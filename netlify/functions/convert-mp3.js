const {
  downloaderHosts,
  isSafeDownloadUrl,
  json,
  noStore,
  rateLimitRequest,
  request,
  validateConversionGrant,
} = require("./spotify-utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." }, noStore);
  const rawBody = event.body || "";
  if (Buffer.byteLength(rawBody, "utf8") > 1_024) return json(413, { error: "Request is too large." }, noStore);
  let videoId;
  let conversionGrant;
  try {
    ({ videoId, conversionGrant } = JSON.parse(rawBody || "{}"));
  } catch {
    return json(400, { error: "Invalid request." }, noStore);
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) return json(400, { error: "Invalid video id." }, noStore);
  if (!validateConversionGrant(videoId, conversionGrant)) return json(403, { error: "A fresh YouTube match is required before conversion." }, noStore);
  const rate = rateLimitRequest(event, { scope: "convert-mp3", limit: 5, windowMs: 10 * 60_000 });
  if (!rate.allowed) return json(429, { error: "Too many conversions. Try again later." }, { ...noStore, "Retry-After": String(rate.retryAfter) });
  const key = process.env.RAPIDAPI_KEY || process.env.REACT_APP_API_KEY;
  const host = process.env.RAPIDAPI_HOST || "youtube-mp36.p.rapidapi.com";
  if (!key || !/^[a-z0-9.-]+$/i.test(host)) return json(503, { error: "MP3 conversion is unavailable." }, noStore);
  try {
    const response = await request(`https://${host}/dl?id=${encodeURIComponent(videoId)}`, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host } });
    if (!response.ok) throw new Error("conversion");
    const link = (await response.json())?.link;
    if (!isSafeDownloadUrl(link, downloaderHosts(host))) throw new Error("download");
    return json(200, { downloadUrl: link }, noStore);
  } catch (conversionError) {
    const status = conversionError.code === "UPSTREAM_TIMEOUT" ? 504 : 502;
    return json(status, { error: "The download is not ready. Try again." }, noStore);
  }
};
