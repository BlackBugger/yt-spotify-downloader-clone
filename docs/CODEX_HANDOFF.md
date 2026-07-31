# Tunevera implementation handoff

**Last reconciled by Codex:** 2026-07-31
**Repository:** `BlackBugger/yt-spotify-downloader-clone`
**Local checkout:** `D:/AI-Projects/yt-spotify-downloader-clone`
**Branch:** `agent/cruz-ui-refresh-20260724`
**Draft PR:** https://github.com/BlackBugger/yt-spotify-downloader-clone/pull/1
**Working staging site:** https://tunevera.netlify.app/
**Deploy Preview:** https://deploy-preview-1--cruz-yt-mp3.netlify.app/
**Legacy production:** https://cruz-yt-mp3.netlify.app/

Read `AGENTS.md` before using this handoff. Live code, Git state, and deployment state override this document if they diverge.

## Current status

- The dual-mode Spotify/security implementation was committed and pushed by Ody before this reconciliation.
- The Deploy Preview is built from the PR branch, not production.
- Codex completed the remaining local UI resilience, accessibility feedback, popup handling, artwork fallback, player error recovery, functional Library actions, centered transport player, and 390px work described below.
- Codex committed and pushed the accessible bottom-player volume slider in `d7d631bdd057d6b40161ac5af676254c20aca3e6`. GitHub's Netlify check succeeded, and the Deploy Preview bundle was verified to contain both the visible volume control and targeted Spotify Connect volume handling.
- Netlify built interactive-lyrics implementation `c471ecbed246694a9686ee3aeaba0578a4591fd4` successfully, and Codex verified the resulting Deploy Preview in a real connected browser session.
- Codex pushed lyrics reliability commits `90446b9385878b2e22a31a4d9067860c43186968` and `c2b2864000d0d4c359065c49ccd6856184319bbe`. Netlify's Deploy Preview checks succeeded.
- PR #1 remains a draft. Nothing has been merged to `main` or deployed to production.

## Product contract

Tunevera has two independent modes:

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
- The bottom player exposes the active output's volume with an accessible percentage slider. Browser playback uses the existing Web Playback SDK player's `getVolume()`/`setVolume()` methods without recreating the player; selected Spotify Connect outputs use the targeted Web API volume endpoint and respect `supports_volume`.
- The bottom player exposes a synchronized Spotify save/remove heart with optimistic pending state, rollback, and saved-status loading for the current track.
- The bottom player exposes a dedicated microphone shortcut that focuses and scrolls to the active track's Lyrics section.
- The Lyrics section matches the exact track, artist, album, and duration through a rate-limited server-side LRCLIB lookup. Search and exact-signature requests run concurrently with a five-second provider timeout; exact successful matches use a bounded six-hour warm-function cache, five-minute browser cache, and Netlify durable CDN cache. Errors and misses are never cached, and no browser credential or new secret is required.
- Synchronized lyrics highlight and follow the current line, expose timestamped tap-to-seek controls through the existing browser/remote playback target, and allow follow mode to be toggled.
- Untimed, instrumental, loading, unavailable, retry, provider-credit, and artwork-fallback states remain contained within the dedicated Lyrics region.
- Lyrics request ordering prevents a late response for an older track or logged-out session from replacing the current state. Auto-follow scrolls only the lyric viewport and does not move the surrounding page.
- The bottom player includes an accessible Spotify Connect-style device picker that refreshes the account's current output list, marks active/restricted states, and transfers playback without persisting device IDs.
- A selected remote output remains the target for later track/context Play, play/pause, previous/next, and seek actions instead of pulling playback back to the browser. Switching back to the browser still invokes `activateElement()` from the direct device-selection gesture.
- Device-list and transfer responses are invalidated on logout/unmount, missing device IDs are ignored, restricted devices are disabled, and transfer failures remain in the open picker with a retryable error.
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

- Complete Jest suite: 10 suites, 85 tests passed, clean output.
- Local volume-control regression after the deployed-preview validation: 10 suites, 86 tests passed, clean output.
- Lyrics concurrency and cache regression: 10 suites, 88 tests passed, clean output.
- Production CRA build: compiled successfully. Only Node's existing `fs.F_OK` deprecation advisory was emitted.
- The local volume-control production build compiled successfully using the repository's documented Windows ESLint-cache workaround. Only Node's existing `fs.F_OK` deprecation advisory was emitted.
- All 9 `netlify/functions/*.js` files passed `node --check`.
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
- Deployed-preview connected device picker: three current Spotify outputs loaded successfully, including a TV and browser devices; no output was selected during read-only visual QA.
- Deployed-preview exact 390px device-picker check: no horizontal overflow; the 353px drop-up stayed inside the viewport above the player; all five transport actions rendered as 44px targets in one row; and the player remained fully visible.
- Device transfer and remote-target transport were verified through regression tests rather than changing the owner's real playback destination.
- Deployed-preview `Marilag` lyrics lookup returned both synchronized and plain LRCLIB lyrics for the exact 2:37 recording.
- A later live `Marilag` probe reached the updated fail-fast path but LRCLIB timed out upstream: the preview returned a safe 504 in 6.47 seconds including Netlify overhead. This confirms the former sequential wait is gone, but it also confirms that uncached first-time lyrics still depend on LRCLIB availability.
- Live browser playback advanced the active lyric line; selecting a later timestamp sought the existing Spotify player; Follow could be disabled and re-enabled; and the player microphone shortcut focused `#spotify-lyrics`.
- Deployed-preview exact 390px lyrics check: 390px CSS viewport, no horizontal overflow, a 351px Lyrics panel inside the viewport, and six 44px transport targets in one row.
- Local connected-mode volume QA at exactly 390px: the 355px by 214px player stayed inside the viewport; all six transport controls remained 44px targets; the enabled 257px volume range showed the SDK's 65% value; no page element crossed the viewport boundary; and browser diagnostics contained no warnings or errors.
- Browser and remote-output volume routing, rollback, percentage state, and single-player preservation were verified through regression tests rather than changing the owner's real Spotify volume.
- Auto-follow remained anchored with the Lyrics section 24px from the viewport top while the active line advanced; only the internal lyric list scrolled.
- The live empty-search error remained available, and browser diagnostics contained no console warnings or errors after search, playback, lyrics loading, seeking, follow toggling, and responsive checks.

## Remaining release gates

1. Keep PR #1 draft until the owner decides the implementation is ready for formal review.
2. For production-grade lyrics availability, select and license a second provider such as Musixmatch, obtain its server-side API credential, and add an exact-recording fallback. Spotify's public Web API does not expose the lyrics shown in Spotify's own clients.
3. Review Spotify policy before commercial streaming use.
4. Do not merge or publish production without a separate explicit instruction.

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
