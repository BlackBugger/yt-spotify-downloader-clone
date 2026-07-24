# Codex handoff — Cruz Audio PR #1

**Last reconciled by Ody:** 2026-07-24
**Repository:** `BlackBugger/yt-spotify-downloader-clone`
**Local checkout:** `D:/AI-Projects/yt-spotify-downloader-clone`
**Branch:** `agent/cruz-ui-refresh-20260724`
**Draft PR:** https://github.com/BlackBugger/yt-spotify-downloader-clone/pull/1
**Deploy Preview:** https://deploy-preview-1--cruz-yt-mp3.netlify.app/
**Production:** https://cruz-yt-mp3.netlify.app/

Read `AGENTS.md` before using this handoff.

## Source-of-truth status

- PR #1 is open and draft.
- Remote PR head remains `d7f1aa6197fb95c2ae2d8405e041b97c42e57313`.
- The existing Netlify preview is healthy but still represents that old remote commit.
- The Spotify/security implementation is currently uncommitted in the local working tree.
- Nothing from this implementation has been pushed, merged, published, or deployed to production.
- Do not use the existing public preview as evidence for the local Spotify implementation.

## Product decision

Keep the public site usable exactly as a no-login search/match/download experience. Add Spotify account mode as an enhancement:

- Spotify login/logout;
- profile/avatar;
- playlists, saved albums, and saved tracks;
- heart/save and remove from library on search results;
- in-browser Spotify playback and real play/pause state where an eligible Premium account permits it.

## Implemented locally

- Netlify Functions for catalog search, Spotify login/callback/session/logout, YouTube matching, and RapidAPI conversion.
- Server-side OAuth code exchange and client-credentials use.
- Secure refresh-token cookie; user access token remains memory-only.
- Browser secret references removed from active frontend flows.
- Public mode no longer shares token state with authenticated Spotify mode.
- Library/profile UI with playlists, albums, saved tracks, artwork, loading, empty, and error states.
- Heart/save/remove behavior on catalog results.
- Web Playback SDK hook with one-player lifecycle, ready device ID, player-state updates, play/pause, mobile `activateElement()`, error handling, and disconnect.
- Session refresh updates the in-memory token without recreating the player.
- Expired authenticated sessions clear back to public mode.
- Complete public Find → Match → Save instructional cards restored.
- Dedicated live/status regions, `aria-busy`, wrappable card errors, secure downloader-host validation, and Netlify multi-cookie response handling.
- Runtime-fetch helper falls back to bundled `node-fetch` when a Netlify runtime lacks global `fetch`.

## Tests observed by Ody after the latest behavior fixes

Targeted checks currently green:

- `CI=true npm test -- --watchAll=false src/hooks/useSpotifyPlayer.test.jsx`
  - 4 tests passed.
- `CI=true npm test -- --watchAll=false src/pages/Home.test.jsx`
  - 10 tests passed with clean output.
- `CI=true npm test -- --watchAll=false src/serverFunctions.test.js`
  - 5 tests passed.

A production CRA build also compiled successfully after the player/session/public-empty-state fixes. It emitted only the existing outdated Browserslist database advisory.

These targeted results are not the final release gate. Netlify-function fallback changes and final CSS/browser fixes still require the complete suite and a new final build.

## Known open work — do not mark complete yet

1. Run the complete Jest suite after all final edits.
2. Add or reconcile regression coverage for saved-track optimistic update rollback and the remaining function paths.
3. Correct remaining WCAG AA failures without changing the design language. Known low colors include the search hint, “Popular now,” and album metadata.
4. Verify/fix connected-mode 390px layout:
   - authenticated header controls must not overflow;
   - four result actions must wrap or use a two-column grid;
   - library tabs/cards and now-playing bar must fit.
5. Syntax-check every Netlify Function and run mocked function probes with and without runtime global `fetch`.
6. Run final security/storage scans without outputting values.
7. Run `git diff --check` on the working tree.
8. Review the complete diff for intentionally retired legacy dashboard components; ensure they are not broken stubs reachable from the app.
9. Commit only after local gates are green, then run the committed-range whitespace check.
10. Push only the PR branch, wait for Netlify, and verify the new deployed preview at desktop and 390px.
11. Update the draft PR body with implementation scope, actual test counts, preview evidence, and human prerequisites.

## Human/external prerequisites

Real Spotify OAuth and playback cannot be claimed until the callback URL is registered in Spotify Developer Dashboard and the server-side Netlify variables are configured:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY`
- `RAPIDAPI_KEY`
- `RAPIDAPI_HOST`
- optional `RAPIDAPI_DOWNLOAD_HOSTS`
- optional `SPOTIFY_REDIRECT_URI`

Never copy or print their values. In-browser Spotify playback requires an eligible Premium plan. Spotify policy must be reviewed before commercial streaming use.

## Codex reconciliation assignment

Perform a **read-only senior frontend/security review** of the current working tree:

1. Read `AGENTS.md` and this file.
2. Inspect `git status`, all tracked and untracked changes, and `git diff` against `HEAD` and `origin/main`.
3. Verify public/authenticated mode separation, OAuth/cookie security, token lifecycle, Netlify runtime compatibility, Spotify SDK device behavior, save/remove behavior, accessibility, and connected mobile layout.
4. Compare actual tests to the open-work list.
5. Report findings in severity order with file/line references.
6. Explicitly flag anything in this handoff that does not match the code.
7. Do not edit files, install dependencies, commit, push, merge, deploy, or expose environment values.

Ody owns integration and will independently verify any suggested correction before publication.
