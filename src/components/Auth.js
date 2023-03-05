import './Auth.css';

const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${process.env.REACT_APP_ClientID}&response_type=code&redirect_uri=http://localhost:3000&scope=streaming%20user-read-email%20user-read-private%20user-library-read%20user-library-modify%20user-read-playback-state%20user-modify-playback-state%20playlist-read-private%20user-top-read`;

function Auth() {
  return (
    <a href={AUTH_URL} className="login">
      <img src="https://cdn-icons-png.flaticon.com/512/174/174872.png" alt="login" className="login-img" />
    </a>
  );
}

export default Auth;
