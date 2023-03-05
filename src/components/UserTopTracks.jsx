/* eslint-disable */
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { yTdApi } from "../api/api";
import download from '../assets/download.svg'
import youtube from '../assets/youtube.png'
import { setPlayTrack } from "../redux/reducers";
import './SongCard.css'


const UserTopTracks = () => {

    const [searchThis, setSearchThis] = useState([]);
    const [ytID, setYtID] = useState('');
    const [downloadLink, setDownloadLink] = useState('');

    const { userTopTracks } = useSelector((state) => state.userTopTracks);

    const dispatch = useDispatch();


    function handlePlay(track) {
        dispatch((setPlayTrack(track)))
    }

    const downloadthis = async (event) => {
        event.preventDefault();

        console.log(searchThis)
        var name = searchThis.name;
        var artist = searchThis.artist;
        var searchYT = `${name} by ${artist}`

        const trackName = searchYT;

        const KEY = 'AIzaSyAbv5Y7iVusXiGKv75mru5G_Y4jNZUTtPY';

        const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + "&key=" + KEY, {
        })

        const data = await fetchAPI.json();
        console.log('this is data', data.items[0].id.videoId);
        setYtID(data.items[0].id.videoId);

        const response = await yTdApi.get(`dl?id=${data.items[0].id.videoId}`)

        const dlLink = response.data.link;
        setDownloadLink(dlLink);
        console.log('inside downloadbutton', dlLink);

        window.open(dlLink, "_self")

    }

    const youtubeLink = async (event) => {
        event.preventDefault();

        console.log(searchThis)
        var name = searchThis.name;
        var artist = searchThis.artist;
        var searchYT = `${name} by ${artist}`

        const trackName = searchYT;

        const KEY = 'AIzaSyAbv5Y7iVusXiGKv75mru5G_Y4jNZUTtPY';

        const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + "&key=" + KEY, {

        })
        const data = await fetchAPI.json();
        console.log('this is data', data.items[0].id.videoId);
        window.open(`https://www.youtube.com/watch?v=${data.items[0].id.videoId}`)
    }




    return (
        <>

            {userTopTracks.map((track) => (
                <div className="track" key={track.id} onClick={() => handlePlay(track.uri)}>
                    <div className="track-info">
                        <div className="track-image">
                            <img src={track.album.images[0].url} />
                        </div>
                        <div className="track-title">
                            <h3>{track.album.name}</h3>
                            <p>{track.album.artists[0].name}</p>
                        </div>
                    </div>
                    <div className="download">
                        <form onSubmit={youtubeLink} className="" >
                            <button onClick={() => setSearchThis({ name: track.album.name, artist: track.album.artists[0].name })} >
                                <img src={youtube} alt="youtube" />
                            </button>
                        </form>

                        <form onSubmit={downloadthis} className="" >
                            <button onClick={() => setSearchThis({ name: track.album.name, artist: track.album.artists[0].name })} >
                                <a><img src={download} alt="search" /></a>
                            </button>
                        </form>
                    </div>
                </div>
            ))}

        </>
    );

}

export default UserTopTracks;