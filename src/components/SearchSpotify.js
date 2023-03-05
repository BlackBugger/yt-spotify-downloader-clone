
import { setTrack } from '../redux/reducers';
import { store } from "../redux/store";

export const searchSpotify = async (dispatch)=> {

  const accessToken = store.getState().accessToken.accessToken
  const searchInput = store.getState().accessToken.searchInput

  
  // Search
  var searchParam = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
  };

  // Track
  await fetch(
    'https://api.spotify.com/v1/search?q=' +
      searchInput +
      '&type=track&limit=20',
    searchParam
  )
    .then((response) => response.json())
    .then((data) => {
      dispatch(setTrack(data.tracks.items));
    });
}


