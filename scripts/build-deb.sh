#!/bin/bash
# DevKit Linux deb 构建脚本（WSL 内执行）
# 用法: wsl -u root -- bash /mnt/d/project/py/DevKit/scripts/build-deb.sh
set -e
cd /root/devkit
export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/.tauri)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat .tauri-key-password.txt)"
npm run tauri build -- --bundles deb
