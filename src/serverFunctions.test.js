const {
  buildCallbackUrl,
  createSessionCookie,
  createConversionGrant,
  isSafeDownloadUrl,
  parseCookies,
  rateLimitRequest,
  request,
  resetRateLimits,
  runtimeFetch,
  validateConversionGrant,
  validateSearchQuery,
  validateState,
} = require("../netlify/functions/spotify-utils");

beforeEach(() => resetRateLimits());

test("validates public catalog search input", () => {
  expect(validateSearchQuery("   ")).toEqual({ valid: false, error: "A search query is required." });
  expect(validateSearchQuery("x".repeat(201)).valid).toBe(false);
  expect(validateSearchQuery("SZA")).toEqual({ valid: true, value: "SZA" });
});

test("constructs a callback only from a trusted deployment origin", () => {
  process.env.SPOTIFY_ALLOWED_ORIGINS = "https://preview.example.net";
  try {
    expect(buildCallbackUrl({ headers: { host: "preview.example.net", "x-forwarded-proto": "https" } })).toBe("https://preview.example.net/.netlify/functions/spotify-callback");
    expect(() => buildCallbackUrl({ headers: { host: "attacker.example.net", "x-forwarded-proto": "https" } })).toThrow("Untrusted callback origin");
  } finally {
    delete process.env.SPOTIFY_ALLOWED_ORIGINS;
  }
});

test("constructs a deploy-preview callback from runtime-supported Netlify metadata", () => {
  process.env.SITE_NAME = "cruz-yt-mp3";
  try {
    expect(buildCallbackUrl({ headers: { host: "deploy-preview-1--cruz-yt-mp3.netlify.app", "x-forwarded-proto": "https" } })).toBe("https://deploy-preview-1--cruz-yt-mp3.netlify.app/.netlify/functions/spotify-callback");
    expect(() => buildCallbackUrl({ headers: { host: "deploy-preview-1--another-site.netlify.app", "x-forwarded-proto": "https" } })).toThrow("Untrusted callback origin");
    expect(() => buildCallbackUrl({ headers: { host: "attacker.example.net", "x-forwarded-proto": "https" } })).toThrow("Untrusted callback origin");
  } finally {
    delete process.env.SITE_NAME;
  }
});

test("creates a secure httpOnly refresh cookie and validates oauth state", () => {
  const cookie = createSessionCookie("refresh-token");
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/Secure/);
  expect(cookie).toMatch(/SameSite=Lax/);
  const state = "a".repeat(64);
  expect(parseCookies(`spotify_oauth_state=${state}`).spotify_oauth_state).toBe(state);
  expect(validateState(state, state)).toBe(true);
  expect(validateState(state, "b".repeat(64))).toBe(false);
  expect(validateState("é", "a")).toBe(false);
  expect(() => parseCookies("cruz_spotify_refresh=%E0%A4%A")).not.toThrow();
});

test("falls back to bundled node-fetch when the function runtime has no global fetch", async () => {
  const fallback = jest.fn(async () => ({ ok: true }));
  const request = runtimeFetch(undefined, async () => ({ default: fallback }));

  const response = await request("https://example.com/api");

  expect(response.ok).toBe(true);
  expect(fallback).toHaveBeenCalledWith("https://example.com/api");
});

test("accepts only HTTPS downloader links from the configured service", () => {
  expect(isSafeDownloadUrl("https://safe.example/download.mp3", ["safe.example"])).toBe(true);
  expect(isSafeDownloadUrl("javascript:alert(1)", ["safe.example"])).toBe(false);
  expect(isSafeDownloadUrl("https://evil.example/download.mp3", ["safe.example"])).toBe(false);
});

test("aborts upstream requests after the configured timeout", async () => {
  jest.useFakeTimers();
  const originalFetch = global.fetch;
  global.fetch = jest.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  }));
  try {
    const pending = request("https://example.com/slow", {}, 25);
    jest.advanceTimersByTime(25);
    await expect(pending).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });
  } finally {
    global.fetch = originalFetch;
    jest.useRealTimers();
  }
});

test("creates short-lived conversion grants bound to one video", () => {
  process.env.CONVERSION_GRANT_SECRET = "test-grant-secret-with-enough-entropy";
  try {
    const grant = createConversionGrant("abcdefghijk", 1_700_000_000_000);
    expect(validateConversionGrant("abcdefghijk", grant, 1_700_000_100_000)).toBe(true);
    expect(validateConversionGrant("zzzzzzzzzzz", grant, 1_700_000_100_000)).toBe(false);
    expect(validateConversionGrant("abcdefghijk", grant, 1_700_000_400_000)).toBe(false);
  } finally {
    delete process.env.CONVERSION_GRANT_SECRET;
  }
});

test("throttles repeated requests within a bounded client window", () => {
  const event = { headers: { "x-nf-client-connection-ip": "203.0.113.8" } };
  const options = { scope: "conversion", limit: 2, windowMs: 60_000 };
  expect(rateLimitRequest(event, options, 1_000).allowed).toBe(true);
  expect(rateLimitRequest(event, options, 2_000).allowed).toBe(true);
  const limited = rateLimitRequest(event, options, 3_000);
  expect(limited.allowed).toBe(false);
  expect(limited.retryAfter).toBeGreaterThan(0);
});
