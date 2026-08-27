<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { darkTheme, dateEnUS, dateZhCN, enUS, NConfigProvider, NMessageProvider, zhCN } from "naive-ui";
import { isTauri } from "@tauri-apps/api/core";
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

// 全局快捷键导航：Rust 侧按下快捷键后 emit 事件，这里跳转到对应工具页
const unlisten = ref<UnlistenFn | null>(null);
const unlistenFocus = ref<UnlistenFn | null>(null);

onMounted(async () => {
  void themeStore.load();
  void langStore.load();
  if (isTauri()) {
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
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
