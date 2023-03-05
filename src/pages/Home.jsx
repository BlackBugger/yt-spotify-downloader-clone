import React from 'react'
import { useEffect, useState } from "react";
import "./Home.css";
import SongCard from "../components/SongCard";
import { useSelector, useDispatch } from "react-redux";
import { spotifyAccessToken } from '../api/SpotifyAccessToken';
import { setSearchInput, setTrack } from '../redux/reducers';
import { searchSpotify } from '../components/SearchSpotify';
import Auth from '../components/Auth';
import { BsSearch } from 'react-icons/bs'
export default function Home() {

  const { track } = useSelector((state) => state.track)
  const { searchInput } = useSelector((state) => state.searchInput)
  const dispatch = useDispatch();

  useEffect(() => {
    //API Access Token For Spotify
    spotifyAccessToken(dispatch);
    dispatch(setTrack([]));
  }, [searchInput === '']);

  async function submit(event) {
    event.preventDefault();
    searchSpotify(dispatch);
  }



  return (
    <div className="app">
      <div className='header'>
        <form onSubmit={submit} className="search">
          <input
            name='videoID'
            placeholder="Search"
            onChange={(event) => dispatch(setSearchInput(event.target.value))}
          />
          <button type="submit" onKeyPress={(event) => {
            if (event.key === "Enter") {

              submit();
            }
          }} ><BsSearch /></button>

        </form>
        {/* <Auth /> */}

      </div>

      <div className="containers">
        <div className='search-list'>
          {searchInput && (
            track.map((track) => (
              <SongCard
                key={track.id}
                image={track.album.images[0].url}
                title={track.album.name}
                artist={track.album.artists[0].name}
                id={track.id}
              />)))}

        </div>


      </div>
    </div>
  );
}
