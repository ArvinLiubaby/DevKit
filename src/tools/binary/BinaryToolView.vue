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
  NText,
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
    <div class="source-row">
      <n-text strong size="small">{{ t("bin.sourceRadix") }}</n-text>
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

    <div v-if="results.length" class="result-list">
      <div v-for="r in results" :key="r.radix" class="result-row">
        <n-text depth="3" size="small" class="result-label">{{ t(`bin.radix${r.radix}`) }}</n-text>
        <n-text code class="result-value">{{ r.text }}</n-text>
        <n-button size="tiny" secondary @click="copy(r.text, r.radix)">{{ t("bin.copy") }}</n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bin-tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 输入框等宽字体，贴合进制数字的阅读习惯 */
.bin-input {
  font-family: Consolas, "Courier New", monospace;
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

.result-label {
  flex: none;
  width: 56px;
  font-family: inherit;
}

.result-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
