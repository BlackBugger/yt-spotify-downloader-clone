import classes from './Content.module.css';
import UserFavorites from './UserFavorites';
import { useDispatch, useSelector } from 'react-redux';
import { setUserLibrary, setUserTopTracks, setIsLoading, setUserPlaylist } from '../../redux/reducers';
import { useEffect } from 'react';
import UserLibrary from './UserLibrary';
import UserPlaylist from './UserPlaylist';
import SongCard from '../SongCard';
import AddPlaylist from './AddPlaylist';
import './content.css';
import { trySpotifyAPI } from '../../api/api';

function Content({spotifyApi}) {
console.log('api token',spotifyApi);
  const { searchInput } = useSelector((state) => state.searchInput);
  const dispatch = useDispatch();

  const { accessToken } = useSelector((state) => state.accessToken);

  useEffect(() => {
    dispatch(setIsLoading(true));
    spotifyApi.getMyTopTracks().then(
      function (data) {
        let topTracks = data.body.items;
        dispatch(setUserTopTracks(topTracks));
      },
      function (err) {
        console.log('Something went wrong!', err);
      }
    );

    spotifyApi.getMySavedTracks().then(
      function (data) {
        let savedTracks = data.body.items;
        dispatch(setUserLibrary(savedTracks));
      },
      function (err) {
        console.log('Something went wrong!', err);
      }
    );
    spotifyApi.getUserPlaylists().then(
      function (data) {
        let userPlaylist = data.body.items;

        dispatch(setUserPlaylist(userPlaylist));
      },
      function (err) {
        console.log('Something went wrong!', err);
      }
    );

    dispatch(setIsLoading(false));
  }, [accessToken]);

  const { userLibrary } = useSelector((state) => state.userLibrary);
  const { track } = useSelector((state) => state.track);
  return (
    <div className={classes.container}>
      <div className={classes.test}>

        <div className={classes.contentcard}>
          <UserFavorites accessToken={accessToken} />
        </div>

        <div className={classes.contentcard}>
          <div className={classes.underDev}></div>
        </div>

        <div className={classes.contentcard}>
          <AddPlaylist />
        </div>

        <div className={classes.contentcard}>
          <UserPlaylist />
        </div>

      </div>

      <div className={classes.test2} id="test">
        <div className={classes.contentcard}>
          {searchInput
            ? track.map((track) => (
                <SongCard
                  key={track.id}
                  image={track.album.images[0].url}
                  title={track.album.name}
                  artist={track.album.artists[0].name}
                  id={track.id}
                  uri={track.uri}
                />
              ))
            : userLibrary.map((tracks) => (
                <UserLibrary
                  key={tracks.track.id}
                  image={tracks.track.album.images[0].url}
                  title={tracks.track.album.name}
                  artist={tracks.track.album.artists[0].name}
                  id={tracks.track.id}
                  uri={tracks.track.uri}
                  spotifyApi={spotifyApi}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

export default Content;
