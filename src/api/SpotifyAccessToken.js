import { setAccessToken } from '../redux/reducers';

export const spotifyAccessToken = async (dispatch) => {
  const ClientID = process.env.REACT_APP_ClientID;
  const ClientSecret = process.env.REACT_APP_ClientSecret;

  var auth = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&client_id=' + ClientID + '&client_secret=' + ClientSecret,
  };

  fetch('https://accounts.spotify.com/api/token', auth)
    .then((result) => result.json())
    .then((data) => dispatch(setAccessToken(data.access_token)));
};
