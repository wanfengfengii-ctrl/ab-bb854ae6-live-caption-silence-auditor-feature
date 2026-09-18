import type { SourceRange } from "./api";

/**
 * Why a locate action is unavailable for a gap result. Null when the gap can
 * be located in the textarea's current text.
 */
export function locateUnavailableReason(
  ranges: SourceRange[] | undefined,
  text: string,
): string | null {
  if (!ranges || ranges.length === 0) {
    return "该结果未携带定位数据";
  }
  const lineCount = text === "" ? 0 : text.split("\n").length;
  for (const range of ranges) {
    if (
      !Number.isInteger(range.start_line) ||
      !Number.isInteger(range.end_line) ||
      range.start_line < 1 ||
      range.end_line < range.start_line ||
      range.end_line > lineCount
    ) {
      return "定位行号已超出当前原文";
    }
  }
  return null;
}

function lineStartOffsets(value: string): number[] {
  const offsets = [0];
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

/**
 * Focus the WebVTT textarea and select the cue block at the given 1-based
 * source lines. The selection covers the block content itself (identifier,
 * timing and every payload line) but not the blank separator after it.
 */
export function selectSourceRange(
  textarea: HTMLTextAreaElement,
  range: SourceRange,
): void {
  const offsets = lineStartOffsets(textarea.value);
  const start = offsets[range.start_line - 1];
  const nextLineStart = offsets[range.end_line];
  const end =
    nextLineStart !== undefined
      ? nextLineStart - 1 // exclude the '\n' terminating the block
      : textarea.value.length;
  textarea.focus();
  textarea.setSelectionRange(start, Math.max(start, end));
}
