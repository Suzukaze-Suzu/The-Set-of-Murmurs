import { Component, ReactNode } from 'react';
import { translate, localeFromPath } from '../i18n';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// 错误边界：某个页面/组件运行时抛错时，不白屏，显示友好错误提示
// ★ 英文版（2026-09-21）：类组件不能用 hook，直接调 translate() 并就地判语言
//   （错误边界必须在语言 Provider 之外也能工作，所以不依赖 context）。
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
      const locale = localeFromPath(
        typeof window === 'undefined' ? '/' : window.location.pathname,
      );
      const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
      return (
        <div className="page error-page">
          <span className="empty-icon empty-icon-ghost" />
          <h1 className="page-title">{t('common.somethingWentWrong')}</h1>
          <p className="error-page-desc">{t('common.temporaryTryRefresh')}</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            {t('common.refresh')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
