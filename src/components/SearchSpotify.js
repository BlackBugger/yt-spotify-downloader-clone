import { setTrack } from "../redux/reducers";
import { store } from "../redux/store";

export const searchSpotify = async (dispatch, query) => {
  const accessToken = store.getState().accessToken.accessToken;
  const searchInput = query || store.getState().searchInput.searchInput;

  if (!accessToken) {
    throw new Error("Search is still getting ready. Please try again in a moment.");
  }

  const response = await fetch(
    "https://api.spotify.com/v1/search?q=" +
      encodeURIComponent(searchInput.trim()) +
      "&type=track&limit=12",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  if (!response.ok) {
    throw new Error("We couldn't complete that search. Please try again.");
  }

  const data = await response.json();
  const tracks = data?.tracks?.items || [];
  dispatch(setTrack(tracks));
  return tracks;
};
