import React, { useState } from "react";
import { FiExternalLink, FiHeart, FiPlay } from "react-icons/fi";
import "./SpotifyLibrary.css";

const tabs = [
  ["playlists", "Playlists"],
  ["albums", "Albums"],
  ["tracks", "Saved Tracks"],
];

function trackArtists(track) {
  return (track.artists || []).map((artist) => artist.name).join(", ");
}

function libraryEntry(item) {
  return item.track || item.album || item;
}

function artworkFor(item) {
  const entry = libraryEntry(item);
  return entry.images?.[0]?.url || entry.album?.images?.[0]?.url || "";
}

function LibraryCard({ item, saved, onPlay, onToggleSaved }) {
  const entry = libraryEntry(item);
  const isTrack = Boolean(item.track || entry.type === "track");
  const metadata = trackArtists(entry) || entry.owner?.display_name || "Spotify";
  const artwork = artworkFor(item);
  const externalUrl = entry.external_urls?.spotify;
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const isSaved = isTrack && saved !== false;

  const toggleSaved = async () => {
    if (!isTrack || pending) return;
    setPending(true);
    try {
      await onToggleSaved?.(entry);
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="spotify-library-card">
      <div className="spotify-library-art">
        {artwork && !artworkFailed ? (
          <img src={artwork} alt="" loading="lazy" onError={() => setArtworkFailed(true)} />
        ) : (
          <div className="spotify-library-art-placeholder" aria-hidden="true" />
        )}
        <button
          className="spotify-library-play"
          type="button"
          aria-label={`Play ${entry.name}`}
          onClick={() => onPlay?.(entry)}
        >
          <FiPlay aria-hidden="true" />
        </button>
      </div>
      <div className="spotify-library-copy">
        <strong>{entry.name || "Untitled Spotify item"}</strong>
        <span>{metadata}</span>
      </div>
      <div className="spotify-library-actions">
        {isTrack && (
          <button
            className={`spotify-library-save ${isSaved ? "saved" : ""}`}
            type="button"
            aria-label={`${isSaved ? "Remove" : "Save"} ${entry.name}`}
            aria-pressed={isSaved}
            disabled={pending}
            onClick={toggleSaved}
          >
            <FiHeart aria-hidden="true" />
          </button>
        )}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${entry.name} in Spotify`}
          >
            <FiExternalLink aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

export default function SpotifyLibrary({
  account,
  library,
  saved,
  onLoad,
  onPlay,
  onToggleSaved,
}) {
  const activeLabel = tabs.find(([tab]) => tab === library.tab)?.[1] || "Library";
  const statusMessage = library.loading
    ? `Loading ${activeLabel.toLowerCase()}`
    : library.error
      ? `${activeLabel} could not be loaded`
      : `${library.items.length} ${activeLabel.toLowerCase()} loaded`;

  return (
    <section className="library-panel" id="spotify-library" tabIndex="-1" aria-label="Spotify library">
      <div className="library-heading">
        {account.images?.[0]?.url && <img className="profile-avatar" src={account.images[0].url} alt="" />}
        <div>
          <span className="section-label">Your Spotify</span>
          <h2>Library</h2>
          <p>Play your playlists, albums, and saved tracks here. Browser playback requires Spotify Premium.</p>
        </div>
      </div>
      <div className="library-tabs" aria-label="Spotify library sections">
        {tabs.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            aria-pressed={library.tab === tab}
            onClick={() => onLoad(tab)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="spotify-library-content" aria-busy={library.loading}>
        <p className="sr-only" role="status">{statusMessage}</p>
        {library.loading && <p>Loading {activeLabel.toLowerCase()}…</p>}
        {library.error && <p className="library-error" role="alert">{library.error}</p>}
        {!library.loading && !library.error && library.items.length === 0 && (
          <p className="library-empty">No {library.tab} to show yet.</p>
        )}
        {!library.loading && !library.error && library.items.length > 0 && (
          <div className="library-grid">
            {library.items.map((item) => {
              const entry = libraryEntry(item);
              return (
                <LibraryCard
                  key={entry.id}
                  item={item}
                  saved={item.track ? saved[entry.id] : undefined}
                  onPlay={onPlay}
                  onToggleSaved={onToggleSaved}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
