/* ══════════════════════════════════════════════════════════════════════════════
   katexBundle.ts —— 「KaTeX 本体（CSS ＋ 字体）＋ 两个插件」的唯一入口
   ──────────────────────────────────────────────────────────────────────────────
   2026-10-10 新增（用户原话「给留言板加katex」）。

   为什么要有这么一层：KaTeX 的样式表原先**只由 `index.html` 第 55 行那条
   `<link href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">`** 供。
   2026-10-10 实测：**这台机器直连 jsdelivr ＝ ECONNRESET（被墙）**，于是
     · 公式虽然生成了 KaTeX 的 HTML，但**没有一条 KaTeX 规则生效** ——
       `.katex-display` 不是 block（行间公式挤在正文同一行、不居中）、`\frac` 的分数线不见；
     · 而且那是一条 **<head> 里的渲染阻塞样式表**，连不上时首屏要等它失败。
   把 CSS 收进构建产物（下面这行 import）之后：公式样式与站点同源、跟着 chunk 走，
   墙内也不用再等一个连不上的 CDN。

   用法（两种都对）：
     · 正文那支　`import { remarkMath, rehypeKatex } from '../lib/katexBundle';`（静态）
     · 留言那支　`import('../lib/katexBundle')`（动态 —— 没公式的留言不下载这包）

   ⚠️ 顺序陷阱：`katex.min.css` 的 `.katex{font:normal 1.21em KaTeX_Main,Times New Roman,serif}`
     用的是 **font 简写**，连 font-family 一起设。本包是**按需注入**的，会落在 `index.css`
     **之后**，于是同特异性（0,1,0）下它会赢 —— `index.css` 里那条给公式中文兜衬线的补丁
     （2026-09-17 修「手机上公式里的中文掉黑体」）会被压掉。所以那条补丁已改成
     `.katex.katex`（(0,2,0)，**与顺序无关**）。改这里时别把它改回去。

   回退＝把两处 import 换回 `remark-math` / `rehype-katex` 直连，并在 `index.html`
   恢复那条 jsdelivr `<link>`（此时公式样式重新依赖 CDN 可达性）。
   ══════════════════════════════════════════════════════════════════════════════ */
import 'katex/dist/katex.min.css';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export { remarkMath, rehypeKatex };
