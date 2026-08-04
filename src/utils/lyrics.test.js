import { parseSyncedLyrics, splitPlainLyrics } from "./lyrics";

test("parses, sorts, and expands synchronized lyric timestamps", () => {
  expect(parseSyncedLyrics([
    "[00:12.50]Second line",
    "[00:02.250][00:07.00]First line",
    "[ar:Artist metadata]",
    "untimed text",
  ].join("\n"))).toEqual([
    { time: 2250, text: "First line" },
    { time: 7000, text: "First line" },
    { time: 12500, text: "Second line" },
  ]);
});

test("ignores malformed synchronized lines and normalizes plain lyrics", () => {
  expect(parseSyncedLyrics("[bad]Nope\n[00:75.00]Nope\n[01:02.5]Keep me")).toEqual([
    { time: 62500, text: "Keep me" },
  ]);
  expect(splitPlainLyrics(" First line \n\n Second line\r\n")).toEqual([
    "First line",
    "Second line",
  ]);
});
