<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  NAlert,
  NButton,
  NDivider,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSwitch,
  NText,
  useMessage,
} from "naive-ui";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  buildFoldRanges,
  describeParseError,
  formatJson,
  minifyJson,
  sortJsonKeys,
  type FixReport,
} from "./core";
import { highlightJson } from "./highlight";
import { useThemeStore } from "../../stores/theme";
import { useJsonToolStore } from "../../stores/jsonTool";

const message = useMessage();

// 工作区状态提升到全局 store：切页返回后输入 / 输出 / 设置 / 折叠状态原样恢复
const store = useJsonToolStore();
const { input, output, error, indent, autoFormat, autoFix, lastReport, collapsedLines } =
  storeToRefs(store);
// reactive 对象直接从 store 取（保持响应式，且可直接传给 core 函数）
const fixOptions = store.fixOptions;

const indentOptions = [
  { label: "2 空格", value: 2 },
  { label: "4 空格", value: 4 },
  { label: "Tab", value: "\t" },
];
// 示例刻意使用多种非标准写法，用于演示自动修复能力
const sampleJson = `{
  // 工具信息（行注释）
  name: 'DevKit',
  version: "0.1.0",
  features: ['json', 'base64', 0x10, 0o17, 0b1010],
  config: {
    theme: 'dark',
    offline: true,
    ratio: Infinity,
  },
  desc: '本地优先
离线可用',
  /* 块注释：以上均为可自动修复的非标准写法 */
}`;

// 修复报告 → 人类可读描述列表
const reportLines = computed(() => {
  const r = lastReport.value;
  if (!r) return [];
  const lines: string[] = [];
  if (r.looseFeatures) {
    lines.push("JSON5 宽容语法：单引号 / 注释 / 尾随逗号 / 裸键 / 十六进制 / 多行字符串");
  }
  if (r.nonJsonValues > 0) {
    lines.push(`非 JSON 值 ${r.nonJsonValues} 处（undefined / NaN / Infinity）→ null`);
  }
  if (r.octalLiterals > 0) {
    lines.push(`八进制字面量 ${r.octalLiterals} 处（0o…）→ 十进制`);
  }
  if (r.binaryLiterals > 0) {
    lines.push(`二进制字面量 ${r.binaryLiterals} 处（0b…）→ 十进制`);
  }
  if (r.controlChars > 0) {
    lines.push(`字符串内未转义控制字符 ${r.controlChars} 处（换行/Tab 等）→ 转义序列`);
  }
  return lines;
});

/* ------------------------------------------------------------------ */
/* 代码折叠：输出按行渲染（保留语法高亮），对象/数组块可折叠/展开       */
/* ------------------------------------------------------------------ */
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

const lines = computed(() => (output.value ? output.value.split("\n") : []));
// 逐行高亮并缓存：折叠状态切换不触发重新高亮
const lineHtmls = computed(() => lines.value.map((line) => highlightJson(line)));
// 折叠起点行 → 结束行（0-based），由输出行结构括号匹配得到
const foldRanges = computed(() => buildFoldRanges(lines.value));
// 已折叠的起点行集合（状态在 store，切页返回后折叠结构不变）

interface RenderLine {
  index: number;
  html: string;
  foldable: boolean;
  collapsed: boolean;
}

// 按折叠状态过滤后的渲染行列表
const renderLines = computed<RenderLine[]>(() => {
  const ranges = foldRanges.value;
  const collapsed = collapsedLines.value;
  const result: RenderLine[] = [];
  let i = 0;
  const n = lines.value.length;
  while (i < n) {
    const end = ranges.get(i);
    const isCollapsed = end !== undefined && collapsed.has(i);
    result.push({
      index: i,
      html: lineHtmls.value[i],
      foldable: end !== undefined,
      collapsed: isCollapsed,
    });
    i = isCollapsed ? end! + 1 : i + 1;
  }
  return result;
});

// 输出变化时重置折叠状态（默认全部展开）
watch(output, () => {
  collapsedLines.value = new Set();
});

function toggleFold(lineIndex: number) {
  if (!foldRanges.value.has(lineIndex)) return;
  const next = new Set(collapsedLines.value);
  if (next.has(lineIndex)) next.delete(lineIndex);
  else next.add(lineIndex);
  collapsedLines.value = next;
}

/* ------------------------------------------------------------------ */

// 输入变化时防抖自动格式化，实现"输入即所得"
let debounceTimer: number | undefined;
// 组件卸载时清理未触发的防抖任务，避免切页后仍在后台格式化
onUnmounted(() => {
  window.clearTimeout(debounceTimer);
});
watch(input, () => {
  if (!autoFormat.value) return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (input.value.trim()) {
      try {
        const { text, report } = formatJson(input.value, indent.value, autoFix.value, fixOptions);
        output.value = text;
        error.value = "";
        lastReport.value = report;
      } catch (err) {
        error.value = describeParseError(err);
        lastReport.value = null;
      }
    } else {
      output.value = "";
      error.value = "";
      lastReport.value = null;
    }
  }, 300);
});

// 缩进 / 修复开关变化时重新格式化（静默，不弹提示）
watch(indent, () => {
  if (input.value.trim() && autoFormat.value) run("format", false);
});
watch(autoFix, () => {
  if (!autoFix.value) lastReport.value = null;
  if (input.value.trim() && autoFormat.value) run("format", false);
});
watch(
  fixOptions,
  () => {
    if (input.value.trim() && autoFormat.value) run("format", false);
  },
  { deep: true },
);

function run(action: "format" | "minify" | "sort", notify = true) {
  const raw = input.value.trim();
  if (!raw) {
    message.warning("请先输入 JSON 内容");
    return;
  }
  try {
    let text: string;
    let report: FixReport | null = null;
    if (action === "format") {
      const result = formatJson(raw, indent.value, autoFix.value, fixOptions);
      text = result.text;
      report = result.report;
    } else if (action === "minify") {
      const result = minifyJson(raw, autoFix.value, fixOptions);
      text = result.text;
      report = result.report;
    } else {
      const result = sortJsonKeys(raw, indent.value, autoFix.value, fixOptions);
      text = result.text;
      report = result.report;
    }
    output.value = text;
    error.value = "";
    lastReport.value = report;
    // 修复完成后给出明确提示
    if (notify && report) {
      message.success(`已自动修复 ${reportLines.value.length} 类非标准写法，详见修复提示`);
    }
  } catch (err) {
    error.value = describeParseError(err);
    lastReport.value = null;
    if (notify) message.error("解析失败，详见错误提示");
  }
}

async function copyOutput() {
  if (!output.value) {
    message.warning("暂无可复制的内容");
    return;
  }
  await writeText(output.value);
  message.success("结果已复制到剪贴板");
}

function loadSample() {
  input.value = sampleJson;
}

const clearAll = store.clearAll;

const inputStats = computed(
  () => `${input.value.length} 字符 · ${input.value ? input.value.split("\n").length : 0} 行`,
);
const outputStats = computed(
  () => `${output.value.length} 字符 · ${output.value ? output.value.split("\n").length : 0} 行`,
);
</script>

<template>
  <div class="json-tool" :class="{ dark: isDark }">
    <n-space class="toolbar" align="center" :wrap="true">
      <n-button type="primary" size="small" @click="run('format')">格式化</n-button>
      <n-button size="small" @click="run('minify')">压缩</n-button>
      <n-button size="small" @click="run('sort')">键排序</n-button>
      <n-button size="small" @click="loadSample">载入示例</n-button>
      <n-button size="small" @click="clearAll">清空</n-button>
      <n-select v-model:value="indent" :options="indentOptions" size="small" class="indent-select" />
      <n-switch v-model:value="autoFormat" size="small" />
      <n-text depth="3" size="small">自动格式化</n-text>
    </n-space>

    <!-- 修复开关行：总开关 + 三类修复项细分开关 -->
    <n-space class="fix-bar" align="center" :wrap="true">
      <n-switch v-model:value="autoFix" size="small" />
      <n-text depth="3" size="small">自动修复非标准写法</n-text>
      <n-divider vertical />
      <n-switch v-model:value="fixOptions.looseSyntax" size="small" :disabled="!autoFix" />
      <n-text depth="3" size="small">JSON5 宽容语法</n-text>
      <n-switch v-model:value="fixOptions.nonJsonValues" size="small" :disabled="!autoFix" />
      <n-text depth="3" size="small">undefined / NaN / Infinity</n-text>
      <n-switch v-model:value="fixOptions.radixLiterals" size="small" :disabled="!autoFix" />
      <n-text depth="3" size="small">八 / 二进制字面量</n-text>
    </n-space>

    <n-alert v-if="error" type="error" class="error-alert" :show-icon="true">
      {{ error }}
    </n-alert>

    <!-- 修复报告：展示本次自动修复了哪些非标准写法 -->
    <n-alert
      v-if="reportLines.length"
      type="info"
      class="error-alert"
      :show-icon="true"
      closable
      @close="lastReport = null"
    >
      <template #header>已自动修复非标准写法</template>
      <ul class="report-list">
        <li v-for="line in reportLines" :key="line">{{ line }}</li>
      </ul>
    </n-alert>

    <div class="panels">
      <n-input
        v-model:value="input"
        type="textarea"
        class="panel-input"
        placeholder="粘贴或输入 JSON 内容…（支持单引号 / 注释 / 尾随逗号 / 裸键等非标准写法；Ctrl+Enter 格式化，Ctrl+Shift+Enter 压缩）"
        :status="error ? 'error' : undefined"
        :autosize="{ minRows: 16, maxRows: 32 }"
        @keydown.ctrl.enter.prevent="run('format')"
        @keydown.ctrl.shift.enter.prevent="run('minify')"
      />
      <div class="output-panel">
        <div class="output-head">
          <n-text depth="3" size="small">点击行首箭头折叠 / 展开代码块</n-text>
          <n-button size="tiny" secondary @click="copyOutput">复制结果</n-button>
        </div>
        <div class="output-body code-view">
          <template v-if="output">
            <div v-for="line in renderLines" :key="line.index" class="code-line">
              <button
                v-if="line.foldable"
                type="button"
                class="fold-btn"
                :class="{ collapsed: line.collapsed }"
                :title="line.collapsed ? '展开' : '折叠'"
                @click="toggleFold(line.index)"
              >
                <svg class="fold-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
              <span v-else class="fold-btn-placeholder"></span>
              <span class="line-text" v-html="line.html"></span>
              <span v-if="line.collapsed" class="fold-ellipsis">…</span>
            </div>
          </template>
          <n-empty v-else size="small" description="暂无结果，请先格式化" />
        </div>
      </div>
    </div>

    <div class="stats">
      <n-text depth="3" size="small">输入：{{ inputStats }}</n-text>
      <n-text depth="3" size="small">输出：{{ outputStats }}</n-text>
    </div>
  </div>
</template>

<style scoped>
.json-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  margin-bottom: 8px;
}

.fix-bar {
  margin-bottom: 8px;
}

.indent-select {
  width: 110px;
}

.error-alert {
  margin-bottom: 8px;
}

.report-list {
  margin: 4px 0 0;
  padding-left: 18px;
}

.panels {
  display: flex;
  gap: 12px;
  min-height: 0;
}

.panel-input {
  flex: 1;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
}

.output-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.output-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.output-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 6px 0;
}

/* 代码折叠行 */
.code-line {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
}

.code-line:hover {
  background: rgba(128, 128, 128, 0.08);
}

.fold-btn {
  flex: none;
  width: 22px;
  height: 22px;
  margin: 0 2px 0 0;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(128, 128, 128, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s;
}

.fold-btn:hover {
  background: rgba(64, 152, 252, 0.16);
  color: #4098fc;
}

.fold-icon {
  width: 15px;
  height: 15px;
  flex: none;
  transition: transform 0.15s;
  /* 展开状态（可折叠）：箭头朝下 */
  transform: rotate(90deg);
}

/* 折叠状态：箭头朝右（可展开） */
.fold-btn.collapsed .fold-icon {
  transform: rotate(0deg);
}

.json-tool.dark .fold-btn {
  color: rgba(210, 210, 210, 0.85);
}

.fold-btn-placeholder {
  flex: none;
  width: 24px;
}

.line-text {
  white-space: pre;
}

.fold-ellipsis {
  color: rgba(128, 128, 128, 0.8);
}

/* JSON 高亮配色（v-html 注入元素，需 :deep；明暗两套） */
:deep(.j-key) {
  color: #0b7285;
}
:deep(.j-string) {
  color: #2e7d32;
}
:deep(.j-number) {
  color: #e65100;
}
:deep(.j-keyword) {
  color: #9c27b0;
}
.json-tool.dark :deep(.j-key) {
  color: #4fc1ff;
}
.json-tool.dark :deep(.j-string) {
  color: #7ee787;
}
.json-tool.dark :deep(.j-number) {
  color: #ffab70;
}
.json-tool.dark :deep(.j-keyword) {
  color: #d2a8ff;
}

.stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
</style>
