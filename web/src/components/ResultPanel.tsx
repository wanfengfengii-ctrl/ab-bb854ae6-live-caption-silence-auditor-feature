import type { Gap, ReviewResult } from "../api";
import { GAP_TYPE_LABEL, formatMs } from "../format";
import { gapKey, type LocateState } from "../locate";

function GapLocation({ gap }: { gap: Gap }) {
  if (gap.type === "between") {
    return (
      <span data-testid={`gap-lines-${gap.type}`}>
        第 {gap.line} 行 → 第 {gap.to_line} 行
      </span>
    );
  }
  return <span>第 {gap.line} 行字幕{gap.type === "head" ? "之前" : "之后"}</span>;
}

const STEP_LABELS = ["· 前一块", "· 后一块"];

// Shared 定位原文 button: focuses the WebVTT source and selects the cue
// block(s) forming the gap. A between gap has two boundary blocks, so
// repeated clicks cycle between them. When the response carries no locate
// data the button stays disabled with the reason on its title, without
// disturbing the rest of the result.
function LocateButton({
  gap,
  locate,
  onLocate,
}: {
  gap: Gap;
  locate: LocateState | null;
  onLocate: (gap: Gap) => void;
}) {
  const ranges = gap.source_ranges ?? [];
  if (ranges.length === 0) {
    return (
      <button
        type="button"
        className="locate-button"
        disabled
        title="本次结果缺少原文定位数据，无法定位"
        data-testid="locate-button"
      >
        定位原文
      </button>
    );
  }
  const active = locate !== null && locate.key === gapKey(gap);
  const rangeIndex = active ? locate.rangeIndex : null;
  return (
    <button
      type="button"
      className={`locate-button${active ? " locate-button--active" : ""}`}
      aria-pressed={active}
      title={
        ranges.length > 1
          ? "选中形成该空档的字幕块，重复点击在前后两块间切换"
          : "选中形成该空档的字幕块"
      }
      data-testid="locate-button"
      onClick={() => onLocate(gap)}
    >
      定位原文
      {active && rangeIndex !== null && ranges.length > 1 && (
        <span className="locate-button__step" data-testid="locate-step">
          {STEP_LABELS[rangeIndex] ?? `· 第 ${rangeIndex + 1} 块`}
        </span>
      )}
    </button>
  );
}

export function ResultPanel({
  result,
  locate,
  onLocate,
}: {
  result: ReviewResult;
  locate: LocateState | null;
  onLocate: (gap: Gap) => void;
}) {
  return (
    <section
      className={`result ${result.passed ? "result--pass" : "result--fail"}`}
      aria-live="polite"
    >
      <header className="result__header">
        <h2 data-testid="verdict">
          {result.passed ? "✅ 审校通过" : "❌ 审校不通过"}
        </h2>
        <p className="result__summary">
          共解析 <strong>{result.cue_count}</strong> 条字幕，最大空档{" "}
          <strong data-testid="max-gap">{result.max_gap_ms}</strong> ms
          {result.violations.length > 0 && (
            <>
              ，违规区段 <strong>{result.violations.length}</strong> 处
            </>
          )}
        </p>
      </header>

      {result.violations.length > 0 && (
        <div className="result__violations">
          <h3>违规区段（超过允许上限）</h3>
          <ul>
            {result.violations.map((gap, index) => (
              <li
                key={`v-${index}`}
                className="violation"
                data-testid="violation"
              >
                <span className="badge">{GAP_TYPE_LABEL[gap.type]}</span>
                <span>
                  {formatMs(gap.start_ms)} → {formatMs(gap.end_ms)}
                </span>
                <span data-testid="violation-duration">{gap.duration_ms} ms</span>
                <span data-testid="violation-limit">
                  上限 {gap.limit_ms} ms
                </span>
                <GapLocation gap={gap} />
                <LocateButton gap={gap} locate={locate} onLocate={onLocate} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="result__all-gaps" open>
        <summary>全部空档（{result.gaps.length} 段）</summary>
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>起 (ms)</th>
              <th>止 (ms)</th>
              <th>时长 (ms)</th>
              <th>采用上限 (ms)</th>
              <th>位置</th>
              <th>原文</th>
            </tr>
          </thead>
          <tbody>
            {result.gaps.map((gap, index) => (
              <tr
                key={`g-${index}`}
                className={gap.duration_ms > 0 ? "" : "gap--zero"}
                data-testid="gap-row"
              >
                <td>{GAP_TYPE_LABEL[gap.type]}</td>
                <td>{gap.start_ms}</td>
                <td>{gap.end_ms}</td>
                <td>{gap.duration_ms}</td>
                <td>{gap.limit_ms}</td>
                <td>
                  <GapLocation gap={gap} />
                </td>
                <td>
                  <LocateButton gap={gap} locate={locate} onLocate={onLocate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
