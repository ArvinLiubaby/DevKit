//! 全局快捷键管理：动作定义、解析 / 注册 / 注销、持久化与前端管理命令。
//! 快捷键字符串格式沿用 global_hotkey 的 FromStr 约定：修饰键在前（小写
//! control / alt / shift / super），主键使用 KeyboardEvent.code 同名键码
//! （KeyK / Digit1 / Space / F5 / ArrowUp …），如 "control+shift+KeyK"。

use std::collections::HashMap;
use std::sync::Mutex;

use global_hotkey::hotkey::{Code, HotKey as Shortcut, Modifiers};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_store::StoreExt;

/// 快捷键动作定义：新增动作只需在此追加一项并补全 handle() 分支
pub struct ActionDef {
    pub id: &'static str,
    pub default_key: &'static str,
    /// 前端路由路径；空串表示无页面（如唤起主窗口）
    pub path: &'static str,
}

/// 内置动作：每个工具一个全局快捷键，按下后唤起主窗口并跳转对应工具页
/// macOS 默认用 Command（super）修饰键，其余平台用 Alt（Option/Alt 在 macOS 会输入特殊字符）
pub const ACTIONS: [ActionDef; 7] = [
    ActionDef {
        id: "toggleWindow",
        default_key: "alt+Space",
        path: "",
    },
    ActionDef {
        id: "jsonFormatter",
        default_key: if cfg!(target_os = "macos") { "super+J" } else { "alt+J" },
        path: "/tools/json-formatter",
    },
    ActionDef {
        id: "timestampConverter",
        default_key: if cfg!(target_os = "macos") { "super+T" } else { "alt+T" },
        path: "/tools/timestamp-converter",
    },
    ActionDef {
        id: "textDiff",
        default_key: if cfg!(target_os = "macos") { "super+D" } else { "alt+D" },
        path: "/tools/text-diff",
    },
    ActionDef {
        id: "imageConverter",
        default_key: if cfg!(target_os = "macos") { "super+I" } else { "alt+I" },
        path: "/tools/image-converter",
    },
    ActionDef {
        id: "ossRecommend",
        default_key: if cfg!(target_os = "macos") { "super+R" } else { "alt+R" },
        path: "/tools/oss-recommend",
    },
    ActionDef {
        id: "shortcutManager",
        default_key: if cfg!(target_os = "macos") { "super+K" } else { "alt+K" },
        path: "/tools/shortcuts",
    },
];

/// 快捷键管理器：action id -> 当前快捷键（与系统注册保持同步）
pub struct ShortcutManager {
    map: Mutex<HashMap<String, Shortcut>>,
}

impl ShortcutManager {
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutInfo {
    id: String,
    key: String,
    default_key: String,
}

/* ------------------------------------------------------------------ */
/* 注册 / 注销                                                         */
/* ------------------------------------------------------------------ */

/// 启动时加载持久化配置并注册全部动作（单个失败不影响其他动作）
pub fn register_all(app: &AppHandle, manager: &ShortcutManager) {
    let saved = load_saved(app);
    let mut map = manager.map.lock().unwrap();
    for action in ACTIONS {
        let key_str = saved
            .get(action.id)
            .cloned()
            .unwrap_or_else(|| action.default_key.to_string());
        let Ok(shortcut) = key_str.parse::<Shortcut>() else {
            eprintln!("[devkit] 快捷键 {key_str} 解析失败，使用默认值 {}", action.default_key);
            continue;
        };
        if let Err(err) = register_action(app, &action, shortcut) {
            eprintln!("[devkit] 快捷键注册失败 ({}): {err}", action.id);
            continue;
        }
        map.insert(action.id.to_string(), shortcut);
    }
}

fn register_action(app: &AppHandle, action: &ActionDef, shortcut: Shortcut) -> Result<(), String> {
    let id = action.id;
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                handle_action(id, app);
            }
        })
        .map_err(|e| e.to_string())
}

fn handle_action(id: &str, app: &AppHandle) {
    // 先唤起主窗口（可能隐藏 / 最小化），再导航到对应工具页
    show_main_window(app);
    if id == "toggleWindow" {
        // 主窗口唤起：回到首页并聚焦搜索框
        let _ = app.emit("devkit://focus-search", ());
    } else if let Some(action) = ACTIONS.iter().find(|a| a.id == id) {
        if !action.path.is_empty() {
            let _ = app.emit("devkit://navigate", action.path);
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/* ------------------------------------------------------------------ */
/* 解析 / 格式化                                                       */
/* ------------------------------------------------------------------ */

/// 快捷键的可读展示：Ctrl+Alt+Shift+K / Alt+Space 风格
fn format_key(shortcut: &Shortcut) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mods = shortcut.mods;
    if mods.contains(Modifiers::CONTROL) {
        parts.push("Ctrl".to_string());
    }
    if mods.contains(Modifiers::ALT) {
        parts.push("Alt".to_string());
    }
    if mods.contains(Modifiers::SHIFT) {
        parts.push("Shift".to_string());
    }
    if mods.contains(Modifiers::SUPER) {
        parts.push("Super".to_string());
    }
    parts.push(code_label(shortcut.key));
    parts.join("+")
}

fn code_label(code: Code) -> String {
    let s = format!("{code:?}");
    // KeyK -> K、Digit1 -> 1
    if let Some(rest) = s.strip_prefix("Key") {
        if rest.len() == 1 {
            return rest.to_string();
        }
    }
    if let Some(rest) = s.strip_prefix("Digit") {
        if rest.len() == 1 {
            return rest.to_string();
        }
    }
    match s.as_str() {
        "Escape" => "Esc".to_string(),
        "Backquote" => "`".to_string(),
        "Minus" => "-".to_string(),
        "Equal" => "=".to_string(),
        "BracketLeft" => "[".to_string(),
        "BracketRight" => "]".to_string(),
        "Backslash" => "\\".to_string(),
        "Semicolon" => ";".to_string(),
        "Quote" => "'".to_string(),
        "Comma" => ",".to_string(),
        "Period" => ".".to_string(),
        "Slash" => "/".to_string(),
        _ => s,
    }
}

/* ------------------------------------------------------------------ */
/* 持久化（tauri-plugin-store，settings.json 的 shortcuts 字段）        */
/* ------------------------------------------------------------------ */

const STORE_FILE: &str = "settings.json";
const SHORTCUTS_KEY: &str = "shortcuts";

fn load_saved(app: &AppHandle) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let Ok(store) = app.store(STORE_FILE) else {
        return out;
    };
    let Some(value) = store.get(SHORTCUTS_KEY) else {
        return out;
    };
    let Some(obj) = value.as_object() else {
        return out;
    };
    for (k, v) in obj {
        if let Some(s) = v.as_str() {
            out.insert(k.clone(), s.to_string());
        }
    }
    out
}

fn save_all(app: &AppHandle, map: &HashMap<String, Shortcut>) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let mut obj = serde_json::Map::new();
    for (id, shortcut) in map {
        obj.insert(id.clone(), serde_json::Value::String(format_key(shortcut)));
    }
    store.set(SHORTCUTS_KEY, serde_json::Value::Object(obj));
    store.save().map_err(|e| e.to_string())
}

/* ------------------------------------------------------------------ */
/* Tauri 命令（前端管理页调用）                                         */
/* ------------------------------------------------------------------ */

fn collect_infos(map: &HashMap<String, Shortcut>) -> Vec<ShortcutInfo> {
    ACTIONS
        .iter()
        .map(|a| ShortcutInfo {
            id: a.id.to_string(),
            key: map
                .get(a.id)
                .map(format_key)
                .unwrap_or_else(|| a.default_key.to_string()),
            default_key: a
                .default_key
                .parse::<Shortcut>()
                .map(|s| format_key(&s))
                .unwrap_or_else(|_| a.default_key.to_string()),
        })
        .collect()
}

#[tauri::command]
pub fn list_shortcuts(state: State<'_, ShortcutManager>) -> Vec<ShortcutInfo> {
    let map = state.map.lock().unwrap();
    collect_infos(&map)
}

#[tauri::command]
pub fn update_shortcut(
    app: AppHandle,
    state: State<'_, ShortcutManager>,
    id: String,
    key: String,
) -> Result<Vec<ShortcutInfo>, String> {
    let action = ACTIONS
        .iter()
        .find(|a| a.id == id)
        .ok_or_else(|| format!("unknown shortcut action: {id}"))?;
    let shortcut: Shortcut = key.parse().map_err(|e: global_hotkey::hotkey::HotKeyParseError| e.to_string())?;
    let mut map = state.map.lock().unwrap();
    // 冲突检测：同一组合键不允许绑定到两个动作
    if let Some((other_id, _)) = map.iter().find(|(k, sc)| *k != &id && **sc == shortcut) {
        return Err(format!("shortcut conflict with {other_id}"));
    }
    if let Some(old) = map.get(&id) {
        let _ = app.global_shortcut().unregister(*old);
    }
    register_action(&app, action, shortcut)?;
    map.insert(id, shortcut);
    save_all(&app, &map)?;
    Ok(collect_infos(&map))
}

#[tauri::command]
pub fn reset_shortcut(
    app: AppHandle,
    state: State<'_, ShortcutManager>,
    id: String,
) -> Result<Vec<ShortcutInfo>, String> {
    let action = ACTIONS
        .iter()
        .find(|a| a.id == id)
        .ok_or_else(|| format!("unknown shortcut action: {id}"))?;
    let default: Shortcut = action
        .default_key
        .parse()
        .map_err(|e: global_hotkey::hotkey::HotKeyParseError| e.to_string())?;
    let mut map = state.map.lock().unwrap();
    if let Some(old) = map.get(&id) {
        let _ = app.global_shortcut().unregister(*old);
    }
    register_action(&app, action, default)?;
    map.insert(id, default);
    save_all(&app, &map)?;
    Ok(collect_infos(&map))
}

#[tauri::command]
pub fn reset_all_shortcuts(
    app: AppHandle,
    state: State<'_, ShortcutManager>,
) -> Result<Vec<ShortcutInfo>, String> {
    let mut map = state.map.lock().unwrap();
    for shortcut in map.values() {
        let _ = app.global_shortcut().unregister(*shortcut);
    }
    map.clear();
    for action in ACTIONS {
        let default: Shortcut = action
            .default_key
            .parse()
            .map_err(|e: global_hotkey::hotkey::HotKeyParseError| e.to_string())?;
        register_action(&app, &action, default)?;
        map.insert(action.id.to_string(), default);
    }
    save_all(&app, &map)?;
    Ok(collect_infos(&map))
}
