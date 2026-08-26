import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import { defaultFixOptions, type FixOptions, type FixReport } from "../tools/json/core";

/**
 * JSON 格式化工具的工作区状态：提升到全局 store。
 * 路由切换时组件被卸载，本地状态会丢失；存入 store 后返回页面时
 * 输入 / 输出 / 设置 / 折叠状态可原样恢复，避免用户数据被清空。
 */
export const useJsonToolStore = defineStore("jsonTool", () => {
  const input = ref("");
  const output = ref("");
  const error = ref("");
  const indent = ref<number | string>(2);
  const autoFormat = ref(true);
  // 自动修复：总开关 + 修复项细分开关（默认全部开启）
  const autoFix = ref(true);
  const fixOptions = reactive<FixOptions>({ ...defaultFixOptions });
  const lastReport = ref<FixReport | null>(null);
  // 折叠状态随 store 保留，切页回来折叠结构不变
  const collapsedLines = ref<Set<number>>(new Set());

  function clearAll() {
    input.value = "";
    output.value = "";
    error.value = "";
    lastReport.value = null;
    collapsedLines.value = new Set();
  }

  return {
    input,
    output,
    error,
    indent,
    autoFormat,
    autoFix,
    fixOptions,
    lastReport,
    collapsedLines,
    clearAll,
  };
});
