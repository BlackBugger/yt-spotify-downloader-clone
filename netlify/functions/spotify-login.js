const crypto = require("crypto");
const { buildCallbackUrl, json, serializeCookie, spotifyCredentials } = require("./spotify-utils");
const scopes = ["user-read-private", "playlist-read-private", "playlist-read-collaborative", "user-library-read", "user-library-modify", "user-read-playback-state", "user-modify-playback-state", "streaming"];
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." });
  const { clientId } = spotifyCredentials();
  if (!clientId) {
    console.error("[spotify-login] unavailable: missing_client_id");
    return json(500, { error: "Spotify login is unavailable." });
  }
  let redirectUri;
  try {
    redirectUri = buildCallbackUrl(event);
  } catch {
    console.error("[spotify-login] unavailable: invalid_callback_configuration");
    return json(500, { error: "Spotify login is unavailable." });
  }
  try {
    const state = crypto.randomBytes(32).toString("hex");
    const auth = new URL("https://accounts.spotify.com/authorize");
    auth.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, scope: scopes.join(" ") }).toString();
    return { statusCode: 302, headers: { Location: auth.toString(), "Set-Cookie": serializeCookie("spotify_oauth_state", state, { Path: "/", "Max-Age": 600, HttpOnly: true, Secure: true, SameSite: "Lax" }) }, body: "" };
  } catch {
    console.error("[spotify-login] unavailable: initialization_failed");
    return json(500, { error: "Spotify login is unavailable." });
  }
};
