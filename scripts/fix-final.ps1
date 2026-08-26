# 修复 DevKit.lnk：图标源改为 icon.ico 文件（绕过 exe 图标提取缓存），并清理测试快捷方式
$ErrorActionPreference = "Stop"
$instDir = "D:\Users\Creek\AppData\Local\DevKit"

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut("C:\Users\Creek\Desktop\DevKit.lnk")
$lnk.IconLocation = "$instDir\icon.ico,0"
$lnk.Save()
Write-Output "DevKit.lnk 图标源已改为 icon.ico"

Remove-Item "C:\Users\Creek\Desktop\DevKit2.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Users\Creek\Desktop\DevKit3.lnk" -Force -ErrorAction SilentlyContinue
Write-Output "测试快捷方式已清理"
