<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { NAlert, NButton, NPopconfirm, useMessage } from "naive-ui";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useThemeStore } from "../../stores/theme";
import homeIcon from "../../assets/icons/home.svg";
import jsonIcon from "../../assets/icons/json.svg";
import timeIcon from "../../assets/icons/time.svg";
import textIcon from "../../assets/icons/text.svg";
import imageIcon from "../../assets/icons/image.svg";
import githubIcon from "../../assets/icons/github.svg";
import keyboardIcon from "../../assets/icons/keyboard.svg";

/** Rust 侧 ShortcutInfo 的镜像类型（serde camelCase） */
interface ShortcutInfo {
  id: string;
  key: string;
  defaultKey: string;
}

/** 浏览器预览模式的静态默认配置（无 Rust 命令可用），与 Rust 侧 ACTIONS 保持一致 */
const DEFAULT_ITEMS: ShortcutInfo[] = [
  { id: "toggleWindow", key: "Alt+Space", defaultKey: "Alt+Space" },
  { id: "jsonFormatter", key: "Alt+J", defaultKey: "Alt+J" },
  { id: "timestampConverter", key: "Alt+T", defaultKey: "Alt+T" },
  { id: "textDiff", key: "Alt+D", defaultKey: "Alt+D" },
  { id: "imageConverter", key: "Alt+I", defaultKey: "Alt+I" },
  { id: "ossRecommend", key: "Alt+R", defaultKey: "Alt+R" },
  { id: "shortcutManager", key: "Alt+K", defaultKey: "Alt+K" },
];

/** 动作 → 工具图标：与侧边栏菜单图标保持一致 */
const ACTION_ICONS: Record<string, string> = {
  toggleWindow: homeIcon,
  jsonFormatter: jsonIcon,
  timestampConverter: timeIcon,
  textDiff: textIcon,
  imageConverter: imageIcon,
  ossRecommend: githubIcon,
  shortcutManager: keyboardIcon,
};

// 修饰键显示名（Rust global_hotkey 格式为 control/alt/shift/super）
const MOD_LABEL: Record<string, string> = {
  alt: "Alt",
  control: "Ctrl",
  ctrl: "Ctrl",
  shift: "Shift",
  super: "Win",
  meta: "Meta",
  cmd: "Cmd",
};

/** 快捷键字符串 → 分体键帽段：修饰键规范显示，单字母大写 */
function keyParts(key: string): string[] {
  return key
    .split("+")
    .filter(Boolean)
    .map((p) => MOD_LABEL[p.toLowerCase()] ?? (p.length === 1 ? p.toUpperCase() : p));
}

const message = useMessage();
const { t } = useI18n();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

const desktop = isTauri();
const items = ref<ShortcutInfo[]>([]);
/** 正在录制新快捷键的动作 id，null 表示未在录制 */
const recordingId = ref<string | null>(null);

async function refresh() {
  if (!desktop) {
    items.value = DEFAULT_ITEMS;
    return;
  }
  try {
    items.value = await invoke<ShortcutInfo[]>("list_shortcuts");
  } catch (err) {
    message.error(t("shortcut.updateFailed", { err: String(err) }));
  }
}

function startRecord(id: string) {
  recordingId.value = id;
}

function cancelRecord() {
  recordingId.value = null;
}

/** 录制键盘事件：组合键 → global_hotkey 格式字符串（control/alt/shift/super + KeyboardEvent.code） */
function onKeydown(e: KeyboardEvent) {
  if (!recordingId.value) return;
  if (e.key === "Escape") {
    cancelRecord();
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  const isModifierKey = [
    "ControlLeft", "ControlRight", "AltLeft", "AltRight",
    "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight",
  ].includes(e.code);
  if (isModifierKey) return; // 单独按下修饰键，等待主键

  const mods: string[] = [];
  if (e.ctrlKey) mods.push("control");
  if (e.altKey) mods.push("alt");
  if (e.shiftKey) mods.push("shift");
  if (e.metaKey) mods.push("super");
  if (mods.length === 0) {
    message.warning(t("shortcut.invalid"));
    return;
  }

  applyShortcut(recordingId.value, [...mods, e.code].join("+"));
}

async function applyShortcut(id: string, key: string) {
  recordingId.value = null;
  try {
    items.value = await invoke<ShortcutInfo[]>("update_shortcut", { id, key });
    message.success(t("shortcut.updated"));
  } catch (err) {
    const detail = String(err);
    message.error(detail.includes("conflict") ? t("shortcut.conflict") : t("shortcut.updateFailed", { err: detail }));
  }
}

async function reset(id: string) {
  try {
    items.value = await invoke<ShortcutInfo[]>("reset_shortcut", { id });
    message.success(t("shortcut.resetDone"));
  } catch (err) {
    message.error(t("shortcut.updateFailed", { err: String(err) }));
  }
}

async function resetAll() {
  try {
    items.value = await invoke<ShortcutInfo[]>("reset_all_shortcuts");
    message.success(t("shortcut.resetDone"));
  } catch (err) {
    message.error(t("shortcut.updateFailed", { err: String(err) }));
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown, true);
  refresh();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <div class="sc-tool" :class="{ dark: isDark }">
    <n-alert v-if="!desktop" type="info" :show-icon="true" class="sc-alert">
      {{ t("shortcut.notTauri") }}
    </n-alert>

    <!-- 简介横幅：键盘图标徽标 + 说明文字 -->
    <section class="sc-intro">
      <span class="intro-icon" aria-hidden="true">
        <img :src="keyboardIcon" alt="" />
      </span>
      <p class="intro-text">{{ t("shortcut.intro") }}</p>
    </section>

    <div class="sc-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="sc-row"
        :class="{ recording: recordingId === item.id }"
      >
        <span class="sc-avatar" aria-hidden="true">
          <img :src="ACTION_ICONS[item.id] ?? keyboardIcon" alt="" />
        </span>
        <div class="sc-info">
          <span class="sc-name">{{ t(`shortcut.actions.${item.id}`) }}</span>
          <span class="sc-default">
            {{ t("shortcut.default") }}
            <span class="kbd-group muted">
              <kbd v-for="(part, i) in keyParts(item.defaultKey)" :key="i" class="kbd">{{ part }}</kbd>
            </span>
          </span>
        </div>
        <div class="sc-actions">
          <span v-if="recordingId === item.id" class="kbd-recording">
            <span class="rec-dot" aria-hidden="true"></span>
            {{ t("shortcut.recording") }}
          </span>
          <span v-else class="kbd-group">
            <kbd v-for="(part, i) in keyParts(item.key)" :key="i" class="kbd">{{ part }}</kbd>
          </span>

          <n-button v-if="recordingId === item.id" size="small" @click="cancelRecord">
            Esc
          </n-button>
          <template v-else>
            <n-button size="small" type="primary" :disabled="!desktop" @click="startRecord(item.id)">
              {{ t("shortcut.modify") }}
            </n-button>
            <n-button size="small" secondary :disabled="!desktop" @click="reset(item.id)">
              {{ t("shortcut.reset") }}
            </n-button>
          </template>
        </div>
      </div>
    </div>

    <div class="sc-footer">
      <n-popconfirm :disabled="!desktop" @positive-click="resetAll">
        <template #trigger>
          <n-button size="small" secondary type="warning" :disabled="!desktop">
            {{ t("shortcut.resetAll") }}
          </n-button>
        </template>
        {{ t("shortcut.resetAllConfirm") }}
      </n-popconfirm>
    </div>
  </div>
</template>

<style scoped>
.sc-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 760px;
  margin: 0 auto;
  padding: 4px 0;
}

.sc-alert {
  margin-bottom: 4px;
}

/* ---------- 简介横幅 ---------- */
.sc-intro {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border: 1px solid rgba(128, 128, 128, 0.16);
  border-radius: 12px;
  background: linear-gradient(120deg, rgba(64, 152, 252, 0.08), rgba(34, 211, 238, 0.05));
}

.intro-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(64, 152, 252, 0.12);
}

.intro-icon img {
  width: 20px;
  height: 20px;
}

.intro-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(100, 100, 100, 1);
}

/* ---------- 快捷键列表 ---------- */
.sc-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sc-row {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 16px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.sc-row:hover {
  border-color: rgba(64, 152, 252, 0.4);
  box-shadow: 0 3px 12px rgba(64, 152, 252, 0.1);
}

/* 录制中的行：品牌蓝描边提示焦点所在 */
.sc-row.recording {
  border-color: rgba(64, 152, 252, 0.6);
  box-shadow: 0 0 0 3px rgba(64, 152, 252, 0.14);
}

.sc-avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(64, 152, 252, 0.1);
}

.sc-avatar img {
  width: 20px;
  height: 20px;
}

.sc-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.sc-name {
  font-size: 14px;
  font-weight: 600;
}

.sc-default {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(128, 128, 128, 0.95);
}

.sc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/* ---------- 键帽 ---------- */
.kbd-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 分体键帽：顶部高光 + 底部加粗边，模拟物理键 */
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  padding: 2px 8px;
  border: 1px solid rgba(64, 152, 252, 0.4);
  border-bottom-width: 2.5px;
  border-radius: 6px;
  background: rgba(64, 152, 252, 0.08);
  color: #1a6fd4;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.kbd-group.muted .kbd {
  border-color: rgba(128, 128, 128, 0.3);
  background: rgba(128, 128, 128, 0.07);
  color: rgba(128, 128, 128, 1);
  box-shadow: none;
}

/* 录制状态：红点呼吸 + 虚线框提示等待按键 */
.kbd-recording {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 12px;
  border: 1px dashed rgba(208, 48, 80, 0.55);
  border-radius: 6px;
  background: rgba(208, 48, 80, 0.07);
  color: #d03050;
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  animation: rec-in 0.2s ease;
}

.rec-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d03050;
  animation: dot-blink 1s ease-in-out infinite;
}

@keyframes dot-blink {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes rec-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sc-footer {
  display: flex;
  justify-content: flex-end;
}

/* ---------- 深色模式 ---------- */
.sc-tool.dark .sc-intro {
  border-color: rgba(64, 152, 252, 0.24);
  background: linear-gradient(120deg, rgba(64, 152, 252, 0.12), rgba(34, 211, 238, 0.07));
}

.sc-tool.dark .intro-icon {
  background: rgba(64, 152, 252, 0.18);
}

.sc-tool.dark .intro-text {
  color: rgba(200, 204, 210, 0.85);
}

.sc-tool.dark .sc-row {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.sc-tool.dark .sc-row:hover {
  border-color: rgba(64, 152, 252, 0.5);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35);
}

.sc-tool.dark .sc-row.recording {
  border-color: rgba(64, 152, 252, 0.65);
  box-shadow: 0 0 0 3px rgba(64, 152, 252, 0.2);
}

.sc-tool.dark .sc-avatar {
  background: rgba(64, 152, 252, 0.16);
}

.sc-tool.dark .sc-default {
  color: rgba(200, 204, 210, 0.65);
}

.sc-tool.dark .kbd {
  border-color: rgba(64, 152, 252, 0.5);
  background: rgba(64, 152, 252, 0.16);
  color: #7cb8ff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.sc-tool.dark .kbd-group.muted .kbd {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(200, 204, 210, 0.75);
}

.sc-tool.dark .kbd-recording {
  border-color: rgba(255, 107, 129, 0.55);
  background: rgba(255, 107, 129, 0.1);
  color: #ff8a9b;
}

.sc-tool.dark .rec-dot {
  background: #ff8a9b;
}
</style>
