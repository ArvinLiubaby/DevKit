<script setup lang="ts">
import { computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NSelect,
  NSwitch,
  NText,
} from "naive-ui";
import type { MenuOption } from "naive-ui";
import { useThemeStore } from "../stores/theme";
import { useLanguageStore } from "../stores/language";
import { tools } from "../tools/registry";

const themeStore = useThemeStore();
const route = useRoute();
const router = useRouter();
const isDark = computed(() => themeStore.theme === "dark");
const { t } = useI18n();
const langStore = useLanguageStore();

// 语言切换选项（仅中英双语）
const langOptions = [
  { label: "中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
];

// 菜单主题：选中项用品牌蓝淡色背景，替代默认绿色，与导航栏整体更协调
const menuThemeOverrides = computed(() => ({
  itemColorActive: isDark.value ? "rgba(64, 152, 252, 0.24)" : "rgba(64, 152, 252, 0.12)",
  itemTextColorActive: isDark.value ? "#7cb8ff" : "#1a6fd4",
  itemColorActiveHover: isDark.value ? "rgba(64, 152, 252, 0.24)" : "rgba(64, 152, 252, 0.12)",
  itemTextColorActiveHover: isDark.value ? "#7cb8ff" : "#1a6fd4",
}));

// 菜单由工具注册表驱动，新工具注册后自动出现在侧边栏；computed 保证切换语言时实时重渲染
const menuOptions = computed<MenuOption[]>(() => [
  { label: t("app.home"), key: "/" },
  {
    type: "group",
    label: t("app.tools"),
    key: "tools-group",
    children: tools.map((tool) => ({
      label: t(tool.nameKey),
      key: tool.path,
      // 菜单图标：内联样式（icon 渲染函数在 NMenu 作用域执行，scoped class 不生效）
      icon: () =>
        h("img", {
          src: tool.icon,
          style: { width: "16px", height: "16px", display: "block", flex: "none" },
        }),
    })),
  },
]);

const activeKey = computed(() => route.path);

function handleMenuSelect(key: string) {
  router.push(key);
}
</script>

<template>
  <n-layout has-sider class="app-shell">
    <n-layout-sider
      bordered
      class="app-sider"
      :class="{ dark: isDark }"
      :width="220"
      collapse-mode="width"
      :collapsed-width="0"
      show-trigger
    >
      <n-menu
        :options="menuOptions"
        :value="activeKey"
        :theme-overrides="menuThemeOverrides"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered class="app-header">
        <n-text strong>DevKit</n-text>
        <div class="header-actions">
          <n-select
            :value="langStore.lang"
            :options="langOptions"
            size="small"
            class="lang-select"
            @update:value="(v) => langStore.set(v as 'zh-CN' | 'en-US')"
          />
          <div class="theme-switch">
            <n-text depth="3">{{ t("app.darkMode") }}</n-text>
            <n-switch
              :value="themeStore.theme === 'dark'"
              @update:value="() => themeStore.toggle()"
            />
          </div>
        </div>
      </n-layout-header>
      <n-layout-content class="app-content" content-style="padding: 16px">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.app-shell {
  height: 100vh;
}

/* 导航栏与工作区拉开层次：浅色浅灰 / 深色深灰，避免与内容区融为一体 */
.app-sider {
  background: #f5f6f8;
}

.app-sider.dark {
  background: #1a1c21;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
}

.app-content {
  height: calc(100vh - 48px);
}

.theme-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lang-select {
  width: 100px;
}
</style>
