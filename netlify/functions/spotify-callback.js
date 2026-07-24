const { buildCallbackUrl, createSessionCookie, json, parseCookies, spotifyToken, validateState } = require("./spotify-utils");
exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie);
  if (!code || !validateState(cookies.spotify_oauth_state, event.queryStringParameters?.state)) return json(400, { error: "Spotify login could not be verified." });
  try {
    const data = await spotifyToken({ grant_type: "authorization_code", code, redirect_uri: buildCallbackUrl(event) });
    if (!data.refresh_token) throw new Error();
    return { statusCode: 302, headers: { Location: "/" }, multiValueHeaders: { "Set-Cookie": [createSessionCookie(data.refresh_token), "spotify_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"] }, body: "" };
  } catch { return json(502, { error: "Spotify login could not be completed." }); }
};
