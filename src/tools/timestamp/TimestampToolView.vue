<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
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
import { coreLang, i18n } from "../../i18n";

const message = useMessage();
const { t } = useI18n();

// core 层通用语言标记（formatElapsed / unitLabel 参数），随全局语言切换
const coreLangNow = computed(() => coreLang(i18n.global.locale.value));

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
  if (!tsUnit.value) return t("ts.tsInvalid");
  if (!tsDate.value) return t("ts.tsOutOfRange");
  return "";
});

/* ------------------------------------------------------------------ */
/* 日期 → 时间戳                                                       */
/* ------------------------------------------------------------------ */
const dateResult = computed(() => parseDateString(dateInput.value));
const dateError = computed(() => {
  if (!dateInput.value.trim()) return "";
  return dateResult.value ? "" : t("ts.dateInvalid");
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
      <n-text strong>{{ t("ts.current") }}</n-text>
      <n-text code>{{ nowSec }}</n-text>
      <n-text depth="3" size="small">{{ t("ts.seconds") }}</n-text>
      <n-text code>{{ nowMs }}</n-text>
      <n-text depth="3" size="small">{{ t("ts.ms") }}</n-text>
      <n-text depth="3">{{ nowLocal }}</n-text>
      <n-button size="tiny" secondary @click="copy(String(nowSec), t('ts.copySecDone'))">{{ t("ts.copySec") }}</n-button>
      <n-button size="tiny" secondary @click="copy(String(nowMs), t('ts.copyMsDone'))">{{ t("ts.copyMs") }}</n-button>
    </n-space>

    <div class="panels">
      <!-- 时间戳 → 日期时间 -->
      <div class="panel">
        <n-text strong size="small">{{ t("ts.tsToDate") }}</n-text>
        <n-input
          v-model:value="tsInput"
          :placeholder="t('ts.tsPlaceholder')"
          :status="tsError ? 'error' : undefined"
        />
        <n-alert v-if="tsError" type="error" size="small" :show-icon="true">{{ tsError }}</n-alert>
        <div v-if="tsDate" class="result-list">
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.precision") }}</n-text>
            <n-text size="small">{{
              t("ts.precisionDetail", {
                unit: unitLabel(tsUnit!, coreLangNow),
                offset: formatTimezoneOffset(tsDate),
              })
            }}</n-text>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.local") }}</n-text>
            <n-text code class="result-value">{{ formatLocal(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatLocal(tsDate), t('ts.localCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.utc") }}</n-text>
            <n-text code class="result-value">{{ formatUtc(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatUtc(tsDate), t('ts.utcCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">ISO 8601</n-text>
            <n-text code class="result-value">{{ formatIso(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatIso(tsDate), t('ts.isoCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.localIso") }}</n-text>
            <n-text code class="result-value">{{ formatIsoLocal(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatIsoLocal(tsDate), t('ts.localIsoCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.elapsed") }}</n-text>
            <n-text size="small">{{ formatElapsed(tsDate, new Date(), coreLangNow) }}</n-text>
          </div>
        </div>
      </div>

      <!-- 日期时间 → 时间戳 -->
      <div class="panel">
        <n-text strong size="small">{{ t("ts.dateToTs") }}</n-text>
        <n-date-picker
          v-model:value="datePickerValue"
          type="datetime"
          :status="dateError ? 'error' : undefined"
          clearable
        />
        <n-input
          v-model:value="dateInput"
          :placeholder="t('ts.datePlaceholder')"
          :status="dateError ? 'error' : undefined"
        />
        <n-alert v-if="dateError" type="error" size="small" :show-icon="true">{{ dateError }}</n-alert>
        <div v-if="dateResult" class="result-list">
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.local") }}</n-text>
            <n-text code class="result-value">{{ formatLocal(dateResult) }}</n-text>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.secTs") }}</n-text>
            <n-text code class="result-value">{{ Math.floor(dateResult.getTime() / 1000) }}</n-text>
            <n-button
              size="tiny"
              secondary
              @click="copy(String(Math.floor(dateResult.getTime() / 1000)), t('ts.secTsCopied'))"
            >
              {{ t("ts.copy") }}
            </n-button>
          </div>
          <div class="result-row">
            <n-text depth="3" size="small">{{ t("ts.msTs") }}</n-text>
            <n-text code class="result-value">{{ dateResult.getTime() }}</n-text>
            <n-button size="tiny" secondary @click="copy(String(dateResult.getTime()), t('ts.msTsCopied'))">
              {{ t("ts.copy") }}
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
