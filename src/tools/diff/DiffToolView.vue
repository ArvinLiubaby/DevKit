<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { NButton, NEmpty, NInput, NSpace, NText } from "naive-ui";
import { diffText, escapeHtml, type DiffResult, type Range } from "./core";
import { useThemeStore } from "../../stores/theme";
import { useDiffToolStore } from "../../stores/diffTool";

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
      <n-button size="small" @click="swap">交换左右</n-button>
      <n-button size="small" @click="loadSample">载入示例</n-button>
      <n-button size="small" @click="clearAll">清空</n-button>
      <n-text v-if="stats" depth="3" size="small">
        新增 {{ stats.add }} 行 · 删除 {{ stats.del }} 行 · 修改 {{ stats.change }} 行
      </n-text>
    </n-space>

    <div class="inputs">
      <div class="input-col">
        <n-text depth="3" size="small">原始文本</n-text>
        <n-input
          v-model:value="leftText"
          type="textarea"
          class="mono"
          placeholder="粘贴原始文本…"
          :autosize="{ minRows: 8, maxRows: 16 }"
        />
      </div>
      <div class="input-col">
        <n-text depth="3" size="small">修改后文本</n-text>
        <n-input
          v-model:value="rightText"
          type="textarea"
          class="mono"
          placeholder="粘贴修改后的文本…"
          :autosize="{ minRows: 8, maxRows: 16 }"
        />
      </div>
    </div>

    <!-- 对比结果：左右两列渲染全部行（缺失侧留空占位），保证行高对齐 -->
    <div v-if="diffResult && diffResult.lines.length && !identical" class="diff-view">
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
    <n-empty v-else-if="identical" size="small" description="两侧文本完全一致，无差异" />
    <n-empty
      v-else-if="diffResult"
      size="small"
      description="在两侧输入文本后自动对比（300ms 防抖）"
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
  margin-bottom: 8px;
}

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
  gap: 4px;
}

.mono :deep(textarea) {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
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
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
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
