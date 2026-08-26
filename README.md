# DevKit

[English](README.en.md) | **中文**

![Release](https://img.shields.io/github/v/release/ArvinLiubaby/DevKit) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green) ![Downloads](https://img.shields.io/github/downloads/ArvinLiubaby/DevKit/total)

**本地优先、离线可用、跨平台的开发者效率工具集。** 基于 Tauri 2 + Vue 3 构建，安装包仅约 3 MB，开箱即用，支持中英双语与深色模式。

## ✨ 功能特性

### JSON 格式化工具

- **自动修复非标准写法**：自动识别并修复单引号字符串/键名、尾随逗号、裸键（缺引号键名）、`//` 与 `/* */` 注释、十六进制/八进制/二进制数字字面量、字符串内未转义的控制字符、`undefined`/`NaN`/`Infinity` 等非 JSON 值，修复后给出完整提示
- **修复项独立开关**：宽容语法、非 JSON 值、进制字面量三类修复可单独开关（默认全开）
- **输出编辑同步**：格式化结果可直接编辑，修改自动同步回原始输入
- **代码折叠**：编辑器式折叠体验，对象/数组块行首箭头一键折叠/展开
- **语法高亮**：键名、字符串、数字、关键字四类 token 着色，适配明暗主题
- **一键操作**：格式化、压缩、按键排序、复制结果、载入示例，输入自动预览

### 时间戳转换工具

- **当前时间戳**：秒/毫秒级实时显示，一键复制
- **双向转换**：时间戳 → 日期时间（秒/毫秒/微秒精度自动识别），日期时间 → 时间戳
- **多格式输出**：本地时间、UTC 时间、ISO 8601、本地 ISO、距今（相对时间）
- **日期选择器**：可视化选日期时间，自动换算时间戳

### 文本对比工具

- **行级 Diff**：左右双列对比，删除/新增/修改行分色标记
- **词级高亮**：修改行内精确标记被替换片段
- **实时对比**：输入自动对比（300ms 防抖），完全一致时绿色卡片提示

### 图片压缩转换工具

- **格式互转**：PNG / JPG / WebP 三格式一键互转
- **质量压缩**：0-100 质量滑块（JPEG / WebP），压缩率实时显示
- **等比缩放**：1-200% 百分比缩放，EXIF 方向自动校正
- **批量处理**：最多 20 张拖拽导入，统一设置批量处理，单张保存或全部导出

### 优秀开源软件推荐

- **精选软件**：Clash Verge Rev / Motrix / MusicFree / Notepad++ 等社区验证的优秀开源项目
- **一键直达**：系统浏览器打开 GitHub 项目页，或复制项目链接

### 快捷键管理

- **全局快捷键**：应用后台或最小化时依然生效，每个工具预设一个快捷键，按下即唤起窗口并直达工具页（`Alt+J` JSON / `Alt+T` 时间戳 / `Alt+D` 对比 / `Alt+I` 图片 / `Alt+R` 推荐 / `Alt+K` 快捷键管理 / `Alt+Space` 唤起主窗口）
- **可视化修改**：录制式修改组合键，实时生效并持久化；冲突检测、单条重置与全部重置

### 通用能力

- **中英双语**：一键切换语言，界面文案与组件文案全量跟随，选择持久化
- **深色模式**：太阳/月亮一键切换，全界面明暗适配
- **状态保留**：切换工具页面后输入内容与设置原样恢复
- **全局快捷键**：每个工具预设快捷键（可自定义），后台也能一键直达

## 📥 下载安装

从 [GitHub Releases](https://github.com/ArvinLiubaby/DevKit/releases) 下载对应平台安装包：

| 平台 | 安装包 | 说明 |
| --- | --- | --- |
| Windows | [DevKit_0.3.0_x64-setup.exe](https://github.com/ArvinLiubaby/DevKit/releases/latest/download/DevKit_0.3.0_x64-setup.exe) | NSIS 安装包，免管理员安装，支持应用内自动更新 |
| Linux | [DevKit_0.3.0_amd64.deb](https://github.com/ArvinLiubaby/DevKit/releases/latest/download/DevKit_0.3.0_amd64.deb) | 适用于 Debian/Ubuntu 系发行版，需安装 libwebkit2gtk-4.1-0 / libgtk-3-0 / librsvg2-2 |

安装后可通过 **应用内自动更新** 获取新版本（新版本发布后自动检测更新）。

## 🚀 使用说明

启动应用后，在侧边栏选择工具：

1. **JSON 格式化**：粘贴或输入 JSON 文本（支持各种非标准写法）→ 自动格式化并高亮展示 → 可折叠/展开任意层级 → 可直接编辑输出并同步回输入 → 一键复制
2. **时间戳转换**：查看并复制当前时间戳 → 输入时间戳或日期时间，双向即时转换
3. **文本对比**：两侧粘贴文本，自动对比并高亮差异行/词
4. **图片压缩转换**：拖入图片 → 选择目标格式 / 质量 / 缩放 → 实时预览压缩效果 → 单张保存或全部导出
5. **优秀开源软件**：浏览精选开源项目卡片 → 一键打开 GitHub 项目页或复制链接
6. **快捷键**：查看全部全局快捷键 → 点击"修改"后直接按下新组合键，实时生效并持久化

> 提示：应用最小化或后台运行时，按下任意工具快捷键（如 `Alt+J`）即可唤起窗口并直达对应工具页。

## 🛠️ 开发指南

### 环境要求

- [Node.js](https://nodejs.org/) 22+（推荐 22 LTS 或更新版本）
- [Rust](https://www.rust-lang.org/) stable
- **Windows**：[Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含 WebView2）
- **Linux**：`libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、`librsvg2-dev`、`patchelf`

### 常用命令

```bash
npm install          # 安装依赖
npm run tauri dev    # 开发模式（热更新）
npm run tauri build  # 构建安装包（Windows: NSIS / Linux: deb）
npm run lint         # 代码检查
```

### 发布流程

推送版本 tag（如 `v0.1.0`）自动触发 [GitHub Actions](.github/workflows/release.yml) 矩阵构建：

- Windows → NSIS 安装包（含签名）
- Linux → deb 安装包
- 自动生成 `latest.json` 更新清单并创建 GitHub Release

> 发布前需在仓库 Secrets 配置 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（自动更新签名密钥）。

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | [Tauri 2](https://tauri.app/)（Rust） |
| 前端 | [Vue 3.5](https://vuejs.org/) + [Naive UI](https://www.naiveui.com/) + Pinia + Vue Router |
| 国际化 | [vue-i18n](https://vue-i18n.intlify.dev/)（中英双语） |
| 构建 | Vite + TypeScript |

## 📁 目录结构

```
src/
├── tools/          # 工具模块（注册表驱动，懒加载）
│   ├── json/       # JSON 格式化工具（core 逻辑 / highlight 高亮 / 视图）
│   ├── timestamp/  # 时间戳转换工具
│   ├── diff/       # 文本对比工具
│   ├── image/      # 图片压缩转换工具（core 逻辑 / store 状态 / 视图）
│   ├── recommend/  # 优秀开源软件推荐工具
│   └── shortcut/   # 快捷键管理工具（配套 src-tauri/src/shortcuts.rs）
├── locales/        # 语言包（zh-CN / en-US）
├── i18n/           # vue-i18n 实例
├── stores/         # Pinia 状态（主题、语言、工具工作区）
└── ...
src-tauri/          # Tauri 后端（Rust，含全局快捷键管理 shortcuts.rs）
```

## 📄 开源协议

[MIT](LICENSE)
