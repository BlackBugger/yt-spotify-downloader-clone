# Cruz Audio implementation handoff

**Last reconciled by Codex:** 2026-07-30
**Repository:** `BlackBugger/yt-spotify-downloader-clone`
**Local checkout:** `D:/AI-Projects/yt-spotify-downloader-clone`
**Branch:** `agent/cruz-ui-refresh-20260724`
**Draft PR:** https://github.com/BlackBugger/yt-spotify-downloader-clone/pull/1
**Deploy Preview:** https://deploy-preview-1--cruz-yt-mp3.netlify.app/
**Production:** https://cruz-yt-mp3.netlify.app/

Read `AGENTS.md` before using this handoff. Live code, Git state, and deployment state override this document if they diverge.

## Current status

- The dual-mode Spotify/security implementation was committed and pushed by Ody before this reconciliation.
- The Deploy Preview is built from the PR branch, not production.
- Codex completed the remaining local UI resilience, accessibility feedback, popup handling, artwork fallback, player error recovery, functional Library actions, centered transport player, and 390px work described below.
- Netlify built implementation commit `3a2a21dd7f4f2bdf2d12e5d39387e9a8722888e2` successfully, and Codex verified the resulting Deploy Preview in a real connected browser session.
- PR #1 remains a draft. Nothing has been merged to `main` or deployed to production.

## Product contract

Cruz Audio has two independent modes:

1. Public mode requires no account and preserves search → YouTube match → authorized MP3 conversion.
2. Spotify account mode adds login/logout, profile, playlists, saved albums and tracks, save/remove controls, and eligible Spotify Premium browser playback.

## Implemented

- Netlify Functions for catalog search, Spotify OAuth/session/logout, YouTube matching, and RapidAPI conversion.
- Server-side catalog credentials, OAuth code exchange, YouTube key use, and RapidAPI use.
- OAuth state validation, trusted callback-origin handling, secure HttpOnly refresh-token cookie, and memory-only access tokens.
- Public/authenticated mode separation; failed or expired authenticated sessions safely fall back to public mode.
- Functional Library/profile UI with playlist, album, saved-track, artwork, loading, empty, and error states; cards can start Spotify track/context playback, open Spotify, and remove saved tracks.
- Optimistic save/remove controls with rollback and request-order protection.
- Spotify user requests retry once after an expired access token by refreshing the memory-only session; concurrent refreshes are deduplicated.
- Spotify Web Playback SDK single-load and single-player lifecycle, device targeting, token refresh, direct-gesture `activateElement()`, player state, play/pause, previous/next, seeking, elapsed/duration display, normalized errors, and disconnect handling.
- The centered bottom player uses a neon Spotify-inspired treatment and remains usable at exactly 390px.
- The bottom player exposes a synchronized Spotify save/remove heart with optimistic pending state, rollback, and saved-status loading for the current track.
- SDK authentication errors trigger one session refresh, raw token errors are not shown to users, and a healthy player-state event clears stale playback errors.
- OAuth callback redirects are absolute to the trusted app origin, and leftover OAuth query parameters are removed from the browser address bar.
- Node 16-compatible runtime-fetch fallback and Netlify multi-cookie response compatibility.
- Server-side YouTube matching, short-lived conversion grants, rate limits, request timeouts, and HTTPS conversion-link allowlisting.
- Complete public Find → Match → Save guidance, dedicated live regions, `aria-busy`, wrappable errors, and WCAG AA secondary text.
- Catalog status now starts at `Ready`, changes to `Checking` during a search, and reports `Online` only after a successful catalog response.
- YouTube matching opens its placeholder tab directly from the user gesture, avoiding common popup blockers.
- Broken result and library artwork falls back cleanly.
- Spotify SDK autoplay and device-disconnect failures surface visibly.
- A completed search collapses the large hero into a compact top search state and renders matches immediately below it, before the connected Library.
- Result cards use four equal icon-only actions with accessible labels and native tooltips; connected mode keeps them in one aligned row at exactly 390px.
- Retired legacy dashboard components remain unreachable from the active route.

## Validation observed on 2026-07-30

- Complete Jest suite: 8 suites, 68 tests passed, clean output.
- Production CRA build: compiled successfully. Only Node's existing `fs.F_OK` deprecation advisory was emitted.
- All 8 `netlify/functions/*.js` files passed `node --check`.
- Runtime-fetch fallback resolved the bundled `node-fetch` path.
- `git diff --check` passed apart from Git's local LF/CRLF conversion notices.
- A scan of 29 browser source files found zero references to privileged credential variables and zero access/refresh-token storage references.
- Local public-mode 390px inspection: no horizontal overflow or out-of-bounds elements.
- Connected-mode 390px inspection: no horizontal overflow; the authenticated header fit without collision; four 42px track actions fit in one row inside the first result card.
- Deployed-preview connected search for `Marilag`: 12 tracks returned, the large hero collapsed, the compact search remained at the top, and results rendered before the Library.
- Deployed-preview connected Library: 20 playlists, 20 albums, and 20 saved tracks loaded; cards exposed working play, open-in-Spotify, and saved-track removal controls.
- Prior deployed-preview playback regression (unchanged by this layout pass): `Snooze` started from the direct Play gesture; the player reported active playback with previous, pause, next, seek, elapsed-time, and 3:21 duration controls.
- Deployed-preview browser console: no warnings or errors; no visible invalid-token or playback-error alert after search and playback.
- Deployed-preview exact 390px check: no horizontal overflow; results began at the compact hero boundary; all four 42px actions stayed in one row inside the first card; the Library followed the results; and the player heart was present.

## Remaining release gates

1. Keep PR #1 draft until the owner decides the implementation is ready for formal review.
2. Review Spotify policy before commercial streaming use.
3. Do not merge or publish production without a separate explicit instruction.

## Human/external prerequisites

Real Spotify OAuth and playback require Spotify Developer Dashboard and Netlify configuration:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY`
- `RAPIDAPI_KEY`
- `RAPIDAPI_HOST`
- optional `RAPIDAPI_DOWNLOAD_HOSTS`
- optional `CONVERSION_GRANT_SECRET`
- optional `SPOTIFY_ALLOWED_ORIGINS`
- optional `SPOTIFY_REDIRECT_URI`

The exact preview callback URL must be registered in Spotify Developer Dashboard. Never copy or print variable values. Browser playback requires an eligible Spotify Premium account, an allowed Spotify user/app configuration, and a direct user Play gesture. Spotify policy must be reviewed before commercial streaming use.
