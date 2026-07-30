import { spotifyUserRequest } from "./spotifyUserRequest";

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test("uses the current in-memory Spotify access token", async () => {
  fetch.mockResolvedValue({ ok: true, status: 200 });

  await spotifyUserRequest(
    "https://api.spotify.com/v1/me/playlists",
    { headers: { Accept: "application/json" } },
    { getAccessToken: () => "current-token", refreshAccessToken: jest.fn() },
  );

  expect(fetch).toHaveBeenCalledWith(
    "https://api.spotify.com/v1/me/playlists",
    expect.objectContaining({
      headers: {
        Accept: "application/json",
        Authorization: "Bearer current-token",
      },
    }),
  );
});

test("refreshes and retries once when Spotify rejects an expired token", async () => {
  const refreshAccessToken = jest.fn().mockResolvedValue({ accessToken: "fresh-token" });
  fetch
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValueOnce({ ok: true, status: 200 });

  const response = await spotifyUserRequest(
    "https://api.spotify.com/v1/me/tracks",
    undefined,
    { getAccessToken: () => "expired-token", refreshAccessToken },
  );

  expect(response.ok).toBe(true);
  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "https://api.spotify.com/v1/me/tracks",
    expect.objectContaining({
      headers: { Authorization: "Bearer fresh-token" },
    }),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("does not retry non-authentication failures", async () => {
  const refreshAccessToken = jest.fn();
  fetch.mockResolvedValue({ ok: false, status: 403 });

  await spotifyUserRequest(
    "https://api.spotify.com/v1/me/tracks",
    undefined,
    { getAccessToken: () => "current-token", refreshAccessToken },
  );

  expect(refreshAccessToken).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("does not repeat a rejected request when session refresh fails", async () => {
  const rejected = { ok: false, status: 401 };
  fetch.mockResolvedValue(rejected);

  const response = await spotifyUserRequest(
    "https://api.spotify.com/v1/me/tracks",
    undefined,
    {
      getAccessToken: () => "expired-token",
      refreshAccessToken: jest.fn().mockResolvedValue(null),
    },
  );

  expect(response).toBe(rejected);
  expect(fetch).toHaveBeenCalledTimes(1);
});
