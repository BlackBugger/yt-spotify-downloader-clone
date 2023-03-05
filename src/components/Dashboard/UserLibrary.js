/* eslint-disable */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { yTdApi } from '../../api/api';
import download from '../../assets/download.svg';
import youtube from '../../assets/youtube.png';
import { setPlayTrack } from '../../redux/reducers';
import classes from '../track.module.css';

const UserLibrary = (props) => {
  const [searchThis, setSearchThis] = useState([]);
  const [ytID, setYtID] = useState('');
  const [downloadLink, setDownloadLink] = useState('');
  const [likeID, setLikeID] = useState('');
  const [test, setTest] = useState(false);
  const { searchInput } = useSelector((state) => state.searchInput);

  const dispatch = useDispatch();

  function handlePlay(track) {
    dispatch(setPlayTrack(track));
    console.log(track);
  }

  const downloadthis = async (event) => {
    event.preventDefault();

    console.log(searchThis);
    var name = searchThis.name;
    var artist = searchThis.artist;
    var searchYT = `${name} by ${artist}`;

    const trackName = searchYT;

    const KEY = 'AIzaSyAbv5Y7iVusXiGKv75mru5G_Y4jNZUTtPY';

    const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + '&key=' + KEY, {});

    const data = await fetchAPI.json();
    console.log('this is data', data.items[0].id.videoId);
    setYtID(data.items[0].id.videoId);

    const response = await yTdApi.get(`dl?id=${data.items[0].id.videoId}`);

    const dlLink = response.data.link;
    setDownloadLink(dlLink);
    console.log('inside downloadbutton', dlLink);

    window.open(dlLink, '_self');
  };

  const youtubeLink = async (event) => {
    event.preventDefault();

    console.log(searchThis);
    var name = searchThis.name;
    var artist = searchThis.artist;
    var searchYT = `${name} by ${artist}`;

    const trackName = searchYT;

    const KEY = 'AIzaSyAbv5Y7iVusXiGKv75mru5G_Y4jNZUTtPY';

    const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + '&key=' + KEY, {});
    const data = await fetchAPI.json();
    console.log('this is data', data.items[0].id.videoId);
    window.open(`https://www.youtube.com/watch?v=${data.items[0].id.videoId}`);
  };

  props.spotifyApi.containsMySavedTracks([props.id])
  .then(function (data) {
      var trackIsInYourMusic = data.body[0];

      if (trackIsInYourMusic) {
          setTest(trackIsInYourMusic)
      } else {
          setTest(false)
      }
  }, function (err) {
      console.log('Something went wrong!', err);
  });

  const like = async (event) => {
    event.preventDefault();

    if (test === true) {
      props.spotifyApi.removeFromMySavedTracks([likeID]).then(
        function (data) {
          console.log('Removed!');
        },
        function (err) {
          console.log('Something went wrong!', err);
        }
      );
      setTest(false);
    } else {
      props.spotifyApi.addToMySavedTracks([likeID]).then(
        function (data) {
          console.log('Added track!');
        },
        function (err) {
          console.log('Something went wrong!', err);
        }
      );
      setTest(true);
    }
  };

  return (
    <>
      <div className={classes.track} key={props.id}>
        <div className={classes.trackinfo}>
          <div className={classes.trackimage} onClick={() => handlePlay(props.uri)}>
            <img src={props.image} />
          </div>
          <div className={classes.tracktitle}>
            <h3>{props.title}</h3>
            <p>{props.artist}</p>
          </div>
        </div>
        <div className={classes.downloads}>
          <form onSubmit={like} className="">
            <button onClick={() => {setLikeID(props.id)}}>
              {test ? (
                <img src="https://cdn-icons-png.flaticon.com/512/1077/1077086.png" alt="liked" />
              ) : (
                <img src="https://cdn-icons-png.flaticon.com/512/1077/1077035.png" alt="like" />
              )}
            </button>
          </form>
          <form onSubmit={youtubeLink} className="">
            <button onClick={() => setSearchThis({ name: track.track.album.name, artist: track.track.album.artists[0].name })}>
              <img src={youtube} alt="youtube" />
            </button>
          </form>

          <form onSubmit={downloadthis} className="">
            <button onClick={() => setSearchThis({ name: props.title, artist: props.artist })}>
              <a>
                <img src={download} alt="search" />
              </a>
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default UserLibrary;
