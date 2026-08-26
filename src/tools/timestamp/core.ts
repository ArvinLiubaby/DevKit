/**
 * 时间戳转换核心逻辑：Unix 时间戳（秒/毫秒/微秒）与可读日期时间的双向解析、格式化。
 */

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** 时间戳精度：10 位秒、13 位毫秒、16 位微秒 */
export type TsUnit = "s" | "ms" | "us";

const UNIT_LABEL: Record<TsUnit, string> = {
  s: "秒",
  ms: "毫秒",
  us: "微秒",
};

export function unitLabel(unit: TsUnit): string {
  return UNIT_LABEL[unit];
}

/** 检测时间戳精度，非纯数字返回 null */
export function detectUnit(input: string): TsUnit | null {
  const s = input.trim();
  if (!/^\d{1,17}$/.test(s)) return null;
  if (s.length <= 10) return "s";
  if (s.length <= 13) return "ms";
  return "us";
}

/** 解析 Unix 时间戳（自动识别秒/毫秒/微秒），无效返回 null */
export function parseTimestamp(input: string): Date | null {
  const s = input.trim();
  if (!/^\d{1,17}$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return null;
  const ms = s.length <= 10 ? n * 1000 : s.length <= 13 ? n : Math.floor(n / 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 本地时间：YYYY-MM-DD HH:mm:ss */
export function formatLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** UTC 时间：YYYY-MM-DD HH:mm:ss */
export function formatUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** ISO 8601（UTC，含 Z 后缀） */
export function formatIso(date: Date): string {
  return date.toISOString();
}

/** ISO 8601（本地时间，含时区偏移，如 +08:00） */
export function formatIsoLocal(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${formatLocal(date)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** 当前时区偏移描述，如 UTC+08:00 */
export function formatTimezoneOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** 距今描述：3 天 5 小时后 / 2 小时前 */
export function formatElapsed(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "后" : "前";
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const seconds = Math.floor((abs % 60_000) / 1000);
  if (days > 0) return `${days} 天 ${hours} 小时${suffix}`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟${suffix}`;
  if (minutes > 0) return `${minutes} 分钟 ${seconds} 秒${suffix}`;
  return `${seconds} 秒${suffix}`;
}

/**
 * 解析日期时间字符串（本地时区优先），无效返回 null。
 * 支持：2026-08-26 / 2026-08-26 15:30:00.123 / 2026/08/26 15:30 / 2026年8月26日 15:30:00 /
 *       ISO 8601 带时区偏移（2026-08-26T15:30:00+08:00）等。
 */
export function parseDateString(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(
    /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/,
  );
  if (m) {
    const [, y, mo, day, hh = "0", mm = "0", ss = "0", ms = "0"] = m;
    const d = new Date(+y, +mo - 1, +day, +hh, +mm, +ss, +ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // 其余交给 Date.parse（ISO 8601 带时区、RFC 2822 等）
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
