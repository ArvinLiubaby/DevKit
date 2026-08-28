<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { NAlert, NButton, NDatePicker, NInput, NText, useMessage } from "naive-ui";
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
    <!-- 当前时间戳：实时卡片（脉冲呼吸点 + 秒 / 毫秒大字展示） -->
    <section class="now-card">
      <div class="now-head">
        <span class="pulse" aria-hidden="true"></span>
        <span class="now-title">{{ t("ts.current") }}</span>
        <span class="now-local">{{ nowLocal }}</span>
      </div>
      <div class="now-values">
        <div class="now-item">
          <span class="unit-chip">{{ t("ts.seconds") }}</span>
          <code class="now-num">{{ nowSec }}</code>
          <n-button size="tiny" secondary @click="copy(String(nowSec), t('ts.copySecDone'))">
            {{ t("ts.copySec") }}
          </n-button>
        </div>
        <div class="now-divider" aria-hidden="true"></div>
        <div class="now-item">
          <span class="unit-chip ms">{{ t("ts.ms") }}</span>
          <code class="now-num">{{ nowMs }}</code>
          <n-button size="tiny" secondary @click="copy(String(nowMs), t('ts.copyMsDone'))">
            {{ t("ts.copyMs") }}
          </n-button>
        </div>
      </div>
    </section>

    <div class="panels">
      <!-- 时间戳 → 日期时间 -->
      <section class="panel-card">
        <header class="panel-head">
          <span class="panel-icon blue" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zM12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"
              />
            </svg>
          </span>
          <span class="panel-title">{{ t("ts.tsToDate") }}</span>
        </header>
        <n-input
          v-model:value="tsInput"
          :placeholder="t('ts.tsPlaceholder')"
          :status="tsError ? 'error' : undefined"
        />
        <n-alert v-if="tsError" type="error" size="small" :show-icon="true">{{ tsError }}</n-alert>
        <div v-if="tsDate" class="result-list">
          <div class="result-row plain">
            <span class="row-label">{{ t("ts.precision") }}</span>
            <span class="row-text">{{
              t("ts.precisionDetail", {
                unit: unitLabel(tsUnit!, coreLangNow),
                offset: formatTimezoneOffset(tsDate),
              })
            }}</span>
          </div>
          <div class="result-row">
            <span class="row-label">{{ t("ts.local") }}</span>
            <n-text code class="row-value">{{ formatLocal(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatLocal(tsDate), t('ts.localCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <span class="row-label">{{ t("ts.utc") }}</span>
            <n-text code class="row-value">{{ formatUtc(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatUtc(tsDate), t('ts.utcCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <span class="row-label">ISO 8601</span>
            <n-text code class="row-value">{{ formatIso(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatIso(tsDate), t('ts.isoCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row">
            <span class="row-label">{{ t("ts.localIso") }}</span>
            <n-text code class="row-value">{{ formatIsoLocal(tsDate) }}</n-text>
            <n-button size="tiny" secondary @click="copy(formatIsoLocal(tsDate), t('ts.localIsoCopied'))">{{ t("ts.copy") }}</n-button>
          </div>
          <div class="result-row plain">
            <span class="row-label">{{ t("ts.elapsed") }}</span>
            <span class="row-text">{{ formatElapsed(tsDate, new Date(), coreLangNow) }}</span>
          </div>
        </div>
      </section>

      <!-- 日期时间 → 时间戳 -->
      <section class="panel-card">
        <header class="panel-head">
          <span class="panel-icon violet" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
              />
            </svg>
          </span>
          <span class="panel-title">{{ t("ts.dateToTs") }}</span>
        </header>
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
          <div class="result-row plain">
            <span class="row-label">{{ t("ts.local") }}</span>
            <span class="row-text mono">{{ formatLocal(dateResult) }}</span>
          </div>
          <div class="result-row">
            <span class="row-label">{{ t("ts.secTs") }}</span>
            <n-text code class="row-value">{{ Math.floor(dateResult.getTime() / 1000) }}</n-text>
            <n-button
              size="tiny"
              secondary
              @click="copy(String(Math.floor(dateResult.getTime() / 1000)), t('ts.secTsCopied'))"
            >
              {{ t("ts.copy") }}
            </n-button>
          </div>
          <div class="result-row">
            <span class="row-label">{{ t("ts.msTs") }}</span>
            <n-text code class="row-value">{{ dateResult.getTime() }}</n-text>
            <n-button size="tiny" secondary @click="copy(String(dateResult.getTime()), t('ts.msTsCopied'))">
              {{ t("ts.copy") }}
            </n-button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ts-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}

/* ---------- 当前时间戳：实时卡片 ---------- */
.now-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 20px;
  padding: 14px 18px;
  border: 1px solid rgba(64, 152, 252, 0.22);
  border-radius: 12px;
  background: linear-gradient(120deg, rgba(64, 152, 252, 0.09), rgba(34, 211, 238, 0.07));
}

.now-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

/* 实时脉冲点：绿点 + 扩散圆环动画 */
.pulse {
  position: relative;
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #22c55e;
}

.pulse::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(34, 197, 94, 0.45);
  animation: pulse-ring 1.8s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.5);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.now-title {
  font-size: 14px;
  font-weight: 600;
}

.now-local {
  font-size: 12.5px;
  color: rgba(128, 128, 128, 0.95);
  font-variant-numeric: tabular-nums;
}

.now-values {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.now-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.now-divider {
  width: 1px;
  height: 26px;
  background: rgba(128, 128, 128, 0.25);
}

.unit-chip {
  flex: none;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  background: rgba(64, 152, 252, 0.13);
  color: #1a6fd4;
}

.unit-chip.ms {
  background: rgba(34, 211, 238, 0.14);
  color: #0e7490;
}

.now-num {
  font-family: Consolas, "Courier New", monospace;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
}

/* ---------- 双面板卡片 ---------- */
.panels {
  display: flex;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.panel-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
  overflow-y: auto;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.panel-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: #fff;
}

.panel-icon svg {
  width: 17px;
  height: 17px;
}

.panel-icon.blue {
  background: linear-gradient(135deg, #4098fc, #22d3ee);
  box-shadow: 0 2px 8px rgba(64, 152, 252, 0.35);
}

.panel-icon.violet {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

/* ---------- 结果列表 ---------- */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(128, 128, 128, 0.14);
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.035);
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  transition: background-color 0.15s ease;
}

.result-row:hover {
  background: rgba(64, 152, 252, 0.07);
}

.row-label {
  flex: none;
  width: 92px;
  padding: 2px 0;
  border-radius: 6px;
  text-align: center;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 11.5px;
  font-weight: 500;
  background: rgba(128, 128, 128, 0.12);
  color: rgba(100, 100, 100, 1);
}

.row-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.row-text {
  flex: 1;
  min-width: 0;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 12.5px;
  color: rgba(110, 110, 110, 1);
  overflow-wrap: anywhere;
}

.row-text.mono {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
}

/* ---------- 深色模式 ---------- */
.ts-tool.dark .now-card {
  border-color: rgba(64, 152, 252, 0.28);
  background: linear-gradient(120deg, rgba(64, 152, 252, 0.12), rgba(34, 211, 238, 0.08));
}

.ts-tool.dark .now-local {
  color: rgba(200, 200, 200, 0.75);
}

.ts-tool.dark .unit-chip {
  background: rgba(64, 152, 252, 0.22);
  color: #7cb8ff;
}

.ts-tool.dark .unit-chip.ms {
  background: rgba(34, 211, 238, 0.2);
  color: #67e8f9;
}

.ts-tool.dark .now-divider {
  background: rgba(255, 255, 255, 0.14);
}

.ts-tool.dark .panel-card {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.ts-tool.dark .result-list {
  border-color: rgba(255, 255, 255, 0.09);
  background: rgba(0, 0, 0, 0.16);
}

.ts-tool.dark .result-row:hover {
  background: rgba(64, 152, 252, 0.12);
}

.ts-tool.dark .row-label {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(210, 214, 220, 0.9);
}

.ts-tool.dark .row-text {
  color: rgba(200, 204, 210, 0.8);
}
</style>
