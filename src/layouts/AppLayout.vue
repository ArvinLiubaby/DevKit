<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  NButton,
  NDropdown,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NModal,
  NText,
  NTooltip,
  useMessage,
} from "naive-ui";
import type { DropdownOption, MenuOption } from "naive-ui";
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useThemeStore } from "../stores/theme";
import { useLanguageStore } from "../stores/language";
import { tools } from "../tools/registry";
import aboutIcon from "../assets/icons/about.svg";
import homeIcon from "../assets/icons/home.svg";
import toolsIcon from "../assets/icons/tools.svg";
// 程序图标（与任务栏/桌面一致）作为弹窗品牌 logo
import appIcon from "../../src-tauri/icons/icon.png";

const themeStore = useThemeStore();
const route = useRoute();
const router = useRouter();
const message = useMessage();
const isDark = computed(() => themeStore.theme === "dark");
const { t } = useI18n();
const langStore = useLanguageStore();

// 关于弹窗：版本号从 Tauri 运行时读取，浏览器预览回退当前发布版本
const showAbout = ref(false);
const appVersion = ref("0.5.1");
if (isTauri()) {
  getVersion().then((v) => (appVersion.value = v));
}

/** 打开 GitHub 仓库：Tauri 用 opener 插件（系统默认浏览器），浏览器预览回退 <a> 跳转 */
async function openRepo() {
  const url = "https://github.com/ArvinLiubaby/DevKit";
  try {
    if (isTauri()) {
      await openUrl(url);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    }
  } catch (err) {
    message.error(t("app.openFailed", { err: String(err) }));
  }
}

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

// 菜单图标：内联样式（icon 渲染函数在 NMenu 作用域执行，scoped class 不生效）
const toolIcon = (src: string) =>
  h("img", { src, style: { width: "16px", height: "16px", display: "block", flex: "none" } });

// 菜单结构：首页 → 工具（submenu 收纳全部普通工具）→ 设置类工具（如快捷键）独立为一级项
const menuOptions = computed<MenuOption[]>(() => [
  { label: t("app.home"), key: "/", icon: () => toolIcon(homeIcon) },
  {
    type: "submenu",
    label: t("app.tools"),
    key: "tools-submenu",
    icon: () => toolIcon(toolsIcon),
    children: tools
      .filter((tool) => tool.category !== "设置")
      .map((tool) => ({
        label: t(tool.nameKey),
        key: tool.path,
        icon: () => toolIcon(tool.icon),
      })),
  },
  ...tools
    .filter((tool) => tool.category === "设置")
    .map((tool) => ({
      label: t(tool.nameKey),
      key: tool.path,
      icon: () => toolIcon(tool.icon),
    })),
]);

// "工具"子菜单默认展开；切换语言时 key 不变，展开状态保持
const expandedKeys = ref<string[]>(["tools-submenu"]);
function handleUpdateExpanded(keys: string[]) {
  expandedKeys.value = keys;
}

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
      <div class="sider-inner">
        <n-menu
          :options="menuOptions"
          :value="activeKey"
          :expanded-keys="expandedKeys"
          :theme-overrides="menuThemeOverrides"
          @update:value="handleMenuSelect"
          @update:expanded-keys="handleUpdateExpanded"
        />
        <div class="sider-footer">
          <!-- 关于入口：悬浮圆形按钮，阴影 + hover 上浮交互 -->
          <n-tooltip placement="right">
            <template #trigger>
              <button
                class="about-fab"
                type="button"
                :aria-label="t('app.about')"
                @click="showAbout = true"
              >
                <img class="about-fab-icon" :src="aboutIcon" alt="" aria-hidden="true" />
              </button>
            </template>
            {{ t("app.about") }}
          </n-tooltip>
        </div>
      </div>
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

  <!-- 关于弹窗：品牌 logo + 版本 + 简介 + GitHub 仓库入口，居中卡片 -->
  <n-modal
    v-model:show="showAbout"
    :mask-closable="true"
    :close-on-esc="true"
    :show-close="false"
    class="about-modal-root"
  >
    <div class="about-modal" :class="{ dark: isDark }">
      <button
        class="about-close"
        type="button"
        :aria-label="t('app.close')"
        @click="showAbout = false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>
      <button class="about-logo-btn" type="button" :title="t('app.aboutRepo')" @click="openRepo">
        <img class="about-logo" :src="appIcon" alt="DevKit" />
      </button>
      <div class="about-name">DevKit</div>
      <div class="about-version">{{ t("app.aboutVersion") }} v{{ appVersion }}</div>
      <div class="about-slogan">{{ t("app.aboutSlogan") }}</div>
      <n-button type="primary" size="small" block class="about-repo" @click="openRepo">
        {{ t("app.aboutRepo") }}
      </n-button>
      <div class="about-copy">© 2026 Creek · MIT License</div>
    </div>
  </n-modal>
</template>

<style scoped>
.app-shell {
  height: 100vh;
}

/* 导航栏与工作区拉开层次：浅色浅灰 / 深色深灰，避免与内容区融为一体 */
app-sider {
  background: #f5f6f8;
}

.app-sider.dark {
  background: #1a1c21;
}

/* 侧边栏内部：菜单占满，底部固定"关于"入口 */
.sider-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sider-footer {
  margin-top: auto;
  display: flex;
  justify-content: flex-start;
  padding: 14px 0 16px 14px;
}

/* 一级菜单项视觉加强：加粗 + 字距，与工具子项拉开层级（首页 / 工具 / 快捷键等）
   naive 结构：submenu 根为 n-submenu，其下还有一层 n-menu-item */
:deep(.n-menu > .n-menu-item > .n-menu-item-content .n-menu-item-content-header),
:deep(.n-menu > .n-submenu > .n-menu-item > .n-menu-item-content .n-menu-item-content-header) {
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* 悬浮圆形按钮：液态玻璃质感（半透明磨砂 + 顶部高光 + 边缘高光线），hover 上浮 + 阴影加深 */
.about-fab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.about-fab:hover {
  transform: translateY(-2px) scale(1.05);
  background: rgba(255, 255, 255, 0.7);
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.about-fab:active {
  transform: translateY(0) scale(0.97);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.app-sider.dark .about-fab {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.app-sider.dark .about-fab:hover {
  background: rgba(255, 255, 255, 0.14);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.about-fab-icon {
  width: 22px;
  height: 22px;
}

/* 关于弹窗：居中卡片，四周和谐、跟随主题 */
.about-modal-root {
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 340px;
  padding: 30px 28px 22px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
  color: #333;
  text-align: center;
}

.about-modal.dark {
  background: #23262c;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  color: #d7dbe0;
}

.about-close {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.55;
  cursor: pointer;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.about-close:hover {
  opacity: 1;
  background: rgba(128, 128, 128, 0.14);
}

.about-modal.dark .about-close:hover {
  background: rgba(255, 255, 255, 0.14);
}

.about-close svg {
  width: 15px;
  height: 15px;
}

/* logo：可点击跳转仓库，hover 轻微放大 */
.about-logo-btn {
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.about-logo-btn:hover {
  transform: scale(1.06);
}

.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
}

.about-name {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.about-version {
  font-size: 12px;
  opacity: 0.55;
}

.about-slogan {
  margin-bottom: 6px;
  font-size: 12.5px;
  line-height: 1.6;
  opacity: 0.75;
}

.about-repo {
  margin-top: 4px;
}

.about-copy {
  margin-top: 10px;
  font-size: 11px;
  opacity: 0.45;
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
