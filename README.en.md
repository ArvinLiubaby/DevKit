# DevKit

[简体中文](README.md) | **English**

![Release](https://img.shields.io/github/v/release/ArvinLiubaby/DevKit) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green) ![Downloads](https://img.shields.io/github/downloads/ArvinLiubaby/DevKit/total)

**A local-first, offline, cross-platform developer toolbox.** Built with Tauri 2 + Vue 3, the installer is only ~3 MB and works out of the box. Supports Chinese/English bilingual UI and dark mode.

## ✨ Features

### JSON Formatter

- **Auto-fix non-standard syntax**: automatically detects and fixes single-quoted strings/keys, trailing commas, bare keys, `//` and `/* */` comments, hex/octal/binary numeric literals, unescaped control characters in strings, and non-JSON values such as `undefined`/`NaN`/`Infinity`, with a full fix report
- **Independent fix toggles**: loose syntax, non-JSON values, and radix literals can be toggled separately (all on by default)
- **Editable output with sync**: the formatted result can be edited directly, and changes sync back to the original input automatically
- **Code folding**: editor-style folding, one click on the arrow at the line start to collapse/expand object and array blocks
- **Syntax highlighting**: four token types (keys, strings, numbers, keywords) colored for both light and dark themes
- **One-click actions**: format, minify, sort keys, copy result, load sample, with instant preview as you type

### Timestamp Converter

- **Current timestamp**: second/millisecond precision displayed live, copy with one click
- **Bidirectional conversion**: timestamp → datetime (second/millisecond/microsecond auto-detected), datetime → timestamp
- **Multiple formats**: local time, UTC time, ISO 8601, local ISO, and elapsed time (relative)
- **Date picker**: pick a date/time visually and get the timestamp instantly

### Text Diff

- **Line-level diff**: side-by-side comparison with color-coded deleted/added/changed lines
- **Word-level highlighting**: precise marking of replaced fragments within changed lines
- **Live comparison**: diff runs automatically as you type (300ms debounce), with a green card when both sides are identical

### General

- **Bilingual UI**: switch between Chinese and English with one click; all UI and component texts follow, preference is persisted
- **Dark mode**: toggle between sun/moon with one click, fully adapted light/dark themes
- **State persistence**: input content and settings are restored when switching between tools

## 📥 Installation

Download the installer for your platform from [GitHub Releases](https://github.com/ArvinLiubaby/DevKit/releases):

| Platform | Installer | Notes |
| --- | --- | --- |
| Windows | [DevKit_0.2.0_x64-setup.exe](https://github.com/ArvinLiubaby/DevKit/releases/latest/download/DevKit_0.2.0_x64-setup.exe) | NSIS installer, no admin required, in-app auto-update supported |
| Linux | [DevKit_0.2.0_amd64.deb](https://github.com/ArvinLiubaby/DevKit/releases/latest/download/DevKit_0.2.0_amd64.deb) | For Debian/Ubuntu-based distros; requires libwebkit2gtk-4.1-0 / libgtk-3-0 / librsvg2-2 |

After installation, new versions are delivered via **in-app auto-update**.

## 🚀 Usage

Launch the app and pick a tool from the sidebar:

1. **JSON Formatter**: paste or type JSON (including non-standard syntax) → auto-format with highlighting → fold/expand any level → edit the output and sync back to the input → copy with one click
2. **Timestamp Converter**: view and copy the current timestamp → enter a timestamp or datetime for instant bidirectional conversion
3. **Text Diff**: paste text on both sides, differences are highlighted automatically at line and word level

More tools are under development (Base64 encode/decode, UUID generator, hash calculator, etc.).

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ (22 LTS or newer recommended)
- [Rust](https://www.rust-lang.org/) stable
- **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (includes WebView2)
- **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`, `patchelf`

### Common Commands

```bash
npm install          # install dependencies
npm run tauri dev    # development mode (hot reload)
npm run tauri build  # build installers (Windows: NSIS / Linux: deb)
npm run lint         # lint check
```

### Release Process

Pushing a version tag (e.g. `v0.1.0`) triggers the [GitHub Actions](.github/workflows/release.yml) matrix build:

- Windows → NSIS installer (signed)
- Linux → deb installer
- Auto-generates the `latest.json` update manifest and creates a GitHub Release

> Before releasing, configure `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the repository Secrets (auto-update signing keys).

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop framework | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend | [Vue 3.5](https://vuejs.org/) + [Naive UI](https://www.naiveui.com/) + Pinia + Vue Router |
| i18n | [vue-i18n](https://vue-i18n.intlify.dev/) (Chinese/English) |
| Build | Vite + TypeScript |

## 📁 Project Structure

```
src/
├── tools/          # Tool modules (registry-driven, lazy-loaded)
│   ├── json/       # JSON formatter (core logic / highlight / view)
│   ├── timestamp/  # Timestamp converter
│   └── diff/       # Text diff
├── locales/        # Locale packs (zh-CN / en-US)
├── i18n/           # vue-i18n instance
├── stores/         # Pinia state (theme, language, tool workspaces)
└── ...
src-tauri/          # Tauri backend (Rust)
```

## 📄 License

[MIT](LICENSE)
