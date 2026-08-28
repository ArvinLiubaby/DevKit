<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NText, useMessage } from "naive-ui";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { pinyin } from "pinyin-pro";
import { tools } from "../tools/registry";
import { useThemeStore } from "../stores/theme";
import { useSearchFocusStore } from "../stores/searchFocus";

const message = useMessage();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.theme === "dark");
const { t } = useI18n();
const clipboardContent = ref("");

// 首页"可用工具"卡片：只展示工具类，设置类（如快捷键）不参与
const toolCards = computed(() => tools.filter((tool) => tool.category !== "设置"));

// ---------- 程序搜索（类似开始菜单） ----------
interface ProgramEntry {
  name: string;
  path: string;
}

// 搜索索引：中文名 → 全拼（weixin）+ 首字母（wx）；英文名 → 小写 + 词首字母（vsc）
interface SearchIndex {
  entry: ProgramEntry;
  name: string;
  full: string;
  initials: string;
}

const searchQuery = ref("");
const searchIndex = ref<SearchIndex[]>([]);
const showResults = ref(false);
const selectedIndex = ref(0);
const searchInputRef = ref<HTMLInputElement | null>(null);
const focusStore = useSearchFocusStore();

// 中英文混合名分段处理（如“钉钉 DingTalk”），中文段转拼音、英文段保留
function buildSearchIndex(list: ProgramEntry[]): SearchIndex[] {
  return list.map((entry) => {
    const parts = entry.name.match(/[\u4e00-\u9fff]+|[^\u4e00-\u9fff]+/g) ?? [entry.name];
    let full = "";
    let initials = "";
    for (const part of parts) {
      if (/[\u4e00-\u9fff]/.test(part)) {
        const syllables = pinyin(part, { toneType: "none", type: "array" });
        full += syllables.join("");
        initials += syllables.map((s) => s.charAt(0)).join("");
      } else {
        const lower = part.toLowerCase();
        full += lower;
        initials += lower
          .split(/[^a-z0-9]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0))
          .join("");
      }
    }
    return {
      entry,
      name: entry.name.toLowerCase(),
      full: full.toLowerCase(),
      initials: initials.toLowerCase(),
    };
  });
}

// 匹配打分：数字越小越靠前
// 0 精确 → 1 名前缀 → 2 首字母前缀 → 3 全拼前缀 → 10+ 子串（位置越靠前分越低）→ 40+ 模糊子序列
function matchScore(q: string, item: SearchIndex): number | null {
  const { name, full, initials } = item;
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (initials.startsWith(q)) return 2;
  if (full.startsWith(q)) return 3;
  const inName = name.indexOf(q);
  if (inName >= 0) return 10 + inName;
  const inInit = initials.indexOf(q);
  if (inInit >= 0) return 20 + inInit;
  const inFull = full.indexOf(q);
  if (inFull >= 0) return 30 + inFull;
  // 模糊子序列：'vsc' → Visual Studio Code（跳字越少分越低）
  const gaps = fuzzyGaps(q, name) ?? fuzzyGaps(q, initials) ?? fuzzyGaps(q, full);
  if (gaps != null) return 40 + gaps;
  return null;
}

// 子序列匹配：q 的字符在 target 中按序出现则匹配，返回跳字次数（null 表示不匹配）
function fuzzyGaps(q: string, target: string): number | null {
  let ti = 0;
  let gaps = 0;
  let last = -2;
  for (const ch of q) {
    const found = target.indexOf(ch, ti);
    if (found < 0) return null;
    if (found - last > 1) gaps++;
    last = found;
    ti = found + 1;
  }
  return gaps;
}

// 匹配：按打分升序 + 名称字典序，最多展示 12 条
const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return [];
  return searchIndex.value
    .map((item) => ({ item, score: matchScore(q, item) }))
    .filter((x): x is { item: SearchIndex; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 12)
    .map((x) => x.item.entry);
});

watch(filtered, () => {
  selectedIndex.value = 0;
});

// 程序图标缓存：path -> Blob URL（首次提取后复用，避免重复 invoke）
const iconUrls = reactive(new Map<string, string>());
async function loadIcon(entry: ProgramEntry) {
  if (iconUrls.has(entry.path)) return;
  try {
    const bytes = await invoke<number[]>("get_program_icon", { path: entry.path });
    if (bytes && bytes.length) {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/bmp" });
      iconUrls.set(entry.path, URL.createObjectURL(blob));
    }
  } catch {
    /* 提取失败回退首字母头像 */
  }
}
// 结果变化时预加载图标（最多 12 条）
watch(filtered, (list) => {
  void Promise.all(list.map(loadIcon));
});

// Alt+Space 唤起信号：消费后聚焦搜索框（此时 HomeView 可能刚挂载）
watch(
  () => focusStore.signal,
  async () => {
    focusStore.consume();
    await nextTick();
    searchInputRef.value?.focus();
    searchInputRef.value?.select();
  },
);

onMounted(() => {
  if (isTauri()) {
    // 首次进入首页加载程序列表并构建拼音索引（Rust 侧进程内缓存，后续调用即时返回）
    void invoke<ProgramEntry[]>("list_programs").then((list) => {
      searchIndex.value = buildSearchIndex(list);
    });
    // 挂载前已收到唤起信号（其他工具页 Alt+Space 跳回首页）
    if (focusStore.pending) {
      focusStore.consume();
      searchInputRef.value?.focus();
    }
  }
});

function onSearchKeydown(e: KeyboardEvent) {
  const list = filtered.value;
  if (e.key === "ArrowDown" && list.length) {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % list.length;
  } else if (e.key === "ArrowUp" && list.length) {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value - 1 + list.length) % list.length;
  } else if (e.key === "Enter" && list.length) {
    e.preventDefault();
    void launch(list[selectedIndex.value]);
  } else if (e.key === "Escape") {
    showResults.value = false;
    searchInputRef.value?.blur();
  }
}

async function launch(entry: ProgramEntry) {
  showResults.value = false;
  searchQuery.value = "";
  searchInputRef.value?.blur();
  try {
    await invoke("launch_program", { path: entry.path });
    message.success(t("search.launched", { name: entry.name }));
  } catch (err) {
    message.error(t("search.launchFailed", { err: String(err) }));
  }
}

async function copyWelcome() {
  try {
    // 验证 clipboard-manager 插件链路（Rust 插件 + capabilities 权限 + JS API）
    await writeText("DevKit - local-first developer toolbox");
    message.success(t("home.copied"));
    // 读回验证，用于排查剪贴板被外部占用/写入失败等问题
    clipboardContent.value = await readText();
  } catch (err) {
    message.error(t("home.copyFailed", { err: String(err) }));
  }
}
</script>

<template>
  <div class="home" :class="{ dark: isDark }">
    <!-- 欢迎区 -->
    <section class="hero">
      <h1 class="hero-title">{{ t("home.welcome") }}</h1>
      <div class="hero-accent" aria-hidden="true"></div>
      <p class="hero-sub">{{ t("home.subtitle") }}</p>

      <!-- 程序搜索：类似开始菜单，↑↓ 选择 + Enter 启动 -->
      <div class="search-box">
        <div class="search-input-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
            />
          </svg>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="search-input"
            :placeholder="isTauri() ? t('search.placeholder') : t('search.notTauri')"
            :disabled="!isTauri()"
            @focus="showResults = true"
            @keydown="onSearchKeydown"
          />
        </div>
        <div v-if="showResults && searchQuery.trim()" class="search-results">
          <div v-if="!filtered.length" class="search-empty">{{ t("search.empty") }}</div>
          <div
            v-for="(item, i) in filtered"
            :key="item.path"
            class="search-item"
            :class="{ active: i === selectedIndex }"
            @mousedown.prevent="launch(item)"
            @mouseenter="selectedIndex = i"
          >
            <span v-if="iconUrls.get(item.path)" class="search-avatar search-avatar-img">
              <img :src="iconUrls.get(item.path)!" alt="" draggable="false" />
            </span>
            <span v-else class="search-avatar">{{ item.name.charAt(0).toUpperCase() }}</span>
            <div class="search-info">
              <span class="search-name">{{ item.name }}</span>
              <span class="search-path">{{ item.path }}</span>
            </div>
          </div>
        </div>
      </div>

      <n-button class="copy-btn" @click="copyWelcome">
        <template #icon>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="copy-icon">
            <path
              fill="currentColor"
              d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
            />
          </svg>
        </template>
        {{ t("home.copyWelcome") }}
      </n-button>
      <p v-if="clipboardContent" class="clipboard-check">
        <n-text depth="3" size="small">{{ t("home.clipboardCheck", { content: clipboardContent }) }}</n-text>
      </p>
    </section>

    <!-- 工具卡片 -->
    <section class="tools-section">
      <h2 class="section-title">{{ t("home.availableTools") }}</h2>
      <div class="tool-grid">
        <router-link
          v-for="(tool, i) in toolCards"
          :key="tool.id"
          :to="tool.path"
          class="tool-card"
          :style="{ animationDelay: `${i * 70}ms` }"
        >
          <div class="tool-icon">
            <img :src="tool.icon" alt="" />
          </div>
          <div class="tool-info">
            <span class="tool-name">{{ t(tool.nameKey) }}</span>
            <span class="tool-desc">{{ t(tool.descKey) }}</span>
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

/* ---------- 程序搜索（类似开始菜单） ---------- */
.search-box {
  position: relative;
  width: min(560px, 100%);
  margin-top: 28px;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 16px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.search-input-wrap:focus-within {
  border-color: rgba(64, 152, 252, 0.6);
  box-shadow: 0 4px 18px rgba(64, 152, 252, 0.15);
}

.search-icon {
  flex: none;
  width: 18px;
  height: 18px;
  color: rgba(128, 128, 128, 0.8);
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: inherit;
}

.search-input:disabled {
  cursor: not-allowed;
}

.search-input::placeholder {
  color: rgba(128, 128, 128, 0.75);
}

/* 下拉结果面板 */
.search-results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 100;
  max-height: 340px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(14px);
}

.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.search-item.active,
.search-item:hover {
  background: rgba(18, 150, 219, 0.12);
}

.search-avatar {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #4098fc, #22d3ee);
}

.search-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.search-name {
  font-size: 14px;
  font-weight: 600;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-path {
  font-size: 11.5px;
  color: rgba(128, 128, 128, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-empty {
  padding: 18px 10px;
  text-align: center;
  font-size: 13px;
  color: rgba(128, 128, 128, 0.9);
}

/* ---------- 工具卡片 ---------- */
.tools-section {
  margin-top: 8px;
}

.section-title {
  position: relative;
  margin: 0 0 18px;
  padding-left: 13px;
  font-size: 18px;
  font-weight: 600;
}

.section-title::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, #6366f1, #22d3ee);
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
  /* 覆盖 <a> 默认链接蓝色：颜色跟随主题文字色（浅色深灰 / 深色浅灰） */
  color: inherit;
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
  /* 统一中英文字体链：避免混排时中文（雅黑）与英文（Segoe UI）基线错位 */
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
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

/* 程序真实图标：圆角方形 + 浅色衬底（透明图标可见） */
.search-avatar-img {
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.04);
}
.search-avatar-img img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.dark .search-avatar-img {
  background: rgba(255, 255, 255, 0.08);
}

/* 深色：搜索框与结果面板 */
.dark .search-input-wrap {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
}

.dark .search-results {
  background: rgba(30, 32, 38, 0.96);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

.dark .search-item.active,
.dark .search-item:hover {
  background: rgba(18, 150, 219, 0.25);
}

.dark .search-path {
  color: rgba(200, 200, 200, 0.65);
}
</style>
