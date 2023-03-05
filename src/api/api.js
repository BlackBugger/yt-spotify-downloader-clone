import axios from "axios";
import { useSelector } from "react-redux";
import SpotifyWebApi from "spotify-web-api-node";
import { store } from "../redux/store";

export const yTdApi = axios.create({
  baseURL: "https://youtube-mp36.p.rapidapi.com/",
  Accept: "application/json",
  headers: {
    'X-RapidAPI-Key': "49d4ef8e46msh29fbf3e305cf6d1p16d62bjsn319df009fdc8",
    'X-RapidAPI-Host': "youtube-mp36.p.rapidapi.com"
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
