const { clearSessionCookie, json, noStore } = require("./spotify-utils");
exports.handler = async (event) => event.httpMethod !== "POST" ? json(405, { error: "Method not allowed." }, noStore) : json(200, { authenticated: false }, { ...noStore, "Set-Cookie": clearSessionCookie() });
