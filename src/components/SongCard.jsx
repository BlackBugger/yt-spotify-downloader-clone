import React, { useState } from "react";
import { yTdApi } from "../api/api";
import {
  FiArrowUpRight,
  FiDownload,
  FiLoader,
  FiMusic,
} from "react-icons/fi";
import "./SongCard.css";

const SongCard = ({ image, title, artist, album }) => {
  const [activeAction, setActiveAction] = useState("");
  const [actionError, setActionError] = useState("");

  async function findYoutubeVideo() {
    const key = process.env.REACT_APP_YOUTUBE_API_KEY;
    if (!key) throw new Error("YouTube matching is not configured.");

    const query = encodeURIComponent(`${title} by ${artist}`);
    const response = await fetch(
      `https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&q=${query}&key=${key}`
    );

    if (!response.ok) throw new Error("We couldn't find a YouTube match.");

    const data = await response.json();
    const videoId = data?.items?.[0]?.id?.videoId;

    if (!videoId) throw new Error("No YouTube match was found.");
    return videoId;
  }

  async function openYoutube() {
    setActionError("");
    setActiveAction("youtube");

    try {
      const videoId = await findYoutubeVideo();
      window.open(
        `https://www.youtube.com/watch?v=${videoId}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActiveAction("");
    }
  }

  async function downloadTrack() {
    setActionError("");
    setActiveAction("download");

    try {
      const videoId = await findYoutubeVideo();
      const response = await yTdApi.get(`dl?id=${videoId}`);
      const downloadLink = response?.data?.link;

      if (!downloadLink) throw new Error("The download is not ready. Try again.");
      window.location.assign(downloadLink);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActiveAction("");
    }
  }

  const isBusy = Boolean(activeAction);

  return (
    <article className="track-card">
      <div className="track-art">
        {image ? <img src={image} alt="" loading="lazy" /> : <FiMusic />}
      </div>
      <div className="track-copy">
        <h3>{title}</h3>
        <p>{artist}</p>
        <span>{album}</span>
        {actionError && <small role="alert">{actionError}</small>}
      </div>
      <div className="track-actions">
        <button
          type="button"
          className="track-action secondary"
          onClick={openYoutube}
          disabled={isBusy}
          aria-label={`Open ${title} on YouTube`}
        >
          {activeAction === "youtube" ? (
            <FiLoader className="spin" />
          ) : (
            <FiArrowUpRight />
          )}
          <span>YouTube</span>
        </button>
        <button
          type="button"
          className="track-action primary"
          onClick={downloadTrack}
          disabled={isBusy}
          aria-label={`Download ${title} as MP3`}
        >
          {activeAction === "download" ? (
            <FiLoader className="spin" />
          ) : (
            <FiDownload />
          )}
          <span>MP3</span>
        </button>
      </div>
    </article>
  );
};

export default SongCard;
