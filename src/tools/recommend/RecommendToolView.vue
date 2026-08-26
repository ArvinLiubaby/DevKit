<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NText, useMessage } from "naive-ui";
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
    <n-text depth="3" size="small" class="intro">{{ t("recommend.intro") }}</n-text>

    <div class="rec-grid">
      <div v-for="item in RECOMMENDATIONS" :key="item.id" class="rec-card">
        <div class="rec-head">
          <img class="rec-icon" :src="githubIcon" :alt="item.name" />
          <div class="rec-title">
            <n-text strong>{{ item.name }}</n-text>
            <span class="rec-tag">{{ t(item.tagKey) }}</span>
          </div>
        </div>
        <n-text depth="2" size="small" class="rec-desc">{{ t(item.descKey) }}</n-text>
        <div class="rec-actions">
          <n-button size="small" type="primary" @click="openRepo(item)">
            {{ t("recommend.visit") }}
          </n-button>
          <n-button size="small" secondary @click="copyLink(item)">
            {{ t("recommend.copyLink") }}
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rec-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 880px;
  margin: 0 auto;
  padding: 4px 0;
}

.intro {
  line-height: 1.6;
}

.rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 12px;
}

.rec-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.045);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.rec-card:hover {
  border-color: rgba(64, 152, 252, 0.5);
  box-shadow: 0 2px 10px rgba(64, 152, 252, 0.08);
}

.rec-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rec-icon {
  width: 28px;
  height: 28px;
  flex: none;
}

.rec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 15px;
}

.rec-tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(64, 152, 252, 0.14);
  color: #1a6fd4;
}

.dark .rec-tag {
  color: #7cb8ff;
}

.rec-desc {
  line-height: 1.6;
}

.rec-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
</style>
