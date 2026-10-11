/* ══════════════════════════════════════════════════════════════════════════════
   mathDelimiters.ts —— LaTeX 定界符归一（正文与留言**共用一支**）
   ──────────────────────────────────────────────────────────────────────────────
   2026-10-10 从 `components/MarkdownRenderer.tsx` 原样搬出来（函数体一字未改）。
   搬家的原因：留言板要加 KaTeX（用户原话「给留言板加katex」），它同样需要这层归一；
   若留在正文那支里，留言层就得**再抄一份**，两处迟早抄岔。

   为什么要归一：remark-math 底层（micromark-extension-math）**只认 `$` / `$$`**，
   不认 `\[ \]` / `\( \)`。用户写 `\[ 分段函数 \]` 会被当普通文本，不进 KaTeX。
   这里在送进 ReactMarkdown 之前先把两种写法翻成 `$` 形式。

   避免误伤的手法：**先用占位符把代码保护起来**（围栏块 + 行内代码），转换完再还原 ——
   否则代码块里字面写着 `\(` 的内容也会被改写。
   ⚠️ 留言层 `CommentMarkdown` 自己的 `keepLineBreaks` 用的是**另一套占位符**（`\u0000K`），
   两支互不干扰；两者叠用时**先调本函数、再调 keepLineBreaks**。
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * 将 LaTeX 风格的数学定界符统一为 remark-math 能识别的 $ / $$ 形式：
 *   - 块级 \[ ... \]  →  $$ ... $$
 *   - 行内 \( ... \)  →  $ ... $
 */
export function normalizeMathDelimiters(md: string): string {
  const placeholders: string[] = [];
  // 保护围栏代码块 ``` 或 ~~~（含语言标注），整块存为占位符
  let text = md.replace(
    /(```|~~~)[^\n]*\n[\s\S]*?\n\1/g,
    (m) => {
      placeholders.push(m);
      return '\u0000CODE' + (placeholders.length - 1) + '\u0000';
    }
  );
  // 保护行内代码 `...`
  text = text.replace(/(`+)([\s\S]*?)\1/g, (m) => {
    placeholders.push(m);
    return '\u0000CODE' + (placeholders.length - 1) + '\u0000';
  });
  // 块级 \[ ... \]（起止须各自独占一行，可跨多行）→ $$ ... $$
  text = text.replace(
    /(^|\n)(\s*)\\\[([\s\S]*?)\\\](\s*)(?=\n|$)/g,
    (_m, nl, ws1, inner, ws2) => nl + ws1 + '$$' + inner + '$$'
  );
  // 行内 \( ... \)（单行）→ $ ... $
  text = text.replace(/\\\(([^\r\n]*?)\\\)/g, (_m, inner) => '$' + inner + '$');
  // 还原代码占位符
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, i) => placeholders[Number(i)]);
  return text;
}
