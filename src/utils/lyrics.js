const timestampPattern = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g;

export function parseSyncedLyrics(value) {
  if (typeof value !== "string") return [];
  const parsed = [];
  value.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const matches = [...rawLine.matchAll(timestampPattern)];
    const text = rawLine.replace(timestampPattern, "").trim();
    if (!text || matches.length === 0) return;
    matches.forEach((match, timestampIndex) => {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return;
      parsed.push({
        time: Math.round((minutes * 60 + seconds) * 1000),
        text,
        order: lineIndex * 100 + timestampIndex,
      });
    });
  });
  return parsed
    .sort((first, second) => first.time - second.time || first.order - second.order)
    .map(({ time, text }) => ({ time, text }));
}

export function splitPlainLyrics(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
