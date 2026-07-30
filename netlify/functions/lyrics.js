const {
  json,
  noStore,
  rateLimitRequest,
  request,
} = require("./spotify-utils");

function requiredText(value, maximum) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maximum) return "";
  return normalized;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." }, noStore);

  const parameters = event.queryStringParameters || {};
  const track = requiredText(parameters.track, 200);
  const artist = requiredText(parameters.artist, 300);
  const album = requiredText(parameters.album, 300);
  const duration = Number(parameters.duration);
  if (!track || !artist || !album || !Number.isInteger(duration) || duration < 1 || duration > 7_200) {
    return json(400, { error: "A valid track, artist, album, and duration are required." }, noStore);
  }

  const rate = rateLimitRequest(event, { scope: "lyrics", limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return json(
      429,
      { error: "Too many lyrics requests. Try again shortly." },
      { ...noStore, "Retry-After": String(rate.retryAfter) },
    );
  }

  const url = new URL("https://lrclib.net/api/get");
  url.search = new URLSearchParams({
    track_name: track,
    artist_name: artist,
    album_name: album,
    duration: String(duration),
  }).toString();

  try {
    const response = await request(url, {
      headers: {
        "User-Agent": "CruzAudio/0.1.0 (https://cruz-yt-mp3.netlify.app)",
      },
    });
    if (response.status === 404) {
      return json(404, { error: "Lyrics are not available for this track yet." }, noStore);
    }
    if (response.status === 429) {
      const retryAfter = response.headers?.get?.("retry-after");
      return json(
        503,
        { error: "The lyrics service is busy. Try again shortly." },
        {
          ...noStore,
          ...(/^\d{1,5}$/.test(retryAfter || "") ? { "Retry-After": retryAfter } : {}),
        },
      );
    }
    if (!response.ok) throw new Error("lyrics");
    const data = await response.json();
    return json(200, {
      instrumental: Boolean(data?.instrumental),
      plainLyrics: typeof data?.plainLyrics === "string" ? data.plainLyrics : "",
      syncedLyrics: typeof data?.syncedLyrics === "string" ? data.syncedLyrics : "",
      source: "LRCLIB",
    }, noStore);
  } catch (lyricsError) {
    const status = lyricsError.code === "UPSTREAM_TIMEOUT" ? 504 : 502;
    return json(status, {
      error: status === 504
        ? "The lyrics service took too long to respond."
        : "Lyrics are temporarily unavailable.",
    }, noStore);
  }
};
