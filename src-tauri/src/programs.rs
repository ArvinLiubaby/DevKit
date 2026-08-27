use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// 可启动程序条目（Windows: 开始菜单/桌面快捷方式；Linux: applications 目录 .desktop）
#[derive(Serialize, Clone)]
pub struct ProgramEntry {
    pub name: String,
    pub path: String,
}

/// 进程内缓存：扫描一次即可，程序列表在应用生命周期内视为不变
static CACHE: Mutex<Option<Vec<ProgramEntry>>> = Mutex::new(None);

#[tauri::command]
pub fn list_programs() -> Vec<ProgramEntry> {
    if let Some(cache) = CACHE.lock().unwrap().as_ref() {
        return cache.clone();
    }
    let entries = scan_programs();
    *CACHE.lock().unwrap() = Some(entries.clone());
    entries
}

#[tauri::command]
pub fn launch_program(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // UWP/Store 应用（path 为 shell:AppsFolder\AUMID）：系统按 AppUserModelID 激活已有实例
        if path.starts_with("shell:AppsFolder\\") {
            return shell_execute(&path);
        }
        // 激活优先：解析 .lnk 目标 exe，若其已有可见主窗口则直接激活（微信/Edge 等不再新开实例），
        // 否则回退 ShellExecuteW（等价双击）启动
        let exe = resolve_lnk_target(&path).or_else(|| {
            if path.to_lowercase().ends_with(".exe") {
                Some(path.clone())
            } else {
                None
            }
        });
        if let Some(exe_path) = exe {
            if let Some(hwnd) = find_visible_window(&exe_path) {
                activate_window(hwnd);
                return Ok(());
            }
        }
        shell_execute(&path)?;
    }
    #[cfg(target_os = "linux")]
    {
        // xdg-open 打开 .desktop 文件会执行其 Exec 行，等价于从应用菜单启动
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = path;
        return Err("unsupported platform".into());
    }
    Ok(())
}

/// 提取程序图标（Windows）：IShellItemImageFactory → 32bpp 像素 → BMP 文件字节
/// 对 .lnk/.exe/Store 应用（shell:AppsFolder\AUMID）均适用；失败返回 None（前端回退首字母头像）
#[tauri::command]
pub fn get_program_icon(path: String) -> Option<Vec<u8>> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::{Interface, PCWSTR};
        use windows::Win32::Foundation::SIZE;
        use windows::Win32::Graphics::Gdi::{
            BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CreateCompatibleDC, DeleteDC, DeleteObject,
            DIB_RGB_COLORS, GetDIBits, GetObjectW, HGDIOBJ, SelectObject,
        };
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
        use windows::Win32::UI::Shell::{
            IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
            SIIGBF_ICONONLY,
        };
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED); // 幂等
            let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
            let Ok(item) = SHCreateItemFromParsingName::<_, _, IShellItem>(PCWSTR(wide.as_ptr()), None) else {
                return None;
            };
            let Ok(factory) = item.cast::<IShellItemImageFactory>() else {
                return None;
            };
            // 请求 48x48（ICONONLY 保证纯图标，不带文件边框等附加元素）
            let Ok(hbitmap) = factory.GetImage(SIZE { cx: 48, cy: 48 }, SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK) else {
                return None;
            };
            let mut bmp: BITMAP = std::mem::zeroed();
            let obj_bytes = GetObjectW(
                HGDIOBJ(hbitmap.0),
                std::mem::size_of::<BITMAP>() as i32,
                Some(&mut bmp as *mut _ as *mut core::ffi::c_void),
            );
            if obj_bytes == 0 || bmp.bmWidth <= 0 || bmp.bmHeight == 0 {
                let _ = DeleteObject(HGDIOBJ(hbitmap.0));
                return None;
            }
            let w = bmp.bmWidth;
            let h = bmp.bmHeight.abs();
            // 拷贝像素到 32bpp BGRA（负高度 = 自顶向下，BMP 标准行序）
            let dc = CreateCompatibleDC(None);
            if dc.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(hbitmap.0));
                return None;
            }
            let _ = SelectObject(dc, HGDIOBJ(hbitmap.0));
            let mut bmi: BITMAPINFO = std::mem::zeroed();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bmi.bmiHeader.biWidth = w;
            bmi.bmiHeader.biHeight = -h;
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;
            let mut pixels = vec![0u8; (w * h * 4) as usize];
            let copied = GetDIBits(
                dc,
                hbitmap,
                0,
                h as u32,
                Some(pixels.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );
            let _ = DeleteDC(dc);
            let _ = DeleteObject(HGDIOBJ(hbitmap.0));
            if copied == 0 {
                return None;
            }
            // 防御：若 alpha 全为 0（GDI 未填充），置 255 避免整图全透明
            let mut has_alpha = false;
            for px in pixels.chunks_exact(4) {
                if px[3] != 0 {
                    has_alpha = true;
                    break;
                }
            }
            if !has_alpha {
                for px in pixels.chunks_exact_mut(4) {
                    px[3] = 255;
                }
            }
            // 组装 BMP 文件（BITMAPFILEHEADER 14B + BITMAPINFOHEADER 40B + BGRA 像素）
            let data_size = (w * h * 4) as u32;
            let file_size = 14 + 40 + data_size;
            let mut out = Vec::with_capacity(file_size as usize);
            out.extend_from_slice(b"BM");
            out.extend_from_slice(&file_size.to_le_bytes());
            out.extend_from_slice(&[0u8; 4]); // 保留字段
            out.extend_from_slice(&54u32.to_le_bytes()); // 像素偏移
            out.extend_from_slice(&40u32.to_le_bytes()); // biSize
            out.extend_from_slice(&w.to_le_bytes());
            out.extend_from_slice(&(-h).to_le_bytes());
            out.extend_from_slice(&1u16.to_le_bytes()); // planes
            out.extend_from_slice(&32u16.to_le_bytes()); // bitcount
            out.extend_from_slice(&BI_RGB.0.to_le_bytes());
            out.extend_from_slice(&data_size.to_le_bytes());
            out.extend_from_slice(&[0u8; 16]); // 分辨率 + 调色板
            out.extend_from_slice(&pixels);
            Some(out)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        None
    }
}

fn scan_programs() -> Vec<ProgramEntry> {
    // 同名去重：用户目录优先（后写入覆盖先写入）
    let mut by_name: HashMap<String, String> = HashMap::new();

    #[cfg(target_os = "windows")]
    {
        let mut dirs: Vec<PathBuf> = Vec::new();
        if let Ok(appdata) = std::env::var("APPDATA") {
            dirs.push(PathBuf::from(appdata).join("Microsoft/Windows/Start Menu/Programs"));
        }
        if let Ok(progdata) = std::env::var("PROGRAMDATA") {
            dirs.push(PathBuf::from(progdata).join("Microsoft/Windows/Start Menu/Programs"));
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            dirs.push(PathBuf::from(profile).join("Desktop"));
        }
        dirs.push(PathBuf::from(r"C:\Users\Public\Desktop"));
        for dir in dirs {
            scan_lnk(&dir, &mut by_name);
        }
        // Store（UWP）应用没有 .lnk 快捷方式，需单独枚举 AppsFolder 虚拟文件夹
        scan_store_apps(&mut by_name);
    }

    #[cfg(target_os = "linux")]
    {
        let mut dirs = vec![
            PathBuf::from("/usr/share/applications"),
            PathBuf::from("/usr/local/share/applications"),
        ];
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(home).join(".local/share/applications"));
        }
        for dir in dirs {
            scan_desktop(&dir, &mut by_name);
        }
    }

    let mut out: Vec<ProgramEntry> = by_name
        .into_iter()
        .map(|(name, path)| ProgramEntry { name, path })
        .collect();
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

/// 递归扫描快捷方式目录（Windows）
#[cfg(target_os = "windows")]
fn scan_lnk(dir: &Path, by_name: &mut HashMap<String, String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            scan_lnk(&p, by_name);
            continue;
        }
        let Some(ext) = p.extension() else {
            continue;
        };
        if !ext.eq_ignore_ascii_case("lnk") && !ext.eq_ignore_ascii_case("exe") {
            continue;
        }
        let Some(stem) = p.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if stem.is_empty() {
            continue;
        }
        // 过滤卸载类快捷方式（“卸载微信”/“Uninstall WeChat”等），搜索应用时不应出现卸载项
        let lower = stem.to_lowercase();
        if lower.contains("uninstall") || stem.contains("卸载") {
            continue;
        }
        by_name.insert(stem.to_string(), p.to_string_lossy().into_owned());
    }
}

/// 枚举 Windows 应用商店（UWP）应用：AppsFolder 虚拟文件夹 → 显示名 + AUMID
/// Store 应用无传统 .lnk 快捷方式（如 Watt Toolkit 商店版），不枚举则搜索不到
#[cfg(target_os = "windows")]
fn scan_store_apps(by_name: &mut HashMap<String, String>) {
    use windows::core::PCWSTR;
    use windows::Win32::System::Com::{CoInitializeEx, CoTaskMemFree, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        BHID_EnumItems, IEnumShellItems, IShellItem, SHCreateItemFromParsingName, SIGDN_NORMALDISPLAY,
        SIGDN_PARENTRELATIVEPARSING,
    };
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED); // 幂等
        // 1) 直接解析 shell:AppsFolder 虚拟文件夹路径
        //    注意：SHGetKnownFolderPath 对 AppsFolder 虚拟文件夹会返回 E_FAIL，必须用字符串路径解析
        let wide: Vec<u16> = "shell:AppsFolder"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let Ok(root) = SHCreateItemFromParsingName::<_, _, IShellItem>(PCWSTR(wide.as_ptr()), None) else {
            return;
        };
        let Ok(enumerator) = root.BindToHandler::<_, IEnumShellItems>(None, &BHID_EnumItems) else {
            return;
        };
        loop {
            let mut buf = [None; 1];
            if enumerator.Next(&mut buf, None).is_err() {
                break;
            }
            let Some(item) = buf[0].take() else {
                break; // 枚举结束（S_FALSE 不填充元素）
            };
            // 3) 显示名（系统已本地化）
            let Ok(name_ptr) = item.GetDisplayName(SIGDN_NORMALDISPLAY) else {
                continue;
            };
            let name = name_ptr.to_string().unwrap_or_default();
            let _ = CoTaskMemFree(Some(name_ptr.0 as *const _));
            if name.is_empty() {
                continue;
            }
            // 4) 相对解析名即 AUMID（如 SteamTools.WattToolkit_xxx!App），仅收录含 '!' 的 UWP 应用
            let Ok(aumid_ptr) = item.GetDisplayName(SIGDN_PARENTRELATIVEPARSING) else {
                continue;
            };
            let aumid = aumid_ptr.to_string().unwrap_or_default();
            let _ = CoTaskMemFree(Some(aumid_ptr.0 as *const _));
            if aumid.is_empty() || !aumid.contains('!') {
                continue;
            }
            // 5) 已有同名桌面版快捷方式则保留原项，Store 版只补漏
            by_name.entry(name).or_insert_with(|| format!("shell:AppsFolder\\{aumid}"));
        }
    }
}

/// 解析 .lnk 快捷方式，返回目标 exe 完整路径（ShellExecute 回退用）
#[cfg(target_os = "windows")]
fn shell_execute(path: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR::null(),
            PCWSTR(wide.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    // 返回值小于等于 32 为错误码（SE_ERR_*）
    if (result.0 as isize) <= 32 {
        return Err(format!("ShellExecute failed with code {}", result.0 as isize));
    }
    Ok(())
}

/// 解析 .lnk 的目标 exe 路径（IShellLinkW）；非 lnk 返回 None
#[cfg(target_os = "windows")]
fn resolve_lnk_target(lnk: &str) -> Option<String> {
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, IPersistFile, STGM_READ};
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED); // 幂等，忽略模式冲突
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
        let file: IPersistFile = link.cast().ok()?;
        let wide: Vec<u16> = lnk.encode_utf16().chain(std::iter::once(0)).collect();
        file.Load(PCWSTR(wide.as_ptr()), STGM_READ).ok()?;
        let mut buf = vec![0u16; 1024];
        let mut find_data: windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW = std::mem::zeroed();
        link.GetPath(&mut buf, &mut find_data, 0).ok()?;
        let len = buf.iter().position(|&c| c == 0)?;
        let target = String::from_utf16_lossy(&buf[..len]);
        if target.is_empty() {
            None
        } else {
            Some(target)
        }
    }
}

/// 查找目标 exe 的可见主窗口（Z 序最前优先）
#[cfg(target_os = "windows")]
fn find_visible_window(exe_path: &str) -> Option<windows::Win32::Foundation::HWND> {
    use std::collections::HashSet;
    use windows::core::{BOOL, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM};
    use windows::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW};
    use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, IsWindowVisible};

    // 收集目标 exe 对应的全部 pid（按完整路径匹配，避免同名 exe 误伤）
    let mut pids = HashSet::new();
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return None;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut ok = Process32FirstW(snapshot, &mut entry).is_ok();
        while ok {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, entry.th32ProcessID) {
                let mut buf = vec![0u16; 1024];
                let mut len = 1024u32;
                if QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok() {
                    let path = String::from_utf16_lossy(&buf[..len as usize]);
                    if path.eq_ignore_ascii_case(exe_path) {
                        pids.insert(entry.th32ProcessID);
                    }
                }
                let _ = CloseHandle(handle);
            }
            ok = Process32NextW(snapshot, &mut entry).is_ok();
        }
        let _ = CloseHandle(snapshot);
    }
    if pids.is_empty() {
        return None;
    }

    // 枚举窗口（EnumWindows 按 Z 序从最前开始），取第一个属于目标进程的可见窗口
    struct FindCtx<'a> {
        pids: &'a HashSet<u32>,
        found: Option<HWND>,
    }
    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam.0 as *mut FindCtx);
        let mut pid = 0u32;
        let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if ctx.pids.contains(&pid) && IsWindowVisible(hwnd).as_bool() {
            ctx.found = Some(hwnd);
            return BOOL(0); // 停止枚举
        }
        BOOL(1)
    }
    let mut ctx = FindCtx { pids: &pids, found: None };
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut ctx as *mut _ as isize));
    }
    ctx.found
}

/// 激活已有窗口：还原最小化 + 模拟 Alt 绕过前台锁后置前
#[cfg(target_os = "windows")]
fn activate_window(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, SendInput, VK_MENU,
    };
    use windows::Win32::UI::WindowsAndMessaging::{SetForegroundWindow, ShowWindow, SW_RESTORE};
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        // 后台进程 SetForegroundWindow 受前台锁限制：成对模拟 Alt 按下+弹起解除
        // 注意必须成对发送（DOWN 后立即 UP）！只按下不弹起会导致系统键盘状态卡在
        // Alt 按住，之后所有按键都会变成 Alt+组合键（菜单/快捷键错乱）
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_MENU,
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_MENU,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        let _ = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        let _ = SetForegroundWindow(hwnd);
    }
}

/// 解析 .desktop 文件（Linux）：取 Name= 显示名，跳过 NoDisplay 隐藏项
#[cfg(target_os = "linux")]
fn scan_desktop(dir: &Path, by_name: &mut HashMap<String, String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().map_or(true, |e| e != "desktop") {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&p) else {
            continue;
        };
        let mut name = None;
        let mut hidden = false;
        for line in content.lines() {
            let line = line.trim();
            if let Some(v) = line.strip_prefix("Name=") {
                if name.is_none() {
                    name = Some(v.to_string());
                }
            } else if line == "NoDisplay=true" {
                hidden = true;
            }
        }
        if hidden {
            continue;
        }
        if let Some(n) = name {
            if !n.is_empty() {
                by_name.insert(n, p.to_string_lossy().into_owned());
            }
        }
    }
}
