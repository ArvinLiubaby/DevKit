<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { darkTheme, dateEnUS, dateZhCN, enUS, NConfigProvider, NMessageProvider, zhCN } from "naive-ui";
import { isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useThemeStore } from "./stores/theme";
import { useLanguageStore } from "./stores/language";

const themeStore = useThemeStore();
const langStore = useLanguageStore();
const router = useRouter();

// naive-ui 组件文案随语言切换（日期选择器等）
const naiveLocale = computed(() => (langStore.lang === "zh-CN" ? zhCN : enUS));
const naiveDateLocale = computed(() => (langStore.lang === "zh-CN" ? dateZhCN : dateEnUS));

// 全局快捷键导航：Rust 侧按下快捷键后 emit 事件，这里跳转到对应工具页
const unlisten = ref<UnlistenFn | null>(null);

onMounted(async () => {
  void themeStore.load();
  void langStore.load();
  if (isTauri()) {
    unlisten.value = await listen<string>("devkit://navigate", (e) => {
      void router.push(e.payload);
    });
  }
});

onBeforeUnmount(() => {
  unlisten.value?.();
});
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
