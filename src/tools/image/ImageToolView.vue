<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { markRaw } from "vue";
import {
  NButton,
  NEmpty,
  NInputNumber,
  NPopconfirm,
  NSelect,
  NSlider,
  useMessage,
} from "naive-ui";
import {
  buildOutName,
  compressionPercent,
  encodeImage,
  FORMAT_EXT,
  formatBytes,
  formatSupportsQuality,
  IMAGE_FORMATS,
  type ImageFormat,
} from "./core";
import { useImageToolStore, type ImageItem } from "../../stores/imageTool";
import { useThemeStore } from "../../stores/theme";

const message = useMessage();
const { t } = useI18n();

// 工作区状态提升到全局 store：切页返回后图片与设置原样恢复
const store = useImageToolStore();
const { items, format, quality, scale } = storeToRefs(store);

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

const formatOptions = IMAGE_FORMATS.map((f) => ({ label: f.toUpperCase(), value: f }));
// PNG 为无损格式，质量滑块禁用
const qualityEnabled = computed(() => formatSupportsQuality(format.value));

const hasDone = computed(() => items.value.some((i) => i.status === "done"));

// 缩放快捷按钮档位
const scalePresets = [100, 75, 50, 25];

/* ------------------------------------------------------------------ */
/* 导入：点击选择 / 拖拽                                               */
/* ------------------------------------------------------------------ */
const fileInput = ref<HTMLInputElement | null>(null);
const dragActive = ref(false);

function isImageFile(f: File): boolean {
  return f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(f.name);
}

async function addFiles(files: File[]) {
  const images = files.filter(isImageFile);
  if (!images.length) return;
  const { accepted, dropped } = await store.addFiles(images);
  if (dropped > 0) message.warning(t("image.tooMany", { max: store.MAX_IMAGES }));
  if (accepted > 0) processAll();
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) addFiles(Array.from(input.files));
  input.value = "";
}

function onDrop(e: DragEvent) {
  dragActive.value = false;
  const files = Array.from(e.dataTransfer?.files ?? []);
  if (files.length) addFiles(files);
}

/* ------------------------------------------------------------------ */
/* 处理：设置变更防抖 300ms 后批量重编码                                */
/* ------------------------------------------------------------------ */
// 代际计数：设置快速连续变化时，旧一轮处理的写入结果直接丢弃
let processGen = 0;
let debounceTimer: number | undefined;

async function processAll() {
  const gen = ++processGen;
  for (const item of items.value) {
    if (!item.source || item.status === "error") continue;
    if (gen !== processGen) return; // 新一轮已开始，放弃本次剩余项
    item.status = "processing";
    try {
      const { blob, width, height } = await encodeImage(
        { source: item.source, width: item.width, height: item.height },
        format.value,
        quality.value,
        scale.value,
      );
      if (gen !== processGen) return;
      item.outBlob = markRaw(blob);
      item.outSize = blob.size;
      item.outWidth = width;
      item.outHeight = height;
      item.status = "done";
      item.error = undefined;
    } catch (err) {
      if (gen !== processGen) return;
      item.status = "error";
      item.error = err instanceof Error && "code" in err ? (err as { code: "decodeFailed" | "encodeFailed" }).code : "encodeFailed";
    }
  }
}

watch([format, quality, scale], () => {
  if (!items.value.length) return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(processAll, 300);
});

onMounted(() => {
  // 切页返回：上次未处理完的项继续处理（已完成的保留结果）
  if (items.value.some((i) => i.status === "pending")) processAll();
});

onUnmounted(() => {
  window.clearTimeout(debounceTimer);
});

/* ------------------------------------------------------------------ */
/* 保存：Tauri 环境用系统对话框 + fs 写入，浏览器预览回退 a[download]   */
/* ------------------------------------------------------------------ */
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveFilter(format: ImageFormat) {
  return { name: format.toUpperCase(), extensions: [FORMAT_EXT[format].slice(1)] };
}

async function saveItem(item: ImageItem) {
  if (!item.outBlob || item.status !== "done") return;
  const outName = buildOutName(item.name, format.value);
  try {
    if (isTauri()) {
      const path = await save({ title: t("image.saveTitle"), defaultPath: outName, filters: [saveFilter(format.value)] });
      if (!path) return;
      await writeFile(path, new Uint8Array(await item.outBlob.arrayBuffer()));
    } else {
      downloadBlob(item.outBlob, outName);
    }
    message.success(t("image.saved"));
  } catch (err) {
    message.error(String(err));
  }
}

async function saveAll() {
  const done = items.value.filter((i) => i.status === "done" && i.outBlob);
  if (!done.length) {
    message.warning(t("image.noImages"));
    return;
  }
  try {
    if (isTauri()) {
      const dir = await open({ directory: true, multiple: false, title: t("image.saveAllTitle") });
      if (!dir) return;
      for (const item of done) {
        const path = await join(dir, buildOutName(item.name, format.value));
        await writeFile(path, new Uint8Array(await item.outBlob!.arrayBuffer()));
      }
    } else {
      for (const item of done) downloadBlob(item.outBlob!, buildOutName(item.name, format.value));
    }
    message.success(t("image.savedAll", { count: done.length }));
  } catch (err) {
    message.error(String(err));
  }
}

/* ------------------------------------------------------------------ */
/* 大小变化展示                                                        */
/* ------------------------------------------------------------------ */
function deltaOf(item: ImageItem): number {
  return item.outSize != null ? compressionPercent(item.size, item.outSize) : 0;
}

function deltaText(item: ImageItem): string {
  const d = deltaOf(item);
  if (d > 0) return t("image.compressed", { percent: d });
  if (d < 0) return t("image.enlarged", { percent: -d });
  return t("image.unchanged");
}

function deltaClass(item: ImageItem): string {
  const d = deltaOf(item);
  return d > 0 ? "good" : d < 0 ? "warn" : "flat";
}

function errText(item: ImageItem): string {
  return t(`image.err.${item.error ?? "encodeFailed"}`);
}
</script>

<template>
  <div class="img-tool" :class="{ dark: isDark }">
    <!-- 设置面板：设置项横排 + 操作按钮右对齐 -->
    <div class="control-panel">
      <div class="setting-row">
        <div class="setting">
          <span class="setting-label">{{ t("image.format") }}</span>
          <n-select v-model:value="format" :options="formatOptions" style="width: 120px" size="small" />
        </div>
        <div class="setting">
          <span class="setting-label">{{ t("image.quality") }}<b class="quality-num">{{ quality }}</b></span>
          <n-slider
            v-model:value="quality"
            :min="0"
            :max="100"
            :step="1"
            :disabled="!qualityEnabled"
            style="width: 170px"
          />
        </div>
        <div class="setting">
          <span class="setting-label">{{ t("image.scale") }}</span>
          <n-input-number v-model:value="scale" :min="1" :max="200" size="small" style="width: 90px" />
          <div class="scale-btns">
            <n-button
              v-for="p in scalePresets"
              :key="p"
              size="tiny"
              secondary
              :class="{ active: scale === p }"
              @click="scale = p"
            >
              {{ p }}%
            </n-button>
          </div>
        </div>
        <div class="panel-actions">
          <n-button size="small" type="primary" :disabled="!hasDone" @click="saveAll">
            {{ t("image.saveAll") }}
          </n-button>
          <n-popconfirm :positive-text="t('image.ok')" :negative-text="t('image.cancel')" @positive-click="store.clearAll">
            <template #trigger>
              <n-button size="small" :disabled="!items.length">{{ t("image.clear") }}</n-button>
            </template>
            {{ t("image.clearConfirm") }}
          </n-popconfirm>
        </div>
      </div>
      <div class="setting-hints">
        <span>{{ t("image.qualityHint") }}</span>
        <span class="hint-sep" aria-hidden="true">·</span>
        <span>{{ t("image.scaleHint") }}</span>
      </div>
    </div>

    <!-- 导入区：点击 / 拖拽（已有图片时收紧高度） -->
    <div
      class="dropzone"
      :class="{ active: dragActive, compact: items.length > 0 }"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter="fileInput?.click()"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="onDrop"
    >
      <div class="drop-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
          />
        </svg>
      </div>
      <span class="drop-title">{{ t("image.selectImages") }}</span>
      <span class="drop-hint">{{ t("image.selectHint", { max: store.MAX_IMAGES }) }}</span>
    </div>
    <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFileChange" />

    <!-- 图片卡片列表 -->
    <div v-if="items.length" class="card-grid">
      <div v-for="item in items" :key="item.id" class="card">
        <img class="thumb" :src="item.previewUrl" :alt="item.name" />
        <div class="info">
          <div class="name" :title="item.name">{{ item.name }}</div>
          <div class="meta">
            <span class="tag">{{ t("image.original") }}</span>
            <span>{{ t("image.sizeInfo", { width: item.width, height: item.height }) }} · {{ formatBytes(item.size) }}</span>
          </div>
          <div class="meta">
            <span class="tag out">{{ t("image.output") }}</span>
            <template v-if="item.status === 'done' && item.outSize != null">
              <span>{{ t("image.sizeInfo", { width: item.outWidth, height: item.outHeight }) }} · {{ formatBytes(item.outSize) }}</span>
              <span class="delta" :class="deltaClass(item)">{{ deltaText(item) }}</span>
            </template>
            <span v-else-if="item.status === 'processing'" class="processing">
              <span class="processing-dot" aria-hidden="true"></span>
              {{ t("image.processing") }}
            </span>
            <span v-else-if="item.status === 'error'" class="delta err">{{ errText(item) }}</span>
          </div>
        </div>
        <div class="actions">
          <n-button size="tiny" secondary :disabled="item.status !== 'done'" @click="saveItem(item)">
            {{ t("image.save") }}
          </n-button>
          <n-button size="tiny" quaternary circle :aria-label="t('image.remove')" @click="store.removeItem(item.id)">
            ✕
          </n-button>
        </div>
      </div>
    </div>
    <n-empty v-else :description="t('image.noImages')" style="margin-top: 32px" />
  </div>
</template>

<style scoped>
.img-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

/* ---------- 设置面板 ---------- */
.control-panel {
  padding: 12px 14px 8px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
}

.setting-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  align-items: center;
}

.setting {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.setting-label {
  flex: none;
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(90, 90, 90, 1);
}

.quality-num {
  margin-left: 5px;
  padding: 0 6px;
  border-radius: 5px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  font-weight: 600;
  background: rgba(64, 152, 252, 0.12);
  color: #1a6fd4;
}

.scale-btns {
  display: flex;
  gap: 4px;
}

/* 缩放档位按钮：命中当前值时品牌蓝高亮 */
.scale-btns .active :deep(.n-button__content) {
  color: #1a6fd4;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.setting-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  font-size: 11.5px;
  color: rgba(128, 128, 128, 0.9);
}

/* ---------- 导入区 ---------- */
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 30px 16px;
  border: 1.5px dashed rgba(128, 128, 128, 0.4);
  border-radius: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    padding 0.25s ease;
}

/* 已有图片时收紧高度，把空间让给卡片列表 */
.dropzone.compact {
  padding: 14px 16px;
  flex-direction: row;
  justify-content: center;
}

.dropzone.compact .drop-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.dropzone.compact .drop-icon svg {
  width: 16px;
  height: 16px;
}

.dropzone.compact .drop-hint {
  display: none;
}

.dropzone:hover {
  border-color: rgba(64, 152, 252, 0.6);
  background: rgba(64, 152, 252, 0.04);
}

.dropzone.active {
  border-color: #4098fc;
  background: rgba(64, 152, 252, 0.08);
}

.drop-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #4098fc, #22d3ee);
  box-shadow: 0 4px 12px rgba(64, 152, 252, 0.35);
  transition: transform 0.2s ease;
}

.dropzone:hover .drop-icon {
  transform: translateY(-2px) scale(1.04);
}

.drop-icon svg {
  width: 24px;
  height: 24px;
}

.drop-title {
  font-size: 14px;
  font-weight: 600;
}

.drop-hint {
  font-size: 12px;
  color: rgba(128, 128, 128, 0.9);
}

/* ---------- 图片卡片 ---------- */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
  min-height: 0;
}

.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(64, 152, 252, 0.45);
  box-shadow: 0 6px 18px rgba(64, 152, 252, 0.12);
}

.thumb {
  width: 66px;
  height: 66px;
  flex: none;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.16);
  background: rgba(128, 128, 128, 0.1);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(128, 128, 128, 0.95);
}

.tag {
  flex: none;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(128, 128, 128, 0.15);
}

.tag.out {
  background: rgba(64, 152, 252, 0.15);
  color: #1a6fd4;
}

/* 压缩结果徽章：缩小绿 / 增大黄 / 不变灰 / 错误红 */
.delta {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.delta.good {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.delta.warn {
  background: rgba(240, 180, 41, 0.18);
  color: #a16207;
}

.delta.flat {
  background: rgba(128, 128, 128, 0.14);
  color: rgba(110, 110, 110, 1);
}

.delta.err {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.processing {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(128, 128, 128, 0.95);
}

.processing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4098fc;
  animation: dot-blink 1s ease-in-out infinite;
}

@keyframes dot-blink {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.actions {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ---------- 深色模式 ---------- */
.img-tool.dark .control-panel,
.img-tool.dark .card {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.img-tool.dark .setting-label {
  color: rgba(210, 214, 220, 0.92);
}

.img-tool.dark .quality-num {
  background: rgba(64, 152, 252, 0.22);
  color: #7cb8ff;
}

.img-tool.dark .scale-btns .active :deep(.n-button__content) {
  color: #7cb8ff;
}

.img-tool.dark .setting-hints,
.img-tool.dark .drop-hint {
  color: rgba(200, 204, 210, 0.65);
}

.img-tool.dark .card:hover {
  border-color: rgba(64, 152, 252, 0.55);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.img-tool.dark .tag.out {
  color: #7cb8ff;
}

.img-tool.dark .delta.good {
  background: rgba(74, 222, 128, 0.16);
  color: #7be0a0;
}

.img-tool.dark .delta.warn {
  background: rgba(240, 180, 41, 0.18);
  color: #facc15;
}

.img-tool.dark .delta.flat {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(200, 204, 210, 0.8);
}

.img-tool.dark .delta.err {
  background: rgba(248, 113, 113, 0.16);
  color: #ff8a85;
}
</style>
