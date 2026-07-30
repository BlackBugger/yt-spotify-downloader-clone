import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import SpotifyNowPlaying from "./SpotifyNowPlaying";

const track = {
  name: "Neon Nights",
  artists: [{ name: "Cruz" }, { name: "Audio" }],
  album: { images: [{ url: "https://images.example/cover.jpg" }] },
};

function renderPlayer(overrides = {}) {
  const props = {
    track,
    isPlaying: true,
    isReady: true,
    error: "",
    position: 65000,
    duration: 185000,
    onTogglePlay: jest.fn(),
    onPrevious: jest.fn(),
    onNext: jest.fn(),
    onSeek: jest.fn(),
    ...overrides,
  };
  render(<SpotifyNowPlaying {...props} />);
  return props;
}

test("shows artwork, track metadata, elapsed time, duration, and accessible controls", () => {
  renderPlayer();

  expect(screen.getByRole("complementary", { name: /spotify player/i })).toBeInTheDocument();
  expect(screen.getByText("Neon Nights")).toBeInTheDocument();
  expect(screen.getByText("Cruz, Audio")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /neon nights cover/i })).toHaveAttribute("src", "https://images.example/cover.jpg");
  expect(screen.getByText("1:05")).toBeInTheDocument();
  expect(screen.getByText("3:05")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /pause neon nights/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /previous track/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /next track/i })).toBeEnabled();
  expect(screen.getByRole("slider", { name: /playback position/i })).toHaveAttribute("aria-valuetext", "1:05 of 3:05");
});

test("routes transport and seek actions to the existing player", () => {
  const props = renderPlayer();

  fireEvent.click(screen.getByRole("button", { name: /previous track/i }));
  fireEvent.click(screen.getByRole("button", { name: /pause neon nights/i }));
  fireEvent.click(screen.getByRole("button", { name: /next track/i }));
  fireEvent.change(screen.getByRole("slider", { name: /playback position/i }), { target: { value: "90000" } });

  expect(props.onPrevious).toHaveBeenCalledTimes(1);
  expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  expect(props.onNext).toHaveBeenCalledTimes(1);
  expect(props.onSeek).toHaveBeenCalledWith(90000);
});

test("stays useful while connected but idle and communicates unavailable playback", () => {
  renderPlayer({
    track: null,
    isPlaying: false,
    isReady: false,
    error: "Spotify Premium is required for browser playback.",
    position: 0,
    duration: 0,
  });

  expect(screen.getByText("Ready when you are")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Spotify Premium");
  expect(screen.getByRole("button", { name: /play spotify/i })).toBeDisabled();
  expect(screen.getByRole("slider", { name: /playback position/i })).toBeDisabled();
});
