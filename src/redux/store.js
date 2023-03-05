import { configureStore } from '@reduxjs/toolkit';
import reducer from './reducers';

export const store = configureStore({
  reducer: {
    accessToken: reducer,
    code: reducer,
    track: reducer,
    userLibrary: reducer,
    userTopTracks: reducer,
    userPlaylist: reducer,
    searchInput: reducer,
    playTrack: reducer,
    show: reducer,
    isLoading: reducer,
  },
});
