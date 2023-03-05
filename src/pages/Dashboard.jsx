/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react'
import { useEffect } from "react";
import "./Home.css";
import { useSelector, useDispatch } from "react-redux";
import { setSearchInput, setTrack } from '../redux/reducers';
import { search } from '../components/Search';
import Auth from '../components/Auth';
import useAuth from "../useAuth";
import Player from '../components/Player';
import Content from '../components/Dashboard/Content';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SpotifyWebApi from 'spotify-web-api-node';


function Dashboard({ code }) {
   

    const accessTokenz = useAuth(code)
    const { searchInput } = useSelector((state) => state.searchInput)
    const dispatch = useDispatch();

    async function submit(event) {
        event.preventDefault();

    }

    const spotifyApi = new SpotifyWebApi({
        clientId: '63aa93f61f7b42509d332eac7fc63f13',
        accessToken: accessTokenz,
    });


    useEffect(() => {

        let cancel = false

        setTimeout(() => {

            if (!searchInput) return dispatch(setTrack([]))
            if (cancel) return
            search(dispatch);

        }, 500)

        return () => cancel = true

    }, [searchInput]);



    const { isLoading } = useSelector((state) => state.isLoading);
    return (

        <div className="app">
            <div className='header'>
                <form onSubmit={submit} className="search">
                    <input
                        name='videoID'
                        placeholder="Search here"
                        onChange={(event) => dispatch(setSearchInput(event.target.value))}
                    />
                    <button type="submit" onKeyPress={(event) => {
                        if (event.key === "Enter") {
                         
                            submit();
                        }
                    }} >ENTER</button>
                    <div className=''>
                        <Auth />
                    </div>

                </form>


            </div>
            <div className='container-all'>
                {isLoading ? (<LoadingSpinner />) :
                    (<Content spotifyApi={spotifyApi} />)
                }
            </div>




            <div className='player'><Player /></div>
        </div>
    );
}

export default Dashboard;