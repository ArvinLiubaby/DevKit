<script setup lang="ts">
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import {
  NAlert,
  NButton,
  NInput,
  NRadioButton,
  NRadioGroup,
  useMessage,
} from "naive-ui";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { detectRadix, parseRadix, RADIXES, toRadix, type Radix } from "./core";
import { useThemeStore } from "../../stores/theme";
import { useBinaryToolStore } from "../../stores/binaryTool";

const message = useMessage();
const { t } = useI18n();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

// 工作区状态提升到全局 store：切页返回后输入原样恢复
const store = useBinaryToolStore();
const { input, radix } = storeToRefs(store);

// 输入带 0b / 0o / 0x 前缀时自动切换源进制（前缀本身由 core 解析剥离）
watch(input, (v) => {
  const detected = detectRadix(v);
  if (detected != null && detected !== radix.value) radix.value = detected;
});

const value = computed(() => parseRadix(input.value, radix.value));
const error = computed(() => {
  if (!input.value.trim()) return "";
  return value.value === null ? t("bin.invalid") : "";
});

// 四个进制的转换结果行（源进制也包括在内，方便对照）
const results = computed(() => {
  if (value.value === null) return [] as { radix: Radix; text: string }[];
  return RADIXES.map((r) => ({ radix: r, text: toRadix(value.value!, r) }));
});

async function copy(text: string, r: Radix) {
  if (!text) return;
  await writeText(text);
  message.success(t("bin.copied", { radix: t(`bin.radix${r}`) }));
}
</script>

<template>
  <div class="bin-tool" :class="{ dark: isDark }">
    <!-- 输入卡片：源进制选择 + 数值输入 -->
    <section class="bin-card">
      <div class="source-row">
        <span class="source-label">{{ t("bin.sourceRadix") }}</span>
        <n-radio-group v-model:value="radix" size="small">
          <n-radio-button v-for="r in RADIXES" :key="r" :value="r">
            {{ t(`bin.radix${r}`) }}
          </n-radio-button>
        </n-radio-group>
      </div>
      <n-input
        v-model:value="input"
        class="bin-input"
        :placeholder="t('bin.placeholder')"
        :status="error ? 'error' : undefined"
      />
      <n-alert v-if="error" type="error" size="small" :show-icon="true">{{ error }}</n-alert>
      <n-alert v-else-if="!input.trim()" type="info" size="small" :show-icon="true">
        {{ t("bin.tip") }}
      </n-alert>
    </section>

    <!-- 结果列表：每个进制一行，彩色徽标区分，源进制行高亮 -->
    <section v-if="results.length" class="result-list">
      <div
        v-for="r in results"
        :key="r.radix"
        class="result-row"
        :class="{ source: r.radix === radix }"
      >
        <span class="radix-chip" :class="'chip-' + r.radix">{{ t(`bin.radix${r.radix}`) }}</span>
        <code class="result-value">{{ r.text }}</code>
        <n-button size="tiny" secondary @click="copy(r.text, r.radix)">{{ t("bin.copy") }}</n-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bin-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  max-width: 880px;
}

/* ---------- 输入卡片 ---------- */
.bin-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
}

.source-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-label {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(90, 90, 90, 1);
}

/* 输入框等宽字体，贴合进制数字的阅读习惯 */
.bin-input {
  font-family: Consolas, "Courier New", monospace;
}

.bin-input :deep(input) {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* ---------- 结果列表 ---------- */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid rgba(128, 128, 128, 0.14);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.03);
  animation: list-in 0.25s ease;
}

@keyframes list-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  transition: background-color 0.15s ease;
}

.result-row:hover {
  background: rgba(64, 152, 252, 0.07);
}

/* 源进制行：品牌蓝淡底描边，提示这是输入对照行 */
.result-row.source {
  background: rgba(64, 152, 252, 0.09);
  box-shadow: inset 0 0 0 1px rgba(64, 152, 252, 0.28);
}

/* 进制徽标：二 / 八 / 十 / 十六各自色系 */
.radix-chip {
  flex: none;
  width: 64px;
  padding: 2px 0;
  border-radius: 6px;
  text-align: center;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 11.5px;
  font-weight: 600;
}

.chip-2 {
  background: rgba(64, 152, 252, 0.13);
  color: #1a6fd4;
}

.chip-8 {
  background: rgba(20, 184, 166, 0.13);
  color: #0f766e;
}

.chip-10 {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.chip-16 {
  background: rgba(168, 85, 247, 0.13);
  color: #7e22ce;
}

.result-value {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 13.5px;
  overflow-wrap: anywhere;
}

/* ---------- 深色模式 ---------- */
.bin-tool.dark .bin-card {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.bin-tool.dark .source-label {
  color: rgba(210, 214, 220, 0.92);
}

.bin-tool.dark .result-list {
  border-color: rgba(255, 255, 255, 0.09);
  background: rgba(0, 0, 0, 0.16);
}

.bin-tool.dark .result-row:hover {
  background: rgba(64, 152, 252, 0.12);
}

.bin-tool.dark .result-row.source {
  background: rgba(64, 152, 252, 0.14);
  box-shadow: inset 0 0 0 1px rgba(64, 152, 252, 0.4);
}

.bin-tool.dark .chip-2 {
  background: rgba(64, 152, 252, 0.2);
  color: #7cb8ff;
}

.bin-tool.dark .chip-8 {
  background: rgba(45, 212, 191, 0.16);
  color: #5eead4;
}

.bin-tool.dark .chip-10 {
  background: rgba(129, 140, 248, 0.18);
  color: #a5b4fc;
}

.bin-tool.dark .chip-16 {
  background: rgba(192, 132, 252, 0.16);
  color: #d8b4fe;
}
</style>
