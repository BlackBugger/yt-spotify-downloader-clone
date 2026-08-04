const {
  json,
  noStore,
  rateLimitRequest,
  request,
  spotifyCatalogToken,
  validateSearchQuery,
} = require("./spotify-utils");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." }, noStore);
  const checked = validateSearchQuery(event.queryStringParameters?.q);
  if (!checked.valid) return json(400, { error: checked.error }, noStore);
  const rate = rateLimitRequest(event, { scope: "catalog", limit: 30, windowMs: 60_000 });
  if (!rate.allowed) return json(429, { error: "Too many catalog searches. Try again shortly." }, { ...noStore, "Retry-After": String(rate.retryAfter) });
  try {
    const accessToken = await spotifyCatalogToken();
    const url = new URL("https://api.spotify.com/v1/search");
    url.search = new URLSearchParams({ q: checked.value, type: "track", limit: "12" }).toString();
    const response = await request(url, { headers: { Authorization: ["Bearer", accessToken].join(" ") } });
    if (!response.ok) throw new Error("catalog");
    const data = await response.json();
    return json(200, { tracks: data?.tracks?.items || [] }, { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300" });
  } catch (catalogError) {
    const status = catalogError.code === "UPSTREAM_TIMEOUT" ? 504 : 502;
    return json(status, { error: "Catalog is temporarily unavailable." }, noStore);
  }
};
