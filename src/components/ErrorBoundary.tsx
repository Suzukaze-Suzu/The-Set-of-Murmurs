import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// 错误边界：某个页面/组件运行时抛错时，不白屏，显示友好错误提示
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('页面出错：', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page error-page">
          <span className="empty-icon empty-icon-ghost" />
          <h1 className="page-title">页面出了点问题</h1>
          <p className="error-page-desc">可能是临时错误，刷新一下试试。</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
