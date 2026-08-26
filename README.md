# DevKit

![Release](https://img.shields.io/github/v/release/ArvinLiubaby/DevKit) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green) ![Downloads](https://img.shields.io/github/downloads/ArvinLiubaby/DevKit/total)

**本地优先、离线可用、跨平台的开发者效率工具集。** 基于 Tauri 2 + Vue 3 构建，安装包仅约 3 MB，开箱即用。

## ✨ 功能特性

### JSON 格式化工具

- **自动修复非标准写法**：自动识别并修复单引号字符串/键名、尾随逗号、裸键（缺引号键名）、`//` 与 `/* */` 注释、十六进制/八进制/二进制数字字面量、字符串内未转义的控制字符、`undefined`/`NaN`/`Infinity` 等非 JSON 值，修复后给出完整提示
- **修复项独立开关**：宽容语法、非 JSON 值、进制字面量三类修复可单独开关（默认全开）
- **代码折叠**：编辑器式折叠体验，对象/数组块行首箭头一键折叠/展开
- **语法高亮**：键名、字符串、数字、关键字四类 token 着色，适配明暗主题
- **一键操作**：格式化、压缩、按键排序、复制结果、载入示例，输入自动预览

## 📥 下载安装

从 [GitHub Releases](https://github.com/ArvinLiubaby/DevKit/releases) 下载对应平台安装包：

| 平台 | 安装包 | 说明 |
| --- | --- | --- |
| Windows | [DevKit_0.1.0_x64-setup.exe](https://github.com/ArvinLiubaby/DevKit/releases/latest/download/DevKit_0.1.0_x64-setup.exe) | NSIS 安装包，免管理员安装，支持应用内自动更新 |
| Linux | [DevKit_0.1.0_amd64.deb](https://github.com/ArvinLiubaby/DevKit/releases/latest/download/DevKit_0.1.0_amd64.deb) | 适用于 Debian/Ubuntu 系发行版（CI 构建中，发布后立即可用） |

安装后可通过 **应用内自动更新** 获取新版本（新版本发布后自动检测更新）。

## 🚀 使用说明

启动应用后，在侧边栏选择工具：

1. **JSON 格式化**：粘贴或输入 JSON 文本（支持各种非标准写法）→ 自动格式化并高亮展示 → 可折叠/展开任意层级 → 一键复制
2. 更多工具持续开发中（剪贴板、时间戳转换、Base64 编解码等）

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
| 构建 | Vite + TypeScript |

## 📁 目录结构

```
src/
├── tools/          # 工具模块（注册表驱动，懒加载）
│   └── json/       # JSON 格式化工具（core 逻辑 / highlight 高亮 / 视图）
├── stores/         # Pinia 状态（主题等）
└── ...
src-tauri/          # Tauri 后端（Rust）
```

## 📄 开源协议

[MIT](LICENSE)
