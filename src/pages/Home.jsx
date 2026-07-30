import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheck, FiDownload, FiHeadphones, FiSearch, FiYoutube } from "react-icons/fi";
import SongCard from "../components/SongCard";
import SpotifyLibrary from "../components/SpotifyLibrary";
import SpotifyNowPlaying from "../components/SpotifyNowPlaying";
import { spotifyUserRequest } from "../api/spotifyUserRequest";
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

function Header({ account, catalogStatus, onLibrary, onLogout }) {
  const catalogLabel = {
    idle: "Ready",
    loading: "Checking",
    ready: "Online",
    unavailable: "Unavailable",
  }[catalogStatus] || "Ready";
  const openLibrary = () => {
    onLibrary("playlists");
    const panel = document.getElementById("spotify-library");
    panel?.focus();
    panel?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  return <header className="site-header">
    <a className="brand" href="/" aria-label="Cruz Audio home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><span>CRUZ</span><span className="brand-divider">/</span><span className="brand-product">AUDIO</span></a>
    <div className={`header-controls ${account ? "connected" : "public"}`}>
      {account ? <><button className="header-button" onClick={openLibrary}>Library</button>{account.images?.[0]?.url && <img className="header-avatar" src={account.images[0].url} alt="" />}<span className="profile-name">{account.display_name || account.id}</span><button className="header-button" onClick={onLogout}>Disconnect</button></> : <button className="header-button connect" onClick={() => window.location.assign("/.netlify/functions/spotify-login")}>Connect Spotify</button>}
      <span className="catalog-status" role="status" aria-label={`Catalog status: ${catalogLabel.toLowerCase()}`}><span className={`status-dot ${catalogStatus}`} aria-hidden="true" /><span className="catalog-prefix">Catalog </span>{catalogLabel}</span>
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
  const [catalogStatus, setCatalogStatus] = useState("idle");
  const [account, setAccount] = useState(null);
  const [token, setToken] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [saved, setSaved] = useState({});
  const [library, setLibrary] = useState({ tab: "playlists", items: [], loading: false, error: "" });
  const [notice, setNotice] = useState("");
  const [playerNotice, setPlayerNotice] = useState("");
  const authenticatedRef = useRef(false);
  const sessionRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const selectedLibraryTabRef = useRef("playlists");
  const libraryRequestRef = useRef(0);
  const savedStatusRequestRef = useRef(0);
  const savedMutationVersionRef = useRef({});
  const savePendingRef = useRef({});
  const savedRef = useRef({});
  const playerAuthRecoveryRef = useRef(false);
  const tokenRef = useRef("");
  const sessionRefreshPromiseRef = useRef(null);

  useEffect(() => () => {
    sessionRequestRef.current += 1;
    searchRequestRef.current += 1;
    libraryRequestRef.current += 1;
    savedStatusRequestRef.current += 1;
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthParameters = ["code", "state", "ubi"];
    const shouldClean = oauthParameters.some((parameter) => url.searchParams.has(parameter));
    if (!shouldClean) return;
    oauthParameters.forEach((parameter) => url.searchParams.delete(parameter));
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const setSession = useCallback((session) => {
    if (!session.authenticated) {
      authenticatedRef.current = false;
      tokenRef.current = "";
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
    tokenRef.current = session.accessToken;
    setAccount(session.profile);
    setToken(session.accessToken);
    setExpiresIn(Number(session.expiresIn || 0));
  }, []);

  const refreshSession = useCallback(() => {
    if (sessionRefreshPromiseRef.current) return sessionRefreshPromiseRef.current;
    const requestId = ++sessionRequestRef.current;
    const pending = (async () => {
      try {
        const session = await api("spotify-session");
        if (requestId !== sessionRequestRef.current) return null;
        setSession(session);
        setNotice("");
        return session;
      } catch (sessionError) {
        if (requestId !== sessionRequestRef.current) return null;
        if (sessionError.status === 401) {
          setSession({ authenticated: false });
          setNotice("Your Spotify session expired. Public search is still available.");
        } else if (authenticatedRef.current) {
          setNotice("Your Spotify session could not be refreshed. We will try again later.");
        }
        return null;
      }
    })();
    sessionRefreshPromiseRef.current = pending;
    pending.finally(() => {
      if (sessionRefreshPromiseRef.current === pending) sessionRefreshPromiseRef.current = null;
    });
    return pending;
  }, [setSession]);

  const spotifyRequest = useCallback((url, options) => spotifyUserRequest(url, options, {
    getAccessToken: () => tokenRef.current,
    refreshAccessToken: refreshSession,
  }), [refreshSession]);

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
  useEffect(() => {
    if (!player.error) {
      playerAuthRecoveryRef.current = false;
      setPlayerNotice("");
      return;
    }
    if (player.errorType === "authentication") {
      setPlayerNotice("Refreshing your Spotify playback session.");
      if (!playerAuthRecoveryRef.current) {
        playerAuthRecoveryRef.current = true;
        refreshSession();
      }
      return;
    }
    setPlayerNotice(player.error);
  }, [player.error, player.errorType, refreshSession]);

  useEffect(() => {
    if (!token || tracks.length === 0) return undefined;
    const ids = tracks.map((track) => track.id).filter(Boolean);
    const requestId = ++savedStatusRequestRef.current;
    const versions = Object.fromEntries(ids.map((id) => [id, savedMutationVersionRef.current[id] || 0]));
    spotifyRequest(`https://api.spotify.com/v1/me/tracks/contains?ids=${encodeURIComponent(ids.join(","))}`)
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
  }, [spotifyRequest, token, tracks]);

  const loadLibrary = useCallback(async (tab) => {
    if (!token) return;
    selectedLibraryTabRef.current = tab;
    const requestId = ++libraryRequestRef.current;
    setLibrary({ tab, items: [], loading: true, error: "" });
    try {
      const response = await spotifyRequest(`https://api.spotify.com/v1/${libraryEndpoints[tab]}`);
      if (!response.ok) throw new Error("Your library could not be loaded.");
      const data = await response.json();
      if (requestId === libraryRequestRef.current) {
        const items = data.items || [];
        if (tab === "tracks") {
          setSaved((current) => {
            const next = { ...current };
            items.forEach(({ track }) => { if (track?.id) next[track.id] = true; });
            savedRef.current = next;
            return next;
          });
        }
        setLibrary({ tab, items, loading: false, error: "" });
      }
    } catch (libraryError) {
      if (requestId === libraryRequestRef.current) setLibrary({ tab, items: [], loading: false, error: libraryError.message });
    }
  }, [spotifyRequest, token]);

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
    setCatalogStatus("loading");
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
    savedMutationVersionRef.current[id] = mutationVersion;
    const optimistic = { ...savedRef.current, [id]: !previous };
    savedRef.current = optimistic;
    setSaved(optimistic);
    try {
      const response = await spotifyRequest(`https://api.spotify.com/v1/me/tracks?ids=${encodeURIComponent(track.id)}`, { method: previous ? "DELETE" : "PUT" });
      if (!response.ok) throw new Error();
      if (previous && selectedLibraryTabRef.current === "tracks") {
        setLibrary((current) => ({
          ...current,
          items: current.items.filter((item) => item.track?.id !== id),
        }));
      }
      return true;
    } catch {
      if (savedMutationVersionRef.current[id] === mutationVersion && authenticatedRef.current) {
        const rolledBack = { ...savedRef.current, [id]: previous };
        savedRef.current = rolledBack;
        setSaved(rolledBack);
        setNotice(`Could not ${previous ? "remove" : "save"} ${track.name}.`);
      }
      return false;
    } finally {
      delete savePendingRef.current[id];
    }
  }

  async function playSpotifyItem(item) {
    await player.activateElement?.();
    if (!player.deviceId) { setNotice("Cruz Audio is connecting a Spotify device. Spotify Premium is required for in-browser playback."); return; }
    try {
      const playback = item.type === "track" ? { uris: [item.uri] } : { context_uri: item.uri };
      const response = await spotifyRequest(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(player.deviceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playback),
      });
      if (!response.ok) throw new Error();
      setNotice("");
    } catch { setNotice("Spotify could not transfer playback. Your library and saves still work; Premium is required for browser playback."); }
  }

  async function togglePlayerPlayback() {
    await player.activateElement?.();
    await player.togglePlay?.();
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
  return <div className={`home-page ${account ? "has-spotify-player" : ""}`}>
    <Header account={account} catalogStatus={catalogStatus} onLibrary={loadLibrary} onLogout={logout} />
    {notice && <p className="account-notice" role="alert">{notice}</p>}
    <main>
      <section className="hero"><div className="hero-content"><div className="eyebrow"><span>Search</span><FiArrowRight /><span>Match</span><FiArrowRight /><span>Listen</span></div><h1>Your next listen,<span> one search away.</span></h1><p className="hero-copy">Find a track in Spotify&apos;s catalog, jump to its closest YouTube match, or save the audio for later.</p>
        <div className="search-shell"><form onSubmit={submit} className="cruz-search"><label htmlFor="track-search">What do you want to hear?</label><div className="search-control"><FiSearch className="search-icon" /><input id="track-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} aria-describedby={error ? "search-error" : "search-hint"} placeholder="Song, artist, or album" /><button type="submit" disabled={loading}><span>{loading ? "Searching" : "Find tracks"}</span><FiArrowRight /></button></div>{error ? <p className="search-message error" id="search-error" role="alert">{error}</p> : <p className="search-message" id="search-hint">Try a song title and artist for the closest match.</p>}</form><div className="popular-searches"><span>Popular now</span><div>{popularSearches.map((item) => <button type="button" key={item} onClick={() => { setQuery(item); submit(null, item); }}>{item}</button>)}</div></div></div>
        <div className="hero-proof"><span><FiCheck /> Spotify catalog search</span><span><FiCheck /> YouTube source match</span><span><FiCheck /> No account required</span></div></div></section>
      {account && <SpotifyLibrary account={account} library={library} saved={saved} onLoad={loadLibrary} onPlay={playSpotifyItem} onToggleSaved={toggleSaved} />}
      <section className={`content-section ${searched ? "has-results" : ""}`} aria-label="Search results" aria-busy={loading}>
        <p className="sr-only" role="status" aria-label="Search status">{resultStatus}</p>
        {loading ? (
          <div className="results-panel"><h2>Finding the best matches...</h2></div>
        ) : searched && !searchFailed ? (
          <div className="results-panel">
            <div className="results-heading"><div><span className="section-label">Search results</span><h2>{tracks.length ? `Matches for “${lastQuery}”` : `No matches for “${lastQuery}”`}</h2></div>{tracks.length > 0 && <span className="result-count">{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</span>}</div>
            {tracks.length ? <div className="search-list">{tracks.map((track) => <SongCard key={track.id} track={track} connected={Boolean(account)} saved={saved[track.id]} onPlay={playSpotifyItem} onToggleSaved={toggleSaved} />)}</div> : <div className="no-results"><FiHeadphones /><h3>Try a different search</h3><p>Check the spelling or add the artist&apos;s name.</p></div>}
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
    {account && <SpotifyNowPlaying
      track={nowPlaying}
      isPlaying={player.isPlaying}
      isReady={Boolean(player.deviceId)}
      error={playerNotice}
      position={player.position}
      duration={player.duration}
      onTogglePlay={togglePlayerPlayback}
      onPrevious={player.previousTrack}
      onNext={player.nextTrack}
      onSeek={player.seek}
    />}
    <footer><div><span className="footer-brand">CRUZ / AUDIO</span><p>Built for faster music discovery.</p></div><p className="legal-copy">Please respect creators and only download content you&apos;re authorized to use.</p></footer>
  </div>;
}
