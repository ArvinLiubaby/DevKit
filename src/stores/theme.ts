import { defineStore } from "pinia";
import { ref } from "vue";
import { Store } from "@tauri-apps/plugin-store";

const SETTINGS_FILE = "settings.json";
const THEME_KEY = "theme";

/** 是否运行在 Tauri WebView 内（纯浏览器 dev 预览时插件 API 不可用） */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * 主题状态：默认浅色，持久化优先 tauri-plugin-store（settings.json），
 * 非 Tauri 环境（浏览器预览）回退 localStorage，保证 `npm run dev` 可独立调试。
 */
export const useThemeStore = defineStore("theme", () => {
  const theme = ref<"light" | "dark">("light");

  async function load() {
    if (isTauri()) {
      try {
        const store = await Store.load(SETTINGS_FILE);
        const saved = (await store.get<string>(THEME_KEY)) ?? "light";
        theme.value = saved === "dark" ? "dark" : "light";
        // 镜像到 localStorage，供 index.html 启动内联脚本同步读取（消除白屏闪烁）
        localStorage.setItem(THEME_KEY, theme.value);
        return;
      } catch (err) {
        console.warn("[theme] 读取设置失败，回退 localStorage", err);
      }
    }
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") {
      theme.value = "dark";
    }
  }

  async function toggle() {
    theme.value = theme.value === "light" ? "dark" : "light";
    if (isTauri()) {
      try {
        const store = await Store.load(SETTINGS_FILE);
        await store.set(THEME_KEY, theme.value);
        await store.save();
        localStorage.setItem(THEME_KEY, theme.value);
        return;
      } catch (err) {
        console.warn("[theme] 写入设置失败，回退 localStorage", err);
      }
    }
    localStorage.setItem(THEME_KEY, theme.value);
  }

  return { theme, load, toggle };
});
