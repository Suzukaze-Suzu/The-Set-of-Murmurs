import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ══════════════════════════════════════════════════════════════════════════════
   留言正文的 Markdown 渲染（2026-10-09，用户原话「让留言支持markdown」）
   ──────────────────────────────────────────────────────────────────────────────
   与正文那支 `MarkdownRenderer`（文章/小说/关于）**故意分开写**，三处不同：

     ① **不开 rehypeRaw** —— 留言是任何登录用户都能写的内容，而正文那支为了支持内联
        HTML 挂了 `rehype-raw`。留言若跟着开，`<img src=x onerror=…>` 这类会被当标签执行
        （存储型 XSS）。这里保持 react-markdown 的默认：**原样转义**，HTML 标签当文字显示。
     ② **不挂 remark-math / rehype-katex** —— 留言里没人写公式，省掉 KaTeX 那 ~270kb
        （评论组件挂在首页书架、留言页、文章阅读页的 chunk 上，只有阅读页真需要公式）。
     ③ **单换行就是换行**（见 `keepLineBreaks`）—— 留言是个"聊天输入框"，用户按一次回车
        就是要分段，不按 CommonMark「单换行折成空格」的规矩来。
        （改版前这里连 `.mtxt p` 都没有 `white-space:pre-wrap`，回车其实是**被吃掉**的。）

   支持的范围＝GitHub 风味 Markdown（标题／粗斜体／删除线／有序无序列表／引用／行内与围栏
   代码／链接／图片／表格／分隔线／任务列表／裸链接自动成链）。
   样式在 `src/styles/n1-app.css` 的 ⑩ 段（`.n1 .mtxt .comment-md …`）。

   回退＝把三个调用点换回 `<p>{内容}</p>`，再删掉这个文件与 n1-app.css 的 ⑩ 段。
   ══════════════════════════════════════════════════════════════════════════════ */

/* 把「单换行」翻成 CommonMark 的**硬换行**（行尾两空格 + 换行），空行（＝段落分隔）原样。
   ⚠️ 必须先保护代码——围栏块与行内代码里的换行是**代码原文**，插两空格会改掉内容。
   （保护手法与 MarkdownRenderer 的 `normalizeMathDelimiters` 同一套：占位符 → 还原。） */
function keepLineBreaks(md: string): string {
  const kept: string[] = [];
  // 围栏代码块 ``` / ~~~（含语言标注），整块存成占位符
  let text = md.replace(/(```|~~~)[^\n]*\n[\s\S]*?\n\1/g, (m) => {
    kept.push(m);
    return '\u0000K' + (kept.length - 1) + '\u0000';
  });
  // 行内代码 `…`
  text = text.replace(/(`+)([\s\S]*?)\1/g, (m) => {
    kept.push(m);
    return '\u0000K' + (kept.length - 1) + '\u0000';
  });
  // 单换行 → 硬换行；连续空行不动（那是段落分隔，交给 Markdown 自己分）
  text = text.replace(/([^\n])\n(?!\n)/g, '$1  \n');
  return text.replace(/\u0000K(\d+)\u0000/g, (_m, i) => kept[Number(i)]);
}

interface Props {
  content: string;
}

export default function CommentMarkdown({ content }: Props) {
  return (
    <div className="comment-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* 外链一律新窗口打开 + noopener/nofollow：留言里的链接是用户给的，
             不能把当前页顶掉、也不该给它们传权重（正文那支没管这条，留言这层必须管）。 */
          a({ href, children }: any) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
          /* 图片只限宽（内联只写 height/display，宽度交给 CSS 的 ⑩ 段，
             免得行内样式压过 `max-width`）——与正文那支同一口径。 */
          img({ src, alt }: any) {
            return <img src={src} alt={alt} loading="lazy" style={{ height: 'auto', display: 'block' }} />;
          },
          pre({ children }: any) {
            return <pre className="code-block">{children}</pre>;
          },
        }}
      >
        {keepLineBreaks(content)}
      </ReactMarkdown>
    </div>
  );
}
