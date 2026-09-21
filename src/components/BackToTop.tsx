import { useEffect, useState } from 'react';
import { useT } from '../i18n';

// 回到顶部按钮：滚动超过一定距离后显示，点击平滑回到顶部
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      className={`back-to-top${visible ? ' show' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('article.backToTop')}
      title={t('article.backToTop')}
    >
      ↑
    </button>
  );
}
