const callback = require("../netlify/functions/spotify-callback");
const catalog = require("../netlify/functions/catalog-search");
const convert = require("../netlify/functions/convert-mp3");
const lyrics = require("../netlify/functions/lyrics");
const session = require("../netlify/functions/spotify-session");
const youtube = require("../netlify/functions/youtube-match");
const {
  createConversionGrant,
  downloaderHosts,
  isSafeDownloadUrl,
  resetCatalogTokenCache,
  resetRateLimits,
  validateConversionGrant,
} = require("../netlify/functions/spotify-utils");

beforeEach(() => {
  resetCatalogTokenCache();
  resetRateLimits();
  process.env.SPOTIFY_CLIENT_ID = "test-id";
  process.env.SPOTIFY_CLIENT_SECRET = "test-secret";
  process.env.SPOTIFY_ALLOWED_ORIGINS = "https://preview.example.net";
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: "access", expires_in: 3600, refresh_token: "refresh" }) }));
});

afterEach(() => {
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.SPOTIFY_ALLOWED_ORIGINS;
  delete process.env.RAPIDAPI_DOWNLOAD_HOSTS;
  delete process.env.RAPIDAPI_KEY;
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.CONVERSION_GRANT_SECRET;
});

test("OAuth callback returns separate cookies through Lambda multiValueHeaders", async () => {
  const state = "a".repeat(64);
  const response = await callback.handler({
    httpMethod: "GET",
    headers: { host: "preview.example.net", "x-forwarded-proto": "https", cookie: `spotify_oauth_state=${state}` },
    queryStringParameters: { code: "valid-code", state },
  });
  expect(response.statusCode).toBe(302);
  expect(response.headers.Location).toBe("https://preview.example.net/");
  expect(response.multiValueHeaders["Set-Cookie"]).toHaveLength(2);
  expect(response.headers["Set-Cookie"]).toBeUndefined();
});

test("uses an explicit HTTPS-only download host allowlist", () => {
  process.env.RAPIDAPI_DOWNLOAD_HOSTS = "cdn.example.com, downloads.example.net";
  expect(downloaderHosts("api.example.com")).toEqual(["cdn.example.com", "downloads.example.net"]);
  expect(isSafeDownloadUrl("https://cdn.example.com/song.mp3", downloaderHosts("api.example.com"))).toBe(true);
  expect(isSafeDownloadUrl("https://api.example.com/song.mp3", downloaderHosts("api.example.com"))).toBe(false);
  expect(isSafeDownloadUrl("http://cdn.example.com/song.mp3", downloaderHosts("api.example.com"))).toBe(false);
});

test("session refresh persists a rotated refresh token", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "access", expires_in: 3600, refresh_token: "rotated-refresh" }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "harold", display_name: "Harold" }) });

  const response = await session.handler({ httpMethod: "GET", headers: { cookie: "cruz_spotify_refresh=original" } });

  expect(response.statusCode).toBe(200);
  expect(response.headers["Set-Cookie"]).toMatch(/cruz_spotify_refresh=rotated-refresh/);
  expect(JSON.parse(response.body)).toMatchObject({ authenticated: true, accessToken: "access" });
});

test("invalid refresh credentials clear the session cookie", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 400, headers: { get: () => null }, json: async () => ({ error: "invalid_grant" }) });

  const response = await session.handler({ httpMethod: "GET", headers: { cookie: "cruz_spotify_refresh=expired" } });

  expect(response.statusCode).toBe(401);
  expect(response.headers["Set-Cookie"]).toMatch(/Max-Age=0/);
  expect(JSON.parse(response.body)).toEqual({ authenticated: false });
});

test("transient refresh rate limits preserve the session cookie and retry hint", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 429, headers: { get: (name) => name.toLowerCase() === "retry-after" ? "12" : null }, json: async () => ({ error: "rate_limited" }) });

  const response = await session.handler({ httpMethod: "GET", headers: { cookie: "cruz_spotify_refresh=keep-me" } });

  expect(response.statusCode).toBe(503);
  expect(response.headers["Set-Cookie"]).toBeUndefined();
  expect(response.headers["Retry-After"]).toBe("12");
});

test("YouTube matching issues a short-lived conversion grant", async () => {
  process.env.YOUTUBE_API_KEY = "youtube-key";
  process.env.CONVERSION_GRANT_SECRET = "test-grant-secret-with-enough-entropy";
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [{ id: { videoId: "abcdefghijk" } }] }) });

  const response = await youtube.handler({ httpMethod: "GET", headers: { "x-nf-client-connection-ip": "203.0.113.9" }, queryStringParameters: { q: "SZA Saturn" } });
  const body = JSON.parse(response.body);

  expect(response.statusCode).toBe(200);
  expect(validateConversionGrant(body.videoId, body.conversionGrant)).toBe(true);
});

test("MP3 conversion rejects arbitrary video ids without a valid grant", async () => {
  process.env.RAPIDAPI_KEY = "rapid-key-with-enough-entropy";
  const response = await convert.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "203.0.113.9" }, body: JSON.stringify({ videoId: "abcdefghijk" }) });

  expect(response.statusCode).toBe(403);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("MP3 conversion accepts a matched video grant and validates the download host", async () => {
  process.env.RAPIDAPI_KEY = "rapid-key-with-enough-entropy";
  const grant = createConversionGrant("abcdefghijk");
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ link: "https://youtube-mp36.p.rapidapi.com/song.mp3" }) });

  const response = await convert.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "203.0.113.9" }, body: JSON.stringify({ videoId: "abcdefghijk", conversionGrant: grant }) });

  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body)).toEqual({ downloadUrl: "https://youtube-mp36.p.rapidapi.com/song.mp3" });
});

test("catalog searches reuse a valid Spotify client token", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "catalog-access", expires_in: 3600 }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tracks: { items: [] } }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tracks: { items: [] } }) });
  const event = (q) => ({ httpMethod: "GET", headers: { "x-nf-client-connection-ip": "203.0.113.9" }, queryStringParameters: { q } });

  expect((await catalog.handler(event("SZA"))).statusCode).toBe(200);
  expect((await catalog.handler(event("Drake"))).statusCode).toBe(200);
  const tokenCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes("accounts.spotify.com/api/token"));
  expect(tokenCalls).toHaveLength(1);
});

test("lyrics lookup sends an exact track signature to LRCLIB with client identification", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ([
      {
        trackName: "Neon Sky",
        artistName: "Cruz",
        albumName: "After Dark",
        duration: 410,
        instrumental: false,
        plainLyrics: "Wrong recording",
        syncedLyrics: "[00:01.00]Wrong recording",
      },
      {
        trackName: "Neon Sky",
        artistName: "Cruz",
        albumName: "After Dark",
        duration: 182.8,
        instrumental: false,
        plainLyrics: "A quiet verse",
        syncedLyrics: "[00:01.00]A quiet verse",
      },
    ]),
  });

  const response = await lyrics.handler({
    httpMethod: "GET",
    headers: { "x-nf-client-connection-ip": "203.0.113.9" },
    queryStringParameters: {
      track: "Neon Sky",
      artist: "Cruz",
      album: "After Dark",
      duration: "182",
    },
  });

  expect(response.statusCode).toBe(200);
  expect(global.fetch).toHaveBeenCalledWith(
    expect.objectContaining({
      origin: "https://lrclib.net",
      pathname: "/api/search",
      search: expect.stringContaining("track_name=Neon+Sky"),
    }),
    expect.objectContaining({
      headers: expect.objectContaining({ "User-Agent": expect.stringContaining("CruzAudio") }),
      signal: expect.any(Object),
    }),
  );
  expect(JSON.parse(response.body)).toEqual({
    instrumental: false,
    plainLyrics: "A quiet verse",
    syncedLyrics: "[00:01.00]A quiet verse",
    source: "LRCLIB",
  });
});

test("lyrics lookup rejects incomplete requests without contacting the provider", async () => {
  const response = await lyrics.handler({
    httpMethod: "GET",
    headers: { "x-nf-client-connection-ip": "203.0.113.9" },
    queryStringParameters: { track: "Neon Sky" },
  });

  expect(response.statusCode).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("lyrics lookup translates provider misses into a safe unavailable response", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 404,
    headers: { get: () => null },
    json: async () => ({}),
  });

  const response = await lyrics.handler({
    httpMethod: "GET",
    headers: { "x-nf-client-connection-ip": "203.0.113.9" },
    queryStringParameters: {
      track: "Neon Sky",
      artist: "Cruz",
      album: "After Dark",
      duration: "182",
    },
  });

  expect(response.statusCode).toBe(404);
  expect(JSON.parse(response.body)).toEqual({ error: "Lyrics are not available for this track yet." });
});

test("lyrics lookup treats search results for a different recording as unavailable", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ([{
      trackName: "Neon Sky",
      artistName: "Cruz",
      albumName: "After Dark",
      duration: 420,
      instrumental: false,
      plainLyrics: "Wrong recording",
      syncedLyrics: "[00:01.00]Wrong recording",
    }]),
  });

  const response = await lyrics.handler({
    httpMethod: "GET",
    headers: { "x-nf-client-connection-ip": "203.0.113.9" },
    queryStringParameters: {
      track: "Neon Sky",
      artist: "Cruz",
      album: "After Dark",
      duration: "182",
    },
  });

  expect(response.statusCode).toBe(404);
  expect(JSON.parse(response.body)).toEqual({ error: "Lyrics are not available for this track yet." });
});
