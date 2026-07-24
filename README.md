# Cruz Audio

Cruz Audio supports public Spotify catalog search without a Spotify account. Optional Spotify account mode adds profile/library/save controls and requests in-browser playback through Spotify Web Playback SDK-compatible access tokens. In-browser Spotify playback requires Spotify Premium; library and save features remain available if playback cannot be transferred.

## Netlify environment

Set these server-side Netlify variables only:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY`
- `RAPIDAPI_KEY`
- `RAPIDAPI_HOST`
- optional `CONVERSION_GRANT_SECRET` — at least 16 characters, used to sign short-lived conversion grants. If omitted, `RAPIDAPI_KEY` is used as the server-only signing key.
- optional `RAPIDAPI_DOWNLOAD_HOSTS` — comma-separated HTTPS CDN host allowlist for conversion links. If omitted, only `RAPIDAPI_HOST` is accepted; set this for a converter that returns a separate known CDN.
- optional `SPOTIFY_REDIRECT_URI` — an exact HTTPS callback ending in `/.netlify/functions/spotify-callback`
- optional `SPOTIFY_ALLOWED_ORIGINS` — comma-separated trusted HTTPS origins when Netlify's `URL`, `DEPLOY_URL`, and `DEPLOY_PRIME_URL` values are not sufficient

For migration only, functions accept legacy Netlify variable names where documented in their source. Do not create `REACT_APP_*` versions of secrets.

OAuth callback construction accepts only the explicit redirect URI, Netlify's trusted deployment origins, configured allowed origins, or loopback HTTP during local development. It does not trust an arbitrary request `Host` header.

Register each production and preview callback URL used for testing in the Spotify Developer Dashboard before performing real OAuth. Refresh tokens remain in a Secure, HttpOnly, SameSite=Lax cookie; browser access tokens are memory-only.
