/**
 * JSON 语法高亮（纯函数）：先转义 HTML 再按 token 着色，返回安全的 HTML 字符串。
 * 零依赖实现——JSON 语法简单（键/字符串/数字/布尔/null/标点），
 * 无需引入 Prism / Shiki 等重量级高亮库，符合 DevKit 轻量本地工具定位。
 *
 * 输出结构：
 *   <span class="j-key">"键名"</span>:          —— 键（字符串 + 冒号）
 *   <span class="j-string">"值"</span>          —— 字符串值
 *   <span class="j-number">42</span>            —— 数字
 *   <span class="j-keyword">true|null</span>    —— 布尔 / null
 * 颜色由消费方 CSS 定义（:deep(.j-key) 等，需适配明暗主题）。
 */

const RE_TOKEN =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g;

/** 转义 HTML 特殊字符，防止注入 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 高亮 JSON 文本，返回 HTML。
 * 调用方需用 v-html 渲染，并在容器上设置 white-space: pre 保持格式。
 */
export function highlightJson(text: string): string {
  // 先转义：字符串内容中的 & < > 不会破坏 token 匹配（引号/反斜杠不受影响）
  const escaped = escapeHtml(text);
  // 捕获组：1=字符串整体，2=字符串内单个字符（忽略），3=可选的冒号部分
  return escaped.replace(
    RE_TOKEN,
    (match, str: string | undefined, _char: string | undefined, colon: string | undefined) => {
      if (str !== undefined) {
        // 字符串 token：后跟冒号视为键名，否则为字符串值
        return colon
          ? `<span class="j-key">${str}</span>${colon}`
          : `<span class="j-string">${str}</span>`;
      }
      const cls =
        match === "true" || match === "false" || match === "null" ? "j-keyword" : "j-number";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}
