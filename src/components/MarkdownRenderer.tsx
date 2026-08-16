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
        rehypePlugins={[rehypeKatex, rehypeRaw]}
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
        {content}
          </ReactMarkdown>
    </div>
  );
}

