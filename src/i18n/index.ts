import { createI18n } from "vue-i18n";
import zhCN from "../locales/zh-CN";
import enUS from "../locales/en-US";

export type AppLang = "zh-CN" | "en-US";

// 初始语言：浏览器环境先读 localStorage（Tauri 持久化由 language store 异步加载后覆盖）
const saved = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;

export const i18n = createI18n({
  legacy: false,
  locale: saved === "en-US" ? "en-US" : "zh-CN",
  fallbackLocale: "zh-CN",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

/** 当前语言 → core 层通用语言标记（如 formatElapsed 的参数） */
export function coreLang(lang: string): "zh" | "en" {
  return lang === "en-US" ? "en" : "zh";
}
