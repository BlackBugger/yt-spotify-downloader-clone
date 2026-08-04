// Catalog credentials are intentionally server-only. Public search uses
// /.netlify/functions/catalog-search; this export remains for legacy imports.
export const spotifyAccessToken = async () => {
  throw new Error("Use the server-side catalog search function.");
};
