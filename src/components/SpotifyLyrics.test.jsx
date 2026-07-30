import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import SpotifyLyrics from "./SpotifyLyrics";

const track = {
  id: "track-1",
  name: "Neon Sky",
  artists: [{ name: "Cruz" }],
  album: { images: [] },
};

test("highlights the current synchronized line and seeks when a line is selected", () => {
  const onSeek = jest.fn();
  render(
    <SpotifyLyrics
      track={track}
      isPlaying={false}
      position={6500}
      duration={180000}
      lyrics={{
        lines: [
          { time: 1000, text: "First glow" },
          { time: 6000, text: "Second glow" },
          { time: 12000, text: "Third glow" },
        ],
        plainLines: [],
        loading: false,
        error: "",
        instrumental: false,
        source: "LRCLIB",
      }}
      onSeek={onSeek}
    />,
  );

  expect(screen.getByRole("button", { name: /seek to 0:06.*second glow/i })).toHaveAttribute("aria-current", "true");
  fireEvent.click(screen.getByRole("button", { name: /seek to 0:12.*third glow/i }));
  expect(onSeek).toHaveBeenCalledWith(12000);
  expect(screen.getByRole("button", { name: /seek to 0:12.*third glow/i })).toHaveAttribute("aria-current", "true");
});

test("offers follow control and renders untimed lyrics without fake seek buttons", () => {
  render(
    <SpotifyLyrics
      track={track}
      isPlaying={false}
      position={0}
      duration={180000}
      lyrics={{
        lines: [],
        plainLines: ["A quiet verse", "A bright refrain"],
        loading: false,
        error: "",
        instrumental: false,
        source: "LRCLIB",
      }}
    />,
  );

  expect(screen.getByText("A quiet verse")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /seek to/i })).not.toBeInTheDocument();
  expect(screen.getByText(/these lyrics are not time-synced/i)).toBeInTheDocument();
});

test("keeps loading and unavailable messages inside the dedicated lyrics region", () => {
  const { rerender } = render(
    <SpotifyLyrics
      track={track}
      lyrics={{ lines: [], plainLines: [], loading: true, error: "", instrumental: false }}
    />,
  );
  expect(screen.getByRole("region", { name: /lyrics for neon sky/i })).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent(/finding lyrics/i);

  const onRetry = jest.fn();
  rerender(
    <SpotifyLyrics
      track={track}
      lyrics={{ lines: [], plainLines: [], loading: false, error: "Lyrics are not available for this track yet.", instrumental: false }}
      onRetry={onRetry}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/not available/i);
  fireEvent.click(screen.getByRole("button", { name: /try lyrics again/i }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
