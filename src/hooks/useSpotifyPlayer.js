import { useEffect, useRef, useState } from "react";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
let sdkPromise;

function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  const existing = document.querySelector(`script[src="${SDK_URL}"]`);
  if (sdkPromise && existing) return sdkPromise;
  if (sdkPromise && !existing) sdkPromise = undefined;
  const script = existing || document.createElement("script");
  sdkPromise = new Promise((resolve, reject) => {
    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      resolve(window.Spotify);
    };
    if (!existing) {
      script.src = SDK_URL;
      script.async = true;
      script.onerror = () => reject(new Error("Spotify playback SDK could not be loaded."));
      document.body.appendChild(script);
    }
  }).catch((error) => {
    sdkPromise = undefined;
    script.remove();
    throw error;
  });
  return sdkPromise;
}

export function useSpotifyPlayer(accessToken, onReady) {
  const tokenRef = useRef(accessToken);
  const playerRef = useRef(null);
  const hasAccessToken = Boolean(accessToken);
  const [deviceId, setDeviceId] = useState("");
  const [playerState, setPlayerState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  useEffect(() => {
    if (hasAccessToken) return;
    setDeviceId("");
    setPlayerState(null);
    setError("");
  }, [hasAccessToken]);

  useEffect(() => {
    if (!hasAccessToken) return undefined;
    let active = true;
    loadSpotifySdk().then((Spotify) => {
      if (!active || !Spotify?.Player) return;
      const player = new Spotify.Player({
        name: "Cruz Audio",
        getOAuthToken: (callback) => callback(tokenRef.current),
      });
      playerRef.current = player;
      player.addListener("ready", ({ device_id: readyDeviceId }) => {
        if (!active) return;
        setDeviceId(readyDeviceId);
        onReady?.(readyDeviceId);
      });
      player.addListener("not_ready", () => {
        if (!active) return;
        setDeviceId("");
        setPlayerState(null);
      });
      player.addListener("player_state_changed", (state) => { if (active) setPlayerState(state); });
      ["initialization_error", "authentication_error", "account_error", "playback_error"].forEach((event) => {
        player.addListener(event, ({ message }) => { if (active) setError(message || "Spotify playback is unavailable."); });
      });
      Promise.resolve(player.connect())
        .then((connected) => { if (active && !connected) setError("Spotify playback could not connect."); })
        .catch(() => { if (active) setError("Spotify playback could not connect."); });
    }).catch((loadError) => { if (active) setError(loadError.message); });
    return () => {
      active = false;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [hasAccessToken, onReady]);

  return {
    deviceId,
    error,
    playerState,
    isPlaying: Boolean(playerState && !playerState.paused),
    activateElement: () => playerRef.current?.activateElement?.(),
    togglePlay: async () => {
      try {
        await playerRef.current?.togglePlay();
        setError("");
      } catch {
        setError("Spotify playback could not be changed.");
      }
    },
  };
}
