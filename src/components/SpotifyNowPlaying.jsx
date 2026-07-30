import { useEffect, useMemo, useState } from "react";
import { FiDisc, FiPause, FiPlay, FiSkipBack, FiSkipForward } from "react-icons/fi";
import "./SpotifyNowPlaying.css";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SpotifyNowPlaying({
  track,
  isPlaying,
  isReady,
  error,
  position,
  duration,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
}) {
  const [displayPosition, setDisplayPosition] = useState(position || 0);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const trackDuration = Number(duration || track?.duration_ms || 0);
  const artwork = track?.album?.images?.[0]?.url || "";
  const artists = useMemo(
    () => (track?.artists || []).map((artist) => artist.name).filter(Boolean).join(", "),
    [track]
  );

  useEffect(() => {
    setDisplayPosition(clamp(Number(position) || 0, 0, trackDuration || 0));
  }, [position, trackDuration, track?.name]);

  useEffect(() => {
    setArtworkFailed(false);
  }, [artwork]);

  useEffect(() => {
    if (!isPlaying || !track || !trackDuration) return undefined;
    const timer = window.setInterval(() => {
      setDisplayPosition((current) => clamp(current + 500, 0, trackDuration));
    }, 500);
    return () => window.clearInterval(timer);
  }, [isPlaying, track, trackDuration]);

  const canControl = Boolean(track && isReady);
  const elapsed = formatTime(displayPosition);
  const total = formatTime(trackDuration);
  const progress = trackDuration ? (displayPosition / trackDuration) * 100 : 0;
  const playLabel = track
    ? `${isPlaying ? "Pause" : "Play"} ${track.name}`
    : "Play Spotify";

  const seek = (event) => {
    const nextPosition = Number(event.target.value);
    setDisplayPosition(nextPosition);
    onSeek?.(nextPosition);
  };

  return (
    <aside className="spotify-player-bar" aria-label="Spotify player">
      <div className="spotify-player-art">
        {artwork && !artworkFailed ? (
          <img src={artwork} alt={`${track.name} cover`} onError={() => setArtworkFailed(true)} />
        ) : (
          <FiDisc aria-hidden="true" />
        )}
      </div>

      <div className="spotify-player-meta">
        <span className="spotify-player-kicker">{track ? "Now playing" : "Cruz player"}</span>
        <strong>{track?.name || "Ready when you are"}</strong>
        <span>{artists || "Choose a track from search or your library."}</span>
      </div>

      <div className="spotify-player-transport" aria-label="Playback controls">
        <button type="button" onClick={onPrevious} disabled={!canControl} aria-label="Previous track">
          <FiSkipBack aria-hidden="true" />
        </button>
        <button
          type="button"
          className="spotify-player-play"
          onClick={onTogglePlay}
          disabled={!canControl}
          aria-label={playLabel}
        >
          {isPlaying ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
        </button>
        <button type="button" onClick={onNext} disabled={!canControl} aria-label="Next track">
          <FiSkipForward aria-hidden="true" />
        </button>
      </div>

      <div className="spotify-player-timeline">
        <span aria-hidden="true">{elapsed}</span>
        <input
          type="range"
          min="0"
          max={Math.max(trackDuration, 1)}
          step="1000"
          value={clamp(displayPosition, 0, Math.max(trackDuration, 1))}
          onChange={seek}
          disabled={!canControl || !trackDuration}
          aria-label="Playback position"
          aria-valuetext={`${elapsed} of ${total}`}
          style={{ "--player-progress": `${progress}%` }}
        />
        <span aria-hidden="true">{total}</span>
      </div>

      <div className="spotify-player-state">
        {error ? (
          <span role="alert">{error}</span>
        ) : (
          <span role="status">
            <i className={isReady ? "ready" : ""} aria-hidden="true" />
            {isReady ? (track ? "Browser playback active" : "Spotify device ready") : "Connecting Spotify player"}
          </span>
        )}
      </div>
    </aside>
  );
}
