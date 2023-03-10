/* eslint-disable react-hooks/rules-of-hooks */
import { setTrack } from '../redux/reducers';
import { store } from '../redux/store';
import SpotifyWebApi from 'spotify-web-api-node';


export const search = async (dispatch) => {
  const accessToken = store.getState().accessToken.accessToken;
  const searchInput = store.getState().accessToken.searchInput;

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.REACT_APP_ClientID,
    accessToken: accessToken
  });

  spotifyApi.searchTracks(searchInput).then(res => {
    dispatch(setTrack(res.body.tracks.items));
})

// useEffect(() => {
//     spotifyApi.setAccessToken(accessToken);
// }, [accessToken]);

// useEffect(() => {
//     if (!searchInput) return dispatch(setTrack([]))
//     if (!accessToken) return

//     spotifyApi.searchTracks(searchInput).then(res => {
//         console.log(res);
//     })
// }, [searchInput,accessToken]);

  // Search
 
    
    
};
