import type { Component } from "vue";
import jsonIcon from "../assets/icons/json.svg";
import timeIcon from "../assets/icons/time.svg";
import textIcon from "../assets/icons/text.svg";

/**
 * 工具模块元数据：注册表驱动路由与侧边栏菜单。
 * 新增工具只需：在 tools/ 下建模块目录，然后在下方数组中注册一项。
 */
export interface ToolMeta {
  /** 唯一 ID（同时用作路由 name） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 分类（格式化 / 编解码 / 生成器 …），将来用于菜单分组 */
  category: string;
  /** 路由路径，如 /tools/json-formatter */
  path: string;
  /** 侧边栏菜单图标（SVG 资源） */
  icon: string;
  /** 一句话功能描述（首页卡片展示） */
  description: string;
  /** 懒加载组件 */
  component: () => Promise<Component>;
}

export const tools: ToolMeta[] = [
  {
    id: "json-formatter",
    name: "JSON 格式化",
    category: "格式化",
    path: "/tools/json-formatter",
    icon: jsonIcon,
    description: "格式化 / 压缩 / 键排序，非标准写法自动修复",
    component: () => import("./json/JsonToolView.vue"),
  },
  {
    id: "timestamp-converter",
    name: "时间戳转换",
    category: "转换",
    path: "/tools/timestamp-converter",
    icon: timeIcon,
    description: "Unix 时间戳与可读日期时间双向转换",
    component: () => import("./timestamp/TimestampToolView.vue"),
  },
  {
    id: "text-diff",
    name: "文本对比",
    category: "对比",
    path: "/tools/text-diff",
    icon: textIcon,
    description: "行级 Diff 对比，修改行词级高亮",
    component: () => import("./diff/DiffToolView.vue"),
  },
];
