import React, { useEffect, useState } from "react";
import "./Home.css";
import SongCard from "../components/SongCard";
import { useSelector, useDispatch } from "react-redux";
import { spotifyAccessToken } from "../api/SpotifyAccessToken";
import { setSearchInput, setTrack } from "../redux/reducers";
import { searchSpotify } from "../components/SearchSpotify";
import {
  FiArrowRight,
  FiCheck,
  FiDownload,
  FiHeadphones,
  FiSearch,
  FiYoutube,
} from "react-icons/fi";

const popularSearches = ["SZA", "Bad Bunny", "Drake", "Tame Impala"];

export default function Home() {
  const { track } = useSelector((state) => state.track);
  const { searchInput } = useSelector((state) => state.searchInput);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("loading");

  useEffect(() => {
    spotifyAccessToken(dispatch)
      .then(() => setCatalogStatus("ready"))
      .catch(() => setCatalogStatus("unavailable"));

    dispatch(setTrack([]));
  }, [dispatch]);

  async function runSearch(query) {
    setError("");
    setIsLoading(true);
    setHasSearched(true);
    setLastQuery(query);

    try {
      await searchSpotify(dispatch, query);
    } catch (searchError) {
      dispatch(setTrack([]));
      setError(searchError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const query = searchInput.trim();

    if (!query) {
      setError("Enter a song, artist, or album to start searching.");
      return;
    }

    await runSearch(query);
  }

  async function runPopularSearch(query) {
    dispatch(setSearchInput(query));
    await runSearch(query);
  }

  function handleInputChange(event) {
    const nextValue = event.target.value;
    dispatch(setSearchInput(nextValue));

    if (error) setError("");
    if (!nextValue) {
      dispatch(setTrack([]));
      setHasSearched(false);
      setLastQuery("");
    }
  }

  return (
    <div className="home-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Cruz Audio home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>CRUZ</span>
          <span className="brand-divider">/</span>
          <span className="brand-product">AUDIO</span>
        </a>

        <div className="catalog-status">
          <span className={`status-dot ${catalogStatus}`} />
          {catalogStatus === "ready"
            ? "Catalog online"
            : catalogStatus === "loading"
              ? "Connecting catalog"
              : "Catalog unavailable"}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-orb hero-orb-left" />
          <div className="hero-orb hero-orb-right" />
          <div className="hero-content">
            <div className="eyebrow">
              <span>Search</span>
              <FiArrowRight />
              <span>Match</span>
              <FiArrowRight />
              <span>Listen</span>
            </div>

            <h1>
              Your next listen,
              <span> one search away.</span>
            </h1>
            <p className="hero-copy">
              Find a track in Spotify&apos;s catalog, jump to its closest YouTube
              match, or save the audio for later.
            </p>

            <div className="search-shell">
              <form onSubmit={submit} className="cruz-search">
                <label htmlFor="track-search">What do you want to hear?</label>
                <div className="search-control">
                  <FiSearch className="search-icon" aria-hidden="true" />
                  <input
                    id="track-search"
                    name="trackSearch"
                    type="search"
                    placeholder="Song, artist, or album"
                    value={searchInput}
                    onChange={handleInputChange}
                    autoComplete="off"
                    aria-describedby={error ? "search-error" : "search-hint"}
                  />
                  <button type="submit" disabled={isLoading}>
                    <span>{isLoading ? "Searching" : "Find tracks"}</span>
                    <FiArrowRight aria-hidden="true" />
                  </button>
                </div>

                {error ? (
                  <p className="search-message error" id="search-error" role="alert">
                    {error}
                  </p>
                ) : (
                  <p className="search-message" id="search-hint">
                    Try a song title and artist for the closest match.
                  </p>
                )}
              </form>

              <div className="popular-searches">
                <span>Popular now</span>
                <div>
                  {popularSearches.map((query) => (
                    <button
                      type="button"
                      key={query}
                      onClick={() => runPopularSearch(query)}
                      disabled={isLoading}
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-proof" aria-label="Service highlights">
              <span>
                <FiCheck /> Spotify catalog search
              </span>
              <span>
                <FiCheck /> YouTube source match
              </span>
              <span>
                <FiCheck /> No account required
              </span>
            </div>
          </div>
        </section>

        <section
          className={`content-section ${hasSearched ? "has-results" : ""}`}
          aria-live="polite"
        >
          {isLoading ? (
            <div className="results-panel">
              <div className="results-heading">
                <div>
                  <span className="section-label">Searching the catalog</span>
                  <h2>Finding the best matches...</h2>
                </div>
              </div>
              <div className="skeleton-list" aria-label="Loading search results">
                {[1, 2, 3, 4].map((item) => (
                  <div className="track-skeleton" key={item}>
                    <span className="skeleton-art" />
                    <span className="skeleton-copy">
                      <i />
                      <i />
                    </span>
                    <span className="skeleton-actions" />
                  </div>
                ))}
              </div>
            </div>
          ) : hasSearched ? (
            <div className="results-panel">
              <div className="results-heading">
                <div>
                  <span className="section-label">Search results</span>
                  <h2>
                    {track.length
                      ? `Matches for “${lastQuery}”`
                      : `No matches for “${lastQuery}”`}
                  </h2>
                </div>
                {track.length > 0 && (
                  <span className="result-count">{track.length} tracks</span>
                )}
              </div>

              {track.length > 0 ? (
                <div className="search-list">
                  {track.map((item) => (
                    <SongCard
                      key={item.id}
                      image={item.album.images[0]?.url}
                      title={item.name}
                      album={item.album.name}
                      artist={item.artists.map((artist) => artist.name).join(", ")}
                    />
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <FiHeadphones />
                  <h3>Try a different search</h3>
                  <p>Check the spelling or add the artist&apos;s name.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="how-it-works">
              <div className="section-intro">
                <div>
                  <span className="section-label">Simple by design</span>
                  <h2>From a song in your head to audio in your pocket.</h2>
                </div>
              </div>

              <div className="steps-grid">
                <article>
                  <span className="step-number">01</span>
                  <div className="step-icon">
                    <FiSearch />
                  </div>
                  <h3>Find your track</h3>
                  <p>Search by song, artist, or album across Spotify&apos;s catalog.</p>
                </article>
                <article>
                  <span className="step-number">02</span>
                  <div className="step-icon">
                    <FiYoutube />
                  </div>
                  <h3>Check the match</h3>
                  <p>Open the closest YouTube result before you save anything.</p>
                </article>
                <article>
                  <span className="step-number">03</span>
                  <div className="step-icon">
                    <FiDownload />
                  </div>
                  <h3>Save for later</h3>
                  <p>Download the audio you own or have permission to use.</p>
                </article>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer>
        <div>
          <span className="footer-brand">CRUZ / AUDIO</span>
          <p>Built for faster music discovery.</p>
        </div>
        <p className="legal-copy">
          Please respect creators and only download content you&apos;re authorized
          to use.
        </p>
      </footer>
    </div>
  );
}
