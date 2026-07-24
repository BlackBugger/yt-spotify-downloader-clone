# Cruz Audio agent instructions

These instructions apply to the entire repository. Read `docs/CODEX_HANDOFF.md` for the live PR state before reviewing or editing.

## Product boundary

Cruz Audio has two independent modes:

- **Public mode:** no login required; search Spotify's catalog, inspect the closest YouTube match, and request an MP3 only for content the user is authorized to download.
- **Spotify account mode:** login, profile, playlists, saved albums/tracks, heart/save/remove controls, and in-browser Spotify playback when the account is eligible.

Do not make public search/download depend on Spotify login. Preserve the complete public empty state and its Find → Match → Save guidance.

## Design direction

Preserve the current Cruz Audio visual language unless Harold explicitly requests a redesign:

- premium dark, music-focused interface;
- restrained coral-to-lavender accents;
- Manrope display text and DM Sans body text;
- search-first hierarchy and responsive result cards;
- accessible labels/focus, reduced motion, useful loading/error/empty states;
- normal-size secondary text must meet WCAG AA contrast.

## Security and architecture invariants

- Never print, hardcode, commit, screenshot, or disclose credential values.
- Browser code must not reference Spotify client secrets, YouTube API keys, RapidAPI keys, or other privileged credentials.
- Keep catalog exchange, OAuth code exchange, YouTube matching, and MP3 conversion behind Netlify Functions.
- Keep Spotify refresh tokens in `Secure`, `HttpOnly`, `SameSite=Lax` cookies.
- A short-lived Spotify user access token may exist in React memory for the Web Playback SDK; never write it to localStorage or sessionStorage.
- Keep public catalog credentials/tokens separate from authenticated user tokens.
- Validate OAuth state and callback construction. Netlify multi-cookie responses use `multiValueHeaders["Set-Cookie"]`.
- Validate conversion URLs as HTTPS against a server-side allowlist.
- Netlify currently reports an old Node 16 configuration. Functions that call upstream APIs must use the tested runtime-fetch fallback unless a separate, approved Node upgrade lands first.

## Spotify playback completion contract

Do not call playback complete unless all are present:

1. Load the Web Playback SDK once.
2. Create one `Spotify.Player` using the current in-memory token callback.
3. Retain the ready `device_id`.
4. Call `activateElement()` from the user's direct Play action where supported.
5. Start playback against the browser device.
6. Drive now-playing and play/pause from real player state.
7. Handle ready/not-ready and SDK errors.
8. Disconnect on logout/unmount.
9. Refresh the token reference without recreating the player.

Spotify Premium is required for eligible in-browser playback. Library and save controls must remain useful when playback is unavailable.

## Git and deployment rules

- Default branch: `main`.
- Current UI/Spotify branch: `agent/cruz-ui-refresh-20260724`.
- Never commit directly to `main` without Harold's explicit approval.
- Never merge PR #1, publish a deploy, click Publish deploy, or otherwise change production without explicit approval.
- Keep changes scoped and do not overwrite unrelated work.
- A PR-branch push may create a Netlify Deploy Preview; verify the preview before reporting success.

## Engineering workflow

1. Inspect repository status, open PRs, the working diff, and current preview before editing.
2. Use RED → GREEN tests for behavior changes and bug fixes.
3. Run the complete suite: `CI=true npm test -- --watchAll=false`.
4. Run the production build: `CI=true npm run build`.
5. Run `git diff --check` before committing and `git diff --check origin/main...HEAD` after committing.
6. Scan browser source for privileged secret references and storage persistence without printing values.
7. Test the actual Deploy Preview at desktop and exactly 390px mobile.
8. Verify empty search, a real catalog search, overflow, reduced motion, console/runtime/log errors, and failed network requests.
9. Test mock-connected mode at 390px: header controls, four track actions, library states, and now-playing UI.
10. Treat worker summaries as leads; independently inspect and rerun every gate.

Real OAuth/playback requires a registered callback URI and eligible Spotify account. State that prerequisite honestly; do not claim live authentication from mocks.

## Collaboration

- Ody owns integration, final judgment, branch publication, and deployed-preview verification.
- Ragnar may implement code-heavy work.
- Codex should read this file and `docs/CODEX_HANDOFF.md`, reconcile both against the actual diff, and report discrepancies with file/line evidence.
- Unless explicitly assigned implementation, Codex reviews read-only: no edits, commits, pushes, merges, deploys, or production actions.
- If work changes the live status, update `docs/CODEX_HANDOFF.md` with verified evidence and leave unverified items clearly pending.
