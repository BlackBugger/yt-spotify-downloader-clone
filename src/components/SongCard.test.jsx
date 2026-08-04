import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SongCard from "./SongCard";

const track = {
  id: "track-1",
  name: "Responsive Track",
  artists: [{ name: "Cruz Artist" }],
  album: {
    name: "Cruz Album",
    images: [{ url: "https://images.example/cover.jpg" }],
  },
};

function deferred() {
  let resolve;
  const promise = new Promise((onResolve) => { resolve = onResolve; });
  return { promise, resolve };
}

afterEach(() => jest.restoreAllMocks());

test("opens a placeholder tab from the direct YouTube gesture and navigates it after matching", async () => {
  const matchResponse = deferred();
  const popup = {
    close: jest.fn(),
    location: { replace: jest.fn() },
    opener: window,
  };
  jest.spyOn(window, "open").mockReturnValue(popup);
  global.fetch = jest.fn(() => matchResponse.promise);
  render(<SongCard track={track} />);

  fireEvent.click(screen.getByRole("button", { name: "Open Responsive Track on YouTube" }));

  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(popup.opener).toBeNull();
  expect(popup.location.replace).not.toHaveBeenCalled();

  await act(async () => {
    matchResponse.resolve({
      ok: true,
      json: async () => ({ youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk" }),
    });
    await matchResponse.promise;
    await Promise.resolve();
  });

  expect(popup.location.replace).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abcdefghijk");
});

test("replaces broken track artwork with the music fallback", () => {
  const { container } = render(<SongCard track={track} />);
  const image = container.querySelector(".track-art img");

  fireEvent.error(image);

  expect(container.querySelector(".track-art img")).not.toBeInTheDocument();
  expect(container.querySelector(".track-art svg")).toBeInTheDocument();
});

test("uses four consistently sized icon actions in connected mode", () => {
  render(
    <SongCard
      track={track}
      connected
      onPlay={jest.fn()}
      onToggleSaved={jest.fn()}
    />,
  );

  const actions = [
    screen.getByRole("button", { name: "Play Responsive Track" }),
    screen.getByRole("button", { name: "Save Responsive Track" }),
    screen.getByRole("button", { name: "Open Responsive Track on YouTube" }),
    screen.getByRole("button", { name: "Download Responsive Track as MP3" }),
  ];

  actions.forEach((action) => {
    expect(action).toHaveClass("track-action");
    expect(action).toHaveTextContent("");
  });
});
