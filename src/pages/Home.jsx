import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheck, FiDownload, FiHeadphones, FiSearch, FiYoutube } from "react-icons/fi";
import SongCard from "../components/SongCard";
import SpotifyLibrary from "../components/SpotifyLibrary";
import SpotifyLyrics from "../components/SpotifyLyrics";
import SpotifyNowPlaying from "../components/SpotifyNowPlaying";
import { spotifyUserRequest } from "../api/spotifyUserRequest";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { parseSyncedLyrics, splitPlainLyrics } from "../utils/lyrics";
import "./Home.css";

const popularSearches = ["SZA", "Bad Bunny", "Drake", "Tame Impala"];
const REFRESH_EARLY_MS = 30_000;
const libraryEndpoints = { playlists: "me/playlists?limit=20", albums: "me/albums?limit=20", tracks: "me/tracks?limit=20" };
const emptyLyrics = {
  trackId: "",
  lines: [],
  plainLines: [],
  loading: false,
  error: "",
  instrumental: false,
  source: "",
};

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
  const [savePending, setSavePending] = useState({});
  const [library, setLibrary] = useState({ tab: "playlists", items: [], loading: false, error: "" });
  const [notice, setNotice] = useState("");
  const [playerNotice, setPlayerNotice] = useState("");
  const [playbackDevices, setPlaybackDevices] = useState({
    items: [],
    loading: false,
    transferring: "",
    error: "",
  });
  const [playbackTargetId, setPlaybackTargetId] = useState("");
  const [remotePlayback, setRemotePlayback] = useState({
    track: null,
    isPlaying: false,
    position: 0,
    duration: 0,
  });
  const [lyrics, setLyrics] = useState(emptyLyrics);
  const [lyricsRetryKey, setLyricsRetryKey] = useState(0);
  const authenticatedRef = useRef(false);
  const sessionRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const selectedLibraryTabRef = useRef("playlists");
  const libraryRequestRef = useRef(0);
  const savedStatusRequestRef = useRef(0);
  const deviceRequestRef = useRef(0);
  const deviceTransferRef = useRef(0);
  const lyricsRequestRef = useRef(0);
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
    deviceRequestRef.current += 1;
    deviceTransferRef.current += 1;
    lyricsRequestRef.current += 1;
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
      savedMutationVersionRef.current = {};
      savePendingRef.current = {};
      setSaved({});
      setSavePending({});
      selectedLibraryTabRef.current = "playlists";
      libraryRequestRef.current += 1;
      savedStatusRequestRef.current += 1;
      deviceRequestRef.current += 1;
      deviceTransferRef.current += 1;
      lyricsRequestRef.current += 1;
      setLibrary({ tab: "playlists", items: [], loading: false, error: "" });
      setPlaybackDevices({ items: [], loading: false, transferring: "", error: "" });
      setPlaybackTargetId("");
      setRemotePlayback({ track: null, isPlaying: false, position: 0, duration: 0 });
      setLyrics(emptyLyrics);
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
  const browserNowPlaying = player.playerState?.track_window?.current_track;
  const isRemotePlayback = Boolean(playbackTargetId && playbackTargetId !== player.deviceId);
  const nowPlaying = isRemotePlayback ? (remotePlayback.track || browserNowPlaying) : browserNowPlaying;
  const playbackIsPlaying = isRemotePlayback ? remotePlayback.isPlaying : player.isPlaying;
  const playbackPosition = isRemotePlayback ? remotePlayback.position : player.position;
  const playbackDuration = isRemotePlayback ? remotePlayback.duration : player.duration;
  const nowPlayingId = nowPlaying?.id || "";
  const lyricsTrackName = nowPlaying?.name?.trim() || "";
  const lyricsArtist = (nowPlaying?.artists || []).map((artist) => artist.name).filter(Boolean).join(", ");
  const lyricsAlbum = nowPlaying?.album?.name?.trim() || "";
  const lyricsDurationSeconds = Math.round(Number(playbackDuration || nowPlaying?.duration_ms || 0) / 1000);
  const lyricsAvailable = Boolean(
    account
    && nowPlayingId
    && lyricsTrackName
    && lyricsArtist
    && lyricsAlbum
    && lyricsDurationSeconds,
  );
  useEffect(() => { savedRef.current = saved; }, [saved]);

  useEffect(() => {
    if (!lyricsAvailable) {
      lyricsRequestRef.current += 1;
      setLyrics(emptyLyrics);
      return undefined;
    }
    const requestId = ++lyricsRequestRef.current;
    setLyrics({
      ...emptyLyrics,
      trackId: nowPlayingId,
      loading: true,
    });
    const parameters = new URLSearchParams({
      track: lyricsTrackName,
      artist: lyricsArtist,
      album: lyricsAlbum,
      duration: String(lyricsDurationSeconds),
    });
    api(`lyrics?${parameters.toString()}`)
      .then((data) => {
        if (requestId !== lyricsRequestRef.current || !authenticatedRef.current) return;
        setLyrics({
          trackId: nowPlayingId,
          lines: parseSyncedLyrics(data.syncedLyrics),
          plainLines: splitPlainLyrics(data.plainLyrics),
          loading: false,
          error: "",
          instrumental: Boolean(data.instrumental),
          source: data.source || "",
        });
      })
      .catch((lyricsError) => {
        if (requestId !== lyricsRequestRef.current || !authenticatedRef.current) return;
        setLyrics({
          ...emptyLyrics,
          trackId: nowPlayingId,
          error: lyricsError.message || "Lyrics are temporarily unavailable.",
        });
      });
    return () => {
      if (requestId === lyricsRequestRef.current) lyricsRequestRef.current += 1;
    };
  }, [
    lyricsAlbum,
    lyricsArtist,
    lyricsAvailable,
    lyricsDurationSeconds,
    lyricsRetryKey,
    lyricsTrackName,
    nowPlayingId,
  ]);

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
    if (!token) return undefined;
    const ids = [...new Set([...tracks.map((track) => track.id), nowPlayingId].filter(Boolean))];
    if (ids.length === 0) return undefined;
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
  }, [nowPlayingId, spotifyRequest, token, tracks]);

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

  const loadPlaybackDevices = useCallback(async () => {
    if (!tokenRef.current) return false;
    const requestId = ++deviceRequestRef.current;
    setPlaybackDevices((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await spotifyRequest("https://api.spotify.com/v1/me/player/devices");
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (requestId !== deviceRequestRef.current || !authenticatedRef.current) return false;
      const items = (data.devices || []).filter((device) => device?.id);
      const activeDevice = items.find((device) => device.is_active);
      setPlaybackDevices({ items, loading: false, transferring: "", error: "" });
      if (activeDevice) {
        setPlaybackTargetId(activeDevice.id);
        if (activeDevice.id !== player.deviceId) {
          try {
            const playbackResponse = await spotifyRequest("https://api.spotify.com/v1/me/player");
            if (
              playbackResponse.ok
              && playbackResponse.status !== 204
              && requestId === deviceRequestRef.current
              && authenticatedRef.current
            ) {
              const playback = await playbackResponse.json();
              setRemotePlayback({
                track: playback.item || null,
                isPlaying: Boolean(playback.is_playing),
                position: Number(playback.progress_ms || 0),
                duration: Number(playback.item?.duration_ms || 0),
              });
            }
          } catch {
            // The device list remains useful even when the optional playback snapshot is unavailable.
          }
        }
      }
      return true;
    } catch {
      if (requestId !== deviceRequestRef.current || !authenticatedRef.current) return false;
      setPlaybackDevices((current) => ({
        ...current,
        loading: false,
        transferring: "",
        error: "Spotify devices could not be loaded. Open Spotify on the device and try again.",
      }));
      return false;
    }
  }, [player.deviceId, spotifyRequest]);

  const transferPlayback = useCallback(async (device) => {
    if (!device?.id || device.is_restricted || !tokenRef.current) return false;
    if (device.is_active) {
      setPlaybackTargetId(device.id);
      return true;
    }
    if (device.id === player.deviceId) await player.activateElement?.();
    const transferId = ++deviceTransferRef.current;
    setPlaybackDevices((current) => ({ ...current, transferring: device.id, error: "" }));
    try {
      const response = await spotifyRequest("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_ids: [device.id] }),
      });
      if (!response.ok) throw new Error();
      if (transferId !== deviceTransferRef.current || !authenticatedRef.current) return false;
      if (device.id !== player.deviceId) {
        setRemotePlayback({
          track: browserNowPlaying || null,
          isPlaying: Boolean(player.isPlaying),
          position: Number(player.position || 0),
          duration: Number(player.duration || browserNowPlaying?.duration_ms || 0),
        });
      }
      setPlaybackTargetId(device.id);
      setPlaybackDevices((current) => ({
        ...current,
        items: current.items.map((item) => ({
          ...item,
          is_active: item.id === device.id,
        })),
        transferring: "",
        error: "",
      }));
      return true;
    } catch {
      if (transferId === deviceTransferRef.current && authenticatedRef.current) {
        setPlaybackDevices((current) => ({
          ...current,
          transferring: "",
          error: "Spotify could not switch devices. Make sure Spotify is open there and try again.",
        }));
      }
      return false;
    }
  }, [browserNowPlaying, player, spotifyRequest]);

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
    setSavePending((current) => ({ ...current, [id]: true }));
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
      setSavePending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  async function playSpotifyItem(item) {
    const targetId = playbackTargetId || player.deviceId;
    if (targetId && targetId === player.deviceId) await player.activateElement?.();
    if (!targetId) { setNotice("Cruz Audio is connecting a Spotify device. Spotify Premium is required for in-browser playback."); return; }
    try {
      const playback = item.type === "track" ? { uris: [item.uri] } : { context_uri: item.uri };
      const response = await spotifyRequest(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(targetId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playback),
      });
      if (!response.ok) throw new Error();
      if (targetId !== player.deviceId) {
        setRemotePlayback((current) => ({
          track: item.type === "track" ? item : current.track,
          isPlaying: true,
          position: 0,
          duration: item.type === "track" ? Number(item.duration_ms || 0) : current.duration,
        }));
      }
      setNotice("");
    } catch { setNotice("Spotify could not transfer playback. Your library and saves still work; Premium is required for browser playback."); }
  }

  async function togglePlayerPlayback() {
    const targetId = playbackTargetId || player.deviceId;
    if (!targetId) return;
    if (targetId === player.deviceId) {
      await player.activateElement?.();
      await player.togglePlay?.();
      return;
    }
    try {
      const action = playbackIsPlaying ? "pause" : "play";
      const response = await spotifyRequest(`https://api.spotify.com/v1/me/player/${action}?device_id=${encodeURIComponent(targetId)}`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error();
      setRemotePlayback((current) => ({ ...current, isPlaying: !playbackIsPlaying }));
      setNotice("");
    } catch {
      setNotice("Spotify could not update playback on that device.");
    }
  }

  async function skipRemote(direction) {
    const targetId = playbackTargetId || player.deviceId;
    if (!targetId || targetId === player.deviceId) {
      await player[direction === "next" ? "nextTrack" : "previousTrack"]?.();
      return;
    }
    try {
      const response = await spotifyRequest(`https://api.spotify.com/v1/me/player/${direction}?device_id=${encodeURIComponent(targetId)}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      setNotice("");
    } catch {
      setNotice(`Spotify could not skip to the ${direction} track on that device.`);
    }
  }

  async function seekPlayback(position) {
    const targetId = playbackTargetId || player.deviceId;
    if (!targetId || targetId === player.deviceId) {
      await player.seek?.(position);
      return;
    }
    try {
      const response = await spotifyRequest(`https://api.spotify.com/v1/me/player/seek?position_ms=${encodeURIComponent(position)}&device_id=${encodeURIComponent(targetId)}`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error();
      setRemotePlayback((current) => ({ ...current, position }));
      setNotice("");
    } catch {
      setNotice("Spotify could not seek on that device.");
    }
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

  function openLyrics() {
    const panel = document.getElementById("spotify-lyrics");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    panel?.focus();
    panel?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  const resultStatus = loading ? "Searching the catalog" : searchFailed ? "Catalog search failed" : searched ? `${tracks.length} tracks found` : "Ready to search";
  return <div className={`home-page ${account ? "has-spotify-player" : ""}`}>
    <Header account={account} catalogStatus={catalogStatus} onLibrary={loadLibrary} onLogout={logout} />
    {notice && <p className="account-notice" role="alert">{notice}</p>}
    <main>
      <section className={`hero ${searched ? "is-collapsed" : ""}`}><div className="hero-content">
        {searched
          ? <div className="collapsed-search-heading"><span className="section-label">Search</span><h1>Find another track.</h1></div>
          : <><div className="eyebrow"><span>Search</span><FiArrowRight /><span>Match</span><FiArrowRight /><span>Listen</span></div><h1>Your next listen,<span> one search away.</span></h1><p className="hero-copy">Find a track in Spotify&apos;s catalog, jump to its closest YouTube match, or save the audio for later.</p></>}
        <div className="search-shell"><form onSubmit={submit} className="cruz-search"><label htmlFor="track-search">What do you want to hear?</label><div className="search-control"><FiSearch className="search-icon" /><input id="track-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} aria-describedby={error ? "search-error" : "search-hint"} placeholder="Song, artist, or album" /><button type="submit" disabled={loading}><span>{loading ? "Searching" : "Find tracks"}</span><FiArrowRight /></button></div>{error ? <p className="search-message error" id="search-error" role="alert">{error}</p> : <p className="search-message" id="search-hint">Try a song title and artist for the closest match.</p>}</form>{!searched && <div className="popular-searches"><span>Popular now</span><div>{popularSearches.map((item) => <button type="button" key={item} onClick={() => { setQuery(item); submit(null, item); }}>{item}</button>)}</div></div>}</div>
        {!searched && <div className="hero-proof"><span><FiCheck /> Spotify catalog search</span><span><FiCheck /> YouTube source match</span><span><FiCheck /> No account required</span></div>}</div></section>
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
      {lyricsAvailable && <SpotifyLyrics
        track={nowPlaying}
        isPlaying={playbackIsPlaying}
        position={playbackPosition}
        duration={playbackDuration}
        lyrics={lyrics}
        onSeek={seekPlayback}
        onRetry={() => setLyricsRetryKey((current) => current + 1)}
      />}
      {account && <SpotifyLibrary account={account} library={library} saved={saved} onLoad={loadLibrary} onPlay={playSpotifyItem} onToggleSaved={toggleSaved} />}
    </main>
    {account && <SpotifyNowPlaying
      track={nowPlaying}
      isPlaying={playbackIsPlaying}
      isReady={Boolean(playbackTargetId || player.deviceId)}
      error={isRemotePlayback ? "" : playerNotice}
      position={playbackPosition}
      duration={playbackDuration}
      onTogglePlay={togglePlayerPlayback}
      onPrevious={() => skipRemote("previous")}
      onNext={() => skipRemote("next")}
      onSeek={seekPlayback}
      saved={Boolean(nowPlayingId && saved[nowPlayingId])}
      savePending={Boolean(nowPlayingId && savePending[nowPlayingId])}
      onToggleSaved={toggleSaved}
      onOpenLyrics={lyricsAvailable ? openLyrics : undefined}
      devices={playbackDevices.items}
      devicesLoading={playbackDevices.loading}
      deviceTransferring={playbackDevices.transferring}
      deviceError={playbackDevices.error}
      onRequestDevices={loadPlaybackDevices}
      onSelectDevice={transferPlayback}
      activeDeviceName={playbackDevices.items.find((device) => device.id === playbackTargetId)?.name}
      isRemoteDevice={isRemotePlayback}
    />}
    <footer><div><span className="footer-brand">CRUZ / AUDIO</span><p>Built for faster music discovery.</p></div><p className="legal-copy">Please respect creators and only download content you&apos;re authorized to use.</p></footer>
  </div>;
}
