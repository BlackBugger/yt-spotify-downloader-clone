import { useEffect, useMemo, useRef, useState } from "react";
import { FiDisc, FiRefreshCw, FiRadio } from "react-icons/fi";
import "./SpotifyLyrics.css";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SpotifyLyrics({
  track,
  isPlaying = false,
  position = 0,
  duration = 0,
  lyrics,
  onSeek,
  onRetry,
}) {
  const [displayPosition, setDisplayPosition] = useState(position);
  const [follow, setFollow] = useState(true);
  const activeLineRef = useRef(null);
  const lyricsViewportRef = useRef(null);
  const artwork = track?.album?.images?.[0]?.url || "";
  const artists = useMemo(
    () => (track?.artists || []).map((artist) => artist.name).filter(Boolean).join(", "),
    [track],
  );
  const lines = useMemo(() => lyrics?.lines || [], [lyrics?.lines]);
  const plainLines = lyrics?.plainLines || [];
  const trackDuration = Number(duration || track?.duration_ms || 0);

  useEffect(() => {
    setDisplayPosition(clamp(Number(position) || 0, 0, trackDuration || 0));
  }, [position, trackDuration, track?.id]);

  useEffect(() => {
    setFollow(true);
  }, [track?.id]);

  useEffect(() => {
    if (!isPlaying || !track || !trackDuration) return undefined;
    const timer = window.setInterval(() => {
      setDisplayPosition((current) => clamp(current + 250, 0, trackDuration));
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPlaying, track, trackDuration]);

  const activeIndex = useMemo(() => {
    let matched = -1;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].time <= displayPosition + 150) matched = index;
      else break;
    }
    return matched;
  }, [displayPosition, lines]);

  useEffect(() => {
    if (!follow || activeIndex < 0) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const viewport = lyricsViewportRef.current;
    const line = activeLineRef.current;
    if (!viewport || !line) return;
    const nextTop = line.offsetTop - viewport.clientHeight / 2 + line.offsetHeight / 2;
    viewport.scrollTo?.({
      top: Math.max(0, nextTop),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeIndex, follow]);

  if (!track) return null;

  const selectLine = (line) => {
    setDisplayPosition(line.time);
    setFollow(true);
    onSeek?.(line.time);
  };

  return (
    <section
      id="spotify-lyrics"
      className="spotify-lyrics"
      aria-label={`Lyrics for ${track.name}`}
      aria-busy={lyrics?.loading ? "true" : "false"}
      tabIndex="-1"
    >
      <div className="spotify-lyrics-track">
        <span className="spotify-lyrics-kicker"><FiRadio aria-hidden="true" /> Live lyrics</span>
        <div className="spotify-lyrics-art">
          {artwork ? <img src={artwork} alt="" /> : <FiDisc aria-hidden="true" />}
        </div>
        <div className="spotify-lyrics-meta">
          <h2>Lyrics</h2>
          <strong>{track.name}</strong>
          <span>{artists || "Spotify track"}</span>
        </div>
        {lines.length > 0 && (
          <button
            type="button"
            className="spotify-lyrics-follow"
            aria-pressed={follow}
            onClick={() => setFollow((current) => !current)}
          >
            <span aria-hidden="true" />
            {follow ? "Following" : "Follow lyrics"}
          </button>
        )}
      </div>

      <div className="spotify-lyrics-stage">
        {lyrics?.loading ? (
          <div className="spotify-lyrics-message spotify-lyrics-loading" role="status">
            <FiRadio aria-hidden="true" />
            <strong>Finding lyrics...</strong>
            <span>Matching this exact recording.</span>
          </div>
        ) : lyrics?.error ? (
          <div className="spotify-lyrics-message">
            <FiDisc aria-hidden="true" />
            <strong>Lyrics unavailable</strong>
            <p role="alert">{lyrics.error}</p>
            {onRetry && (
              <button type="button" onClick={onRetry}>
                <FiRefreshCw aria-hidden="true" /> Try lyrics again
              </button>
            )}
          </div>
        ) : lyrics?.instrumental ? (
          <div className="spotify-lyrics-message" role="status">
            <FiDisc aria-hidden="true" />
            <strong>Instrumental track</strong>
            <span>No sung lyrics—just let it play.</span>
          </div>
        ) : lines.length > 0 ? (
          <div
            className="spotify-lyrics-lines"
            aria-label="Synchronized lyrics"
            ref={lyricsViewportRef}
          >
            {lines.map((line, index) => {
              const active = index === activeIndex;
              return (
                <button
                  type="button"
                  key={`${line.time}-${index}`}
                  ref={active ? activeLineRef : undefined}
                  className={active ? "is-active" : ""}
                  aria-current={active ? "true" : undefined}
                  aria-label={`Seek to ${formatTime(line.time)}: ${line.text}`}
                  onClick={() => selectLine(line)}
                >
                  <span className="spotify-lyric-time" aria-hidden="true">{formatTime(line.time)}</span>
                  <span>{line.text}</span>
                </button>
              );
            })}
          </div>
        ) : plainLines.length > 0 ? (
          <div className="spotify-lyrics-plain">
            <p className="spotify-lyrics-note">These lyrics are not time-synced for this recording.</p>
            {plainLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
        ) : (
          <div className="spotify-lyrics-message" role="status">
            <FiDisc aria-hidden="true" />
            <strong>No lyrics found</strong>
            <span>Try another recording of this track.</span>
          </div>
        )}
        {!lyrics?.loading && !lyrics?.error && lyrics?.source && (
          <a
            className="spotify-lyrics-credit"
            href="https://lrclib.net"
            target="_blank"
            rel="noreferrer"
          >
            Lyrics provided by {lyrics.source}
          </a>
        )}
      </div>
    </section>
  );
}
