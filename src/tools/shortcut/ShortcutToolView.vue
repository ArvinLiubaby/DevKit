<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { NAlert, NButton, NPopconfirm, NText, useMessage } from "naive-ui";
import { invoke, isTauri } from "@tauri-apps/api/core";

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

const message = useMessage();
const { t } = useI18n();

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
  <div class="sc-tool">
    <n-alert v-if="!desktop" type="info" :show-icon="true" class="sc-alert">
      {{ t("shortcut.notTauri") }}
    </n-alert>
    <n-text depth="3" size="small" class="intro">{{ t("shortcut.intro") }}</n-text>

    <div class="sc-list">
      <div v-for="item in items" :key="item.id" class="sc-row">
        <div class="sc-info">
          <n-text strong>{{ t(`shortcut.actions.${item.id}`) }}</n-text>
          <n-text depth="3" size="small">
            {{ t("shortcut.default") }}: <span class="kbd kbd-muted">{{ item.defaultKey }}</span>
          </n-text>
        </div>
        <div class="sc-actions">
          <span v-if="recordingId === item.id" class="kbd kbd-recording">
            {{ t("shortcut.recording") }}
          </span>
          <span v-else class="kbd kbd-current">{{ item.key }}</span>

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
  gap: 12px;
  max-width: 720px;
  margin: 0 auto;
  padding: 4px 0;
}

.sc-alert {
  margin-bottom: 4px;
}

.intro {
  line-height: 1.6;
}

.sc-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.045);
}

.sc-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.sc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-bottom-width: 2px;
  border-radius: 5px;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: nowrap;
}

.kbd-current {
  color: #1a6fd4;
  border-color: rgba(64, 152, 252, 0.45);
  background: rgba(64, 152, 252, 0.08);
}

.kbd-muted {
  opacity: 0.75;
}

.kbd-recording {
  color: #d03050;
  border-color: rgba(208, 48, 80, 0.45);
  background: rgba(208, 48, 80, 0.08);
}

.sc-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
