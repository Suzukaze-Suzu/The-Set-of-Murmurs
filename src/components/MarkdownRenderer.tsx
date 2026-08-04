import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'highlight.js/styles/github.css';

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}
export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-body">
          <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
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

