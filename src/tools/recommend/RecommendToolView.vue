<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, useMessage } from "naive-ui";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { RECOMMENDATIONS, repoUrl, type OpenSourceItem } from "./core";
import githubIcon from "../../assets/icons/github.svg";
import { useThemeStore } from "../../stores/theme";

const message = useMessage();
const { t } = useI18n();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");

/** 打开 GitHub 项目页：Tauri 用 opener 插件（系统默认浏览器），浏览器预览回退 <a> 跳转 */
async function openRepo(item: OpenSourceItem) {
  const url = repoUrl(item.repo);
  try {
    if (isTauri()) {
      await openUrl(url);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    }
  } catch (err) {
    message.error(t("recommend.openFailed", { err: String(err) }));
  }
}

/** 复制项目链接：Tauri 用剪贴板插件，浏览器预览回退 navigator.clipboard */
async function copyLink(item: OpenSourceItem) {
  const url = repoUrl(item.repo);
  try {
    if (isTauri()) {
      await writeText(url);
    } else {
      await navigator.clipboard.writeText(url);
    }
    message.success(t("recommend.copied"));
  } catch (err) {
    message.error(t("recommend.copyFailed", { err: String(err) }));
  }
}
</script>

<template>
  <div class="rec-tool" :class="{ dark: isDark }">
    <!-- 简介横幅：图标徽标 + 说明文字 -->
    <section class="rec-intro">
      <span class="intro-icon" aria-hidden="true">
        <img :src="githubIcon" alt="" />
      </span>
      <p class="intro-text">{{ t("recommend.intro") }}</p>
    </section>

    <div class="rec-grid">
      <article
        v-for="(item, i) in RECOMMENDATIONS"
        :key="item.id"
        class="rec-card"
        :style="{ animationDelay: `${i * 60}ms` }"
      >
        <div class="rec-head">
          <span class="rec-avatar" aria-hidden="true">
            <img :src="githubIcon" alt="" />
          </span>
          <div class="rec-title-col">
            <span class="rec-name">{{ item.name }}</span>
            <span class="rec-repo">{{ item.repo }}</span>
          </div>
          <span class="rec-tag">{{ t(item.tagKey) }}</span>
        </div>
        <p class="rec-desc">{{ t(item.descKey) }}</p>
        <div class="rec-actions">
          <n-button size="small" type="primary" @click="openRepo(item)">
            {{ t("recommend.visit") }}
          </n-button>
          <n-button size="small" secondary @click="copyLink(item)">
            {{ t("recommend.copyLink") }}
          </n-button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.rec-tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 880px;
  margin: 0 auto;
  padding: 4px 0;
}

/* ---------- 简介横幅 ---------- */
.rec-intro {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border: 1px solid rgba(128, 128, 128, 0.16);
  border-radius: 12px;
  background: linear-gradient(120deg, rgba(64, 152, 252, 0.08), rgba(34, 211, 238, 0.05));
}

.intro-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.1);
}

.intro-icon img {
  width: 20px;
  height: 20px;
}

.intro-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(100, 100, 100, 1);
}

/* ---------- 推荐卡片 ---------- */
.rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}

.rec-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.045);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  animation: card-in 0.35s ease backwards;
}

.rec-card:hover {
  transform: translateY(-3px);
  border-color: rgba(64, 152, 252, 0.5);
  box-shadow: 0 8px 22px rgba(64, 152, 252, 0.14);
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

.rec-head {
  display: flex;
  align-items: center;
  gap: 11px;
}

/* GitHub 头像：渐变衬底圆角方块，卡片悬浮时轻微放大 */
.rec-avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4098fc, #22d3ee);
  box-shadow: 0 3px 10px rgba(64, 152, 252, 0.3);
  transition: transform 0.18s ease;
}

.rec-card:hover .rec-avatar {
  transform: scale(1.07);
}

.rec-avatar img {
  width: 22px;
  height: 22px;
  filter: brightness(0) invert(1);
}

.rec-title-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rec-name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rec-repo {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11.5px;
  color: rgba(128, 128, 128, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rec-tag {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(64, 152, 252, 0.13);
  color: #1a6fd4;
}

.rec-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: rgba(110, 110, 110, 1);
}

.rec-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

/* ---------- 深色模式 ---------- */
.rec-tool.dark .rec-intro {
  border-color: rgba(64, 152, 252, 0.24);
  background: linear-gradient(120deg, rgba(64, 152, 252, 0.12), rgba(34, 211, 238, 0.07));
}

.rec-tool.dark .intro-icon {
  background: rgba(255, 255, 255, 0.1);
}

.rec-tool.dark .intro-text {
  color: rgba(200, 204, 210, 0.85);
}

.rec-tool.dark .rec-card {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.rec-tool.dark .rec-card:hover {
  border-color: rgba(64, 152, 252, 0.6);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
}

.rec-tool.dark .intro-icon img,
.rec-tool.dark .rec-avatar img {
  filter: brightness(0) invert(1);
}

.rec-tool.dark .intro-icon img {
  filter: none;
}

.rec-tool.dark .rec-repo {
  color: rgba(200, 204, 210, 0.6);
}

.rec-tool.dark .rec-tag {
  background: rgba(64, 152, 252, 0.22);
  color: #7cb8ff;
}

.rec-tool.dark .rec-desc {
  color: rgba(200, 204, 210, 0.78);
}
</style>
