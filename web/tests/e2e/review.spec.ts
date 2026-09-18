import { expect, test, type Page } from "@playwright/test";

async function submit(page: Page) {
  await page.getByTestId("submit").click();
}

test("页面真实联调：默认样例在 1500ms 上限下审校通过", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await submit(page);

  await expect(page.getByTestId("verdict")).toHaveText("✅ 审校通过");
  await expect(page.getByTestId("max-gap")).toHaveText("1000");
  // head = 1000, between = 500/0, tail = 1000
  await expect(page.getByTestId("violation")).toHaveCount(0);
});

test("裁决边界：上限等于最大空档合格，减少 1ms 立即违规并列出全部区段", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-limit").fill("1000");
  await submit(page);
  await expect(page.getByTestId("verdict")).toHaveText("✅ 审校通过");

  await page.getByTestId("input-limit").fill("999");
  await submit(page);
  await expect(page.getByTestId("verdict")).toHaveText("❌ 审校不通过");
  // 片头与片尾均为 1000ms，均超过 999ms
  await expect(page.getByTestId("violation")).toHaveCount(2);
  await expect(page.getByTestId("violation").first()).toContainText("1000 ms");
});

test("解析错误：拒绝整份输入并显示原始行号，且不保留旧结果", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await submit(page);
  await expect(page.getByTestId("verdict")).toBeVisible();

  await page.getByTestId("input-vtt").fill(
    "WEBVTT\n\n" +
      "00:00:01.000 --> 00:00:02.000\n第一条\n\n" +
      "00:00:03.000 --> 00:00:61.000\n坏时间戳\n",
  );
  await submit(page);

  const errorBox = page.getByTestId("source-error");
  await expect(errorBox).toBeVisible();
  await expect(page.getByTestId("source-error-line")).toHaveText("6");
  await expect(page.getByTestId("verdict")).toHaveCount(0);
});

test("仅含文件头无字幕块被拒绝（empty_document）", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-vtt").fill("WEBVTT\n");
  await submit(page);
  const errorBox = page.getByTestId("source-error");
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText("没有任何字幕块");
});

test("参数错误：开始时间不小于结束时间时指向结束字段，不发起错误状态", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-start").fill("5000");
  await page.getByTestId("input-end").fill("5000");
  await submit(page);
  await expect(page.getByTestId("input-end-error")).toBeVisible();
  await expect(page.getByTestId("source-error")).toHaveCount(0);
  await expect(page.getByTestId("verdict")).toHaveCount(0);
});

test("时间轴违规：重叠字幕按原始行号拒绝", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-start").fill("0");
  await page.getByTestId("input-end").fill("20000");
  await page.getByTestId("input-limit").fill("5000");
  await page.getByTestId("input-vtt").fill(
    "WEBVTT\n\n" +
      "00:00:01.000 --> 00:00:06.000\n长字幕\n\n" +
      "00:00:05.000 --> 00:00:08.000\n与上条重叠\n",
  );
  await submit(page);
  await expect(page.getByTestId("source-error")).toBeVisible();
  await expect(page.getByTestId("source-error-line")).toHaveText("6");
});

// Two cues in 0..5000ms produce three gaps of exactly 1000ms each:
// head 0->1000, between 2000->3000, tail 4000->5000.
const EQUAL_GAPS_VTT =
  "WEBVTT\n\n" +
  "00:00:01.000 --> 00:00:02.000\n第一条\n\n" +
  "00:00:03.000 --> 00:00:04.000\n第二条\n";

async function enableCategoryLimits(page: Page) {
  await page.getByTestId("input-start").fill("0");
  await page.getByTestId("input-end").fill("5000");
  await page.getByTestId("input-vtt").fill(EQUAL_GAPS_VTT);
  await page.getByTestId("gap-limits-toggle").check();
}

test("分类上限：三段等长空档按不同分类上限产生不同判定", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await enableCategoryLimits(page);
  await page.getByTestId("input-gap-head").fill("1000");
  await page.getByTestId("input-gap-between").fill("999");
  await page.getByTestId("input-gap-tail").fill("2000");
  await submit(page);

  await expect(page.getByTestId("verdict")).toHaveText("❌ 审校不通过");
  // Only the 字幕间隙 gap (1000ms > 999ms) violates; head equals its limit
  // and tail is well under its limit.
  const violations = page.getByTestId("violation");
  await expect(violations).toHaveCount(1);
  await expect(violations.first()).toContainText("字幕间隙");
  await expect(violations.first()).toContainText("上限 999 ms");
  // max_gap_ms is the raw largest gap (1000), independent of limits.
  await expect(page.getByTestId("max-gap")).toHaveText("1000");
});

test("分类上限：空档时长等于分类上限时通过", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await enableCategoryLimits(page);
  await page.getByTestId("input-gap-head").fill("1000");
  await page.getByTestId("input-gap-between").fill("1000");
  await page.getByTestId("input-gap-tail").fill("1000");
  await submit(page);

  await expect(page.getByTestId("verdict")).toHaveText("✅ 审校通过");
  await expect(page.getByTestId("violation")).toHaveCount(0);
});

test("分类上限：关闭后重新开启保留本次已填值", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("gap-limits-toggle").check();
  await page.getByTestId("input-gap-head").fill("800");
  await page.getByTestId("input-gap-between").fill("1200");
  await page.getByTestId("input-gap-tail").fill("2000");

  await page.getByTestId("gap-limits-toggle").uncheck();
  await expect(page.getByTestId("input-gap-head")).toHaveCount(0);
  await page.getByTestId("gap-limits-toggle").check();
  await expect(page.getByTestId("input-gap-head")).toHaveValue("800");
  await expect(page.getByTestId("input-gap-between")).toHaveValue("1200");
  await expect(page.getByTestId("input-gap-tail")).toHaveValue("2000");
});

test("分类上限：分类值非法（负数）时在输入旁反馈且不发送请求", async ({ page }: { page: Page }) => {
  await page.goto("/");
  let reviewRequested = false;
  await page.route("**/api/review", (route) => {
    reviewRequested = true;
    route.continue();
  });
  await enableCategoryLimits(page);
  await page.getByTestId("input-gap-head").fill("1000");
  await page.getByTestId("input-gap-between").fill("1000");
  await page.getByTestId("input-gap-tail").fill("-1");
  await submit(page);

  await expect(page.getByTestId("input-gap-tail-error")).toBeVisible();
  await expect(page.getByTestId("input-gap-tail-error")).toContainText("非负整数");
  await expect(page.getByTestId("verdict")).toHaveCount(0);
  // Give any (incorrect) in-flight request a moment, then assert none fired.
  await page.waitForTimeout(300);
  expect(reviewRequested).toBe(false);
});

test("分类上限：分类值超出精确范围时在输入旁拒绝且不发送请求", async ({ page }: { page: Page }) => {
  await page.goto("/");
  let reviewRequested = false;
  await page.route("**/api/review", (route) => {
    reviewRequested = true;
    route.continue();
  });
  await enableCategoryLimits(page);
  await page.getByTestId("input-gap-head").fill("1000");
  await page.getByTestId("input-gap-between").fill("1000");
  // 2^53 + 1 cannot be represented exactly; Number() would silently round it.
  await page.getByTestId("input-gap-tail").fill("9007199254740993");
  await submit(page);

  await expect(page.getByTestId("input-gap-tail-error")).toBeVisible();
  await expect(page.getByTestId("input-gap-tail-error")).toContainText("精确");
  await expect(page.getByTestId("verdict")).toHaveCount(0);
  // Give any (incorrect) in-flight request a moment, then assert none fired.
  await page.waitForTimeout(300);
  expect(reviewRequested).toBe(false);
});

test("分类上限：等待审校结果期间表单锁定，结果与当前配置一致", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await enableCategoryLimits(page);
  await page.getByTestId("input-gap-head").fill("1000");
  await page.getByTestId("input-gap-between").fill("1000");
  await page.getByTestId("input-gap-tail").fill("1000");

  // Hold the response so the waiting state is observable.
  let release: () => void = () => {};
  await page.route("**/api/review", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.continue();
  });
  await submit(page);

  // While the verdict is pending, no threshold (or any other config input)
  // can be edited, so the returned result always matches the visible form.
  await expect(page.getByTestId("input-gap-head")).toBeDisabled();
  await expect(page.getByTestId("input-gap-between")).toBeDisabled();
  await expect(page.getByTestId("input-gap-tail")).toBeDisabled();
  await expect(page.getByTestId("gap-limits-toggle")).toBeDisabled();
  await expect(page.getByTestId("input-start")).toBeDisabled();
  await expect(page.getByTestId("input-end")).toBeDisabled();
  await expect(page.getByTestId("input-limit")).toBeDisabled();
  await expect(page.getByTestId("input-vtt")).toBeDisabled();

  release();
  await expect(page.getByTestId("verdict")).toHaveText("✅ 审校通过");
  await expect(page.getByTestId("input-gap-head")).toBeEnabled();
});

// ---------------------------------------------------------------------------
// 定位原文：从审校结果跳回 WebVTT 字幕块（浏览器经真实代理提交）
// ---------------------------------------------------------------------------

const IDENTIFIED_MULTILINE_VTT =
  "WEBVTT\n\n" +
  "cue-1\n00:00:02.000 --> 00:00:04.000\n第一行\n第二行\n\n" +
  "cue-2\n00:00:07.000 --> 00:00:08.000\n后一块\n";

const FIRST_BLOCK =
  "cue-1\n00:00:02.000 --> 00:00:04.000\n第一行\n第二行";
const SECOND_BLOCK = "cue-2\n00:00:07.000 --> 00:00:08.000\n后一块";

async function selectedText(page: Page): Promise<string> {
  return page
    .getByTestId("input-vtt")
    .evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    );
}

test("定位原文：经真实代理提交后从违规项选中含标识符和多行正文的字幕块", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-start").fill("0");
  await page.getByTestId("input-end").fill("10000");
  await page.getByTestId("input-limit").fill("0");
  await page.getByTestId("input-vtt").fill(IDENTIFIED_MULTILINE_VTT);
  await submit(page);

  // limit 0: head 2000ms / between 3000ms / tail 2000ms 全部违规。
  await expect(page.getByTestId("verdict")).toHaveText("❌ 审校不通过");
  const violations = page.getByTestId("violation");
  await expect(violations).toHaveCount(3);

  // 第一条违规是片头空档，边界块是带标识符和多行正文的第一块。
  await violations.first().getByTestId("locate-source").click();

  const textarea = page.getByTestId("input-vtt");
  await expect(textarea).toBeFocused();
  expect(await selectedText(page)).toBe(FIRST_BLOCK);
  expect(
    await violations.first().getByTestId("locate-status").textContent(),
  ).toContain("第 3–6 行");
});

test("定位原文：字幕间空档重复点击可在前、后两个边界块间切换，零时长空档也可定位", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-start").fill("0");
  await page.getByTestId("input-end").fill("10000");
  await page.getByTestId("input-limit").fill("0");
  await page.getByTestId("input-vtt").fill(IDENTIFIED_MULTILINE_VTT);
  await submit(page);

  // 全部空档表：head / between / tail 三行，between 是第二行。
  const rows = page.getByTestId("gap-row");
  const betweenRow = rows.nth(1);
  const betweenButton = betweenRow.getByTestId("locate-source");

  await betweenButton.click();
  expect(await selectedText(page)).toBe(FIRST_BLOCK);
  expect(await betweenButton.textContent()).toContain("前块");

  await betweenButton.click();
  expect(await selectedText(page)).toBe(SECOND_BLOCK);
  expect(await betweenButton.textContent()).toContain("后块");

  // 再来一次循环回前块。
  await betweenButton.click();
  expect(await selectedText(page)).toBe(FIRST_BLOCK);

  // 首尾相接的零时长 between 空档同样可以定位：两条紧贴字幕、上限放宽。
  const touching =
    "WEBVTT\n\n" +
    "00:00:02.000 --> 00:00:04.000\n前一块\n\n" +
    "00:00:04.000 --> 00:00:06.000\n紧贴块\n";
  await page.getByTestId("input-limit").fill("10000");
  await page.getByTestId("input-vtt").fill(touching);
  await submit(page);
  await expect(page.getByTestId("verdict")).toHaveText("✅ 审校通过");

  const zeroRow = page.getByTestId("gap-row").nth(1);
  await expect(zeroRow).toContainText("0");
  await zeroRow.getByTestId("locate-source").click();
  await expect(page.getByTestId("input-vtt")).toBeFocused();
  expect(await selectedText(page)).toBe(
    "00:00:02.000 --> 00:00:04.000\n前一块",
  );
});

test("定位原文：修改原文后旧审校结果与定位状态立即消失", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByTestId("input-start").fill("0");
  await page.getByTestId("input-end").fill("10000");
  await page.getByTestId("input-limit").fill("0");
  await page.getByTestId("input-vtt").fill(IDENTIFIED_MULTILINE_VTT);
  await submit(page);
  await expect(page.getByTestId("verdict")).toBeVisible();

  await page
    .getByTestId("gap-row")
    .nth(1)
    .getByTestId("locate-source")
    .click();
  await expect(page.getByTestId("locate-status").first()).toBeVisible();
  expect(await selectedText(page)).not.toBe("");

  // 改动原文（无需重新提交）：旧结果与定位按钮立刻全部清空。
  const textarea = page.getByTestId("input-vtt");
  await textarea.press("End");
  await textarea.type(" ");

  await expect(page.getByTestId("verdict")).toHaveCount(0);
  await expect(page.getByTestId("locate-source")).toHaveCount(0);
  await expect(page.getByTestId("locate-status")).toHaveCount(0);
  expect(await selectedText(page)).toBe("");
});
