import { setAccessToken } from '../redux/reducers';

export const spotifyAccessToken = async (dispatch) =>{
  

  const ClientID = 'faf8919d88d44409ab4cddc6b6f40c0c';
  const ClientSecret = '5fcaca2478b748078a2947f579faa3fb';

  var auth = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body:
      'grant_type=client_credentials&client_id=' +
      ClientID +
      '&client_secret=' +
      ClientSecret,
  };

  fetch('https://accounts.spotify.com/api/token', auth)
    .then((result) => result.json())
    .then((data) => dispatch(setAccessToken(data.access_token)));

}



