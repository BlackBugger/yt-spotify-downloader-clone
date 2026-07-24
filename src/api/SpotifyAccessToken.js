import { setAccessToken } from "../redux/reducers";

export const spotifyAccessToken = async (dispatch) => {
  const clientId = process.env.REACT_APP_ClientID;
  const clientSecret = process.env.REACT_APP_ClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify search is not configured.");
  }

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body:
      "grant_type=client_credentials&client_id=" +
      clientId +
      "&client_secret=" +
      clientSecret,
  });

  if (!result.ok) {
    throw new Error("Spotify search is temporarily unavailable.");
  }

  const data = await result.json();
  dispatch(setAccessToken(data.access_token));
};
