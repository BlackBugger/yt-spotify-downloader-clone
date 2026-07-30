import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useSpotifyPlayer } from "./useSpotifyPlayer";

let handlers;
let player;

function Harness({ token, onReady }) {
  const state = useSpotifyPlayer(token, onReady);
  return <>
    <span data-testid="device">{state.deviceId}</span>
    <span data-testid="playing">{String(state.isPlaying)}</span>
    <span data-testid="track">{state.playerState?.track_window?.current_track?.name || ""}</span>
    <span data-testid="error">{state.error}</span>
    <span data-testid="error-type">{state.errorType}</span>
    <button onClick={state.togglePlay}>toggle</button>
    <button onClick={state.activateElement}>activate</button>
    <button onClick={state.previousTrack}>previous</button>
    <button onClick={state.nextTrack}>next</button>
    <button onClick={() => state.seek(42000)}>seek</button>
  </>;
}

beforeEach(() => {
  handlers = {};
  player = {
    addListener: jest.fn((name, handler) => { handlers[name] = handler; }),
    connect: jest.fn(() => Promise.resolve(true)),
    disconnect: jest.fn(),
    togglePlay: jest.fn(() => Promise.resolve()),
    activateElement: jest.fn(() => Promise.resolve()),
    previousTrack: jest.fn(() => Promise.resolve()),
    nextTrack: jest.fn(() => Promise.resolve()),
    seek: jest.fn(() => Promise.resolve()),
  };
  window.Spotify = { Player: jest.fn(() => player) };
  window.onSpotifyWebPlaybackSDKReady = undefined;
});

afterEach(() => {
  delete window.Spotify;
  document.querySelectorAll('script[src="https://sdk.scdn.co/spotify-player.js"]').forEach((script) => script.remove());
  jest.restoreAllMocks();
});

test("creates one SDK device, exposes ready state, updates player state, and disconnects", async () => {
  const onReady = jest.fn();
  const { unmount } = render(<Harness token="in-memory-token" onReady={onReady} />);
  await act(async () => { await Promise.resolve(); });
  expect(window.Spotify.Player).toHaveBeenCalledWith(expect.objectContaining({ name: "Cruz Audio", getOAuthToken: expect.any(Function) }));
  await act(async () => { handlers.ready({ device_id: "cruz-device" }); });
  expect(screen.getByTestId("device")).toHaveTextContent("cruz-device");
  expect(onReady).toHaveBeenCalledWith("cruz-device");
  await act(async () => { handlers.player_state_changed({ paused: false, track_window: { current_track: { name: "Track", artists: [{ name: "Artist" }] } } }); });
  expect(screen.getByTestId("playing")).toHaveTextContent("true");
  await act(async () => { screen.getByRole("button", { name: "toggle" }).click(); });
  expect(player.togglePlay).toHaveBeenCalled();
  unmount();
  expect(player.disconnect).toHaveBeenCalled();
});

test("keeps one SDK device while an in-memory token refreshes", async () => {
  const onReady = jest.fn();
  const { rerender } = render(<Harness token="first-token" onReady={onReady} />);
  await act(async () => { await Promise.resolve(); });

  const options = window.Spotify.Player.mock.calls[0][0];
  const firstCallback = jest.fn();
  options.getOAuthToken(firstCallback);
  expect(firstCallback).toHaveBeenCalledWith("first-token");

  rerender(<Harness token="second-token" onReady={onReady} />);
  await act(async () => { await Promise.resolve(); });

  expect(window.Spotify.Player).toHaveBeenCalledTimes(1);
  const refreshedCallback = jest.fn();
  options.getOAuthToken(refreshedCallback);
  expect(refreshedCallback).toHaveBeenCalledWith("second-token");
});

test("activates the SDK element from an explicit user action", async () => {
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    screen.getByRole("button", { name: "activate" }).click();
  });

  expect(player.activateElement).toHaveBeenCalledTimes(1);
});

test("reports a failed play-pause toggle", async () => {
  player.togglePlay.mockRejectedValue(new Error("device unavailable"));
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });

  fireEvent.click(screen.getByRole("button", { name: "toggle" }));

  expect(await screen.findByText(/playback could not be changed/i)).toBeInTheDocument();
});

test("controls the existing player for previous, next, and seek", async () => {
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });

  fireEvent.click(screen.getByRole("button", { name: "previous" }));
  fireEvent.click(screen.getByRole("button", { name: "next" }));
  fireEvent.click(screen.getByRole("button", { name: "seek" }));

  await act(async () => { await Promise.resolve(); });
  expect(player.previousTrack).toHaveBeenCalledTimes(1);
  expect(player.nextTrack).toHaveBeenCalledTimes(1);
  expect(player.seek).toHaveBeenCalledWith(42000);
  expect(window.Spotify.Player).toHaveBeenCalledTimes(1);
});

test("normalizes SDK errors and clears a stale playback error after healthy state", async () => {
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    handlers.authentication_error({ message: "Invalid token" });
  });
  expect(screen.getByTestId("error")).toHaveTextContent("session needs to be refreshed");
  expect(screen.getByTestId("error")).not.toHaveTextContent("Invalid token");
  expect(screen.getByTestId("error-type")).toHaveTextContent("authentication");

  await act(async () => {
    handlers.playback_error({ message: "Raw playback failure" });
  });
  expect(screen.getByTestId("error")).toHaveTextContent("could not start that track");
  expect(screen.getByTestId("error")).not.toHaveTextContent("Raw playback failure");
  expect(screen.getByTestId("error-type")).toHaveTextContent("playback");

  await act(async () => {
    handlers.player_state_changed({
      paused: false,
      position: 1000,
      duration: 180000,
      track_window: { current_track: { name: "Playing now" } },
    });
  });
  expect(screen.getByTestId("error")).toBeEmptyDOMElement();
  expect(screen.getByTestId("error-type")).toBeEmptyDOMElement();
});

test("loads the SDK script once when the global SDK is not available", () => {
  delete window.Spotify;
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  expect(document.querySelectorAll('script[src="https://sdk.scdn.co/spotify-player.js"]')).toHaveLength(1);
});

test("clears player state when the device is not ready and when the token is removed", async () => {
  const { rerender } = render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });
  await act(async () => {
    handlers.ready({ device_id: "cruz-device" });
    handlers.player_state_changed({ paused: false, track_window: { current_track: { name: "Track" } } });
  });
  expect(screen.getByTestId("track")).toHaveTextContent("Track");

  await act(async () => { handlers.not_ready(); });
  expect(screen.getByTestId("device")).toBeEmptyDOMElement();
  expect(screen.getByTestId("track")).toBeEmptyDOMElement();
  expect(screen.getByTestId("error")).toHaveTextContent("disconnected");

  await act(async () => {
    handlers.player_state_changed({ paused: false, track_window: { current_track: { name: "Again" } } });
    handlers.playback_error({ message: "Playback failed" });
  });
  rerender(<Harness token="" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByTestId("track")).toBeEmptyDOMElement();
  expect(screen.getByTestId("error")).toBeEmptyDOMElement();
});

test("reports a player connection that resolves false", async () => {
  player.connect.mockResolvedValue(false);
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  expect(await screen.findByText(/could not connect/i)).toBeInTheDocument();
});

test("reports when browser autoplay blocks playback", async () => {
  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });

  await act(async () => { handlers.autoplay_failed(); });

  expect(screen.getByTestId("error")).toHaveTextContent("autoplay was blocked");
});

test("retries SDK loading after a script error", async () => {
  delete window.Spotify;
  const firstRender = render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  const firstScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
  await act(async () => { fireEvent.error(firstScript); await Promise.resolve(); });
  expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  firstRender.unmount();

  render(<Harness token="in-memory-token" onReady={jest.fn()} />);
  const secondScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
  expect(secondScript).toBeTruthy();
  expect(secondScript).not.toBe(firstScript);
});
