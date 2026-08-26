<script setup lang="ts">
import { computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NDropdown,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NText,
  NTooltip,
} from "naive-ui";
import type { DropdownOption, MenuOption } from "naive-ui";
import { useThemeStore } from "../stores/theme";
import { useLanguageStore } from "../stores/language";
import { tools } from "../tools/registry";

const themeStore = useThemeStore();
const route = useRoute();
const router = useRouter();
const isDark = computed(() => themeStore.theme === "dark");
const { t } = useI18n();
const langStore = useLanguageStore();

// 语言菜单（仅中英双语）：当前语言带对勾标识，选项语言名保持原生显示
const checkIcon = () =>
  h("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "menu-check" }, [
    h("path", {
      fill: "currentColor",
      d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    }),
  ]);

const langMenuOptions = computed<DropdownOption[]>(() => [
  { key: "zh-CN", label: "中文", icon: langStore.lang === "zh-CN" ? checkIcon : undefined },
  { key: "en-US", label: "English", icon: langStore.lang === "en-US" ? checkIcon : undefined },
]);

function onLangSelect(key: string) {
  langStore.set(key as "zh-CN" | "en-US");
}

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
      <n-layout-header bordered class="app-header" :class="{ dark: isDark }">
        <n-text strong>DevKit</n-text>
        <div class="header-actions">
          <!-- 语言：外层 n-dropdown 提供点击菜单，内层 n-tooltip 直接包 button 提供 hover 提示
               （n-tooltip 的 trigger 须直接是原生元素，夹组件会导致 hover 事件失效） -->
          <n-dropdown
            :options="langMenuOptions"
            trigger="click"
            placement="bottom"
            @select="onLangSelect"
          >
            <n-tooltip>
              <template #trigger>
                <button class="icon-btn" type="button" :aria-label="t('app.switchLang')">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"
                    />
                  </svg>
                </button>
              </template>
              {{ t("app.switchLang") }}
            </n-tooltip>
          </n-dropdown>

          <n-tooltip>
            <template #trigger>
              <button
                class="icon-btn"
                type="button"
                :aria-label="t('app.switchTheme')"
                @click="themeStore.toggle()"
              >
                <transition name="theme-pop" mode="out-in">
                  <svg v-if="isDark" key="sun" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"
                    />
                  </svg>
                  <svg v-else key="moon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"
                    />
                  </svg>
                </transition>
              </button>
            </template>
            {{ t("app.switchTheme") }}
          </n-tooltip>
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
  gap: 6px;
}

/* 图标按钮：透明底 + hover 圆底，深浅色各自适配 */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.icon-btn:hover {
  background: rgba(128, 128, 128, 0.14);
}

.app-header.dark .icon-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.icon-btn svg {
  width: 17px;
  height: 17px;
}

/* 主题图标切换微动画：旋转 + 缩放渐入 */
.theme-pop-enter-active {
  transition: transform 0.3s ease, opacity 0.2s ease;
}

.theme-pop-leave-active {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.theme-pop-enter-from {
  transform: rotate(-90deg) scale(0.5);
  opacity: 0;
}

.theme-pop-leave-to {
  transform: rotate(90deg) scale(0.5);
  opacity: 0;
}

/* 语言菜单：对勾图标 14px */
.menu-check {
  width: 14px;
  height: 14px;
}
</style>
