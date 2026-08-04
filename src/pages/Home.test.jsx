import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "./Home";

const mockSpotifyPlayer = {
  deviceId: "",
  error: "",
  errorType: "",
  playerState: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  togglePlay: jest.fn(),
  activateElement: jest.fn(() => Promise.resolve()),
  previousTrack: jest.fn(),
  nextTrack: jest.fn(),
  seek: jest.fn(),
  setVolume: jest.fn(() => Promise.resolve(true)),
};

jest.mock("../hooks/useSpotifyPlayer", () => ({
  useSpotifyPlayer: () => mockSpotifyPlayer,
}));

const unauthenticated = { ok: true, json: async () => ({ authenticated: false }) };
const tracks = Array.from({ length: 12 }, (_, index) => ({
  id: `track-${index}`,
  name: `Track ${index + 1}`,
  artists: [{ name: "Artist" }],
  album: { name: "Album", images: [] },
  uri: `spotify:track:${index}`,
}));
const originalConsoleError = console.error;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, reject, resolve };
}

beforeEach(() => {
  Object.assign(mockSpotifyPlayer, {
    deviceId: "",
    error: "",
    errorType: "",
    playerState: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 1,
    togglePlay: jest.fn(),
    activateElement: jest.fn(() => Promise.resolve()),
    previousTrack: jest.fn(),
    nextTrack: jest.fn(),
    seek: jest.fn(),
    setVolume: jest.fn(() => Promise.resolve(true)),
  });
  jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("not wrapped in act")) {
      throw new Error("React act warning");
    }
    originalConsoleError(message, ...args);
  });
  global.fetch = jest.fn(() => Promise.resolve(unauthenticated));
  window.history.replaceState({}, "", "/");
});

afterEach(() => jest.restoreAllMocks());

test("renders the Tunevera wordmark and generated logo", async () => {
  await act(async () => { render(<Home />); await Promise.resolve(); });
  const brand = screen.getByRole("link", { name: /tunevera home/i });
  expect(brand).toHaveTextContent("TUNEVERA");
  expect(brand.querySelector("img")).toHaveAttribute("src", expect.stringContaining("tunevera-logo"));
});

test("validates an empty public search without a catalog request", async () => {
  await act(async () => { render(<Home />); await Promise.resolve(); });
  fireEvent.click(screen.getByRole("button", { name: /find tracks/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Enter a song");
  expect(fetch).toHaveBeenCalledWith("/.netlify/functions/spotify-session", undefined);
});

test("searches the public Netlify catalog function and renders twelve results", async () => {
  fetch.mockResolvedValueOnce(unauthenticated).mockResolvedValueOnce({ ok: true, json: async () => ({ tracks }) });
  render(<Home />);
  fireEvent.change(screen.getByLabelText(/what do you want to hear/i), { target: { value: "SZA" } });
  fireEvent.click(screen.getByRole("button", { name: /find tracks/i }));
  await screen.findByText('Matches for “SZA”');
  expect(fetch).toHaveBeenCalledWith("/.netlify/functions/catalog-search?q=SZA", undefined);
  expect(screen.getAllByRole("article")).toHaveLength(12);
  expect(screen.getByRole("status", { name: /search status/i })).toHaveTextContent("12 tracks found");
  expect(screen.getByRole("status", { name: /catalog status: online/i })).toBeInTheDocument();
});

test("collapses the hero and places connected search results before the Library", async () => {
  const containsResponse = deferred();
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: "short-lived",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }
    if (url === "/.netlify/functions/catalog-search?q=SZA") {
      return Promise.resolve({ ok: true, json: async () => ({ tracks: [tracks[0]] }) });
    }
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) {
      return containsResponse.promise;
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("No playlists to show yet.");
  fireEvent.change(screen.getByLabelText(/what do you want to hear/i), { target: { value: "SZA" } });
  fireEvent.click(screen.getByRole("button", { name: /find tracks/i }));

  await screen.findByText("Track 1");
  await act(async () => {
    containsResponse.resolve({ ok: true, json: async () => [false] });
    await containsResponse.promise;
    await Promise.resolve();
    await Promise.resolve();
  });
  const results = screen.getByRole("region", { name: /search results/i });
  const library = screen.getByRole("region", { name: /spotify library/i });

  expect(screen.queryByRole("heading", { name: /your next listen/i })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Find another track." })).toBeInTheDocument();
  expect(results.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("reports a public search error in its dedicated status region", async () => {
  fetch.mockResolvedValueOnce(unauthenticated).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Catalog is unavailable." }) });
  render(<Home />);
  fireEvent.change(screen.getByLabelText(/what do you want to hear/i), { target: { value: "SZA" } });
  fireEvent.submit(screen.getByRole("button", { name: /find tracks/i }).closest("form"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Catalog is unavailable.");
  expect(screen.queryByRole("region", { name: /search results/i })).not.toHaveAttribute("aria-live");
});

test("starts in public mode when the page has an OAuth code query", async () => {
  window.history.replaceState({}, "", "/?code=untrusted&state=untrusted&ubi=untrusted");
  await act(async () => { render(<Home />); await Promise.resolve(); });
  expect(screen.getByRole("button", { name: /connect spotify/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /your next listen/i })).toBeInTheDocument();
  expect(window.location.search).toBe("");
});

test("does not store session access tokens in browser storage", async () => {
  const storageSpy = jest.spyOn(Storage.prototype, "setItem");
  const playlistResponse = deferred();
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "short-lived", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return playlistResponse.promise;
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  render(<Home />);
  expect(await screen.findByText("Cruz")).toBeInTheDocument();
  await act(async () => {
    playlistResponse.resolve({ ok: true, json: async () => ({ items: [] }) });
    await playlistResponse.promise;
  });
  expect(await screen.findByText("No playlists to show yet.")).toBeInTheDocument();
  expect(storageSpy).not.toHaveBeenCalled();
});

test("uses dedicated busy and live semantics instead of a broad results live region", async () => {
  await act(async () => { render(<Home />); await Promise.resolve(); });
  expect(screen.getByRole("region", { name: /search results/i })).toHaveAttribute("aria-busy", "false");
  expect(screen.getByRole("status", { name: /catalog status: ready/i })).toBeInTheDocument();
});

test("preserves the complete public how-it-works guidance", async () => {
  await act(async () => { render(<Home />); await Promise.resolve(); });
  expect(screen.getByRole("heading", { name: "Find your track" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Check the match" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Save for later" })).toBeInTheDocument();
});

test("loads playlists automatically after Spotify login", async () => {
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: "short-lived",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [{ id: "playlist-1", name: "Road Trip", images: [], owner: { display_name: "Harold" } }] }),
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);

  expect(await screen.findByText("Road Trip")).toBeInTheDocument();
  expect(screen.getByText("Harold")).toBeInTheDocument();
});

test("starts a real playlist context from the functional Library", async () => {
  const playlist = {
    id: "playlist-1",
    type: "playlist",
    name: "Night Drive",
    uri: "spotify:playlist:playlist-1",
    owner: { display_name: "Cruz" },
    images: [],
  };
  mockSpotifyPlayer.deviceId = "browser-device";
  fetch.mockImplementation((url, options = {}) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "short-lived", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [playlist] }) });
    }
    if (url.includes("/v1/me/player/play?device_id=browser-device") && options.method === "PUT") {
      return Promise.resolve({ ok: true, status: 204 });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  await act(async () => {
    render(<Home />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(await screen.findByRole("button", { name: "Play Night Drive" }));

  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/v1/me/player/play?device_id=browser-device"),
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ context_uri: "spotify:playlist:playlist-1" }),
    }),
  ));
  expect(mockSpotifyPlayer.activateElement).toHaveBeenCalledTimes(1);
});

test("removes a saved track from the functional Library", async () => {
  const savedTrack = {
    id: "saved-track",
    type: "track",
    name: "Saved Neon",
    uri: "spotify:track:saved-track",
    artists: [{ name: "Cruz" }],
    album: { images: [] },
  };
  fetch.mockImplementation((url, options = {}) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "short-lived", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }
    if (url === "https://api.spotify.com/v1/me/tracks?limit=20") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [{ track: savedTrack }] }) });
    }
    if (url.includes("/v1/me/tracks?ids=saved-track") && options.method === "DELETE") {
      return Promise.resolve({ ok: true, status: 200 });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  await act(async () => {
    render(<Home />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await screen.findByText("No playlists to show yet.");
  fireEvent.click(screen.getByRole("button", { name: "Saved Tracks" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove Saved Neon" }));

  await waitFor(() => expect(screen.queryByText("Saved Neon")).not.toBeInTheDocument());
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/v1/me/tracks?ids=saved-track"),
    expect.objectContaining({ method: "DELETE" }),
  );
});

test("shows playback connection notices visibly", async () => {
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "short-lived", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    if (url === "/.netlify/functions/catalog-search?q=SZA") return Promise.resolve({ ok: true, json: async () => ({ tracks: [tracks[0]] }) });
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) return Promise.resolve({ ok: true, json: async () => [false] });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("No playlists to show yet.");
  fireEvent.change(screen.getByLabelText(/what do you want to hear/i), { target: { value: "SZA" } });
  fireEvent.click(screen.getByRole("button", { name: /find tracks/i }));
  await screen.findByText("Track 1");
  expect(screen.getByText("1 track")).toBeInTheDocument();
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => (
    String(url).startsWith("https://api.spotify.com/v1/me/tracks/contains")
  ))).toBe(true));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole("button", { name: "Play Track 1" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("connecting a Spotify device");
  expect(alert).not.toHaveClass("sr-only");
});

test("refreshes the Spotify session once for an SDK authentication error without showing raw token text", async () => {
  let sessionCalls = 0;
  let playlistCalls = 0;
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") {
      sessionCalls += 1;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: sessionCalls === 1 ? "first" : "second",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      playlistCalls += 1;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: playlistCalls === 1
            ? []
            : [{
              id: "refreshed-playlist",
              type: "playlist",
              name: "Refreshed Library",
              uri: "spotify:playlist:refreshed",
              images: [],
              owner: { display_name: "Cruz" },
            }],
        }),
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  const { rerender } = render(<Home />);
  await screen.findByText("No playlists to show yet.");

  mockSpotifyPlayer.error = "Spotify session needs to be refreshed.";
  mockSpotifyPlayer.errorType = "authentication";
  rerender(<Home />);

  await waitFor(() => expect(sessionCalls).toBe(2));
  await screen.findByText("Refreshed Library");
  expect(sessionCalls).toBe(2);
  expect(playlistCalls).toBe(2);
  expect(screen.queryByText(/invalid token/i)).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/refreshing your Spotify playback session/i);
});

test("clears only the player notice after the SDK reports healthy playback", async () => {
  const playlistResponse = deferred();
  mockSpotifyPlayer.error = "Spotify could not start that track. Try Play again.";
  mockSpotifyPlayer.errorType = "playback";
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: "short-lived",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return playlistResponse.promise;
    }
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) {
      return Promise.resolve({ ok: true, json: async () => [false] });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  const { rerender, unmount } = render(<Home />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not start that track");
  await act(async () => {
    playlistResponse.resolve({ ok: true, json: async () => ({ items: [] }) });
    await playlistResponse.promise;
    await Promise.resolve();
    await Promise.resolve();
  });
  await screen.findByText("No playlists to show yet.");

  mockSpotifyPlayer.error = "";
  mockSpotifyPlayer.errorType = "";
  mockSpotifyPlayer.playerState = {
    paused: false,
    track_window: { current_track: tracks[0] },
  };
  rerender(<Home />);

  await waitFor(() => expect(screen.queryByText(/could not start that track/i)).not.toBeInTheDocument());
  expect(screen.getByText("Track 1")).toBeInTheDocument();
  await act(async () => {
    unmount();
    await Promise.resolve();
    await Promise.resolve();
  });
});

test("updates the current track from the bottom player heart control", async () => {
  const playlistResponse = deferred();
  const containsResponse = deferred();
  const saveResponse = deferred();
  mockSpotifyPlayer.playerState = {
    paused: true,
    track_window: { current_track: tracks[0] },
  };
  fetch.mockImplementation((url, options = {}) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: "short-lived",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return playlistResponse.promise;
    }
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) {
      return containsResponse.promise;
    }
    if (url.includes("/v1/me/tracks?ids=track-0") && options.method === "DELETE") {
      return saveResponse.promise;
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("Cruz");
  await act(async () => {
    playlistResponse.resolve({ ok: true, json: async () => ({ items: [] }) });
    containsResponse.resolve({ ok: true, json: async () => [true] });
    await playlistResponse.promise;
    await containsResponse.promise;
    await Promise.resolve();
    await Promise.resolve();
  });
  const removeButton = await screen.findByRole("button", { name: /remove track 1 from saved tracks/i });
  fireEvent.click(removeButton);

  expect(screen.getByRole("button", { name: /updating track 1 in spotify/i })).toBeDisabled();
  await act(async () => {
    saveResponse.resolve({ ok: true, status: 200 });
    await saveResponse.promise;
    await Promise.resolve();
  });
  expect(await screen.findByRole("button", { name: /save track 1 to spotify/i })).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/v1/me/tracks?ids=track-0"),
    expect.objectContaining({ method: "DELETE" }),
  ));
});

test("keeps the archived lyrics experience out of the connected player", async () => {
  const activeTrack = {
    ...tracks[0],
    album: { name: "After Dark", images: [] },
    duration_ms: 180000,
  };
  mockSpotifyPlayer.deviceId = "browser-device";
  mockSpotifyPlayer.duration = 180000;
  mockSpotifyPlayer.playerState = {
    paused: true,
    track_window: { current_track: activeTrack },
  };
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: "short-lived",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) {
      return Promise.resolve({ ok: true, json: async () => [false] });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("No playlists to show yet.");
  expect(screen.queryByRole("region", { name: /lyrics for/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /open lyrics/i })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => String(url).includes("/.netlify/functions/lyrics"))).toBe(false);
});

test("lists Spotify devices and transfers playback from the bottom player", async () => {
  const playlistResponse = deferred();
  const deviceResponse = deferred();
  const transferResponse = deferred();
  mockSpotifyPlayer.deviceId = "browser-device";
  mockSpotifyPlayer.playerState = {
    paused: true,
    track_window: { current_track: tracks[0] },
  };
  fetch.mockImplementation((url, options = {}) => {
    if (url === "/.netlify/functions/spotify-session") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          accessToken: "short-lived",
          expiresIn: 3600,
          profile: { display_name: "Cruz", images: [] },
        }),
      });
    }
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return playlistResponse.promise;
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) {
      return Promise.resolve({ ok: true, json: async () => [false] });
    }
    if (url === "https://api.spotify.com/v1/me/player/devices") return deviceResponse.promise;
    if (url === "https://api.spotify.com/v1/me/player" && options.method === "PUT") return transferResponse.promise;
    if (url === "https://api.spotify.com/v1/me/player/volume?volume_percent=45&device_id=living-room" && options.method === "PUT") {
      return Promise.resolve({ ok: true, status: 204 });
    }
    if (url === "https://api.spotify.com/v1/me/player/play?device_id=living-room" && options.method === "PUT") {
      return Promise.resolve({ ok: true, status: 204 });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("Cruz");
  await act(async () => {
    playlistResponse.resolve({ ok: true, json: async () => ({ items: [] }) });
    await playlistResponse.promise;
    await Promise.resolve();
  });

  fireEvent.click(screen.getByRole("button", { name: /choose playback device/i }));
  await act(async () => {
    deviceResponse.resolve({
      ok: true,
      json: async () => ({
        devices: [
          { id: "browser-device", name: "Tunevera", type: "Computer", is_active: true, is_restricted: false, volume_percent: 80, supports_volume: true },
          { id: "living-room", name: "Living Room TV", type: "TV", is_active: false, is_restricted: false, volume_percent: 35, supports_volume: true },
        ],
      }),
    });
    await deviceResponse.promise;
    await Promise.resolve();
  });

  fireEvent.click(await screen.findByRole("button", { name: /living room tv/i }));
  expect(screen.getByRole("button", { name: /living room tv.*switching/i })).toBeDisabled();
  await act(async () => {
    transferResponse.resolve({ ok: true, status: 204 });
    await transferResponse.promise;
    await Promise.resolve();
  });

  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "https://api.spotify.com/v1/me/player",
    expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: JSON.stringify({ device_ids: ["living-room"] }),
    }),
  ));
  expect(mockSpotifyPlayer.activateElement).not.toHaveBeenCalled();

  const volume = screen.getByRole("slider", { name: /playback volume/i });
  expect(volume).toHaveValue("35");
  fireEvent.change(volume, { target: { value: "45" } });
  await act(async () => {
    fireEvent.pointerUp(volume);
    await Promise.resolve();
  });
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "https://api.spotify.com/v1/me/player/volume?volume_percent=45&device_id=living-room",
    expect.objectContaining({ method: "PUT" }),
  ));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /play track 1/i }));
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "https://api.spotify.com/v1/me/player/play?device_id=living-room",
    expect.objectContaining({ method: "PUT" }),
  ));
  expect(mockSpotifyPlayer.togglePlay).not.toHaveBeenCalled();
});

test("rolls back a failed heart action and shows the error visibly", async () => {
  const playlistJson = deferred();
  fetch.mockImplementation((url, options = {}) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "short-lived", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: () => playlistJson.promise });
    if (url === "/.netlify/functions/catalog-search?q=SZA") return Promise.resolve({ ok: true, json: async () => ({ tracks: [tracks[0]] }) });
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) return Promise.resolve({ ok: true, json: async () => [false] });
    if (url.startsWith("https://api.spotify.com/v1/me/tracks?ids=") && options.method === "PUT") return Promise.resolve({ ok: false, json: async () => ({}) });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => (
    url === "https://api.spotify.com/v1/me/playlists?limit=20"
  ))).toBe(true));
  await act(async () => { playlistJson.resolve({ items: [] }); await playlistJson.promise; });
  await screen.findByText("No playlists to show yet.");
  fireEvent.change(screen.getByLabelText(/what do you want to hear/i), { target: { value: "SZA" } });
  fireEvent.click(screen.getByRole("button", { name: /find tracks/i }));
  await screen.findByText("Track 1");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save Track 1" }));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(await screen.findByRole("button", { name: "Save Track 1" })).toBeInTheDocument();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Could not save Track 1");
  expect(alert).not.toHaveClass("sr-only");
});

test("clears an expired authenticated session", async () => {
  jest.useFakeTimers();
  try {
    let sessionCalls = 0;
    fetch.mockImplementation((url) => {
      if (url === "/.netlify/functions/spotify-session") {
        sessionCalls += 1;
        return Promise.resolve({ ok: sessionCalls === 1, status: sessionCalls === 1 ? 200 : 401, json: async () => sessionCalls === 1
          ? { authenticated: true, accessToken: "first", expiresIn: 31, profile: { display_name: "Cruz", images: [] } }
          : { authenticated: false } });
      }
      if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<Home />);
    expect(await screen.findByText("Cruz")).toBeInTheDocument();
    await screen.findByText("No playlists to show yet.");

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(await screen.findByRole("button", { name: /connect spotify/i })).toBeInTheDocument();
    expect(screen.queryByText("Cruz")).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test("refreshes the in-memory session token before expiry without browser storage", async () => {
  jest.useFakeTimers();
  try {
    let sessionCalls = 0;
    let playlistCalls = 0;
    fetch.mockImplementation((url) => {
      if (url === "/.netlify/functions/spotify-session") {
        sessionCalls += 1;
        return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: sessionCalls === 1 ? "first" : "second", expiresIn: 90, profile: { display_name: "Cruz", images: [] } }) });
      }
      if (url === "https://api.spotify.com/v1/me/playlists?limit=20") {
        playlistCalls += 1;
        return Promise.resolve({ ok: true, json: async () => ({ items: playlistCalls === 1 ? [] : [{ id: "refreshed-playlist", name: "Refreshed Playlist", images: [], owner: { display_name: "Harold" } }] }) });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    render(<Home />);
    await screen.findByText("Cruz");
    await screen.findByText("No playlists to show yet.");
    await act(async () => {
      jest.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    expect(fetch.mock.calls.filter(([url]) => url === "/.netlify/functions/spotify-session")).toHaveLength(2);
    expect(await screen.findByText("Refreshed Playlist")).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test("ignores an in-flight session refresh that resolves after logout", async () => {
  jest.useFakeTimers();
  try {
    const pendingRefresh = deferred();
    let sessionCalls = 0;
    fetch.mockImplementation((url) => {
      if (url === "/.netlify/functions/spotify-session") {
        sessionCalls += 1;
        if (sessionCalls === 1) return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "first", expiresIn: 31, profile: { display_name: "Cruz", images: [] } }) });
        return pendingRefresh.promise;
      }
      if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      if (url === "/.netlify/functions/spotify-logout") return Promise.resolve({ ok: true, json: async () => ({ authenticated: false }) });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<Home />);
    await screen.findByText("Cruz");
    await screen.findByText("No playlists to show yet.");
    await act(async () => { jest.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(sessionCalls).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByRole("button", { name: /connect spotify/i })).toBeInTheDocument();

    await act(async () => {
      pendingRefresh.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "stale", expiresIn: 3600, profile: { display_name: "Stale Account", images: [] } }) });
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /connect spotify/i })).toBeInTheDocument();
    expect(screen.queryByText("Stale Account")).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test("keeps the authenticated UI when server logout fails", async () => {
  const playlistResponse = deferred();
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "first", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return playlistResponse.promise;
    if (url === "/.netlify/functions/spotify-logout") return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: "Logout unavailable." }) });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await act(async () => {
    playlistResponse.resolve({ ok: true, json: async () => ({ items: [] }) });
    await playlistResponse.promise;
    await Promise.resolve();
  });
  await screen.findByText("No playlists to show yet.");
  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

  await waitFor(() => expect(screen.getByText("Cruz")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /connect spotify/i })).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("Logout unavailable");
});

test("keeps the newest library tab when an older request resolves late", async () => {
  const albumsResponse = deferred();
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "first", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    if (url === "https://api.spotify.com/v1/me/albums?limit=20") return albumsResponse.promise;
    if (url === "https://api.spotify.com/v1/me/tracks?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [{ track: { id: "saved-1", name: "Newest Saved Track", artists: [{ name: "Artist" }], album: { images: [] } } }] }) });
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("No playlists to show yet.");
  fireEvent.click(screen.getByRole("button", { name: "Albums" }));
  fireEvent.click(screen.getByRole("button", { name: "Saved Tracks" }));
  expect(await screen.findByText("Newest Saved Track")).toBeInTheDocument();

  await act(async () => {
    albumsResponse.resolve({ ok: true, json: async () => ({ items: [{ album: { id: "album-1", name: "Stale Album", artists: [{ name: "Artist" }], images: [] } }] }) });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText("Newest Saved Track")).toBeInTheDocument();
  expect(screen.queryByText("Stale Album")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Saved Tracks" })).toHaveAttribute("aria-pressed", "true");
});

test("preserves the selected library tab across access-token refresh", async () => {
  jest.useFakeTimers();
  try {
    let sessionCalls = 0;
    let albumCalls = 0;
    fetch.mockImplementation((url, options = {}) => {
      if (url === "/.netlify/functions/spotify-session") {
        sessionCalls += 1;
        return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: sessionCalls === 1 ? "first" : "second", expiresIn: sessionCalls === 1 ? 31 : 3600, profile: { display_name: "Cruz", images: [] } }) });
      }
      if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      if (url === "https://api.spotify.com/v1/me/albums?limit=20") {
        albumCalls += 1;
        return Promise.resolve({ ok: true, json: async () => ({ items: [{ album: { id: `album-${albumCalls}`, name: albumCalls === 1 ? "First Album" : "Refreshed Album", artists: [{ name: "Artist" }], images: [] } }] }) });
      }
      return Promise.reject(new Error(`Unexpected request: ${url} ${options.headers?.Authorization || ""}`));
    });

    render(<Home />);
    await screen.findByText("No playlists to show yet.");
    fireEvent.click(screen.getByRole("button", { name: "Albums" }));
    expect(await screen.findByText("First Album")).toBeInTheDocument();

    await act(async () => { jest.advanceTimersByTime(1000); await Promise.resolve(); });
    await waitFor(() => expect(albumCalls).toBe(2));
    expect(await screen.findByText("Refreshed Album")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toHaveAttribute("aria-pressed", "true");
  } finally {
    jest.useRealTimers();
  }
});

test("does not let delayed saved-status lookup overwrite a newer save", async () => {
  const containsResponse = deferred();
  const saveResponse = deferred();
  fetch.mockImplementation((url, options = {}) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve({ ok: true, json: async () => ({ authenticated: true, accessToken: "first", expiresIn: 3600, profile: { display_name: "Cruz", images: [] } }) });
    if (url === "https://api.spotify.com/v1/me/playlists?limit=20") return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    if (url === "/.netlify/functions/catalog-search?q=SZA") return Promise.resolve({ ok: true, json: async () => ({ tracks: [tracks[0]] }) });
    if (url.startsWith("https://api.spotify.com/v1/me/tracks/contains")) return containsResponse.promise;
    if (url.startsWith("https://api.spotify.com/v1/me/tracks?ids=") && options.method === "PUT") return saveResponse.promise;
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  await screen.findByText("No playlists to show yet.");
  fireEvent.change(screen.getByLabelText(/what do you want to hear/i), { target: { value: "SZA" } });
  fireEvent.click(screen.getByRole("button", { name: /find tracks/i }));
  await screen.findByText("Track 1");
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => typeof url === "string" && url.includes("/v1/me/tracks/contains"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Save Track 1" }));
  const removeButton = await screen.findByRole("button", { name: "Remove Track 1" });
  expect(removeButton).toBeInTheDocument();
  expect(removeButton).toBeDisabled();
  await act(async () => {
    saveResponse.resolve({ ok: true, json: async () => ({}) });
    await Promise.resolve();
  });
  await waitFor(() => expect(removeButton).not.toBeDisabled());

  await act(async () => {
    containsResponse.resolve({ ok: true, json: async () => [false] });
    await Promise.resolve();
  });
  expect(screen.getByRole("button", { name: "Remove Track 1" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/v1/me/tracks?ids="), expect.objectContaining({ method: "PUT" }));
});

test("keeps the newest public search when an older request resolves late", async () => {
  const firstSearch = deferred();
  const secondSearch = deferred();
  const szaTrack = { ...tracks[0], id: "sza-track", name: "Stale SZA Result" };
  const drakeTrack = { ...tracks[0], id: "drake-track", name: "Newest Drake Result" };
  fetch.mockImplementation((url) => {
    if (url === "/.netlify/functions/spotify-session") return Promise.resolve(unauthenticated);
    if (url === "/.netlify/functions/catalog-search?q=SZA") return firstSearch.promise;
    if (url === "/.netlify/functions/catalog-search?q=Drake") return secondSearch.promise;
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "SZA" }));
  const search = screen.getByLabelText(/what do you want to hear/i);
  fireEvent.change(search, { target: { value: "Drake" } });
  fireEvent.submit(search.closest("form"));

  await act(async () => {
    secondSearch.resolve({ ok: true, json: async () => ({ tracks: [drakeTrack] }) });
    await Promise.resolve();
  });
  expect(await screen.findByText("Newest Drake Result")).toBeInTheDocument();
  expect(screen.getByText('Matches for “Drake”')).toBeInTheDocument();

  await act(async () => {
    firstSearch.resolve({ ok: true, json: async () => ({ tracks: [szaTrack] }) });
    await Promise.resolve();
  });
  expect(screen.getByText("Newest Drake Result")).toBeInTheDocument();
  expect(screen.queryByText("Stale SZA Result")).not.toBeInTheDocument();
  expect(screen.getByText('Matches for “Drake”')).toBeInTheDocument();
});
