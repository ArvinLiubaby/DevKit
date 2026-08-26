<script setup lang="ts">
import { computed, onMounted } from "vue";
import { darkTheme, dateEnUS, dateZhCN, enUS, NConfigProvider, NMessageProvider, zhCN } from "naive-ui";
import { useThemeStore } from "./stores/theme";
import { useLanguageStore } from "./stores/language";

const themeStore = useThemeStore();
const langStore = useLanguageStore();

// naive-ui 组件文案随语言切换（日期选择器等）
const naiveLocale = computed(() => (langStore.lang === "zh-CN" ? zhCN : enUS));
const naiveDateLocale = computed(() => (langStore.lang === "zh-CN" ? dateZhCN : dateEnUS));

onMounted(() => {
  void themeStore.load();
  void langStore.load();
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
