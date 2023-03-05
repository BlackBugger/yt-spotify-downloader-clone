/* eslint-disable */
import axios from "axios";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import SpotifyWebApi from "spotify-web-api-node";
import { yTdApi } from "../api/api";
import download from '../assets/download.svg'
import youtube from '../assets/youtube.png'
import { setPlayTrack } from "../redux/reducers";
import './SongCard.css'

const SongCard = (track) => {

    const [searchThis, setSearchThis] = useState([]);
    const [likeID, setLikeID] = useState('');
    const [downloadLink, setDownloadLink] = useState('');



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

        const KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

        const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + "&key=" + KEY, {
        })

        const data = await fetchAPI.json();
        console.log('this is data', data.items[0].id.videoId);


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

        const KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

        const fetchAPI = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=` + trackName + "&key=" + KEY, {

        })
        const data = await fetchAPI.json();
        console.log('this is data', data.items[0].id.videoId);
        window.open(`https://www.youtube.com/watch?v=${data.items[0].id.videoId}`)
    }

    const { accessToken } = useSelector((state) => state.accessToken);

    const spotifyApi = new SpotifyWebApi({
        clientId: process.env.REACT_APP_ClientID,
        accessToken: accessToken,
    });

    const [test, setTest] = useState(false);



    spotifyApi.containsMySavedTracks([track.id])
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
            spotifyApi.removeFromMySavedTracks([likeID])
                .then(function (data) {
                    console.log('Removed!');
                }, function (err) {
                    console.log('Something went wrong!', err);
                });
            setTest(false)
        } else {
            spotifyApi.addToMySavedTracks([likeID])
                .then(function (data) {
                    console.log('Added track!');
                }, function (err) {
                    console.log('Something went wrong!', err);
                });
            setTest(true)
        }
    }

    return (
        <>
            <div className="track" key={track.id} >
                <div className="track-info">
                    <div className="track-image" onClick={() => handlePlay(track.uri)}>
                        <img src={track.image} />
                    </div>
                    <div className="track-title">
                        <h3>{track.title}</h3>
                        <p>{track.artist}</p>
                    </div>
                </div>
                <div className="download">
                    {/* Like button for spotify */}
                    {/* <form onSubmit={like} className="">
                        <button onClick={() => setLikeID(track.id)}>
                            {test ? <img src='https://cdn-icons-png.flaticon.com/512/1077/1077086.png' alt='liked' /> : <img src='https://cdn-icons-png.flaticon.com/512/1077/1077035.png' alt='like' />}
                        </button>
                    </form> */}
                    <form onSubmit={youtubeLink} className="" >
                        <button onClick={() => setSearchThis({ name: track.title, artist: track.artist })} >
                            <img src={youtube} alt="youtube" />
                        </button>
                    </form>

                    <form onSubmit={downloadthis} className="" >
                        <button onClick={() => setSearchThis({ name: track.title, artist: track.artist })} >
                            <a><img src={download} alt="search" /></a>
                        </button>
                    </form>
                </div>
            </div>


        </>

    );

}

export default SongCard;