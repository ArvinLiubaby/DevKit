/**
 * 图片压缩与转换 core：格式常量、解码、编码、尺寸计算（纯逻辑，无视图依赖）。
 * 压缩 / 转换全部在本地浏览器 canvas 完成，不上传任何数据。
 */

/** 支持的输出格式：浏览器 canvas 原生可编码的三种格式 */
export type ImageFormat = "jpeg" | "png" | "webp";

/** 输出格式列表（UI 选项顺序） */
export const IMAGE_FORMATS: ImageFormat[] = ["jpeg", "png", "webp"];

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const FORMAT_EXT: Record<ImageFormat, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
};

/** 目标格式是否支持有损质量调节（PNG 为无损格式） */
export function formatSupportsQuality(format: ImageFormat): boolean {
  return format !== "png";
}

/** 错误码：视图层用 i18n key（image.err.{code}）翻译展示 */
export type ImageErrorCode = "decodeFailed" | "encodeFailed";

export class ImageError extends Error {
  constructor(public code: ImageErrorCode) {
    super(code);
  }
}

/** 解码后的图像：canvas 可直接绘制的源 + 原始像素尺寸 */
export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** 字节数人性化显示（B / KB / MB，单位通用无需翻译） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 按百分比计算目标尺寸（四舍五入取整，最小 1px） */
export function computeTargetSize(
  width: number,
  height: number,
  percent: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((width * percent) / 100)),
    height: Math.max(1, Math.round((height * percent) / 100)),
  };
}

/** 压缩率：正值表示缩小，负值表示变大，0 表示不变 */
export function compressionPercent(original: number, output: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - output) / original) * 100);
}

/** 输出文件名：原文件名换扩展名（photo.png → photo.jpg，photo.jpeg → photo.jpg） */
export function buildOutName(name: string, format: ImageFormat): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}${FORMAT_EXT[format]}`;
}

/**
 * 解码图片文件。
 * 优先 createImageBitmap：异步解码不阻塞 UI，且自动应用 EXIF 方向（手机照片）；
 * 失败（如部分 SVG）回退 <img> 元素解码。
 */
export async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // 回退 <img> 解码
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new ImageError("decodeFailed");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

/**
 * 编码：按目标格式 / 质量 / 缩放百分比绘制到 canvas 并输出 Blob。
 * quality 0-100，仅对 JPEG / WebP 生效（PNG 无损）。
 */
export async function encodeImage(
  img: DecodedImage,
  format: ImageFormat,
  quality: number,
  scalePercent: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = computeTargetSize(img.width, img.height, scalePercent);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("encodeFailed");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img.source, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new ImageError("encodeFailed"))),
      FORMAT_MIME[format],
      formatSupportsQuality(format) ? quality / 100 : undefined,
    );
  });
  return { blob, width, height };
}
