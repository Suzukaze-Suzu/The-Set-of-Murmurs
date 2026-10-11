import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github.css';
import { useRef, useEffect } from 'react';
// 2026-10-10：定界符归一搬去 lib 与留言层共用（留言板加 KaTeX）。
// 原函数体一字未改，只是换了住处；正文渲染口径不受影响。
import { normalizeMathDelimiters } from '../lib/mathDelimiters';
// KaTeX 插件与**它自己的 CSS／字体**一起从这一支取（原先 CSS 靠 index.html 的 jsdelivr <link>，
// 2026-10-10 实测那条在墙内连不上 → 公式没有一条规则生效）。理由见 lib/katexBundle.ts。
import { remarkMath, rehypeKatex } from '../lib/katexBundle';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// 目录条目：标题 id、文字、级别（1=h1 2=h2 3=h3）
export interface Heading {
  id: string;
  text: string;
  level: number;
}

// KaTeX 额外自定义宏（可选扩展）。KaTeX 本身不能加载 LaTeX 宏包，但可在此注册常用自定义命令。
// 如需更多命令，按 KATEX_MACROS 中 '\宏名': '展开式或函数' 追加即可。
const KATEX_MACROS = {};

// KaTeX 渲染选项：单条公式出错时渲染错误提示而不抛异常中断整篇文档
const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false,
  macros: KATEX_MACROS,
};

export default function MarkdownRenderer({ content, onHeadings }: { content: string; onHeadings?: (headings: Heading[]) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // 检测超宽 LaTeX 块级公式，仅对其添加 math-overflow 类以显示滑动提示箭头
  useEffect(() => {
    const check = () => {
      const root = rootRef.current;
      if (!root) return;
      root.querySelectorAll<HTMLElement>('.katex-display').forEach((el) => {
        const overflow = el.scrollWidth > el.clientWidth + 1;
        el.classList.toggle('math-overflow', overflow);
      });
    };
    const t = setTimeout(check, 60);
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', check);
    };
  }, [content]);

  // 提取 h1/h2/h3 生成目录（给标题加锚点 id，回调给父组件）
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onHeadings) return;
    const seen = new Map<string, number>();
    const hs: Heading[] = [];
    root.querySelectorAll<HTMLElement>('h1, h2, h3').forEach((el, i) => {
      const text = (el.textContent || '').trim();
      let slug = text.replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '').toLowerCase();
      if (!slug) slug = 'h-' + i;
      const n = seen.get(slug) || 0;
      seen.set(slug, n + 1);
      const id = n ? `${slug}-${n}` : slug;
      el.id = id;
      hs.push({ id, text, level: Number(el.tagName.charAt(1)) });
    });
    onHeadings(hs);
  }, [content, onHeadings]);
  return (
    <div className="markdown-body" ref={rootRef}>
          <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, KATEX_OPTIONS], rehypeRaw]}
            components={{
          code({ inline, className, children }: CodeProps) {
                const match = /language-(\w+)/.exec(className || '');
                if (!inline && match && match[1]) {
                  return (
                    <code className={`hljs ${className}`} data-language={match[1]}>
                      {children}
                    </code>
        );
}
                return <code className={className}>{children}</code>;
              },
              img({ src, alt }: any) {
                /* ⚠️ 这里**不能**再写内联 `maxWidth`：内联样式的优先级高于任何 CSS 规则，
                   N1 正文图要限宽（`.n1 .prose-read .markdown-body img` 的 `--img-w`）就会被它压死。
                   宽度交给 CSS 管：未迁页由 index.css 的 `.markdown-body img{max-width:100%}` 兜底，
                   N1 页由 n1-app.css 的 `--img-w` 收到 760px。`height/display` 仍写内联，
                   免得旧层 `.markdown-body img` 只有 max-width、图片回落到 inline 出现基线缝隙。 */
                return <img src={src} alt={alt} loading="lazy" className="md-img" style={{ height: 'auto', display: 'block' }} />;
              },
              pre({ children }: any) {
                return <pre className="code-block">{children}</pre>;
              },
            }}
          >
        {normalizeMathDelimiters(content)}
          </ReactMarkdown>
    </div>
  );
}

