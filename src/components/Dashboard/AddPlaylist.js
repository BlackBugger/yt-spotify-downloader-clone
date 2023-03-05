import { useState } from 'react';
import { useSelector } from 'react-redux';
import SpotifyWebApi from 'spotify-web-api-node';

import classes from './AddPlaylist.module.css';

function AddPlaylist() {
  const [newPlaylist, setNewPlaylist] = useState('');

  const { userPlaylist } = useSelector((state) => state.userPlaylist);

  const { accessToken } = useSelector((state) => state.accessToken);

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.REACT_APP_ClientID,
    accessToken: accessToken,
  });

  const createPlaylist = (event) => {
    event.preventDefault();
    console.log(newPlaylist);

    spotifyApi.createPlaylist(newPlaylist, { public: true }).then(
      function (data) {
        console.log('Created playlist!');
      },
      function (err) {
        console.log('Something went wrong!', err);
      }
    );

    setNewPlaylist('');
  };

  return (
    <div className={classes.contentcard}>
      <div className={classes.test}>
        <form onSubmit={createPlaylist} className={classes.createPlaylist}>
          <label>Create Playlist</label>
          <input value={newPlaylist} placeholder="playlist" onChange={(event) => setNewPlaylist(event.target.value)} />
          <button type="submit">create</button>
        </form>
      </div>
      <div className={classes.cardfront}>
        <div className={classes.titlevertical}>
          <span>P</span>
          <span>L</span>
          <span>A</span>
          <span>Y</span>
          <span>L</span>
          <span>I</span>
          <span>S</span>
          <span>T</span>
        </div>
        <div className={classes.title}>
          <span>A</span>
          <span>D</span>
          <span>D</span>
        </div>
        <div className={classes.collage}>
          {userPlaylist.map((track) => (
            <div className={classes.frontimage} key={track.id}>
              <img src={track.images[0].url} alt="" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AddPlaylist;
