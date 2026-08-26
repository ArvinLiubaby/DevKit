<script setup lang="ts">
import { onMounted } from "vue";
import { darkTheme, NConfigProvider, NMessageProvider } from "naive-ui";
import { useThemeStore } from "./stores/theme";

const themeStore = useThemeStore();

onMounted(() => {
  void themeStore.load();
});
</script>

<template>
  <n-config-provider :theme="themeStore.theme === 'dark' ? darkTheme : null">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
