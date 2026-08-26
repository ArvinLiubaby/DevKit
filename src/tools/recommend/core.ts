/**
 * 优秀开源软件 core：推荐清单静态数据（名称 / 仓库 / 描述 / 标签 i18n key）。
 * 描述与标签为双语 key（recommend.items.{id}.desc / .tag），由视图层翻译。
 */
export interface OpenSourceItem {
  /** 唯一 id（同时用作 i18n key 后缀） */
  id: string;
  /** 软件名称（专有名词，不翻译） */
  name: string;
  /** GitHub 仓库路径 owner/repo */
  repo: string;
  /** 描述 i18n key */
  descKey: string;
  /** 分类标签 i18n key */
  tagKey: string;
}

/** 推荐清单：社区验证过的优秀开源软件 */
export const RECOMMENDATIONS: OpenSourceItem[] = [
  {
    id: "clashVerge",
    name: "Clash Verge Rev",
    repo: "clash-verge-rev/clash-verge-rev",
    descKey: "recommend.items.clashVerge.desc",
    tagKey: "recommend.items.clashVerge.tag",
  },
  {
    id: "motrix",
    name: "Motrix",
    repo: "agalwood/Motrix",
    descKey: "recommend.items.motrix.desc",
    tagKey: "recommend.items.motrix.tag",
  },
  {
    id: "musicFree",
    name: "MusicFree",
    repo: "maotoumao/MusicFree",
    descKey: "recommend.items.musicFree.desc",
    tagKey: "recommend.items.musicFree.tag",
  },
  {
    id: "notepadPlusPlus",
    name: "Notepad++",
    repo: "notepad-plus-plus/notepad-plus-plus",
    descKey: "recommend.items.notepadPlusPlus.desc",
    tagKey: "recommend.items.notepadPlusPlus.tag",
  },
];

/** GitHub 项目页 URL */
export function repoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
