import { describe, expect, it } from "vitest";
import { lineRangeToOffsets } from "./locate";

// 1 WEBVTT  3 cue-1  5 第一行  7 blank      9 第二块
// 2 blank   4 timing 6 第二行  8 timing    10 (trailing newline)
const TEXT = [
  "WEBVTT",
  "",
  "cue-1",
  "00:00:01.000 --> 00:00:02.000",
  "第一行",
  "第二行",
  "",
  "00:00:04.000 --> 00:00:05.000",
  "第二块",
  "",
].join("\n");

describe("lineRangeToOffsets", () => {
  it("maps a multi-line block with an identifier to exact offsets", () => {
    const offsets = lineRangeToOffsets(TEXT, { first_line: 3, last_line: 6 });
    expect(offsets).not.toBeNull();
    expect(TEXT.slice(offsets!.start, offsets!.end)).toBe(
      "cue-1\n00:00:01.000 --> 00:00:02.000\n第一行\n第二行",
    );
  });

  it("maps a single line", () => {
    const offsets = lineRangeToOffsets(TEXT, { first_line: 1, last_line: 1 });
    expect(TEXT.slice(offsets!.start, offsets!.end)).toBe("WEBVTT");
  });

  it("maps the final line without a trailing newline", () => {
    const offsets = lineRangeToOffsets(TEXT, { first_line: 9, last_line: 9 });
    expect(TEXT.slice(offsets!.start, offsets!.end)).toBe("第二块");
  });

  it("rejects spans that cannot address the text", () => {
    expect(lineRangeToOffsets(TEXT, { first_line: 0, last_line: 1 })).toBeNull();
    expect(lineRangeToOffsets(TEXT, { first_line: 3, last_line: 2 })).toBeNull();
    expect(lineRangeToOffsets(TEXT, { first_line: 1, last_line: 99 })).toBeNull();
  });
});
