const STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "your",
  "their",
  "have",
  "been",
  "will",
  "they",
  "them",
  "into",
  "about",
  "without",
  "seeking",
  "convenient",
]);

export function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

export function hasSegmentMessageOverlap(
  messages: string[],
  persona: string,
  rationale: string,
): boolean {
  const segmentTokens = significantTokens(`${persona} ${rationale}`);
  if (segmentTokens.size === 0) {
    return true;
  }

  return messages.some((message) => {
    const messageTokens = significantTokens(message);
    for (const token of messageTokens) {
      if (segmentTokens.has(token)) {
        return true;
      }
    }
    return false;
  });
}
