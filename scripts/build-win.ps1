# DevKit Windows NSIS 打包脚本（PowerShell 中执行）
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content "d:\project\py\DevKit\src-tauri\.tauri" -Raw).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content "d:\project\py\DevKit\.tauri-key-password.txt" -Raw).Trim()
Set-Location "d:\project\py\DevKit"
npm run tauri build -- --bundles nsis
