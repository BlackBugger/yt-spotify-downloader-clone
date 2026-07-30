import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheck,
  FiDisc,
  FiHeart,
  FiPause,
  FiPlay,
  FiRefreshCw,
  FiSkipBack,
  FiSkipForward,
  FiSpeaker,
  FiX,
} from "react-icons/fi";
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
  saved,
  savePending,
  onToggleSaved,
  devices = [],
  devicesLoading,
  deviceTransferring,
  deviceError,
  onRequestDevices,
  onSelectDevice,
  activeDeviceName,
  isRemoteDevice,
}) {
  const [displayPosition, setDisplayPosition] = useState(position || 0);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const deviceButtonRef = useRef(null);
  const devicePickerRef = useRef(null);
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

  useEffect(() => {
    if (!devicesOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setDevicesOpen(false);
        deviceButtonRef.current?.focus();
      }
    };
    const closeOutside = (event) => {
      if (
        !devicePickerRef.current?.contains(event.target)
        && !deviceButtonRef.current?.contains(event.target)
      ) {
        setDevicesOpen(false);
      }
    };
    devicePickerRef.current?.focus();
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [devicesOpen]);

  const canControl = Boolean(track && isReady);
  const elapsed = formatTime(displayPosition);
  const total = formatTime(trackDuration);
  const progress = trackDuration ? (displayPosition / trackDuration) * 100 : 0;
  const playLabel = track
    ? `${isPlaying ? "Pause" : "Play"} ${track.name}`
    : "Play Spotify";
  const canSave = Boolean(track?.id && onToggleSaved);
  const saveLabel = !track
    ? "Save to Spotify"
    : savePending
      ? `Updating ${track.name} in Spotify`
      : saved
        ? `Remove ${track.name} from saved tracks`
        : `Save ${track.name} to Spotify`;

  const seek = (event) => {
    const nextPosition = Number(event.target.value);
    setDisplayPosition(nextPosition);
    onSeek?.(nextPosition);
  };

  const toggleDevices = () => {
    const nextOpen = !devicesOpen;
    setDevicesOpen(nextOpen);
    if (nextOpen) onRequestDevices?.();
  };

  const chooseDevice = async (device) => {
    const transferred = await onSelectDevice?.(device);
    if (transferred !== false) {
      setDevicesOpen(false);
      deviceButtonRef.current?.focus();
    }
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
        <button
          type="button"
          className="spotify-player-save"
          onClick={() => onToggleSaved?.(track)}
          disabled={!canSave || savePending}
          aria-label={saveLabel}
          aria-pressed={Boolean(saved)}
          aria-busy={savePending ? "true" : undefined}
        >
          <FiHeart aria-hidden="true" />
        </button>
        <button
          type="button"
          className="spotify-player-device"
          ref={deviceButtonRef}
          onClick={toggleDevices}
          aria-label="Choose playback device"
          aria-haspopup="dialog"
          aria-expanded={devicesOpen}
          aria-controls="spotify-device-picker"
        >
          <FiSpeaker aria-hidden="true" />
        </button>
      </div>

      {devicesOpen && (
        <div
          id="spotify-device-picker"
          className="spotify-device-picker"
          role="dialog"
          aria-label="Playback devices"
          aria-busy={devicesLoading ? "true" : "false"}
          ref={devicePickerRef}
          tabIndex="-1"
        >
          <div className="spotify-device-picker-heading">
            <div>
              <span>Spotify Connect</span>
              <strong>Play on a device</strong>
            </div>
            <div className="spotify-device-picker-actions">
              <button
                type="button"
                onClick={onRequestDevices}
                disabled={devicesLoading || Boolean(deviceTransferring)}
                aria-label="Refresh playback devices"
              >
                <FiRefreshCw aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDevicesOpen(false);
                  deviceButtonRef.current?.focus();
                }}
                aria-label="Close playback devices"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="spotify-device-status" role="status" aria-label="Device status">
            {devicesLoading
              ? "Finding available devices..."
              : devices.length
                ? `${devices.length} ${devices.length === 1 ? "device" : "devices"} available`
                : "No devices found. Open Spotify on a device and refresh."}
          </p>

          {devices.length > 0 && (
            <div className="spotify-device-list">
              {devices.map((device) => {
                const transferring = deviceTransferring === device.id;
                const status = transferring
                  ? "Switching"
                  : device.is_restricted
                    ? "Unavailable"
                    : device.is_active
                      ? "Active device"
                      : "Available";
                return (
                  <button
                    type="button"
                    className="spotify-device-option"
                    key={device.id}
                    onClick={() => chooseDevice(device)}
                    disabled={Boolean(device.is_restricted || deviceTransferring)}
                    aria-label={`${device.name || "Spotify device"}, ${device.type || "Device"}, ${status}`}
                    aria-pressed={Boolean(device.is_active)}
                  >
                    <span className="spotify-device-icon"><FiSpeaker aria-hidden="true" /></span>
                    <span className="spotify-device-copy">
                      <strong>{device.name || "Spotify device"}</strong>
                      <span>{device.type || "Device"}</span>
                    </span>
                    <span className={`spotify-device-state ${device.is_active ? "active" : ""}`}>
                      {device.is_active && !transferring && <FiCheck aria-hidden="true" />}
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {deviceError && <p className="spotify-device-error" role="alert">{deviceError}</p>}
          <p className="spotify-device-help">Open Spotify on another device if it is not listed yet.</p>
        </div>
      )}

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
            {isReady
              ? isRemoteDevice
                ? `Playing on ${activeDeviceName || "Spotify device"}`
                : track
                  ? "Browser playback active"
                  : "Spotify device ready"
              : "Connecting Spotify player"}
          </span>
        )}
      </div>
    </aside>
  );
}
