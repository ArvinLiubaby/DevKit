import { defineStore } from "pinia";
import { ref } from "vue";
import { Store } from "@tauri-apps/plugin-store";
import { i18n, type AppLang } from "../i18n";

const SETTINGS_FILE = "settings.json";
const LANG_KEY = "lang";

/** 是否运行在 Tauri WebView 内（纯浏览器 dev 预览时插件 API 不可用） */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * 语言状态：默认中文，持久化优先 tauri-plugin-store（settings.json），
 * 非 Tauri 环境（浏览器预览）回退 localStorage，保证 `npm run dev` 可独立调试。
 */
export const useLanguageStore = defineStore("language", () => {
  const lang = ref<AppLang>("zh-CN");

  async function load() {
    if (isTauri()) {
      try {
        const store = await Store.load(SETTINGS_FILE);
        const saved = await store.get<string>(LANG_KEY);
        if (saved === "en-US" || saved === "zh-CN") {
          lang.value = saved;
          i18n.global.locale.value = saved;
          return;
        }
        return;
      } catch (err) {
        console.warn("[language] 读取设置失败，回退 localStorage", err);
      }
    }
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en-US" || saved === "zh-CN") {
      lang.value = saved;
      i18n.global.locale.value = saved;
    }
  }

  async function set(next: AppLang) {
    lang.value = next;
    i18n.global.locale.value = next;
    if (isTauri()) {
      try {
        const store = await Store.load(SETTINGS_FILE);
        await store.set(LANG_KEY, next);
        await store.save();
        return;
      } catch (err) {
        console.warn("[language] 写入设置失败，回退 localStorage", err);
      }
    }
    localStorage.setItem(LANG_KEY, next);
  }

  return { lang, load, set };
});
