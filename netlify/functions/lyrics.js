const {
  json,
  noStore,
  rateLimitRequest,
  request,
} = require("./spotify-utils");

const PROVIDER_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const CACHE_LIMIT = 250;
const lyricsCache = new Map();
const cacheableLyrics = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  "Netlify-CDN-Cache-Control": "public, durable, s-maxage=86400, stale-while-revalidate=604800",
};

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

function cacheKey({ track, artist, album, duration }) {
  return [
    normalizedMatch(track),
    normalizedMatch(artist),
    normalizedMatch(album),
    duration,
  ].join("\u001f");
}

function cachedLyrics(key) {
  const cached = lyricsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    lyricsCache.delete(key);
    return null;
  }
  return cached.record;
}

function rememberLyrics(key, record) {
  if (lyricsCache.size >= CACHE_LIMIT) {
    lyricsCache.delete(lyricsCache.keys().next().value);
  }
  lyricsCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    record,
  });
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
  }, cacheableLyrics);
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

async function providerLookup(url, signature, providerHeaders, multiple) {
  try {
    const response = await request(url, { headers: providerHeaders }, PROVIDER_TIMEOUT_MS);
    if (response.status === 429) return { kind: "busy", response };
    if (response.status === 404) return { kind: "miss" };
    if (!response.ok) return { kind: "failure" };

    const payload = await response.json();
    const selected = selectRecording(multiple ? payload : [payload], signature);
    return selected ? { kind: "match", record: selected } : { kind: "miss" };
  } catch (lookupError) {
    return {
      kind: lookupError.code === "UPSTREAM_TIMEOUT" ? "timeout" : "failure",
    };
  }
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
  const signatureKey = cacheKey(signature);
  const cached = cachedLyrics(signatureKey);
  if (cached) return lyricsResponse(cached);

  const providerHeaders = {
    "User-Agent": "CruzAudio/0.1.0 (https://cruz-yt-mp3.netlify.app)",
  };
  const searchUrl = new URL("https://lrclib.net/api/search");
  searchUrl.search = new URLSearchParams({
    track_name: track,
    artist_name: artist,
    album_name: album,
  }).toString();

  const exactUrl = new URL("https://lrclib.net/api/get");
  exactUrl.search = new URLSearchParams({
    track_name: track,
    artist_name: artist,
    album_name: album,
    duration: String(duration),
  }).toString();

  const [searchResult, exactResult] = await Promise.all([
    providerLookup(searchUrl, signature, providerHeaders, true),
    providerLookup(exactUrl, signature, providerHeaders, false),
  ]);

  const selected = exactResult.record || searchResult.record;
  if (selected) {
    rememberLyrics(signatureKey, selected);
    return lyricsResponse(selected);
  }

  const busy = exactResult.kind === "busy" ? exactResult : searchResult;
  if (busy.kind === "busy") return providerBusy(busy.response);

  if (exactResult.kind === "miss" && searchResult.kind !== "timeout") {
    return json(404, { error: "Lyrics are not available for this track yet." }, noStore);
  }

  const timedOut = exactResult.kind === "timeout" || searchResult.kind === "timeout";
  const status = timedOut ? 504 : 502;
  return json(status, {
    error: timedOut
      ? "The lyrics service took too long to respond."
      : "Lyrics are temporarily unavailable.",
  }, noStore);
};

exports.resetLyricsCache = () => lyricsCache.clear();
