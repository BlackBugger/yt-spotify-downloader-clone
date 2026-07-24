const crypto = require("crypto");
const { buildCallbackUrl, json, serializeCookie, spotifyCredentials } = require("./spotify-utils");
const scopes = ["user-read-private", "playlist-read-private", "playlist-read-collaborative", "user-library-read", "user-library-modify", "user-read-playback-state", "user-modify-playback-state", "streaming"];
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." });
  try {
    const { clientId } = spotifyCredentials();
    if (!clientId) throw new Error();
    const state = crypto.randomBytes(32).toString("hex");
    const auth = new URL("https://accounts.spotify.com/authorize");
    auth.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: buildCallbackUrl(event), state, scope: scopes.join(" ") }).toString();
    return { statusCode: 302, headers: { Location: auth.toString(), "Set-Cookie": serializeCookie("spotify_oauth_state", state, { Path: "/", "Max-Age": 600, HttpOnly: true, Secure: true, SameSite: "Lax" }) }, body: "" };
  } catch { return json(500, { error: "Spotify login is unavailable." }); }
};
