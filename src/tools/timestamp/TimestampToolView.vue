<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { NAlert, NButton, NDatePicker, NInput, NSpace, NText, useMessage } from "naive-ui";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  detectUnit,
  formatElapsed,
  formatIso,
  formatIsoLocal,
  formatLocal,
  formatTimezoneOffset,
  formatUtc,
  parseDateString,
  parseTimestamp,
  unitLabel,
} from "./core";
import { useThemeStore } from "../../stores/theme";
import { useTimestampToolStore } from "../../stores/timestampTool";

const message = useMessage();

// 工作区状态提升到全局 store：切页返回后输入原样恢复
const store = useTimestampToolStore();
const { tsInput, dateInput, datePickerValue } = storeToRefs(store);

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

/* ------------------------------------------------------------------ */
/* 当前时间戳：每秒刷新，一键复制                                       */
/* ------------------------------------------------------------------ */
const now = ref(new Date());
let timer: number | undefined;
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});
onUnmounted(() => {
  window.clearInterval(timer);
});

const nowSec = computed(() => Math.floor(now.value.getTime() / 1000));
const nowMs = computed(() => now.value.getTime());
const nowLocal = computed(() => formatLocal(now.value));

/* ------------------------------------------------------------------ */
/* 时间戳 → 日期                                                       */
/* ------------------------------------------------------------------ */
const tsUnit = computed(() => detectUnit(tsInput.value));
const tsDate = computed(() => parseTimestamp(tsInput.value));
const tsError = computed(() => {
  if (!tsInput.value.trim()) return "";
  if (!tsUnit.value) return "请输入纯数字时间戳（1~17 位数字）";
  if (!tsDate.value) return "时间戳超出可表示范围";
  return "";
});

/* ------------------------------------------------------------------ */
/* 日期 → 时间戳                                                       */
/* ------------------------------------------------------------------ */
const dateResult = computed(() => parseDateString(dateInput.value));
const dateError = computed(() => {
  if (!dateInput.value.trim()) return "";
  return dateResult.value ? "" : "无法识别的日期格式，示例：2026-08-26 15:30:00";
});

// 日期选择器 → 文本输入（保持单一数据源，手动改文本不回写选择器）
watch(datePickerValue, (v) => {
  if (v != null) dateInput.value = formatLocal(new Date(v));
});

async function copy(text: string, tip: string) {
  if (!text) return;
  await writeText(text);
  message.success(tip);
}
</script>

<template>
  <div class="ts-tool" :class="{ dark: isDark }">
    <!-- 当前时间戳 -->
    <n-space class="toolbar" align="center" :wrap="true">
      <n-text strong>当前时间戳</n-text>
      <n-text code>{{ nowSec }}</n-text>
      <n-text depth="3" size="small">秒</n-text>
      <n-text code>{{ nowMs }}</n-text>
      <n-text depth="3" size="small">毫秒</n-text>
      <n-text depth="3">{{ nowLocal }}</n-text>
      <n-button size="tiny" secondary @click="copy(String(nowSec), '当前秒级时间戳已复制')">复制秒</n-button>
      <n-button size="tiny" secondary @click="copy(String(nowMs), '当前毫秒级时间戳已复制')">复制毫秒</n-button>
    </n-space>

    <div class="panels">
      <!-- 时间戳 → 日期时间 -->
      <div class="panel">
        <n-text strong size="small">时间戳 → 日期时间</n-text>
        <n-input
          v-model:value="tsInput"
          placeholder="输入 Unix 时间戳，如 1785111000（秒 / 毫秒 / 微秒自动识别）"
          :status="tsError ? 'error' : undefined"
        />
        <n-alert v-if="tsError" type="error" size="small" :show-icon="true">{{ tsError }}</n-alert>
        <div v-if="tsDate" class="result-list">
          <div class="result-row">
            <n-text depth="3" size="small">识别精度</n-text>
            <n-text size="small">{{ unitLabel(tsUnit!) }}级 · 时区 {{ formatTimezoneOffset(tsDate) }}</n-text>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">本地时间</n-text>
            <n-text code class="result-value">{{ formatLocal(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatLocal(tsDate), '本地时间已复制')">复制</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">UTC 时间</n-text>
            <n-text code class="result-value">{{ formatUtc(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatUtc(tsDate), 'UTC 时间已复制')">复制</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">ISO 8601</n-text>
            <n-text code class="result-value">{{ formatIso(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatIso(tsDate), 'ISO 8601 已复制')">复制</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">本地 ISO</n-text>
            <n-text code class="result-value">{{ formatIsoLocal(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatIsoLocal(tsDate), '本地 ISO 已复制')">复制</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">距今</n-text>
            <n-text size="small">{{ formatElapsed(tsDate) }}</n-text>
          </div>
        </div>
      </div>

      <!-- 日期时间 → 时间戳 -->
      <div class="panel">
        <n-text strong size="small">日期时间 → 时间戳</n-text>
        <n-date-picker
          v-model:value="datePickerValue"
          type="datetime"
          :status="dateError ? 'error' : undefined"
          clearable
        />
        <n-input
          v-model:value="dateInput"
          placeholder="输入日期时间：2026-08-26 15:30:00 / 2026/08/26 / 2026-08-26T15:30:00+08:00"
          :status="dateError ? 'error' : undefined"
        />
        <n-alert v-if="dateError" type="error" size="small" :show-icon="true">{{ dateError }}</n-alert>
        <div v-if="dateResult" class="result-list">
          <div class="result-row">
            <n-text depth="3" size="small">本地时间</n-text>
            <n-text code class="result-value">{{ formatLocal(dateResult) }}</n-text>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">秒级时间戳</n-text>
            <n-text code class="result-value">{{ Math.floor(dateResult.getTime() / 1000) }}</n-text>
            <n-button
              size="tiny"
              secondary
              @click="copy(String(Math.floor(dateResult.getTime() / 1000)), '秒级时间戳已复制')"
            >
              复制
            </n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">毫秒级时间戳</n-text>
            <n-text code class="result-value">{{ dateResult.getTime() }}</n-text>
            <n-button size="tiny" secondary @click="copy(String(dateResult.getTime()), '毫秒级时间戳已复制')">
              复制
            </n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ts-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  margin-bottom: 12px;
}

.panels {
  display: flex;
  gap: 12px;
  min-height: 0;
}

.panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 10px 12px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
}

.result-row > .n-text:first-child {
  flex: none;
  width: 84px;
  font-family: inherit;
}

.result-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
