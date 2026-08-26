/**
 * 文本对比核心逻辑：行级 LCS diff，修改行做词级高亮。
 * 纯函数、无依赖，便于测试与复用。
 */

export type DiffType = "same" | "add" | "del" | "change";

/** 字符区间 [start, end) */
export interface Range {
  start: number;
  end: number;
}

export interface DiffLine {
  type: DiffType;
  /** 原文本行号（0-based），add 行为 null */
  oldIndex: number | null;
  /** 新文本行号（0-based），del 行为 null */
  newIndex: number | null;
  oldText: string;
  newText: string;
  /** 词级高亮区间（change 行）：原文本中被替换的片段 */
  oldHighlights: Range[] | null;
  /** 词级高亮区间（change 行）：新文本中新增的片段 */
  newHighlights: Range[] | null;
}

export interface DiffResult {
  lines: DiffLine[];
  addCount: number;
  delCount: number;
  changeCount: number;
}

type Op = "same" | "del" | "add";

/** 转义 HTML 特殊字符（渲染 diff 结果前必须转义，防注入） */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** LCS 动态规划 + 回溯：返回 a → b 的逐项操作序列 */
function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): Op[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i * width + j] = eq(a[i - 1], b[j - 1])
        ? dp[(i - 1) * width + j - 1] + 1
        : Math.max(dp[(i - 1) * width + j], dp[i * width + j - 1]);
    }
  }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (eq(a[i - 1], b[j - 1])) {
      ops.push("same");
      i--;
      j--;
    } else if (dp[(i - 1) * width + j] >= dp[i * width + j - 1]) {
      ops.push("del");
      i--;
    } else {
      ops.push("add");
      j--;
    }
  }
  while (i > 0) {
    ops.push("del");
    i--;
  }
  while (j > 0) {
    ops.push("add");
    j--;
  }
  return ops.reverse();
}

/** 按空白分词，记录每个词的字符区间 */
function tokenize(line: string): { text: string; start: number; end: number }[] {
  const tokens: { text: string; start: number; end: number }[] = [];
  const re = /\s+|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** 修改行词级对比：标记原文本中被替换的片段、新文本中新增的片段 */
function highlightWordDiff(
  oldLine: string,
  newLine: string,
): { oldHighlights: Range[]; newHighlights: Range[] } {
  const a = tokenize(oldLine);
  const b = tokenize(newLine);
  const ops = lcsOps(a, b, (x, y) => x.text === y.text);
  const oldHighlights: Range[] = [];
  const newHighlights: Range[] = [];
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === "same") {
      i++;
      j++;
    } else if (op === "del") {
      oldHighlights.push({ start: a[i].start, end: a[i].end });
      i++;
    } else {
      newHighlights.push({ start: b[j].start, end: b[j].end });
      j++;
    }
  }
  return { oldHighlights, newHighlights };
}

/** 行级 LCS 规模保护：超过阈值时不做精确匹配，全部按新增/删除处理 */
const MAX_LCS_CELLS = 4_000_000;

/**
 * 对比两段文本：返回逐行 diff 结果（same / add / del / change）。
 * change 行附带词级高亮区间；空行保留并参与对比。
 */
export function diffText(oldText: string, newText: string): DiffResult {
  const a = splitLines(oldText);
  const b = splitLines(newText);

  // 公共前缀 / 后缀裁剪（行级），大幅缩小 LCS 规模
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }
  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);

  let midOps: Op[];
  if (midA.length * midB.length > MAX_LCS_CELLS) {
    // 超大规模：放弃精确匹配，避免卡死
    midOps = [...midA.map(() => "del" as Op), ...midB.map(() => "add" as Op)];
  } else {
    midOps = lcsOps(midA, midB, (x, y) => x === y);
  }

  const ops: Op[] = [];
  for (let i = 0; i < prefix; i++) ops.push("same");
  ops.push(...midOps);
  for (let i = 0; i < suffix; i++) ops.push("same");

  // 生成行结果；连续的 del + add 配对为 change（按顺序一一对应）
  const lines: DiffLine[] = [];
  let addCount = 0;
  let delCount = 0;
  let changeCount = 0;
  let oi = 0;
  let ni = 0;
  let pendingDels: { text: string; index: number }[] = [];
  let pendingAdds: { text: string; index: number }[] = [];

  const flush = () => {
    const paired = Math.min(pendingDels.length, pendingAdds.length);
    for (let k = 0; k < paired; k++) {
      const d = pendingDels[k];
      const ad = pendingAdds[k];
      const { oldHighlights, newHighlights } = highlightWordDiff(d.text, ad.text);
      lines.push({
        type: "change",
        oldIndex: d.index,
        newIndex: ad.index,
        oldText: d.text,
        newText: ad.text,
        oldHighlights,
        newHighlights,
      });
      changeCount++;
    }
    for (let k = paired; k < pendingDels.length; k++) {
      lines.push({
        type: "del",
        oldIndex: pendingDels[k].index,
        newIndex: null,
        oldText: pendingDels[k].text,
        newText: "",
        oldHighlights: null,
        newHighlights: null,
      });
      delCount++;
    }
    for (let k = paired; k < pendingAdds.length; k++) {
      lines.push({
        type: "add",
        oldIndex: null,
        newIndex: pendingAdds[k].index,
        oldText: "",
        newText: pendingAdds[k].text,
        oldHighlights: null,
        newHighlights: null,
      });
      addCount++;
    }
    pendingDels = [];
    pendingAdds = [];
  };

  for (const op of ops) {
    if (op === "same") {
      flush();
      lines.push({
        type: "same",
        oldIndex: oi,
        newIndex: ni,
        oldText: a[oi],
        newText: b[ni],
        oldHighlights: null,
        newHighlights: null,
      });
      oi++;
      ni++;
    } else if (op === "del") {
      pendingDels.push({ text: a[oi], index: oi });
      oi++;
    } else {
      pendingAdds.push({ text: b[ni], index: ni });
      ni++;
    }
  }
  flush();

  return { lines, addCount, delCount, changeCount };
}
