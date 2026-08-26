import JSON5 from "json5";

/**
 * JSON 工具核心逻辑（纯函数，与 UI 分离，便于单元测试与复用）。
 */

/** 修复报告：记录本次解析自动修复了哪些非标准写法 */
export interface FixReport {
  /** undefined / NaN / ±Infinity 替换为 null 的次数 */
  nonJsonValues: number;
  /** 八进制字面量（0o…）转十进制的次数 */
  octalLiterals: number;
  /** 二进制字面量（0b…）转十进制的次数 */
  binaryLiterals: number;
  /** 字符串内未转义控制字符（如换行符）→ 转义序列的次数 */
  controlChars: number;
  /** 是否使用了 JSON5 宽容语法（单引号/注释/尾随逗号/裸键/十六进制/多行字符串） */
  looseFeatures: boolean;
}

/** 修复项开关：按类别独立控制自动修复行为 */
export interface FixOptions {
  /** JSON5 宽容语法：单引号/注释/尾随逗号/裸键/十六进制/多行字符串 */
  looseSyntax: boolean;
  /** undefined / NaN / Infinity 等非 JSON 值 → null */
  nonJsonValues: boolean;
  /** 八进制（0o…）/ 二进制（0b…）字面量 → 十进制 */
  radixLiterals: boolean;
}

/** 全部修复项默认开启 */
export const defaultFixOptions: FixOptions = {
  looseSyntax: true,
  nonJsonValues: true,
  radixLiterals: true,
};

export interface JsonParseResult {
  value: unknown;
  /** 有修复时为报告，严格解析直接通过时为 null */
  report: FixReport | null;
}

/** 操作结果：输出文本 + 修复报告（report 为 null 表示输入本身就是标准 JSON） */
export interface FormatResult {
  text: string;
  report: FixReport | null;
}

/** 格式化（美化）JSON，indent 可为空格数或 Tab 字符串 */
export function formatJson(
  input: string,
  indent: number | string,
  autoFix: boolean,
  options: FixOptions = defaultFixOptions,
): FormatResult {
  const { value, report } = parseJson(input, autoFix, options);
  return { text: JSON.stringify(value, null, indent), report };
}

/** 压缩 JSON（去除所有非必要空白） */
export function minifyJson(
  input: string,
  autoFix: boolean,
  options: FixOptions = defaultFixOptions,
): FormatResult {
  const { value, report } = parseJson(input, autoFix, options);
  return { text: JSON.stringify(value), report };
}

/**
 * 宽松修复失败错误：JSON5 宽容语法修复项未开启时，预处理结果仍无法通过严格解析。
 * message 为底层 JSON.parse 的原始错误（英文，含行列位置），由视图层包装翻译。
 */
export class LooseSyntaxError extends SyntaxError {
  constructor(message: string) {
    super(message);
    this.name = "LooseSyntaxError";
  }
}

/**
 * 解析 JSON（可自动修复非标准写法）。
 *
 * @param autoFix 为 true 时：先尝试标准解析，失败则走"预处理 + JSON5"宽容修复链路；
 *                为 false 时：严格 JSON.parse，非标准写法直接抛错。
 */
export function parseJson(
  input: string,
  autoFix: boolean,
  options: FixOptions = defaultFixOptions,
): JsonParseResult {
  if (!autoFix) {
    return { value: JSON.parse(input), report: null };
  }
  // 合法 JSON 零开销直接通过，避免无谓的宽容解析
  try {
    return { value: JSON.parse(input), report: null };
  } catch {
    // 进入修复链路
  }

  const { text, report } = preprocess(input, options);
  let value: unknown;
  try {
    // 预处理结果能通过严格解析 ⇒ 仅发生了字面量替换（undefined/NaN/Infinity、0o/0b）
    value = JSON.parse(text);
    report.looseFeatures = false;
  } catch (err) {
    if (!options.looseSyntax) {
      // 抛 LooseSyntaxError，视图层据此包装为当前语言的提示文案
      throw new LooseSyntaxError((err as Error).message);
    }
    // JSON5 宽容解析：单引号/注释/尾随逗号/裸键/十六进制/多行字符串
    value = JSON5.parse(text);
    report.looseFeatures = true;
  }
  return { value, report };
}

/** 解析、递归排序对象键并格式化输出（数组元素逐个处理） */
export function sortJsonKeys(
  input: string,
  indent: number | string,
  autoFix: boolean,
  options: FixOptions = defaultFixOptions,
): FormatResult {
  const { value, report } = parseJson(input, autoFix, options);
  return { text: JSON.stringify(sortValue(value), null, indent), report };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/** 将解析错误转换为人类可读信息（含行列位置） */
export function describeParseError(err: unknown): string {
  if (err instanceof SyntaxError) {
    const withPos = err as SyntaxError & { lineNumber?: number; columnNumber?: number };
    if (withPos.lineNumber !== undefined && withPos.columnNumber !== undefined) {
      // 位置后缀用英文通用格式（引擎错误消息本身是英文）
      return `${withPos.message} (line ${withPos.lineNumber}, column ${withPos.columnNumber})`;
    }
    return err.message;
  }
  return String(err);
}

/* ------------------------------------------------------------------ */
/* 代码折叠：解析格式化输出的行结构，建立"折叠起点行 → 结束行"映射      */
/* ------------------------------------------------------------------ */

/** 行内第一个非空白代码字符（跳过字符串内容，避免字符串里的括号干扰） */
function firstCodeChar(line: string): string | undefined {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\") {
        i += 1;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (!/\s/.test(c)) return c;
  }
  return undefined;
}

/** 行内最后一个非空白代码字符（跳过字符串内容） */
function lastCodeChar(line: string): string | undefined {
  let inStr = false;
  let last: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\") {
        i += 1;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (!/\s/.test(c)) last = c;
  }
  return last;
}

/**
 * 建立代码折叠映射：折叠起点行 → 结束行。
 * 起点：行首或行尾为 `{`/`[`（含 `"key": {` 形式）；终点：行首为 `}`/`]`。
 * 依赖格式化输出的行结构约定（JSON.stringify 美化输出，字符串不跨行），
 * 字符串内容中的括号会被跳过，不产生误判。
 * 单行完整结构 `{}` / `[1, 2]` 不产生折叠点；空行忽略。
 * @returns Map<起点行号, 结束行号>（0-based）
 */
export function buildFoldRanges(lines: string[]): Map<number, number> {
  const map = new Map<number, number>();
  const stack: number[] = [];
  lines.forEach((line, idx) => {
    const first = firstCodeChar(line);
    const last = lastCodeChar(line);
    // 单行完整结构（如 `{}` / `[1, 2]`）：无折叠点
    if (
      (first === "{" || first === "[") &&
      (last === "}" || last === "]")
    ) {
      return;
    }
    if (first === "{" || first === "[") {
      stack.push(idx);
    } else if (last === "{" || last === "[") {
      // 行尾是开括号（如 `"a": {`），折叠起点
      stack.push(idx);
    } else if ((first === "}" || first === "]") && stack.length > 0) {
      const start = stack.pop()!;
      if (start !== idx) map.set(start, idx);
    }
  });
  return map;
}

/* ------------------------------------------------------------------ */
/* 词法安全预处理：仅在字符串/注释之外的代码区域做字面量替换，         */
/* 避免误伤字符串内容（如 "I love undefined" 不会被替换）。            */
/* ------------------------------------------------------------------ */

// sticky 正则：从 lastIndex 处精确匹配，全程 O(n) 扫描
const RE_NON_JSON_VALUE = /\b(undefined|NaN)\b|-?(Infinity)\b/y;
const RE_OCTAL_LITERAL = /\b0o([0-7]+)\b/y;
const RE_BINARY_LITERAL = /\b0b([01]+)\b/y;

function preprocess(input: string, options: FixOptions): { text: string; report: FixReport } {
  const report: FixReport = {
    nonJsonValues: 0,
    octalLiterals: 0,
    binaryLiterals: 0,
    controlChars: 0,
    looseFeatures: false,
  };
  let out = "";
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    // 字符串（单引号 / 双引号）：逐个字符处理，转义序列原样保留，
    // 未转义的控制字符（换行/回车/Tab 等）转为转义序列（JSON/JSON5 均不允许原始控制字符）
    if (ch === '"' || ch === "'") {
      out += ch;
      i += 1;
      while (i < n) {
        const c = input[i];
        if (c === "\\") {
          // 转义序列：原样保留（含 \ 换行的续行写法）
          out += c;
          i += 1;
          if (i < n) {
            out += input[i];
            i += 1;
          }
          continue;
        }
        if (c === ch) {
          out += c;
          i += 1;
          break;
        }
        const code = c.charCodeAt(0);
        if (code < 0x20) {
          // 未转义控制字符 → 转义序列，保留语义
          if (c === "\n") out += "\\n";
          else if (c === "\r") out += "\\r";
          else if (c === "\t") out += "\\t";
          else out += `\\u${code.toString(16).padStart(4, "0")}`;
          report.controlChars += 1;
          i += 1;
          continue;
        }
        out += c;
        i += 1;
      }
      continue;
    }

    // 行注释 //：跳过到行尾（保留换行符，维持行列位置）
    if (ch === "/" && input[i + 1] === "/") {
      const start = i;
      while (i < n && input[i] !== "\n") i += 1;
      out += input.slice(start, i);
      continue;
    }

    // 块注释 /* */：整体跳过
    if (ch === "/" && input[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(input[i] === "*" && input[i + 1] === "/")) i += 1;
      i = Math.min(i + 2, n);
      out += input.slice(start, i);
      continue;
    }

    // 非字符串/注释区域：按修复项开关执行字面量替换
    if (options.nonJsonValues) {
      RE_NON_JSON_VALUE.lastIndex = i;
      const nonJson = RE_NON_JSON_VALUE.exec(input);
      if (nonJson) {
        out += "null";
        report.nonJsonValues += 1;
        i = nonJson.index + nonJson[0].length;
        continue;
      }
    }

    if (options.radixLiterals) {
      RE_OCTAL_LITERAL.lastIndex = i;
      const octal = RE_OCTAL_LITERAL.exec(input);
      if (octal) {
        out += String(parseInt(octal[1], 8));
        report.octalLiterals += 1;
        i = octal.index + octal[0].length;
        continue;
      }

      RE_BINARY_LITERAL.lastIndex = i;
      const binary = RE_BINARY_LITERAL.exec(input);
      if (binary) {
        out += String(parseInt(binary[1], 2));
        report.binaryLiterals += 1;
        i = binary.index + binary[0].length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  // looseFeatures 由 parseJson 根据实际解析路径判定（严格通过=false，JSON5 解析=true）
  return { text: out, report };
}
