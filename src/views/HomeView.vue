<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NText, useMessage } from "naive-ui";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { tools } from "../tools/registry";
import { useThemeStore } from "../stores/theme";

const message = useMessage();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");
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
  <div class="home" :class="{ dark: isDark }">
    <!-- 欢迎区 -->
    <section class="hero">
      <h1 class="hero-title">欢迎使用 DevKit</h1>
      <div class="hero-accent" aria-hidden="true"></div>
      <p class="hero-sub">本地优先、离线可用、跨平台的开发者效率工具集</p>
      <n-button class="copy-btn" @click="copyWelcome">
        <template #icon>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="copy-icon">
            <path
              fill="currentColor"
              d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
            />
          </svg>
        </template>
        复制欢迎语
      </n-button>
      <p v-if="clipboardContent" class="clipboard-check">
        <n-text depth="3" size="small">剪贴板读回验证：{{ clipboardContent }}</n-text>
      </p>
    </section>

    <!-- 工具卡片 -->
    <section class="tools-section">
      <h2 class="section-title">可用工具</h2>
      <div class="tool-grid">
        <router-link
          v-for="(t, i) in tools"
          :key="t.id"
          :to="t.path"
          class="tool-card"
          :style="{ animationDelay: `${i * 70}ms` }"
        >
          <div class="tool-icon">
            <img :src="t.icon" alt="" />
          </div>
          <div class="tool-info">
            <span class="tool-name">{{ t.name }}</span>
            <span class="tool-desc">{{ t.description }}</span>
          </div>
          <span class="tool-arrow" aria-hidden="true">→</span>
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 880px;
  margin: 0 auto;
  padding: 32px 8px;
}

/* ---------- 欢迎区 ---------- */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 0 56px;
}

.hero-title {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: linear-gradient(120deg, #6366f1, #22d3ee);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-accent {
  width: 44px;
  height: 3px;
  margin: 18px 0 14px;
  border-radius: 2px;
  background: linear-gradient(90deg, #6366f1, #22d3ee);
}

.hero-sub {
  margin: 0;
  font-size: 14px;
  color: rgba(128, 128, 128, 0.95);
}

.copy-btn {
  margin-top: 24px;
  border-radius: 999px;
  padding: 0 22px;
  font-weight: 500;
}

.copy-icon {
  width: 14px;
  height: 14px;
}

.clipboard-check {
  margin: 14px 0 0;
}

/* ---------- 工具卡片 ---------- */
.tools-section {
  margin-top: 8px;
}

.section-title {
  margin: 0 0 18px;
  font-size: 18px;
  font-weight: 600;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  /* backwards：仅在延迟期应用起始态，结束后释放 transform，避免压过 hover 上浮 */
  animation: card-in 0.4s ease backwards;
}

.tool-card:hover {
  transform: translateY(-3px);
  border-color: rgba(64, 152, 252, 0.55);
  box-shadow: 0 8px 24px rgba(64, 152, 252, 0.14);
}

.tool-icon {
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 150, 219, 0.12);
}

.tool-icon img {
  width: 22px;
  height: 22px;
}

.tool-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tool-name {
  font-size: 15px;
  font-weight: 600;
  color: inherit;
}

.tool-desc {
  font-size: 12.5px;
  color: rgba(128, 128, 128, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-arrow {
  flex: none;
  font-size: 16px;
  color: rgba(128, 128, 128, 0.7);
  transition: transform 0.18s ease, color 0.18s ease;
}

.tool-card:hover .tool-arrow {
  transform: translateX(3px);
  color: #4098fc;
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------- 深色模式 ---------- */
.dark .hero-sub {
  color: rgba(200, 200, 200, 0.8);
}

.dark .tool-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.dark .tool-card:hover {
  border-color: rgba(64, 152, 252, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.dark .tool-desc {
  color: rgba(200, 200, 200, 0.7);
}

.dark .tool-icon {
  background: rgba(18, 150, 219, 0.2);
}
</style>
