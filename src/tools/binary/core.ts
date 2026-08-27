/** 进制转换核心逻辑：BigInt 任意精度，支持 2/8/10/16 进制互转 */

export type Radix = 2 | 8 | 10 | 16;

export const RADIXES: Radix[] = [2, 8, 10, 16];

/** 展示前缀：十六进制 0x / 八进制 0o / 二进制 0b；十进制无前缀 */
export const RADIX_PREFIX: Record<Radix, string> = {
  2: "0b",
  8: "0o",
  10: "",
  16: "0x",
};

/** 各进制允许的字符集（不含符号位与前缀） */
const DIGIT_PATTERN: Record<Radix, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^\d+$/,
  16: /^[0-9a-fA-F]+$/,
};

/** 识别 0b / 0o / 0x 前缀对应的进制；无前缀返回 null */
export function detectRadix(input: string): Radix | null {
  const s = input.trim().toLowerCase();
  if (s.startsWith("0b")) return 2;
  if (s.startsWith("0o")) return 8;
  if (s.startsWith("0x")) return 16;
  return null;
}

/** 去掉正负号与 0b/0o/0x 前缀，返回纯数字串；纯数字（如 0123）原样返回 */
function stripPrefix(raw: string): string {
  const sign = raw.startsWith("-") || raw.startsWith("+") ? raw.slice(1) : raw;
  return sign.replace(/^0[bBxXoO]/, "");
}

/** 按源进制解析输入为 BigInt；空输入或含非法字符返回 null */
export function parseRadix(input: string, radix: Radix): bigint | null {
  const raw = input.trim();
  if (!raw) return null;
  const neg = raw.startsWith("-");
  const digits = stripPrefix(raw).toLowerCase();
  if (!digits || !DIGIT_PATTERN[radix].test(digits)) return null;
  let value = 0n;
  for (const ch of digits) {
    value = value * BigInt(radix) + BigInt(parseInt(ch, radix));
  }
  return neg ? -value : value;
}

/** 将 BigInt 格式化为带进制前缀的字符串（负号在前，如 -0x1A） */
export function toRadix(value: bigint, radix: Radix): string {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return sign + RADIX_PREFIX[radix] + abs.toString(radix);
}
