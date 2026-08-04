import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SpotifyLibrary from "./SpotifyLibrary";

const account = { display_name: "Cruz", images: [] };

test("switches between real library sections", () => {
  const onLoad = jest.fn();
  render(
    <SpotifyLibrary
      account={account}
      library={{ tab: "playlists", items: [], loading: false, error: "" }}
      saved={{}}
      onLoad={onLoad}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Albums" }));
  expect(onLoad).toHaveBeenCalledWith("albums");
  expect(screen.getByRole("button", { name: "Playlists" })).toHaveAttribute("aria-pressed", "true");
});

test("plays a playlist context and links to Spotify", () => {
  const onPlay = jest.fn();
  const playlist = {
    id: "playlist-1",
    type: "playlist",
    name: "Night Drive",
    uri: "spotify:playlist:playlist-1",
    owner: { display_name: "Cruz" },
    images: [],
    external_urls: { spotify: "https://open.spotify.com/playlist/playlist-1" },
  };
  render(
    <SpotifyLibrary
      account={account}
      library={{ tab: "playlists", items: [playlist], loading: false, error: "" }}
      saved={{}}
      onLoad={jest.fn()}
      onPlay={onPlay}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Play Night Drive" }));
  expect(onPlay).toHaveBeenCalledWith(playlist);
  expect(screen.getByRole("link", { name: "Open Night Drive in Spotify" })).toHaveAttribute(
    "href",
    "https://open.spotify.com/playlist/playlist-1",
  );
});

test("plays and removes a saved track", async () => {
  const onPlay = jest.fn();
  const onToggleSaved = jest.fn();
  const track = {
    id: "track-1",
    type: "track",
    name: "Neon Song",
    uri: "spotify:track:track-1",
    artists: [{ name: "Cruz" }],
    album: { images: [] },
  };
  render(
    <SpotifyLibrary
      account={account}
      library={{ tab: "tracks", items: [{ track }], loading: false, error: "" }}
      saved={{ "track-1": true }}
      onLoad={jest.fn()}
      onPlay={onPlay}
      onToggleSaved={onToggleSaved}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Play Neon Song" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Remove Neon Song" }));
    await Promise.resolve();
  });
  expect(onPlay).toHaveBeenCalledWith(track);
  expect(onToggleSaved).toHaveBeenCalledWith(track);
});
