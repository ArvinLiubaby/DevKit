<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
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
  LooseSyntaxError,
  minifyJson,
  sortJsonKeys,
  type FixReport,
} from "./core";
import { highlightJson } from "./highlight";
import { useThemeStore } from "../../stores/theme";
import { useJsonToolStore } from "../../stores/jsonTool";

const message = useMessage();
const { t } = useI18n();

/** 解析错误 → 当前语言提示：LooseSyntaxError 包装翻译，其余附加行列位置 */
function describeError(err: unknown): string {
  if (err instanceof LooseSyntaxError) {
    return t("json.looseError", { msg: err.message });
  }
  return describeParseError(err);
}

// 工作区状态提升到全局 store：切页返回后输入 / 输出 / 设置 / 折叠状态原样恢复
const store = useJsonToolStore();
const { input, output, error, indent, autoFormat, autoFix, lastReport, collapsedLines } =
  storeToRefs(store);
// reactive 对象直接从 store 取（保持响应式，且可直接传给 core 函数）
const fixOptions = store.fixOptions;

// 修复报告默认折叠，避免高亮提示干扰主要操作区
const reportCollapsed = ref(true);

/* 输出编辑模式：修改内容防抖同步回原始输入，输入变化再自动格式化回流 */
const editing = ref(false);
const editableOutput = ref("");
let editSyncTimer: number | undefined;

function enterEdit() {
  editableOutput.value = output.value;
  editing.value = true;
}

function exitEdit() {
  // 退出前兜底同步一次，避免防抖未触发导致最后修改丢失
  if (editableOutput.value !== input.value) input.value = editableOutput.value;
  editing.value = false;
}

function onEditOutput() {
  window.clearTimeout(editSyncTimer);
  editSyncTimer = window.setTimeout(() => {
    if (editableOutput.value !== input.value) input.value = editableOutput.value;
  }, 400);
}

const indentOptions = computed(() => [
  { label: t("json.indent2"), value: 2 },
  { label: t("json.indent4"), value: 4 },
  { label: t("json.indentTab"), value: "\t" },
]);
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

// 修复报告 → 人类可读描述列表（多语言）
const reportLines = computed(() => {
  const r = lastReport.value;
  if (!r) return [];
  const lines: string[] = [];
  if (r.looseFeatures) {
    lines.push(t("json.fixLoose"));
  }
  if (r.nonJsonValues > 0) {
    lines.push(t("json.fixNonJson", { count: r.nonJsonValues }));
  }
  if (r.octalLiterals > 0) {
    lines.push(t("json.fixOctal", { count: r.octalLiterals }));
  }
  if (r.binaryLiterals > 0) {
    lines.push(t("json.fixBinary", { count: r.binaryLiterals }));
  }
  if (r.controlChars > 0) {
    lines.push(t("json.fixControl", { count: r.controlChars }));
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
  window.clearTimeout(editSyncTimer);
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
        error.value = describeError(err);
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
    message.warning(t("json.emptyInput"));
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
      message.success(t("json.fixSuccess", { count: reportLines.value.length }));
    }
  } catch (err) {
    error.value = describeError(err);
    lastReport.value = null;
    if (notify) message.error(t("json.parseFailed"));
  }
}

async function copyOutput() {
  if (!output.value) {
    message.warning(t("json.nothingToCopy"));
    return;
  }
  await writeText(output.value);
  message.success(t("json.copied"));
}

function loadSample() {
  input.value = sampleJson;
}

// 快捷键：Ctrl+Enter 格式化 / Ctrl+Shift+Enter 压缩（单监听避免 naive-ui onKeydown 数组警告）
function onKeydown(e: KeyboardEvent) {
  if (!e.ctrlKey || e.key !== "Enter") return;
  e.preventDefault();
  if (e.shiftKey) run("minify");
  else run("format");
}

const clearAll = store.clearAll;

const inputStats = computed(() =>
  t("json.charLine", {
    chars: input.value.length,
    lines: input.value ? input.value.split("\n").length : 0,
  }),
);
const outputStats = computed(() =>
  t("json.charLine", {
    chars: output.value.length,
    lines: output.value ? output.value.split("\n").length : 0,
  }),
);
</script>

<template>
  <div class="json-tool" :class="{ dark: isDark }">
    <!-- 控制面板：操作按钮 + 设置开关，统一卡片容器分组展示 -->
    <div class="control-panel">
      <div class="control-row">
        <n-space align="center" :wrap="true" class="btn-group">
          <n-button type="primary" size="small" @click="run('format')">{{ t("json.format") }}</n-button>
          <n-button size="small" @click="run('minify')">{{ t("json.minify") }}</n-button>
          <n-button size="small" @click="run('sort')">{{ t("json.sortKeys") }}</n-button>
          <n-button size="small" @click="loadSample">{{ t("json.loadSample") }}</n-button>
          <n-button size="small" @click="clearAll">{{ t("json.clear") }}</n-button>
        </n-space>
        <div class="row-divider" aria-hidden="true"></div>
        <n-space align="center" :wrap="true" class="row-opts">
          <n-select v-model:value="indent" :options="indentOptions" size="small" class="indent-select" />
          <n-switch v-model:value="autoFormat" size="small" />
          <n-text depth="3" size="small">{{ t("json.autoFormat") }}</n-text>
        </n-space>
      </div>

      <!-- 修复开关行：总开关 + 三类修复项细分开关 -->
      <div class="control-row fix-row">
        <n-switch v-model:value="autoFix" size="small" />
        <n-text depth="3" size="small">{{ t("json.autoFix") }}</n-text>
        <n-divider vertical />
        <n-switch v-model:value="fixOptions.looseSyntax" size="small" :disabled="!autoFix" />
        <n-text depth="3" size="small">{{ t("json.looseSyntax") }}</n-text>
        <n-switch v-model:value="fixOptions.nonJsonValues" size="small" :disabled="!autoFix" />
        <n-text depth="3" size="small">{{ t("json.nonJsonValues") }}</n-text>
        <n-switch v-model:value="fixOptions.radixLiterals" size="small" :disabled="!autoFix" />
        <n-text depth="3" size="small">{{ t("json.radixLiterals") }}</n-text>
      </div>
    </div>

    <n-alert v-if="error" type="error" class="error-alert" :show-icon="true">
      {{ error }}
    </n-alert>

    <!-- 修复报告：默认折叠的弱化提示条，点击标题展开 / 收起详情 -->
    <div v-if="reportLines.length" class="fix-report">
      <button class="fix-report-head" type="button" @click="reportCollapsed = !reportCollapsed">
        <svg
          class="fix-report-chevron"
          :class="{ open: !reportCollapsed }"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M6 3.5l4.5 4.5L6 12.5l-1-1L8.5 8 5 4.5z" />
        </svg>
        <span>{{ t("json.fixReportTitle", { count: reportLines.length }) }}</span>
      </button>
      <button class="fix-report-close" type="button" :title="t('json.closeTip')" @click="lastReport = null">
        ×
      </button>
      <ul v-show="!reportCollapsed" class="report-list">
        <li v-for="line in reportLines" :key="line">{{ line }}</li>
      </ul>
    </div>

    <div class="panels">
      <div class="input-panel panel">
        <div class="panel-head">
          <span class="panel-dot in" aria-hidden="true"></span>
          <span class="panel-title">{{ t("json.inputTitle") }}</span>
        </div>
        <n-input
          v-model:value="input"
          type="textarea"
          class="panel-input"
          :placeholder="t('json.inputPlaceholder')"
          :status="error ? 'error' : undefined"
          :autosize="{ minRows: 16, maxRows: 32 }"
          :theme-overrides="{ borderRadius: '8px' }"
          @keydown="onKeydown"
        />
      </div>
      <div class="output-panel panel">
        <div class="panel-head">
          <span class="panel-dot out" aria-hidden="true"></span>
          <span class="panel-title">{{ t("json.outputTitle") }}</span>
          <n-text v-if="!editing" depth="3" size="small">{{ t("json.foldHint") }}</n-text>
          <n-text v-else depth="3" size="small">{{ t("json.editHint") }}</n-text>
          <div class="head-actions">
            <n-button
              v-if="editing"
              type="primary"
              size="tiny"
              @click="exitEdit"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" class="btn-icon" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                  />
                </svg>
              </template>
              {{ t("json.done") }}
            </n-button>
            <n-button v-else size="tiny" secondary @click="enterEdit">
              <template #icon>
                <svg viewBox="0 0 24 24" class="btn-icon" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  />
                </svg>
              </template>
              {{ t("json.edit") }}
            </n-button>
            <n-button size="tiny" secondary @click="copyOutput">
              <template #icon>
                <svg viewBox="0 0 24 24" class="btn-icon" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                  />
                </svg>
              </template>
              {{ t("json.copy") }}
            </n-button>
          </div>
        </div>
        <div v-if="editing" class="output-edit">
          <textarea
            v-model="editableOutput"
            class="output-edit-area"
            spellcheck="false"
            @input="onEditOutput"
          ></textarea>
        </div>
        <div v-else class="output-body code-view">
          <template v-if="output">
            <div v-for="line in renderLines" :key="line.index" class="code-line">
              <button
                v-if="line.foldable"
                type="button"
                class="fold-btn"
                :class="{ collapsed: line.collapsed }"
                :title="line.collapsed ? t('json.expand') : t('json.collapse')"
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
          <n-empty v-else size="small" :description="t('json.outputEmpty')" />
        </div>
      </div>
    </div>

    <div class="stats">
      <span class="stats-item">{{ t("json.inputStats", { stats: inputStats }) }}</span>
      <span class="stats-item">{{ t("json.outputStats", { stats: outputStats }) }}</span>
      <span class="stats-spacer"></span>
      <n-text depth="3" size="small">{{ t("json.shortcutHint") }}</n-text>
    </div>
  </div>
</template>

<style scoped>
.json-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 控制面板：卡片容器，内部分行（操作按钮 / 修复开关） */
.control-panel {
  margin-bottom: 10px;
  padding: 10px 12px 8px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
}

.control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.control-row + .control-row {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed rgba(128, 128, 128, 0.2);
}

.row-divider {
  width: 1px;
  height: 20px;
  background: rgba(128, 128, 128, 0.28);
}

.indent-select {
  width: 110px;
}

.error-alert {
  margin-bottom: 8px;
}

/* 修复报告：弱化提示条（默认折叠） */
.fix-report {
  position: relative;
  margin-bottom: 8px;
  padding: 5px 28px 5px 10px;
  border: 1px solid rgba(128, 128, 128, 0.22);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.06);
  font-size: 13px;
}

.fix-report-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: inherit;
  text-align: left;
  cursor: pointer;
}

.fix-report-chevron {
  flex: none;
  width: 14px;
  height: 14px;
  color: rgba(128, 128, 128, 0.8);
  transition: transform 0.15s ease;
}

.fix-report-chevron.open {
  transform: rotate(90deg);
}

.fix-report-close {
  position: absolute;
  top: 4px;
  right: 6px;
  padding: 0 4px;
  border: none;
  background: none;
  color: rgba(128, 128, 128, 0.7);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.fix-report-close:hover {
  color: inherit;
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

.panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
}

/* 面板标识圆点：输入蓝 / 输出青 */
.panel-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.panel-dot.in {
  background: #4098fc;
  box-shadow: 0 0 0 3px rgba(64, 152, 252, 0.18);
}

.panel-dot.out {
  background: #22d3ee;
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.18);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.panel-input {
  flex: 1;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
}

.output-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 8px;
  padding: 6px 0;
}

/* 输出编辑模式 */
.output-edit {
  flex: 1;
  min-height: 0;
  display: flex;
}

.output-edit-area {
  flex: 1;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
}

.output-edit-area:focus {
  border-color: #4098fc;
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
  align-items: center;
  gap: 16px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.16);
  font-size: 12.5px;
  color: rgba(128, 128, 128, 0.85);
}

.stats-spacer {
  flex: 1;
}

/* 深色模式：控制面板 / 状态栏适配 */
.json-tool.dark .control-panel {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.json-tool.dark .control-row + .control-row {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.json-tool.dark .row-divider {
  background: rgba(255, 255, 255, 0.25);
}

.json-tool.dark .stats {
  border-top-color: rgba(255, 255, 255, 0.12);
  color: rgba(200, 200, 200, 0.75);
}
</style>
