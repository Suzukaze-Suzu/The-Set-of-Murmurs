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
export default function MarkdownRenderer({ content }: { content: string }) {
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

