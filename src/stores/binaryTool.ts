import { defineStore } from "pinia";
import { ref } from "vue";
import type { Radix } from "../tools/binary/core";

/**
 * 进制转换工具的工作区状态：提升到全局 store，切页返回后输入原样恢复。
 * 转换结果均由输入推导（computed），无需持久化。
 */
export const useBinaryToolStore = defineStore("binaryTool", () => {
  // 原始输入（允许任意前缀写法，0b/0o/0x 前缀自动切换进制）
  const input = ref("");
  // 当前源进制
  const radix = ref<Radix>(10);

  return { input, radix };
});
