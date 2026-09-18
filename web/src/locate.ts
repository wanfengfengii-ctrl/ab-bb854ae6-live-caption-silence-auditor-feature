// Locate-in-source support for the gap review: map the 1-based inclusive
// line spans returned by the API onto textarea selection offsets.

import type { Gap, SourceRange } from "./api";

export interface TextOffsets {
  start: number;
  end: number;
}

// Identity of a gap within one review result; a violation and its entry in
// the all-gaps table share the same key so locating continues cycling
// across both lists.
export function gapKey(gap: Gap): string {
  return `${gap.type}:${gap.start_ms}:${gap.end_ms}`;
}

// Which gap is currently highlighted in the source, and which of its
// boundary blocks (index into source_ranges) is selected.
export interface LocateState {
  key: string;
  rangeIndex: number;
}

// Convert a 1-based inclusive line span to textarea selection offsets.
// Returns null when the span cannot address the current text (e.g. stale
// line numbers), in which case locating is skipped rather than selecting
// the wrong passage.
export function lineRangeToOffsets(
  text: string,
  range: SourceRange,
): TextOffsets | null {
  const { first_line: first, last_line: last } = range;
  const lines = text.split("\n");
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(last) ||
    first < 1 ||
    last < first ||
    last > lines.length
  ) {
    return null;
  }
  let start = 0;
  for (let index = 0; index < first - 1; index += 1) {
    start += lines[index].length + 1;
  }
  let end = start;
  for (let index = first - 1; index < last; index += 1) {
    end += lines[index].length;
    if (index < last - 1) end += 1; // newline between selected lines
  }
  return { start, end };
}
