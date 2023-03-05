import axios from 'axios';
import SpotifyWebApi from 'spotify-web-api-node';
import { store } from '../redux/store';

export const yTdApi = axios.create({
  baseURL: 'https://youtube-mp36.p.rapidapi.com/',
  Accept: 'application/json',
  headers: {
    'X-RapidAPI-Key': process.env.REACT_APP_API_KEY,
    'X-RapidAPI-Host': process.env.REACT_APP_API_HOST,
  },
});
export const ytApi = axios.create({
  baseURL: 'https://youtube-mp36.p.rapidapi.com/dl',
  Accept: 'application/json',
});
const axs = store.getState().accessToken.accessToken;
export const trySpotifyAPI = new SpotifyWebApi({
  clientId: process.env.REACT_APP_ClientID,
  accessToken: axs,
});
