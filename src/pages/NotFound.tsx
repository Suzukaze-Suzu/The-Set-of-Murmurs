import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

export default function NotFound() {
  const t = useT();
  usePageTitle(t('notFound.title'));

  return (
    <div className="not-found">
      <div className="not-found-inner">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">{t('notFound.title')}</h1>
        <p className="not-found-desc">{t('notFound.desc')}</p>
        <div className="not-found-links">
          <a className="not-found-btn not-found-btn-primary" href="/">
            {t('notFound.home')}
          </a>
        </div>
      </div>
    </div>
  );
}
