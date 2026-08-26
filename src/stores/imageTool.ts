import { defineStore } from "pinia";
import { markRaw, reactive, ref } from "vue";
import { decodeImage, type ImageErrorCode, type ImageFormat } from "../tools/image/core";

/** 单张图片的工作区条目：原图元数据 + 处理结果 */
export interface ImageItem {
  /** 唯一 id */
  id: string;
  /** 原始文件名 */
  name: string;
  /** 原始文件（markRaw：避免 reactive 代理 File 原生对象） */
  file: File;
  /** 解码后的图像源（markRaw：ImageBitmap/HTMLImageElement 不可被代理） */
  source?: CanvasImageSource;
  /** 原始宽高（解码后填充） */
  width: number;
  height: number;
  /** 原始字节数 */
  size: number;
  /** 原始图预览 URL（addFiles 时创建，移除/清空时 revoke） */
  previewUrl: string;
  /** 处理状态 */
  status: "pending" | "processing" | "done" | "error";
  /** 错误码（视图层翻译展示） */
  error?: ImageErrorCode;
  /** 输出 Blob（markRaw）与输出元数据 */
  outBlob?: Blob;
  outSize?: number;
  outWidth?: number;
  outHeight?: number;
}

const MAX_IMAGES = 20;

/**
 * 图片压缩转换工具的工作区状态：提升到全局 store，切页返回后图片与设置原样恢复。
 * 处理（编码）为异步任务，由视图层驱动；store 只保存数据。
 */
export const useImageToolStore = defineStore("imageTool", () => {
  const items = ref<ImageItem[]>([]);
  // 处理设置：目标格式 / 质量（0-100）/ 缩放百分比
  const format = ref<ImageFormat>("jpeg");
  const quality = ref(80);
  const scale = ref(100);

  /** 批量导入：异步解码获取尺寸，解码失败标记 error */
  async function addFiles(files: File[]) {
    const rest = MAX_IMAGES - items.value.length;
    const accepted = files.slice(0, Math.max(rest, 0));
    for (const file of accepted) {
      const item = reactive<ImageItem>({
        id: crypto.randomUUID(),
        name: file.name,
        file: markRaw(file),
        width: 0,
        height: 0,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        status: "pending",
      });
      items.value.push(item);
      try {
        const decoded = await decodeImage(file);
        item.source = markRaw(decoded.source);
        item.width = decoded.width;
        item.height = decoded.height;
      } catch {
        item.status = "error";
        item.error = "decodeFailed";
      }
    }
    return { accepted: accepted.length, dropped: files.length - accepted.length };
  }

  function removeItem(id: string) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx >= 0) {
      URL.revokeObjectURL(items.value[idx].previewUrl);
      items.value.splice(idx, 1);
    }
  }

  function clearAll() {
    for (const item of items.value) URL.revokeObjectURL(item.previewUrl);
    items.value = [];
  }

  return { items, format, quality, scale, MAX_IMAGES, addFiles, removeItem, clearAll };
});
