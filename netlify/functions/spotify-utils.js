const crypto = require("crypto");

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const noStore = { "Cache-Control": "no-store, max-age=0" };

function runtimeFetch(availableFetch, importer = () => import("node-fetch")) {
  const implementation = arguments.length === 0 ? globalThis.fetch : availableFetch;
  return (...args) => {
    if (typeof implementation === "function") return implementation(...args);
    return importer().then(({ default: fetchImplementation }) => fetchImplementation(...args));
  };
}

async function request(input, options = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await runtimeFetch()(input, { ...options, signal: controller.signal });
  } catch (requestError) {
    if (controller.signal.aborted) {
      const timeoutError = new Error("Upstream request timed out.");
      timeoutError.code = "UPSTREAM_TIMEOUT";
      throw timeoutError;
    }
    throw requestError;
  } finally {
    clearTimeout(timer);
  }
}

const requestWindows = new Map();

function clientAddress(event = {}) {
  const headers = event.headers || {};
  const direct = headers["x-nf-client-connection-ip"] || headers["X-Nf-Client-Connection-Ip"];
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  return String(direct || forwarded || "unknown").split(",")[0].trim().slice(0, 64) || "unknown";
}

function rateLimitRequest(event, { scope, limit, windowMs }, now = Date.now()) {
  const key = `${scope}:${clientAddress(event)}`;
  const existing = requestWindows.get(key);
  const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  entry.count += 1;
  requestWindows.set(key, entry);
  if (requestWindows.size > 5_000) {
    for (const [storedKey, stored] of requestWindows) {
      if (stored.resetAt <= now || requestWindows.size > 5_000) requestWindows.delete(storedKey);
      if (requestWindows.size <= 5_000) break;
    }
  }
  return {
    allowed: entry.count <= limit,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

function resetRateLimits() { requestWindows.clear(); }

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, item) => {
    const [name, ...value] = item.trim().split("=");
    if (name) {
      try { cookies[name] = decodeURIComponent(value.join("=")); }
      catch { /* Ignore malformed cookie values. */ }
    }
    return cookies;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const settings = Object.entries(options).flatMap(([key, setting]) => {
    if (setting === true) return [key];
    if (setting === false || setting === undefined) return [];
    return [`${key}=${setting}`];
  });
  return [`${name}=${encodeURIComponent(value)}`, ...settings].join("; ");
}

function createSessionCookie(refreshToken) {
  return serializeCookie("cruz_spotify_refresh", refreshToken, {
    Path: "/",
    "Max-Age": 60 * 60 * 24 * 30,
    HttpOnly: true,
    Secure: true,
    SameSite: "Lax",
  });
}

function clearSessionCookie() {
  return serializeCookie("cruz_spotify_refresh", "", { Path: "/", "Max-Age": 0, HttpOnly: true, Secure: true, SameSite: "Lax" });
}

function trustedOrigin(value) {
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function buildCallbackUrl(event) {
  if (process.env.SPOTIFY_REDIRECT_URI) {
    const explicit = new URL(process.env.SPOTIFY_REDIRECT_URI);
    const origin = trustedOrigin(explicit.origin);
    if (!origin || explicit.pathname !== "/.netlify/functions/spotify-callback" || explicit.search || explicit.hash) throw new Error("Invalid Spotify redirect URI.");
    return `${origin}/.netlify/functions/spotify-callback`;
  }
  const headers = event.headers || {};
  const host = headers.host || headers.Host;
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error("Missing trusted host.");
  const proto = (headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"] || "https").split(",")[0].trim().toLowerCase();
  if (proto !== "https" && proto !== "http") throw new Error("Invalid protocol.");
  const origin = trustedOrigin(`${proto}://${host}`);
  const configured = [process.env.URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL, ...(process.env.SPOTIFY_ALLOWED_ORIGINS || "").split(",")]
    .map((value) => trustedOrigin((value || "").trim()))
    .filter(Boolean);
  const local = origin && (new URL(origin).hostname === "localhost" || new URL(origin).hostname === "127.0.0.1");
  if (!origin || (!local && !configured.includes(origin))) throw new Error("Untrusted callback origin.");
  return `${origin}/.netlify/functions/spotify-callback`;
}

function validateSearchQuery(query) {
  const value = typeof query === "string" ? query.trim() : "";
  if (!value) return { valid: false, error: "A search query is required." };
  if (value.length > 200) return { valid: false, error: "Search queries must be 200 characters or fewer." };
  return { valid: true, value };
}

function validateState(expected, received) {
  if (!/^[a-f0-9]{64}$/i.test(expected || "") || !/^[a-f0-9]{64}$/i.test(received || "")) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function conversionGrantSecret() {
  const secret = process.env.CONVERSION_GRANT_SECRET || process.env.RAPIDAPI_KEY || process.env.REACT_APP_API_KEY || "";
  return secret.length >= 16 ? secret : "";
}

function grantSignature(videoId, expiresAt, secret) {
  return crypto.createHmac("sha256", secret)
    .update(`${videoId}.${expiresAt}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createConversionGrant(videoId, now = Date.now()) {
  const secret = conversionGrantSecret();
  if (!secret || !/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) throw new Error("Conversion grants are unavailable.");
  const expiresAt = Math.floor(now / 1_000) + 300;
  return `${expiresAt}.${grantSignature(videoId, expiresAt, secret)}`;
}

function validateConversionGrant(videoId, grant, now = Date.now()) {
  const secret = conversionGrantSecret();
  const matched = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(grant || "");
  if (!secret || !/^[A-Za-z0-9_-]{11}$/.test(videoId || "") || !matched) return false;
  const expiresAt = Number(matched[1]);
  const nowSeconds = Math.floor(now / 1_000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < nowSeconds || expiresAt > nowSeconds + 300) return false;
  const expected = Buffer.from(grantSignature(videoId, expiresAt, secret), "utf8");
  const received = Buffer.from(matched[2], "utf8");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function isSafeDownloadUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function downloaderHosts(apiHost) {
  const configured = (process.env.RAPIDAPI_DOWNLOAD_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/i.test(host));
  return configured.length ? [...new Set(configured)] : [apiHost.toLowerCase()];
}

function spotifyCredentials() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID || process.env.REACT_APP_ClientID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || process.env.REACT_APP_ClientSecret,
  };
}

async function spotifyToken(params) {
  const { clientId, clientSecret } = spotifyCredentials();
  if (!clientId || !clientSecret) throw new Error("Spotify is not configured.");
  const response = await request("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: ["Basic", Buffer.from(`${clientId}:${clientSecret}`).toString("base64")].join(" "),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error("Spotify authorization failed.");
    error.upstreamStatus = response.status;
    error.upstreamCode = data.error;
    const retryAfter = response.headers?.get?.("retry-after");
    if (/^\d{1,5}$/.test(retryAfter || "")) error.retryAfter = retryAfter;
    throw error;
  }
  const data = await response.json();
  if (!data?.access_token) throw new Error("Spotify authorization returned an invalid response.");
  return data;
}

let catalogTokenCache = { key: "", accessToken: "", expiresAt: 0 };

async function spotifyCatalogToken(now = Date.now()) {
  const { clientId, clientSecret } = spotifyCredentials();
  const key = crypto.createHash("sha256").update(`${clientId || ""}:${clientSecret || ""}`).digest("hex");
  if (catalogTokenCache.key === key && catalogTokenCache.accessToken && catalogTokenCache.expiresAt > now + 60_000) return catalogTokenCache.accessToken;
  const token = await spotifyToken({ grant_type: "client_credentials" });
  catalogTokenCache = {
    key,
    accessToken: token.access_token,
    expiresAt: now + Math.max(60, Number(token.expires_in || 3600)) * 1_000,
  };
  return catalogTokenCache.accessToken;
}

function resetCatalogTokenCache() { catalogTokenCache = { key: "", accessToken: "", expiresAt: 0 }; }

module.exports = {
  buildCallbackUrl,
  clearSessionCookie,
  createConversionGrant,
  createSessionCookie,
  downloaderHosts,
  isSafeDownloadUrl,
  json,
  noStore,
  parseCookies,
  rateLimitRequest,
  request,
  resetCatalogTokenCache,
  resetRateLimits,
  runtimeFetch,
  serializeCookie,
  spotifyCatalogToken,
  spotifyCredentials,
  spotifyToken,
  validateConversionGrant,
  validateSearchQuery,
  validateState,
};
