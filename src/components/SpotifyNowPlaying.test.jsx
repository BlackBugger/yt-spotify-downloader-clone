import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpotifyNowPlaying from "./SpotifyNowPlaying";

const track = {
  id: "neon-nights",
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
    saved: false,
    savePending: false,
    onToggleSaved: jest.fn(),
    devices: [
      { id: "browser-device", name: "Cruz Audio", type: "Computer", is_active: true, is_restricted: false },
      { id: "living-room", name: "Living Room TV", type: "TV", is_active: false, is_restricted: false },
      { id: "restricted-device", name: "Restricted speaker", type: "Speaker", is_active: false, is_restricted: true },
    ],
    devicesLoading: false,
    deviceTransferring: "",
    deviceError: "",
    onRequestDevices: jest.fn(),
    onSelectDevice: jest.fn(() => Promise.resolve(true)),
    ...overrides,
  };
  const rendered = render(<SpotifyNowPlaying {...props} />);
  return { ...props, rerender: rendered.rerender };
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
  expect(screen.getByRole("button", { name: /save neon nights to spotify/i })).toBeEnabled();
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

test("saves and removes the current track independently of playback availability", () => {
  const props = renderPlayer({ isReady: false });
  const saveButton = screen.getByRole("button", { name: /save neon nights to spotify/i });

  expect(saveButton).toBeEnabled();
  expect(saveButton).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(saveButton);
  expect(props.onToggleSaved).toHaveBeenCalledWith(track);

  props.rerender(
    <SpotifyNowPlaying
      {...props}
      saved
    />
  );
  expect(screen.getByRole("button", { name: /remove neon nights from saved tracks/i })).toHaveAttribute("aria-pressed", "true");
});

test("locks the heart control while a save mutation is pending", () => {
  renderPlayer({ saved: true, savePending: true });

  const saveButton = screen.getByRole("button", { name: /updating neon nights in spotify/i });
  expect(saveButton).toBeDisabled();
  expect(saveButton).toHaveAttribute("aria-busy", "true");
  expect(saveButton).toHaveAttribute("aria-pressed", "true");
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
  expect(screen.getByRole("button", { name: /save to spotify/i })).toBeDisabled();
});

test("loads available devices and transfers playback from an accessible picker", async () => {
  const props = renderPlayer();

  fireEvent.click(screen.getByRole("button", { name: /choose playback device/i }));

  expect(props.onRequestDevices).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("dialog", { name: /playback devices/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cruz audio.*active device/i })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /restricted speaker.*unavailable/i })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: /living room tv/i }));

  await waitFor(() => expect(props.onSelectDevice).toHaveBeenCalledWith(props.devices[1]));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /playback devices/i })).not.toBeInTheDocument());
});

test("keeps device loading, empty, and error messages in dedicated live regions", () => {
  const props = renderPlayer({ devices: [], devicesLoading: true });
  fireEvent.click(screen.getByRole("button", { name: /choose playback device/i }));

  expect(screen.getByRole("dialog", { name: /playback devices/i })).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status", { name: /device status/i })).toHaveTextContent("Finding available devices");

  props.rerender(
    <SpotifyNowPlaying
      {...props}
      devices={[]}
      devicesLoading={false}
      deviceError="Spotify devices could not be loaded."
    />
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Spotify devices could not be loaded.");
});
