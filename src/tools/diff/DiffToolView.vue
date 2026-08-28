<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { NButton, NEmpty, NInput, NSpace, NText } from "naive-ui";
import { diffText, escapeHtml, type DiffResult, type Range } from "./core";
import { useThemeStore } from "../../stores/theme";
import { useDiffToolStore } from "../../stores/diffTool";

const { t } = useI18n();

// 工作区状态提升到全局 store：切页返回后输入原样恢复
const store = useDiffToolStore();
const { leftText, rightText } = storeToRefs(store);
const clearAll = store.clearAll;

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

// 示例文本：覆盖修改（change）/ 新增（add）/ 删除（del）三种差异
const sampleLeft = `const greeting = 'Hello';
function add(a, b) {
  return a + b;
}
// legacy fallback
console.log(greeting);`;

const sampleRight = `const greeting = 'Hello, DevKit!';
function add(a, b) {
  return a + b;
}
function sub(a, b) {
  return a - b;
}
console.log(greeting);`;

/* ------------------------------------------------------------------ */
/* 对比：输入防抖 300ms 后重算                                         */
/* ------------------------------------------------------------------ */
const diffResult = ref<DiffResult | null>(null);
let debounceTimer: number | undefined;

watch(
  [leftText, rightText],
  () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      diffResult.value = diffText(leftText.value, rightText.value);
    }, 300);
  },
  { immediate: true },
);

onUnmounted(() => {
  window.clearTimeout(debounceTimer);
});

const stats = computed(() => {
  const r = diffResult.value;
  if (!r) return null;
  return { add: r.addCount, del: r.delCount, change: r.changeCount, total: r.lines.length };
});

const hasInput = computed(() => leftText.value.trim() !== "" || rightText.value.trim() !== "");
const identical = computed(
  () =>
    hasInput.value &&
    !!diffResult.value &&
    diffResult.value.addCount === 0 &&
    diffResult.value.delCount === 0 &&
    diffResult.value.changeCount === 0,
);

function swap() {
  const l = leftText.value;
  leftText.value = rightText.value;
  rightText.value = l;
}

function loadSample() {
  leftText.value = sampleLeft;
  rightText.value = sampleRight;
}

/** 行内容渲染：转义 + 词级高亮区间包 <mark> */
function renderLine(text: string, highlights: Range[] | null): string {
  if (!highlights || highlights.length === 0) return escapeHtml(text);
  let html = "";
  let pos = 0;
  for (const r of highlights) {
    html += escapeHtml(text.slice(pos, r.start));
    html += `<mark>${escapeHtml(text.slice(r.start, r.end))}</mark>`;
    pos = r.end;
  }
  html += escapeHtml(text.slice(pos));
  return html;
}
</script>

<template>
  <div class="diff-tool" :class="{ dark: isDark }">
    <n-space class="toolbar" align="center" :wrap="true">
      <n-button size="small" @click="swap">{{ t("diff.swap") }}</n-button>
      <n-button size="small" @click="loadSample">{{ t("diff.loadSample") }}</n-button>
      <n-button size="small" @click="clearAll">{{ t("diff.clear") }}</n-button>
      <!-- 差异统计徽章：新增绿 / 删除红 / 修改黄 -->
      <div v-if="stats" class="stat-chips" :title="t('diff.stats', { add: stats.add, del: stats.del, change: stats.change })">
        <span class="stat-chip add">+{{ stats.add }} {{ t("diff.statAdd") }}</span>
        <span class="stat-chip del">−{{ stats.del }} {{ t("diff.statDel") }}</span>
        <span class="stat-chip change">~{{ stats.change }} {{ t("diff.statChange") }}</span>
      </div>
    </n-space>

    <div class="inputs">
      <div class="input-col">
        <div class="input-head">
          <span class="col-dot old" aria-hidden="true"></span>
          <span class="col-label">{{ t("diff.leftLabel") }}</span>
        </div>
        <n-input
          v-model:value="leftText"
          type="textarea"
          class="mono"
          :placeholder="t('diff.leftPlaceholder')"
          :autosize="{ minRows: 8, maxRows: 16 }"
        />
      </div>
      <div class="input-col">
        <div class="input-head">
          <span class="col-dot new" aria-hidden="true"></span>
          <span class="col-label">{{ t("diff.rightLabel") }}</span>
        </div>
        <n-input
          v-model:value="rightText"
          type="textarea"
          class="mono"
          :placeholder="t('diff.rightPlaceholder')"
          :autosize="{ minRows: 8, maxRows: 16 }"
        />
      </div>
    </div>

    <!-- 对比结果：列头与双列同宽对齐（同为 flex:1 + gap:12px） -->
    <template v-if="diffResult && diffResult.lines.length && !identical">
      <div class="diff-heads">
        <div class="diff-head">
          <span class="col-dot old" aria-hidden="true"></span>
          <span>{{ t("diff.leftLabel") }}</span>
        </div>
        <div class="diff-head">
          <span class="col-dot new" aria-hidden="true"></span>
          <span>{{ t("diff.rightLabel") }}</span>
        </div>
      </div>
      <!-- 双列渲染全部行（缺失侧留空占位），保证行高对齐 -->
      <div class="diff-view">
        <div class="diff-col left-col">
          <div
            v-for="(line, idx) in diffResult.lines"
            :key="'l' + idx"
            class="d-line"
            :class="'d-' + line.type"
          >
            <span class="ln">{{ line.oldIndex !== null ? line.oldIndex + 1 : "" }}</span>
            <span class="marker">{{ line.type === 'del' || line.type === 'change' ? '-' : '' }}</span>
            <span class="text" v-html="renderLine(line.oldText, line.oldHighlights)"></span>
          </div>
        </div>
        <div class="diff-col right-col">
          <div
            v-for="(line, idx) in diffResult.lines"
            :key="'r' + idx"
            class="d-line"
            :class="'d-' + line.type"
          >
            <span class="ln">{{ line.newIndex !== null ? line.newIndex + 1 : "" }}</span>
            <span class="marker">{{ line.type === 'add' || line.type === 'change' ? '+' : '' }}</span>
            <span class="text" v-html="renderLine(line.newText, line.newHighlights)"></span>
          </div>
        </div>
      </div>
    </template>
    <!-- 完全一致：醒目绿色卡片提示 -->
    <div v-else-if="identical" class="identical-card">
      <div class="check-badge">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </div>
      <div class="identical-text">
        <n-text strong class="identical-title">{{ t("diff.identicalTitle") }}</n-text>
        <n-text depth="3" size="small">{{ t("diff.identicalSub", { total: stats?.total ?? 0 }) }}</n-text>
      </div>
    </div>
    <n-empty
      v-else-if="diffResult"
      size="small"
      :description="t('diff.emptyHint')"
    />
  </div>
</template>

<style scoped>
.diff-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  margin-bottom: 10px;
}

/* ---------- 差异统计徽章 ---------- */
.stat-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
}

.stat-chip {
  padding: 2px 9px;
  border-radius: 999px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  font-weight: 600;
  animation: chip-in 0.2s ease;
}

.stat-chip.add {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.stat-chip.del {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.stat-chip.change {
  background: rgba(240, 180, 41, 0.16);
  color: #a16207;
}

@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------- 输入区 ---------- */
.inputs {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.input-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-head {
  display: flex;
  align-items: center;
  gap: 7px;
}

/* 列标识圆点：左列（原始）红 / 右列（修改后）绿，与差异配色呼应 */
.col-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.col-dot.old {
  background: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.18);
}

.col-dot.new {
  background: #4ade80;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.18);
}

.col-label {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(90, 90, 90, 1);
}

.mono :deep(textarea) {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
}

/* ---------- 对比结果列头：与双列同布局保证对齐 ---------- */
.diff-heads {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
}

.diff-head {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.05);
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(90, 90, 90, 1);
}

/* 对比结果：双列并排，行高必须固定以保证左右对齐 */
.diff-view {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  overflow: auto;
}

.diff-col {
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(128, 128, 128, 0.22);
  border-radius: 10px;
  overflow: hidden;
}

.d-line {
  display: flex;
  align-items: stretch;
  height: 22px;
  line-height: 22px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  white-space: pre;
}

.d-line .text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 8px;
}

.d-line:hover {
  background: rgba(128, 128, 128, 0.08);
}

.ln {
  flex: none;
  width: 40px;
  padding-left: 6px;
  color: rgba(128, 128, 128, 0.8);
  user-select: none;
  border-right: 1px solid rgba(128, 128, 128, 0.15);
}

.marker {
  flex: none;
  width: 20px;
  text-align: center;
  user-select: none;
}

/* 差异配色：删除红 / 新增绿 / 修改黄 */
.d-del {
  background: rgba(248, 81, 73, 0.14);
  color: #d6453d;
}

.d-add {
  background: rgba(64, 200, 100, 0.16);
  color: #2c9a55;
}

.d-change {
  background: rgba(240, 180, 41, 0.16);
}

/* 词级高亮（v-html 注入的 mark 需 :deep）：左列红色标记被替换片段，右列绿色标记新增片段 */
.left-col :deep(mark) {
  background: rgba(248, 81, 73, 0.35);
  border-radius: 2px;
}

.right-col :deep(mark) {
  background: rgba(64, 200, 100, 0.35);
  border-radius: 2px;
}

/* 完全一致提示卡片：绿色主题 + 对勾徽标 + 弹入动画 */
.identical-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 36px;
  border: 1px dashed rgba(64, 200, 100, 0.55);
  border-radius: 12px;
  background: rgba(64, 200, 100, 0.07);
  animation: pop-in 0.25s ease;
}

.check-badge {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4ade80, #22c55e);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.45);
}

.check-badge svg {
  width: 30px;
  height: 30px;
}

.identical-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.identical-title {
  font-size: 16px;
  font-weight: 700;
  color: #2c9a55;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ---------- 深色模式 ---------- */
.diff-tool.dark .col-label,
.diff-tool.dark .diff-head {
  color: rgba(210, 214, 220, 0.9);
}

.diff-tool.dark .diff-head {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.diff-tool.dark .diff-col {
  border-color: rgba(255, 255, 255, 0.12);
}

.diff-tool.dark .stat-chip.add {
  background: rgba(74, 222, 128, 0.16);
  color: #7be0a0;
}

.diff-tool.dark .stat-chip.del {
  background: rgba(248, 113, 113, 0.16);
  color: #ff8a85;
}

.diff-tool.dark .stat-chip.change {
  background: rgba(240, 180, 41, 0.16);
  color: #facc15;
}

.diff-tool.dark .identical-card {
  border-color: rgba(74, 222, 128, 0.5);
  background: rgba(74, 222, 128, 0.1);
}

.diff-tool.dark .identical-title {
  color: #7be0a0;
}

.diff-tool.dark .check-badge {
  box-shadow: 0 4px 14px rgba(74, 222, 128, 0.35);
}

.diff-tool.dark .d-del {
  background: rgba(248, 81, 73, 0.18);
  color: #ff8a85;
}

.diff-tool.dark .d-add {
  background: rgba(64, 200, 100, 0.18);
  color: #7be0a0;
}

.diff-tool.dark .d-change {
  background: rgba(240, 180, 41, 0.14);
}
</style>
