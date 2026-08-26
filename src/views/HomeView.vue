<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NSpace, NText, useMessage } from "naive-ui";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { tools } from "../tools/registry";

const message = useMessage();
const router = useRouter();
const clipboardContent = ref("");

async function copyWelcome() {
  try {
    // 验证 clipboard-manager 插件链路（Rust 插件 + capabilities 权限 + JS API）
    await writeText("DevKit - 本地优先的开发者效率工具集");
    message.success("已复制到剪贴板");
    // 读回验证，用于排查剪贴板被外部占用/写入失败等问题
    clipboardContent.value = await readText();
  } catch (err) {
    message.error(`剪贴板写入失败：${err}`);
  }
}
</script>

<template>
  <n-card title="欢迎使用 DevKit" size="large">
    <n-text>本地优先、离线可用、跨平台的开发者效率工具集（项目骨架阶段）</n-text>
    <div v-if="clipboardContent" class="clipboard-check">
      <n-text depth="3">剪贴板读回验证：{{ clipboardContent }}</n-text>
    </div>
    <template #footer>
      <n-button type="primary" @click="copyWelcome">复制欢迎语（验证剪贴板插件）</n-button>
    </template>
  </n-card>

  <n-card title="可用工具" size="large">
    <n-space vertical>
      <n-button v-for="t in tools" :key="t.id" quaternary @click="router.push(t.path)">
        {{ t.name }} →
      </n-button>
    </n-space>
  </n-card>
</template>

<style scoped>
.clipboard-check {
  margin-top: 12px;
}
</style>
