import type { Component } from "vue";
import jsonIcon from "../assets/icons/json.svg";
import timeIcon from "../assets/icons/time.svg";
import textIcon from "../assets/icons/text.svg";
import imageIcon from "../assets/icons/image.svg";
import githubIcon from "../assets/icons/github.svg";
import keyboardIcon from "../assets/icons/keyboard.svg";

/**
 * 工具模块元数据：注册表驱动路由与侧边栏菜单。
 * 新增工具只需：在 tools/ 下建模块目录，然后在下方数组中注册一项。
 */
export interface ToolMeta {
  /** 唯一 ID（同时用作路由 name） */
  id: string;
  /** 工具名 i18n key（如 tools.json.name） */
  nameKey: string;
  /** 分类（格式化 / 编解码 / 生成器 …），将来用于菜单分组 */
  category: string;
  /** 路由路径，如 /tools/json-formatter */
  path: string;
  /** 侧边栏菜单图标（SVG 资源） */
  icon: string;
  /** 一句话功能描述 i18n key（首页卡片展示） */
  descKey: string;
  /** 懒加载组件 */
  component: () => Promise<Component>;
}

export const tools: ToolMeta[] = [
  {
    id: "json-formatter",
    nameKey: "tools.json.name",
    category: "格式化",
    path: "/tools/json-formatter",
    icon: jsonIcon,
    descKey: "tools.json.desc",
    component: () => import("./json/JsonToolView.vue"),
  },
  {
    id: "timestamp-converter",
    nameKey: "tools.timestamp.name",
    category: "转换",
    path: "/tools/timestamp-converter",
    icon: timeIcon,
    descKey: "tools.timestamp.desc",
    component: () => import("./timestamp/TimestampToolView.vue"),
  },
  {
    id: "text-diff",
    nameKey: "tools.diff.name",
    category: "对比",
    path: "/tools/text-diff",
    icon: textIcon,
    descKey: "tools.diff.desc",
    component: () => import("./diff/DiffToolView.vue"),
  },
  {
    id: "image-converter",
    nameKey: "tools.image.name",
    category: "转换",
    path: "/tools/image-converter",
    icon: imageIcon,
    descKey: "tools.image.desc",
    component: () => import("./image/ImageToolView.vue"),
  },
  {
    id: "oss-recommend",
    nameKey: "tools.recommend.name",
    category: "推荐",
    path: "/tools/oss-recommend",
    icon: githubIcon,
    descKey: "tools.recommend.desc",
    component: () => import("./recommend/RecommendToolView.vue"),
  },
  {
    id: "shortcuts",
    nameKey: "tools.shortcut.name",
    category: "设置",
    path: "/tools/shortcuts",
    icon: keyboardIcon,
    descKey: "tools.shortcut.desc",
    component: () => import("./shortcut/ShortcutToolView.vue"),
  },
];
