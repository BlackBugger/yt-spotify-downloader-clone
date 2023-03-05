import { createSlice } from '@reduxjs/toolkit';

export const searchAllSlice = createSlice({
  name: 'here',
  initialState: {
    accessToken: '',
    code: '',
    track: [],
    userLibrary: [],
    userTopTracks: [],
    userPlaylist: [],
    searchInput: '',
    playTrack: '',
    show: '',
    isLoading: '',
   
  },
  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },
    setCode: (state, action) => {
      state.code = action.payload;
    },
    setTrack: (state, action) => {
      state.track = action.payload;
    },
    setUserLibrary: (state, action) => {
      state.userLibrary = action.payload;
    },
    setUserTopTracks: (state, action) => {
      state.userTopTracks = action.payload;
    },
    setUserPlaylist: (state, action) => {
      state.userPlaylist = action.payload;
    },
    setSearchInput: (state, action) => {
      state.searchInput = action.payload;
    },
    setPlayTrack: (state, action) => {
      state.playTrack = action.payload;
    },
    setShow: (state, action) => {
      state.show = action.payload;
    },
    setIsLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setAccessToken,setCode, setTrack, setSearchInput, setPlayTrack, setShow, setUserLibrary, setUserTopTracks, setIsLoading, setUserPlaylist } =
  searchAllSlice.actions;

export default searchAllSlice.reducer;
