<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { darkTheme, dateEnUS, dateZhCN, enUS, NConfigProvider, NMessageProvider, zhCN } from "naive-ui";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useThemeStore } from "./stores/theme";
import { useLanguageStore } from "./stores/language";
import { useSearchFocusStore } from "./stores/searchFocus";

const themeStore = useThemeStore();
const langStore = useLanguageStore();
const router = useRouter();
const route = useRoute();
const searchFocusStore = useSearchFocusStore();

// naive-ui 组件文案随语言切换（日期选择器等）
const naiveLocale = computed(() => (langStore.lang === "zh-CN" ? zhCN : enUS));
const naiveDateLocale = computed(() => (langStore.lang === "zh-CN" ? dateZhCN : dateEnUS));

// 主题覆盖：主色统一为品牌蓝（naive-ui 默认绿色），圆角贴合卡片化设计
const themeOverrides = {
  common: {
    primaryColor: "#4098fc",
    primaryColorHover: "#5aa7fd",
    primaryColorPressed: "#2b7fe0",
    primaryColorSuppl: "#22d3ee",
    borderRadius: "8px",
    borderRadiusSmall: "6px",
  },
};

// 全局快捷键导航：Rust 侧按下快捷键后 emit 事件，这里跳转到对应工具页
const unlisten = ref<UnlistenFn | null>(null);
const unlistenFocus = ref<UnlistenFn | null>(null);

onMounted(async () => {
  // 等待主题/语言加载完成后再显示窗口（配合 tauri.conf.json visible: false，消除启动白屏）
  await Promise.allSettled([themeStore.load(), langStore.load()]);
  if (isTauri()) {
    // 窗口以 visible: false 创建，渲染完成后显示。
    // 注意：窗口隐藏时 WebView 渲染循环暂停，requestAnimationFrame 不触发，
    // 必须用 setTimeout（计时器不受渲染循环影响）延迟到首帧绘制后再 show。
    setTimeout(() => {
      getCurrentWindow().show().catch((e) => console.warn("[window] show failed", e));
    }, 100);
    unlisten.value = await listen<string>("devkit://navigate", (e) => {
      void router.push(e.payload);
    });
    // Alt+Space 唤起：回到首页并置位搜索框聚焦信号（HomeView 消费）
    unlistenFocus.value = await listen("devkit://focus-search", () => {
      if (route.path !== "/") {
        void router.push("/");
      }
      searchFocusStore.requestFocus();
    });
  }
});

onBeforeUnmount(() => {
  unlisten.value?.();
  unlistenFocus.value?.();
});

// 只要进入首页（软件内切换 / 启动即在首页 / 外部唤起）都置位搜索框聚焦信号
// immediate: 启动时首页即处于“输入状态”
watch(
  () => route.path,
  (path) => {
    if (path === "/") {
      searchFocusStore.requestFocus();
    }
  },
  { immediate: true },
);
</script>

<template>
  <n-config-provider
    :theme="themeStore.theme === 'dark' ? darkTheme : null"
    :theme-overrides="themeOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
