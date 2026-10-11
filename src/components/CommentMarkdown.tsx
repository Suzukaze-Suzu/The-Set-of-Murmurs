import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState } from 'react';
import { normalizeMathDelimiters } from '../lib/mathDelimiters';

/* ══════════════════════════════════════════════════════════════════════════════
   留言正文的 Markdown 渲染（2026-10-09，用户原话「让留言支持markdown」）
   ＋ 公式（2026-10-10，用户原话「给留言板加katex」）
   ──────────────────────────────────────────────────────────────────────────────
   与正文那支 `MarkdownRenderer`（文章/小说/关于）**故意分开写**，四处不同：

     ① **不开 rehypeRaw** —— 留言是任何登录用户都能写的内容，而正文那支为了支持内联
        HTML 挂了 `rehype-raw`。留言若跟着开，`<img src=x onerror=…>` 这类会被当标签执行
        （存储型 XSS）。这里保持 react-markdown 的默认：**原样转义**，HTML 标签当文字显示。
     ② **KaTeX 按需加载**（2026-10-10 改；此前是「一律不挂」）—— 见下面「公式」那段。
     ③ **单换行就是换行**（见 `keepLineBreaks`）—— 留言是个"聊天输入框"，用户按一次回车
        就是要分段，不按 CommonMark「单换行折成空格」的规矩来。
        （改版前这里连 `.mtxt p` 都没有 `white-space:pre-wrap`，回车其实是**被吃掉**的。）
     ④ **公式解析失败不报错中断整条留言**（`throwOnError:false`）—— 与正文同口径。

   支持的范围＝GitHub 风味 Markdown（标题／粗斜体／删除线／有序无序列表／引用／行内与围栏
   代码／链接／图片／表格／分隔线／任务列表／裸链接自动成链）＋ LaTeX 公式（`$…$`／`$$…$$`／
   `\(…\)`／`\[…\]` 四种写法都认）。
   样式在 `src/styles/n1-app.css` 的 ⑩ 段（`.n1 .mtxt .comment-md …`）与 ⑩-b 段（公式）。

   回退＝把四个调用点换回 `<p>{内容}</p>`，再删掉这个文件与 n1-app.css 的 ⑩／⑩-b 两段；
   只想退回「有 markdown、没公式」则删掉本文件的 `hasMath`／`MATH_PLUGINS` 那段与 ⑩-b 段。

   ──────────────────────────────────────────────────────────────────────────────
   公式这一层为什么这么写（体积取舍，别随手简化）
   ──────────────────────────────────────────────────────────────────────────────
   2026-10-09 这一支的原始设计是「**一律不挂 KaTeX**，省掉那 ~270kb」（旧注释 ②）。
   2026-10-10 用户要求留言板支持公式，于是这条理由得重新算账：

     · 本组件是**共用件** —— 留言板 `/guestbook` 与文章/小说评论（`n1/N1Comments`）都走它，
       而评论组件的 chunk 还挂在**书架页、小说页**上；这些页面 99% 的留言**一条公式都没有**。
     · 直接挂插件＝上面每个页面**无差别** +270kb，为了一两条公式罚所有人。
     · 所以改成**先便宜地判断有没有公式，命中才去 `import()`**：
       没有公式的留言 —— **不发那个 chunk、渲染结果与改造前逐字节相同**；
       有公式的留言 —— 先按原文显示一瞬，插件到位后换成公式（`useState` 一翻转即重渲）。

   `MATH_PLUGINS` 的两种写法（`$…$` 与 `$$…$$`）由 `remark-math` 自己认；
   `\(…\)` 与 `\[…\]` 得先过 `lib/mathDelimiters.ts` 归一（与正文同一支函数）。
   ⚠️ 归一必须在 `keepLineBreaks` **之前**做：后者会往行尾插「两空格 + 换行」，
   先归一可以少一次对公式正文的扰动。
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

/* ── 公式：便宜的存在性检测 ＋ 按需加载 ────────────────────────────────────────
   检测口径**刻意比 remark-math 严**（不是"见到 $ 就算"）—— 这条检测只决定"要不要去拉
   那 270kb"，严一点最坏是"该拉的没拉"，松一点则会替**普通人的人民币留言**白拉一次：
     · `$$…$$` ／ `\(…\)` ／ `\[…\]` —— 见到就算；
     · 行内 `$…$` —— 要求 `$` 后**不是**空白、收尾 `$` 前也**不是**空白。
       于是「这本书 $100 到 $200 不等」**不命中**，整条留言按改造前那一支渲染（逐字节相同）。
   ⚠️ **已知钝角（故意不修）**：同一条留言里既有真公式、又有人民币写法时，插件一旦挂上，
      remark-math 会把 `$100 到 $` 也吃成公式。这与**文章正文完全同口径**（正文那支从
      2026-09 起就这样），本轮不为留言层单独发明一套更刁的解析。实测见
      `first/guestbook-katex/probe-comment-katex.mjs` 的「已知钝角 · 混合留言」一段。
   ⚠️ 另一个钝角：内容若在**代码块里**字面写着 `$x$`，这里也会命中、白拉一次 chunk
     （渲染结果不受影响 —— remark-math 不会把代码块当公式）。为省一次误拉去做代码剥离不划算。 */
const MATH_SIGNAL = /\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$[^\s$](?:[^$\n]*[^\s$])?\$/;
function hasMath(md: string): boolean {
  return MATH_SIGNAL.test(md);
}

// KaTeX 渲染选项：单条公式出错时渲染错误提示而不抛异常中断整条留言（与正文同口径）
const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false,
  macros: {} as Record<string, string>,
};

interface MathPlugins {
  remark: any[];
  rehype: any[];
}

interface Props {
  content: string;
}

export default function CommentMarkdown({ content }: Props) {
  /* 公式插件是按需拉回来的：默认 null ＝ 这一支与改造前完全一样（只挂 remarkGfm）。
     插件是**模块单例**，所以只有全文第一条公式会真的发请求，之后同一个 Promise 命中缓存。 */
  const [mathPlugins, setMathPlugins] = useState<MathPlugins | null>(null);

  useEffect(() => {
    if (!hasMath(content)) {
      setMathPlugins(null); // 同一条留言从"有公式"改成"没公式"时退回轻量管线
      return;
    }
    let alive = true;
    /* 一次动态 import 把「KaTeX 的 CSS ＋ 字体 ＋ 两个插件」一起拉回来 ——
       见 `lib/katexBundle.ts`（那边解释了为什么 CSS 必须自带、不能靠 index.html 的 CDN link）。 */
    import('../lib/katexBundle')
      .then(({ remarkMath, rehypeKatex }) => {
        if (alive) setMathPlugins({ remark: [remarkMath], rehype: [[rehypeKatex, KATEX_OPTIONS]] });
      })
      /* 拉不到（离线 / 陈旧 chunk 404）就**静默退回**轻量管线：公式按原文显示，
         留言其余部分照常渲染 —— 比起整条留言白屏，这样更像"降级"而不是"坏了"。 */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [content]);

  const source = mathPlugins ? keepLineBreaks(normalizeMathDelimiters(content)) : keepLineBreaks(content);

  return (
    <div className="comment-md">
      <ReactMarkdown
        remarkPlugins={mathPlugins ? [remarkGfm, ...mathPlugins.remark] : [remarkGfm]}
        rehypePlugins={mathPlugins ? mathPlugins.rehype : undefined}
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
        {source}
      </ReactMarkdown>
    </div>
  );
}
