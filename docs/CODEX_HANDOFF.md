# Cruz Audio implementation handoff

**Last reconciled by Codex:** 2026-07-29
**Repository:** `BlackBugger/yt-spotify-downloader-clone`
**Local checkout:** `D:/AI-Projects/yt-spotify-downloader-clone`
**Branch:** `agent/cruz-ui-refresh-20260724`
**Draft PR:** https://github.com/BlackBugger/yt-spotify-downloader-clone/pull/1
**Deploy Preview:** https://deploy-preview-1--cruz-yt-mp3.netlify.app/
**Production:** https://cruz-yt-mp3.netlify.app/

Read `AGENTS.md` before using this handoff. Live code, Git state, and deployment state override this document if they diverge.

## Current status

- The dual-mode Spotify/security implementation was committed and pushed by Ody before this reconciliation.
- The existing Deploy Preview is built from the PR branch, not production.
- Codex completed the remaining local UI resilience, accessibility feedback, popup handling, artwork fallback, player error recovery, functional Library actions, centered transport player, and 390px work described below.
- The final branch commit and Netlify rebuild still need to be confirmed before treating the public preview as evidence for these last changes.
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
- SDK authentication errors trigger one session refresh, raw token errors are not shown to users, and a healthy player-state event clears stale playback errors.
- OAuth callback redirects are absolute to the trusted app origin, and leftover OAuth query parameters are removed from the browser address bar.
- Node 16-compatible runtime-fetch fallback and Netlify multi-cookie response compatibility.
- Server-side YouTube matching, short-lived conversion grants, rate limits, request timeouts, and HTTPS conversion-link allowlisting.
- Complete public Find → Match → Save guidance, dedicated live regions, `aria-busy`, wrappable errors, and WCAG AA secondary text.
- Catalog status now starts at `Ready`, changes to `Checking` during a search, and reports `Online` only after a successful catalog response.
- YouTube matching opens its placeholder tab directly from the user gesture, avoiding common popup blockers.
- Broken result and library artwork falls back cleanly.
- Spotify SDK autoplay and device-disconnect failures surface visibly.
- Connected mode at exactly 390px keeps the brand and controls separated, hides only the redundant visual catalog label, and lays four track actions out as a two-column grid.
- Retired legacy dashboard components remain unreachable from the active route.

## Validation observed on 2026-07-29

- Complete Jest suite: 8 suites, 63 tests passed, clean output.
- Production CRA build: compiled successfully. Only Node's existing `fs.F_OK` deprecation advisory was emitted.
- All 8 `netlify/functions/*.js` files passed `node --check`.
- Runtime-fetch fallback resolved the bundled `node-fetch` path.
- `git diff --check` passed apart from Git's local LF/CRLF conversion notices.
- A scan of 29 browser source files found zero references to privileged credential variables and zero access/refresh-token storage references.
- Local public-mode 390px inspection: no horizontal overflow or out-of-bounds elements.
- Local connected-mode 390px inspection: no horizontal overflow; brand/control gap 68px; four track actions fit in two rows inside the first result card.

## Remaining release gates

1. Confirm the current `agent/cruz-ui-refresh-20260724` head is pushed without including unrelated files.
2. Wait for Netlify to build the pushed commit.
3. Verify the deployed preview at desktop and exactly 390px; do not use a stale preview as evidence.
4. Confirm the public catalog flow against configured preview variables.
5. Update the draft PR description with the final scope and observed validation.
6. Keep PR #1 draft until real Spotify OAuth/playback prerequisites are satisfied or explicitly deferred.
7. Do not merge or publish production without a separate explicit instruction.

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
