# 终极对照：用 .ico 文件作为图标源（绕过 exe 图标提取），创建 DevKit3.lnk
$ErrorActionPreference = "Stop"
$instDir = "D:\Users\Creek\AppData\Local\DevKit"

# 1. 复制新图标到安装目录
Copy-Item "d:\project\py\DevKit\src-tauri\icons\icon.ico" "$instDir\icon.ico" -Force
Write-Output "icon.ico 已复制到安装目录"

# 2. 创建 DevKit3.lnk，图标直接指向 .ico 文件
$target = "C:\Users\Creek\Desktop\DevKit3.lnk"
if (Test-Path $target) { Remove-Item $target -Force }
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($target)
$lnk.TargetPath = "$instDir\devkit.exe"
$lnk.WorkingDirectory = "$instDir"
$lnk.Description = "DevKit 图标文件对照"
$lnk.IconLocation = "$instDir\icon.ico,0"
$lnk.Save()
Write-Output "已创建 DevKit3.lnk（图标源 = icon.ico 文件）"
