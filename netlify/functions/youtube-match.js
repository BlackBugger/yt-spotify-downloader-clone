const {
  createConversionGrant,
  json,
  noStore,
  rateLimitRequest,
  request,
  validateSearchQuery,
} = require("./spotify-utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." }, noStore);
  const checked = validateSearchQuery(event.queryStringParameters?.q);
  if (!checked.valid) return json(400, { error: checked.error }, noStore);
  const rate = rateLimitRequest(event, { scope: "youtube-match", limit: 12, windowMs: 60_000 });
  if (!rate.allowed) return json(429, { error: "Too many YouTube matches. Try again shortly." }, { ...noStore, "Retry-After": String(rate.retryAfter) });
  const key = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;
  if (!key) return json(503, { error: "YouTube matching is unavailable." }, noStore);
  try {
    const url = new URL("https://youtube.googleapis.com/youtube/v3/search");
    url.search = new URLSearchParams({ part: "snippet", maxResults: "1", type: "video", q: checked.value, key }).toString();
    const response = await request(url);
    if (!response.ok) throw new Error("youtube");
    const videoId = (await response.json())?.items?.[0]?.id?.videoId;
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) throw new Error("match");
    let conversionGrant = null;
    try { conversionGrant = createConversionGrant(videoId); } catch { /* YouTube links still work when conversion is disabled. */ }
    return json(200, { videoId, youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`, conversionGrant }, { "Cache-Control": "public, max-age=20, s-maxage=60" });
  } catch (youtubeError) {
    const status = youtubeError.code === "UPSTREAM_TIMEOUT" ? 504 : 502;
    return json(status, { error: "No YouTube match was found." }, noStore);
  }
};
