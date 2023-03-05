
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import SpotifyPlayer from 'react-spotify-web-playback';

function Player() {
  const { accessToken } = useSelector((state) => state.accessToken);
  const { playTrack } = useSelector((state) => state.playTrack);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    setPlay(true);
  }, [playTrack]);

  if (!accessToken) return null;
  return (
    <SpotifyPlayer
      token={accessToken}
      callback={(state) => {
        if (!state.isPlaying) setPlay(false);
      }}
      play={play}
      showSaveIcon
      uris={playTrack ? [playTrack] : []}
      styles={{
        activeColor: '#fff',
        bgColor: '#1f2123',
        color: 'rgb(0, 192, 42)',
        loaderColor: '#fff',
        sliderColor: 'rgb(0, 192, 42)',
        trackArtistColor: '#ccc',
        trackNameColor: '#fff',
      }}
    />
  );
}

export default Player;
