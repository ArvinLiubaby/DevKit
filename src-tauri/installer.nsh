; DevKit NSIS 安装钩子
; 桌面快捷方式图标显式指向安装目录的 icons\icon.ico 文件：
; 部分 Windows 系统对"从 exe 提取图标"存在顽固缓存，会导致桌面快捷方式一直显示旧图标。
; 安装/升级时删除并重建快捷方式，保证图标始终正确。
; 注意：Tauri 生成的 NSIS 脚本通过 NSIS_HOOK_POSTINSTALL 宏调用（在 Tauri 创建快捷方式之后执行）。

!macro NSIS_HOOK_POSTINSTALL
  Delete "$DESKTOP\DevKit.lnk"
  CreateShortCut "$DESKTOP\DevKit.lnk" "$INSTDIR\devkit.exe" "" "$INSTDIR\icons\icon.ico" 0
!macroend
