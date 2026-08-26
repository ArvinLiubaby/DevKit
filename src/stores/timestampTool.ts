import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 时间戳转换工具的工作区状态：提升到全局 store，切页返回后输入原样恢复。
 * 转换结果均由输入推导（computed），无需持久化。
 */
export const useTimestampToolStore = defineStore("timestampTool", () => {
  // 时间戳 → 日期：时间戳输入
  const tsInput = ref("");
  // 日期 → 时间戳：日期字符串输入（主输入源）
  const dateInput = ref("");
  // 日期 → 时间戳：日期选择器值（选择后同步到 dateInput，保持单一数据源）
  const datePickerValue = ref<number | null>(null);

  function clearAll() {
    tsInput.value = "";
    dateInput.value = "";
    datePickerValue.value = null;
  }

  return { tsInput, dateInput, datePickerValue, clearAll };
});
