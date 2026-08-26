# 对照实验：创建 DevKit2.lnk（与 DevKit.lnk 完全同目标），用于判断桌面图标缓存归属
$ErrorActionPreference = "Stop"
$target = "C:\Users\Creek\Desktop\DevKit2.lnk"
if (Test-Path $target) { Remove-Item $target -Force }
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($target)
$lnk.TargetPath = "D:\Users\Creek\AppData\Local\DevKit\devkit.exe"
$lnk.WorkingDirectory = "D:\Users\Creek\AppData\Local\DevKit"
$lnk.Description = "DevKit 对照测试"
$lnk.IconLocation = "D:\Users\Creek\AppData\Local\DevKit\devkit.exe,0"
$lnk.Save()
Write-Output "已创建 DevKit2.lnk"
