import React, { useState } from "react";
import { FiDownload, FiHeart, FiLoader, FiMusic, FiPlay, FiYoutube } from "react-icons/fi";
import "./SongCard.css";

async function responseData(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "That action could not be completed.");
  return data;
}

export default function SongCard({ track, onPlay, onToggleSaved, saved = false, connected = false }) {
  const [activeAction, setActiveAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [artworkFailed, setArtworkFailed] = useState(false);
  const title = track.name;
  const artist = track.artists.map((item) => item.name).join(", ");
  const artwork = track.album?.images?.[0]?.url;
  const isBusy = Boolean(activeAction);

  async function matchVideo() {
    const query = encodeURIComponent(`${title} ${artist}`);
    return responseData(await fetch(`/.netlify/functions/youtube-match?q=${query}`));
  }

  async function runAction(name, action) {
    setActionError("");
    setActiveAction(name);
    try { await action(); }
    catch (actionFailure) { setActionError(actionFailure.message || "That action could not be completed."); }
    finally { setActiveAction(""); }
  }

  function openYoutube() {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    return runAction("youtube", async () => {
      try {
        const { youtubeUrl } = await matchVideo();
        if (!youtubeUrl) throw new Error("No YouTube match was found.");
        if (popup) popup.location.replace(youtubeUrl);
        else window.location.assign(youtubeUrl);
      } catch (matchError) {
        popup?.close();
        throw matchError;
      }
    });
  }

  function downloadTrack() {
    return runAction("download", async () => {
      const { videoId, conversionGrant } = await matchVideo();
      const data = await responseData(await fetch("/.netlify/functions/convert-mp3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, conversionGrant }),
      }));
      if (!data.downloadUrl) throw new Error("The download is not ready. Try again.");
      window.location.assign(data.downloadUrl);
    });
  }

  return <article className="track-card">
    <div className="track-art">{artwork && !artworkFailed ? <img src={artwork} alt="" loading="lazy" onError={() => setArtworkFailed(true)} /> : <FiMusic />}</div>
    <div className="track-copy"><h3>{title}</h3><p>{artist}</p><span>{track.album?.name}</span>{actionError && <small role="alert">{actionError}</small>}</div>
    <div className={`track-actions ${connected ? "connected" : ""}`}>
      {connected && <><button type="button" className="track-action secondary" aria-label={`Play ${title}`} title={`Play ${title}`} onClick={() => runAction("play", () => onPlay(track))} disabled={isBusy}><FiPlay /></button><button type="button" className="track-action secondary save-action" aria-label={`${saved ? "Remove" : "Save"} ${title}`} title={`${saved ? "Remove" : "Save"} ${title}`} aria-pressed={saved} onClick={() => runAction("save", () => onToggleSaved(track))} disabled={isBusy}>{activeAction === "save" ? <FiLoader className="spin" /> : <FiHeart fill={saved ? "currentColor" : "none"} />}</button></>}
      <button type="button" className="track-action secondary youtube-action" onClick={openYoutube} disabled={isBusy} aria-label={`Open ${title} on YouTube`} title={`Open ${title} on YouTube`}>{activeAction === "youtube" ? <FiLoader className="spin" /> : <FiYoutube />}</button>
      <button type="button" className="track-action primary" onClick={downloadTrack} disabled={isBusy} aria-label={`Download ${title} as MP3`} title={`Download ${title} as MP3`}>{activeAction === "download" ? <FiLoader className="spin" /> : <FiDownload />}</button>
    </div>
  </article>;
}
