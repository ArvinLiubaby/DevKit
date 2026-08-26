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
  NText,
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

const message = useMessage();
const { t } = useI18n();

// 工作区状态提升到全局 store：切页返回后图片与设置原样恢复
const store = useImageToolStore();
const { items, format, quality, scale } = storeToRefs(store);

const formatOptions = IMAGE_FORMATS.map((f) => ({ label: f.toUpperCase(), value: f }));
// PNG 为无损格式，质量滑块禁用
const qualityEnabled = computed(() => formatSupportsQuality(format.value));

const hasDone = computed(() => items.value.some((i) => i.status === "done"));

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

function deltaType(item: ImageItem): "success" | "warning" | "default" {
  const d = deltaOf(item);
  return d > 0 ? "success" : d < 0 ? "warning" : "default";
}

function errText(item: ImageItem): string {
  return t(`image.err.${item.error ?? "encodeFailed"}`);
}
</script>

<template>
  <div class="img-tool">
    <!-- 设置面板 -->
    <div class="control-panel">
      <div class="setting-row">
        <div class="setting">
          <n-text depth="3" size="small">{{ t("image.format") }}</n-text>
          <n-select v-model:value="format" :options="formatOptions" style="width: 120px" size="small" />
        </div>
        <div class="setting">
          <n-text depth="3" size="small">{{ t("image.quality") }}：{{ quality }}</n-text>
          <n-slider
            v-model:value="quality"
            :min="0"
            :max="100"
            :step="1"
            :disabled="!qualityEnabled"
            style="width: 160px"
          />
          <n-text depth="3" size="tiny">{{ t("image.qualityHint") }}</n-text>
        </div>
        <div class="setting">
          <n-text depth="3" size="small">{{ t("image.scale") }}</n-text>
          <n-input-number v-model:value="scale" :min="1" :max="200" size="small" style="width: 90px" />
          <div class="scale-btns">
            <n-button size="tiny" secondary @click="scale = 100">100%</n-button>
            <n-button size="tiny" secondary @click="scale = 75">75%</n-button>
            <n-button size="tiny" secondary @click="scale = 50">50%</n-button>
            <n-button size="tiny" secondary @click="scale = 25">25%</n-button>
          </div>
          <n-text depth="3" size="tiny">{{ t("image.scaleHint") }}</n-text>
        </div>
      </div>
      <div class="action-row">
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

    <!-- 导入区：点击 / 拖拽 -->
    <div
      class="dropzone"
      :class="{ active: dragActive }"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter="fileInput?.click()"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="onDrop"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
        />
      </svg>
      <n-text>{{ t("image.selectImages") }}</n-text>
      <n-text depth="3" size="tiny">{{ t("image.selectHint", { max: store.MAX_IMAGES }) }}</n-text>
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
              <n-text :type="deltaType(item)" size="small">{{ deltaText(item) }}</n-text>
            </template>
            <n-text v-else-if="item.status === 'processing'" depth="3" size="small">
              {{ t("image.processing") }}
            </n-text>
            <n-text v-else-if="item.status === 'error'" type="error" size="small">
              {{ errText(item) }}
            </n-text>
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
  gap: 10px;
  height: 100%;
}

/* 设置面板：卡片容器 */
.control-panel {
  padding: 10px 12px 8px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.045);
}

.setting-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  align-items: center;
}

.setting {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.scale-btns {
  display: flex;
  gap: 4px;
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

/* 导入区 */
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 30px 16px;
  border: 1.5px dashed rgba(128, 128, 128, 0.4);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.dropzone svg {
  width: 32px;
  height: 32px;
  opacity: 0.55;
}

.dropzone.active {
  border-color: #4098fc;
  background: rgba(64, 152, 252, 0.08);
}

/* 图片卡片 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
  min-height: 0;
}

.card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.045);
}

.thumb {
  width: 64px;
  height: 64px;
  flex: none;
  object-fit: cover;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.1);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(128, 128, 128, 0.9);
}

.tag {
  flex: none;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  background: rgba(128, 128, 128, 0.15);
}

.tag.out {
  background: rgba(64, 152, 252, 0.15);
}

.actions {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
