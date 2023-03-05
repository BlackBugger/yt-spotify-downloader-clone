/* eslint-disable */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { yTdApi } from '../api/api';
import download from '../assets/download.svg';
import youtube from '../assets/youtube.png';
import { setPlayTrack } from '../redux/reducers';
import classes from './track.module.css';

const UserTopPlaylist = () => {
  const [searchThis, setSearchThis] = useState([]);
  const [ytID, setYtID] = useState('');
  const [downloadLink, setDownloadLink] = useState('');

  const { userPlaylist } = useSelector((state) => state.userPlaylist);

  const dispatch = useDispatch();

  function handlePlay(track) {
    dispatch(setPlayTrack(track));
  }

  const downloadthis = async (event) => {
    event.preventDefault();

    console.log(searchThis);
    var name = searchThis.name;
    var artist = searchThis.artist;
    var searchYT = `${name} by ${artist}`;

    const trackName = searchYT;

    const KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

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

    const KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

    const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + '&key=' + KEY, {});
    const data = await fetchAPI.json();
    console.log('this is data', data.items[0].id.videoId);
    window.open(`https://www.youtube.com/watch?v=${data.items[0].id.videoId}`);
  };

  return (
    <>
      {userPlaylist.map((track) => (
        <div className={classes.track} key={track.id} onClick={() => handlePlay(track.uri)}>
          <div className={classes.trackinfo}>
            <div className={classes.trackimage}>
              <img src={track.images[0].url} />
            </div>
            <div className={classes.tracktitle}>
              <h3>{track.name}</h3>
              <p>{track.owner.display_name}</p>
            </div>
          </div>
          <div className={classes.downloads}>
            <form onSubmit={youtubeLink} className="">
              <button onClick={() => setSearchThis({ name: track.album.name, artist: track.album.artists[0].name })}>
                <img src={youtube} alt="youtube" />
              </button>
            </form>

            <form onSubmit={downloadthis} className="">
              <button onClick={() => setSearchThis({ name: track.album.name, artist: track.album.artists[0].name })}>
                <a>
                  <img src={download} alt="search" />
                </a>
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
};

export default UserTopPlaylist;
