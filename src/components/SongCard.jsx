import React, { useState } from "react";
import { FiArrowUpRight, FiDownload, FiHeart, FiLoader, FiMusic, FiPlay } from "react-icons/fi";
import "./SongCard.css";

async function responseData(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "That action could not be completed.");
  return data;
}

export default function SongCard({ track, onPlay, onToggleSaved, saved = false, connected = false }) {
  const [activeAction, setActiveAction] = useState("");
  const [actionError, setActionError] = useState("");
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
    return runAction("youtube", async () => {
      const { youtubeUrl } = await matchVideo();
      if (!youtubeUrl) throw new Error("No YouTube match was found.");
      window.open(youtubeUrl, "_blank", "noopener,noreferrer");
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
    <div className="track-art">{artwork ? <img src={artwork} alt="" loading="lazy" /> : <FiMusic />}</div>
    <div className="track-copy"><h3>{title}</h3><p>{artist}</p><span>{track.album?.name}</span>{actionError && <small role="alert">{actionError}</small>}</div>
    <div className={`track-actions ${connected ? "connected" : ""}`}>
      {connected && <><button type="button" className="track-action secondary" aria-label={`Play ${title}`} onClick={() => runAction("play", () => onPlay(track))} disabled={isBusy}><FiPlay /><span>Play</span></button><button type="button" className="track-action secondary icon-action" aria-label={`${saved ? "Remove" : "Save"} ${title}`} aria-pressed={saved} onClick={() => runAction("save", () => onToggleSaved(track))} disabled={isBusy}>{activeAction === "save" ? <FiLoader className="spin" /> : <FiHeart fill={saved ? "currentColor" : "none"} />}<span>{saved ? "Remove" : "Save"}</span></button></>}
      <button type="button" className="track-action secondary" onClick={openYoutube} disabled={isBusy} aria-label={`Open ${title} on YouTube`}>{activeAction === "youtube" ? <FiLoader className="spin" /> : <FiArrowUpRight />}<span>YouTube</span></button>
      <button type="button" className="track-action primary" onClick={downloadTrack} disabled={isBusy} aria-label={`Download ${title} as MP3`}>{activeAction === "download" ? <FiLoader className="spin" /> : <FiDownload />}<span>MP3</span></button>
    </div>
  </article>;
}
