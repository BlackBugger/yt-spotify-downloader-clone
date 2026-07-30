function withAuthorization(options, accessToken) {
  return {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function spotifyUserRequest(
  url,
  options,
  { getAccessToken, refreshAccessToken },
) {
  const initialToken = getAccessToken();
  if (!initialToken) throw new Error("Spotify is not connected.");

  const response = await fetch(url, withAuthorization(options, initialToken));
  if (response.status !== 401) return response;

  const refreshedSession = await refreshAccessToken();
  const refreshedToken = refreshedSession?.accessToken;
  if (!refreshedToken) return response;

  return fetch(url, withAuthorization(options, refreshedToken));
}
