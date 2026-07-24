import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheck, FiDownload, FiHeadphones, FiSearch, FiYoutube } from "react-icons/fi";
import SongCard from "../components/SongCard";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import "./Home.css";

const popularSearches = ["SZA", "Bad Bunny", "Drake", "Tame Impala"];
const REFRESH_EARLY_MS = 30_000;
const libraryEndpoints = { playlists: "me/playlists?limit=20", albums: "me/albums?limit=20", tracks: "me/tracks?limit=20" };

async function api(path, options) {
  const response = await fetch(`/.netlify/functions/${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = new Error(data.error || "Something went wrong.");
    apiError.status = response.status;
    throw apiError;
  }
  return data;
}

function trackArtists(track) {
  return (track.artists || []).map((artist) => artist.name).join(", ");
}

function artworkFor(item) {
  const entry = item.track || item.album || item;
  return entry.images?.[0]?.url || entry.album?.images?.[0]?.url || "";
}

function LibraryCard({ item }) {
  const entry = item.track || item.album || item;
  const metadata = trackArtists(entry) || entry.owner?.display_name || "Spotify";
  return <article className="library-card">
    {artworkFor(item) ? <img src={artworkFor(item)} alt="" loading="lazy" /> : <div className="library-art-placeholder" aria-hidden="true" />}
    <div><strong>{entry.name}</strong><span>{metadata}</span></div>
  </article>;
}

function LibraryPanel({ account, library, onLoad }) {
  const tabs = [["playlists", "Playlists"], ["albums", "Albums"], ["tracks", "Saved Tracks"]];
  const activeLabel = tabs.find(([tab]) => tab === library.tab)?.[1] || "Library";
  const statusMessage = library.loading
    ? `Loading ${activeLabel.toLowerCase()}`
    : library.error
      ? `${activeLabel} could not be loaded`
      : `${library.items.length} ${activeLabel.toLowerCase()} loaded`;
  return <section className="library-panel" id="spotify-library" tabIndex="-1" aria-label="Spotify library">
    <div className="library-heading">
      {account.images?.[0]?.url && <img className="profile-avatar" src={account.images[0].url} alt="" />}
      <div><span className="section-label">Your Spotify</span><h2>Library</h2><p>Library and saves work on any Spotify account. In-browser playback requires Premium.</p></div>
    </div>
    <div className="library-tabs" aria-label="Spotify library sections">
      {tabs.map(([tab, label]) => <button key={tab} aria-pressed={library.tab === tab} onClick={() => onLoad(tab)}>{label}</button>)}
    </div>
    <div aria-busy={library.loading}>
      <p className="sr-only" role="status">{statusMessage}</p>
      {library.loading && <p>Loading {activeLabel.toLowerCase()}…</p>}
      {library.error && <p role="alert">{library.error}</p>}
      {!library.loading && !library.error && library.items.length === 0 && <p className="library-empty">No {library.tab} to show yet.</p>}
      {!library.loading && !library.error && library.items.length > 0 && <div className="library-grid">{library.items.map((item) => <LibraryCard key={item.id || item.track?.id || item.album?.id} item={item} />)}</div>}
    </div>
  </section>;
}

function Header({ account, catalogStatus, onLibrary, onLogout }) {
  const catalogUnavailable = catalogStatus === "unavailable";
  const openLibrary = () => {
    onLibrary("playlists");
    const panel = document.getElementById("spotify-library");
    panel?.focus();
    panel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  return <header className="site-header">
    <a className="brand" href="/" aria-label="Cruz Audio home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><span>CRUZ</span><span className="brand-divider">/</span><span className="brand-product">AUDIO</span></a>
    <div className="header-controls">
      {account ? <><button className="header-button" onClick={openLibrary}>Library</button>{account.images?.[0]?.url && <img className="header-avatar" src={account.images[0].url} alt="" />}<span className="profile-name">{account.display_name || account.id}</span><button className="header-button" onClick={onLogout}>Disconnect</button></> : <button className="header-button connect" onClick={() => window.location.assign("/.netlify/functions/spotify-login")}>Connect Spotify</button>}
      <span className="catalog-status" role="status" aria-label={`Catalog status: ${catalogUnavailable ? "unavailable" : "online"}`}><span className={`status-dot ${catalogStatus}`} aria-hidden="true" /><span className="catalog-prefix">Catalog </span>{catalogUnavailable ? "Unavailable" : "Online"}</span>
    </div>
  </header>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("ready");
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [saved, setSaved] = useState({});
  const [library, setLibrary] = useState({ tab: "playlists", items: [], loading: false, error: "" });
  const [notice, setNotice] = useState("");
  const authenticatedRef = useRef(false);
  const sessionRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const selectedLibraryTabRef = useRef("playlists");
  const libraryRequestRef = useRef(0);
  const savedStatusRequestRef = useRef(0);
  const savedMutationVersionRef = useRef({});
  const savePendingRef = useRef({});
  const savedRef = useRef({});

  useEffect(() => () => {
    sessionRequestRef.current += 1;
    searchRequestRef.current += 1;
    libraryRequestRef.current += 1;
    savedStatusRequestRef.current += 1;
  }, []);

  const setSession = useCallback((session) => {
    if (!session.authenticated) {
      authenticatedRef.current = false;
      setAccount(null);
      setToken("");
      setExpiresIn(0);
      savedRef.current = {};
      setSaved({});
      selectedLibraryTabRef.current = "playlists";
      libraryRequestRef.current += 1;
      savedStatusRequestRef.current += 1;
      setLibrary({ tab: "playlists", items: [], loading: false, error: "" });
      return;
    }
    authenticatedRef.current = true;
    setAccount(session.profile);
    setToken(session.accessToken);
    setExpiresIn(Number(session.expiresIn || 0));
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = ++sessionRequestRef.current;
    try {
      const session = await api("spotify-session");
      if (requestId !== sessionRequestRef.current) return;
      setSession(session);
      setNotice("");
    } catch (sessionError) {
      if (requestId !== sessionRequestRef.current) return;
      if (sessionError.status === 401) {
        setSession({ authenticated: false });
        setNotice("Your Spotify session expired. Public search is still available.");
      } else if (authenticatedRef.current) {
        setNotice("Your Spotify session could not be refreshed. We will try again later.");
      }
    }
  }, [setSession]);

  useEffect(() => { refreshSession(); }, [refreshSession]);
  useEffect(() => {
    if (!token || !expiresIn) return undefined;
    const delay = Math.max(1_000, expiresIn * 1_000 - REFRESH_EARLY_MS);
    const timer = window.setTimeout(refreshSession, delay);
    return () => window.clearTimeout(timer);
  }, [token, expiresIn, refreshSession]);

  const playerReady = useCallback(() => undefined, []);
  const player = useSpotifyPlayer(token, playerReady);
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => { if (player.error) setNotice(player.error); }, [player.error]);

  useEffect(() => {
    if (!token || tracks.length === 0) return undefined;
    const ids = tracks.map((track) => track.id).filter(Boolean);
    const requestId = ++savedStatusRequestRef.current;
    const versions = Object.fromEntries(ids.map((id) => [id, savedMutationVersionRef.current[id] || 0]));
    fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${encodeURIComponent(ids.join(","))}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Saved-track status could not be loaded.");
        return response.json();
      })
      .then((states) => {
        if (requestId !== savedStatusRequestRef.current) return;
        setSaved((current) => {
          const next = { ...current };
          ids.forEach((id, index) => {
            if ((savedMutationVersionRef.current[id] || 0) === versions[id]) next[id] = Boolean(states[index]);
          });
          savedRef.current = next;
          return next;
        });
      })
      .catch(() => {
        if (requestId === savedStatusRequestRef.current) setNotice("Saved-track status could not be loaded.");
      });
    return () => { if (requestId === savedStatusRequestRef.current) savedStatusRequestRef.current += 1; };
  }, [token, tracks]);

  const loadLibrary = useCallback(async (tab) => {
    if (!token) return;
    selectedLibraryTabRef.current = tab;
    const requestId = ++libraryRequestRef.current;
    setLibrary({ tab, items: [], loading: true, error: "" });
    try {
      const response = await fetch(`https://api.spotify.com/v1/${libraryEndpoints[tab]}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Your library could not be loaded.");
      const data = await response.json();
      if (requestId === libraryRequestRef.current) setLibrary({ tab, items: data.items || [], loading: false, error: "" });
    } catch (libraryError) {
      if (requestId === libraryRequestRef.current) setLibrary({ tab, items: [], loading: false, error: libraryError.message });
    }
  }, [token]);

  useEffect(() => {
    if (token) loadLibrary(selectedLibraryTabRef.current);
    else libraryRequestRef.current += 1;
  }, [token, loadLibrary]);

  async function submit(event, suppliedQuery) {
    event?.preventDefault();
    const value = (suppliedQuery || query).trim();
    if (!value) { setError("Enter a song, artist, or album to start searching."); return; }
    const requestId = ++searchRequestRef.current;
    setError("");
    setSearchFailed(false);
    setLoading(true);
    setSearched(true);
    setLastQuery(value);
    try {
      const data = await api(`catalog-search?q=${encodeURIComponent(value)}`);
      if (requestId !== searchRequestRef.current) return;
      setTracks(data.tracks || []);
      setCatalogStatus("ready");
    } catch (searchError) {
      if (requestId !== searchRequestRef.current) return;
      setTracks([]);
      setSearchFailed(true);
      setError(searchError.message);
      setCatalogStatus("unavailable");
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }

  async function toggleSaved(track) {
    const id = track.id;
    if (!id || !token || savePendingRef.current[id]) return;
    savePendingRef.current[id] = true;
    const previous = Boolean(savedRef.current[id]);
    const mutationVersion = (savedMutationVersionRef.current[id] || 0) + 1;
    const sessionVersion = sessionRequestRef.current;
    savedMutationVersionRef.current[id] = mutationVersion;
    const optimistic = { ...savedRef.current, [id]: !previous };
    savedRef.current = optimistic;
    setSaved(optimistic);
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${encodeURIComponent(track.id)}`, { method: previous ? "DELETE" : "PUT", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
    } catch {
      if (savedMutationVersionRef.current[id] === mutationVersion && sessionRequestRef.current === sessionVersion) {
        const rolledBack = { ...savedRef.current, [id]: previous };
        savedRef.current = rolledBack;
        setSaved(rolledBack);
        setNotice(`Could not ${previous ? "remove" : "save"} ${track.name}.`);
      }
    } finally {
      delete savePendingRef.current[id];
    }
  }

  async function playTrack(track) {
    await player.activateElement?.();
    if (!player.deviceId) { setNotice("Cruz Audio is connecting a Spotify device. Spotify Premium is required for in-browser playback."); return; }
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(player.deviceId)}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uris: [track.uri] }) });
      if (!response.ok) throw new Error();
    } catch { setNotice("Spotify could not transfer playback. Your library and saves still work; Premium is required for browser playback."); }
  }

  async function logout() {
    const requestId = ++sessionRequestRef.current;
    try {
      await api("spotify-logout", { method: "POST" });
      if (requestId !== sessionRequestRef.current) return;
      setSession({ authenticated: false });
      setNotice("");
    } catch (logoutError) {
      if (requestId === sessionRequestRef.current) setNotice(logoutError.message || "Spotify could not disconnect.");
    }
  }

  const resultStatus = loading ? "Searching the catalog" : searchFailed ? "Catalog search failed" : searched ? `${tracks.length} tracks found` : "Ready to search";
  const nowPlaying = player.playerState?.track_window?.current_track;
  return <div className="home-page">
    <Header account={account} catalogStatus={catalogStatus} onLibrary={loadLibrary} onLogout={logout} />
    {notice && <p className="account-notice" role="alert">{notice}</p>}
    <main>
      <section className="hero"><div className="hero-content"><div className="eyebrow"><span>Search</span><FiArrowRight /><span>Match</span><FiArrowRight /><span>Listen</span></div><h1>Your next listen,<span> one search away.</span></h1><p className="hero-copy">Find a track in Spotify&apos;s catalog, jump to its closest YouTube match, or save the audio for later.</p>
        <div className="search-shell"><form onSubmit={submit} className="cruz-search"><label htmlFor="track-search">What do you want to hear?</label><div className="search-control"><FiSearch className="search-icon" /><input id="track-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} aria-describedby={error ? "search-error" : "search-hint"} placeholder="Song, artist, or album" /><button type="submit" disabled={loading}><span>{loading ? "Searching" : "Find tracks"}</span><FiArrowRight /></button></div>{error ? <p className="search-message error" id="search-error" role="alert">{error}</p> : <p className="search-message" id="search-hint">Try a song title and artist for the closest match.</p>}</form><div className="popular-searches"><span>Popular now</span><div>{popularSearches.map((item) => <button type="button" key={item} onClick={() => { setQuery(item); submit(null, item); }}>{item}</button>)}</div></div></div>
        <div className="hero-proof"><span><FiCheck /> Spotify catalog search</span><span><FiCheck /> YouTube source match</span><span><FiCheck /> No account required</span></div></div></section>
      {account && <LibraryPanel account={account} library={library} onLoad={loadLibrary} />}
      <section className={`content-section ${searched ? "has-results" : ""}`} aria-label="Search results" aria-busy={loading}>
        <p className="sr-only" role="status" aria-label="Search status">{resultStatus}</p>
        {loading ? (
          <div className="results-panel"><h2>Finding the best matches...</h2></div>
        ) : searched && !searchFailed ? (
          <div className="results-panel">
            <div className="results-heading"><div><span className="section-label">Search results</span><h2>{tracks.length ? `Matches for “${lastQuery}”` : `No matches for “${lastQuery}”`}</h2></div>{tracks.length > 0 && <span className="result-count">{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</span>}</div>
            {tracks.length ? <div className="search-list">{tracks.map((track) => <SongCard key={track.id} track={track} connected={Boolean(account)} saved={saved[track.id]} onPlay={playTrack} onToggleSaved={toggleSaved} />)}</div> : <div className="no-results"><FiHeadphones /><h3>Try a different search</h3><p>Check the spelling or add the artist&apos;s name.</p></div>}
          </div>
        ) : searchFailed ? (
          <div className="results-panel search-failure"><h2>Search unavailable</h2><p>The catalog could not complete that search. Try again in a moment.</p></div>
        ) : (
          <div className="how-it-works">
            <div className="section-intro"><div><span className="section-label">Simple by design</span><h2>From a song in your head to audio in your pocket.</h2></div></div>
            <div className="steps-grid">
              <article><span className="step-number" aria-hidden="true">01</span><div className="step-icon"><FiSearch /></div><h3>Find your track</h3><p>Search by song, artist, or album across Spotify&apos;s catalog.</p></article>
              <article><span className="step-number" aria-hidden="true">02</span><div className="step-icon"><FiYoutube /></div><h3>Check the match</h3><p>Open the closest YouTube result before you save anything.</p></article>
              <article><span className="step-number" aria-hidden="true">03</span><div className="step-icon"><FiDownload /></div><h3>Save for later</h3><p>Download the audio you own or have permission to use.</p></article>
            </div>
          </div>
        )}
      </section>
    </main>
    {nowPlaying && <aside className="now-playing" aria-label="Spotify player"><div className="now-playing-status" role="status" aria-live="polite" aria-atomic="true"><strong>Now playing: {nowPlaying.name}</strong><span>{trackArtists(nowPlaying)}</span></div><button onClick={player.togglePlay}>{player.isPlaying ? "Pause" : "Play"}</button><small>Spotify Premium required for in-browser playback.</small></aside>}
    <footer><div><span className="footer-brand">CRUZ / AUDIO</span><p>Built for faster music discovery.</p></div><p className="legal-copy">Please respect creators and only download content you&apos;re authorized to use.</p></footer>
  </div>;
}
