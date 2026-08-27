import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 首页搜索框焦点信号：Alt+Space 唤起主窗口时由 App.vue 置位。
 * 使用 pending 标志而非仅计数——若首页尚未挂载（用户在其他工具页），
 * HomeView 挂载后仍能消费该信号完成聚焦。
 */
export const useSearchFocusStore = defineStore("searchFocus", () => {
  const pending = ref(false);
  const signal = ref(0);

  function requestFocus() {
    pending.value = true;
    signal.value++;
  }

  function consume() {
    pending.value = false;
  }

  return { pending, signal, requestFocus, consume };
});
