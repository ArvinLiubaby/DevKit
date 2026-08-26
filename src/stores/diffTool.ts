import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 文本对比工具的工作区状态：提升到全局 store，切页返回后输入原样恢复。
 * 对比结果由输入推导（防抖重算），无需持久化。
 */
export const useDiffToolStore = defineStore("diffTool", () => {
  // 原始文本
  const leftText = ref("");
  // 修改后文本
  const rightText = ref("");

  function clearAll() {
    leftText.value = "";
    rightText.value = "";
  }

  return { leftText, rightText, clearAll };
});
