import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github.css';
import { useRef, useEffect } from 'react';

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

/**
 * 将 LaTeX 风格的数学定界符统一为 remark-math 能识别的 $ / $$ 形式：
 *   - 块级 \[ ... \]  →  $$ ... $$
 *   - 行内 \( ... \)  →  $ ... $
 * remark-math 底层（micromark-extension-math）只识别 $ 定界符，不识别 \[ \] / \( \)，
 * 导致 \[ 分段函数 \] 这类写法被当成普通文本而不进入 KaTeX。这里在送入 ReactMarkdown
 * 前先做转换。为避免误伤，会先用占位符保护代码块与行内代码，转换完再还原。
 */
function normalizeMathDelimiters(md: string): string {
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
                return <img src={src} alt={alt} loading="lazy" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />;
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

