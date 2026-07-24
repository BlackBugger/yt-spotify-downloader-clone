const { clearSessionCookie, createSessionCookie, json, noStore, parseCookies, request, spotifyToken } = require("./spotify-utils");
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." }, noStore);
  const refreshToken = parseCookies(event.headers?.cookie || event.headers?.Cookie).cruz_spotify_refresh;
  if (!refreshToken) return json(200, { authenticated: false }, noStore);
  let token;
  try {
    token = await spotifyToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  } catch (tokenError) {
    if (tokenError.upstreamCode === "invalid_grant") return json(401, { authenticated: false }, { ...noStore, "Set-Cookie": clearSessionCookie() });
    return json(503, { error: "Spotify session refresh is temporarily unavailable." }, { ...noStore, ...(tokenError.retryAfter ? { "Retry-After": tokenError.retryAfter } : {}) });
  }
  try {
    const response = await request("https://api.spotify.com/v1/me", { headers: { Authorization: ["Bearer", token.access_token].join(" ") } });
    if (!response.ok) {
      const retryAfter = response.headers?.get?.("retry-after");
      return json(response.status === 429 ? 503 : 502, { error: "Spotify profile is temporarily unavailable." }, { ...noStore, ...(/^\d{1,5}$/.test(retryAfter || "") ? { "Retry-After": retryAfter } : {}) });
    }
    return json(200, { authenticated: true, accessToken: token.access_token, expiresIn: token.expires_in, profile: await response.json() }, { ...noStore, ...(token.refresh_token ? { "Set-Cookie": createSessionCookie(token.refresh_token) } : {}) });
  } catch {
    return json(502, { error: "Spotify profile is temporarily unavailable." }, noStore);
  }
};
