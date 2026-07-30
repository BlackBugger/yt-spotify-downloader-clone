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

function normalizedMatch(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s,&/+_-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function selectRecording(records, { track, artist, album, duration }) {
  const expectedTrack = normalizedMatch(track);
  const expectedArtist = normalizedMatch(artist);
  const expectedAlbum = normalizedMatch(album);
  return (Array.isArray(records) ? records : [])
    .map((record) => {
      const candidateTrack = normalizedMatch(record?.trackName);
      const candidateArtist = normalizedMatch(record?.artistName);
      const candidateAlbum = normalizedMatch(record?.albumName);
      const durationDifference = Math.abs(Number(record?.duration) - duration);
      const artistMatches = candidateArtist === expectedArtist
        || candidateArtist.includes(expectedArtist)
        || expectedArtist.includes(candidateArtist);
      if (
        candidateTrack !== expectedTrack
        || !candidateArtist
        || !artistMatches
        || !Number.isFinite(durationDifference)
        || durationDifference > 2
      ) return null;
      return {
        record,
        score: durationDifference + (candidateAlbum === expectedAlbum ? 0 : 0.25),
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.score - second.score)[0]?.record;
}

function lyricsResponse(data) {
  return json(200, {
    instrumental: Boolean(data?.instrumental),
    plainLyrics: typeof data?.plainLyrics === "string" ? data.plainLyrics : "",
    syncedLyrics: typeof data?.syncedLyrics === "string" ? data.syncedLyrics : "",
    source: "LRCLIB",
  }, noStore);
}

function providerBusy(response) {
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

  const signature = { track, artist, album, duration };
  const providerHeaders = {
    "User-Agent": "CruzAudio/0.1.0 (https://cruz-yt-mp3.netlify.app)",
  };
  const searchUrl = new URL("https://lrclib.net/api/search");
  searchUrl.search = new URLSearchParams({
    track_name: track,
    artist_name: artist,
    album_name: album,
  }).toString();

  try {
    const searchResponse = await request(searchUrl, { headers: providerHeaders }, 15_000);
    if (searchResponse.status === 429) return providerBusy(searchResponse);
    if (searchResponse.ok) {
      const records = await searchResponse.json();
      const selected = selectRecording(records, signature);
      if (selected) return lyricsResponse(selected);
    }
  } catch {
    // Fall back sequentially to LRCLIB's exact-signature endpoint.
  }

  const exactUrl = new URL("https://lrclib.net/api/get");
  exactUrl.search = new URLSearchParams({
    track_name: track,
    artist_name: artist,
    album_name: album,
    duration: String(duration),
  }).toString();

  try {
    const exactResponse = await request(exactUrl, { headers: providerHeaders }, 15_000);
    if (exactResponse.status === 404) {
      return json(404, { error: "Lyrics are not available for this track yet." }, noStore);
    }
    if (exactResponse.status === 429) return providerBusy(exactResponse);
    if (!exactResponse.ok) throw new Error("lyrics");
    const exactRecord = await exactResponse.json();
    const selected = selectRecording([exactRecord], signature);
    if (!selected) {
      return json(404, { error: "Lyrics are not available for this track yet." }, noStore);
    }
    return lyricsResponse(selected);
  } catch (exactError) {
    const status = exactError.code === "UPSTREAM_TIMEOUT" ? 504 : 502;
    return json(status, {
      error: status === 504
        ? "The lyrics service took too long to respond."
        : "Lyrics are temporarily unavailable.",
    }, noStore);
  }
};
