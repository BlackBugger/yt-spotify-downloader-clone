import axios from "axios";
import SpotifyWebApi from "spotify-web-api-node";
import { store } from "../redux/store";

export const yTdApi = axios.create({
  baseURL: "https://youtube-mp36.p.rapidapi.com/",
  Accept: "application/json",
  headers: {
    'X-RapidAPI-Key': process.env.REACT_APP_API_KEY,
    'X-RapidAPI-Host': process.env.REACT_APP_API_HOST
  },
});
export const ytApi = axios.create({
  baseURL: "https://youtube-mp36.p.rapidapi.com/dl",
  Accept: "application/json",
});
const axs = store.getState().accessToken.accessToken;
export const trySpotifyAPI = new SpotifyWebApi({
  clientId: '63aa93f61f7b42509d332eac7fc63f13',
  accessToken: axs
});
