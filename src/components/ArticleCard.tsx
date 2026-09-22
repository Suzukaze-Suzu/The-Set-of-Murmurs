import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Article, CATEGORY_META } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLocalizedArticle } from '../context/TranslationContext';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey } from '../i18n/dict';
import { formatCountLabel } from '../lib/wordCount';

interface Props {
  article: Article;
  onToggleFavorite?: (id: string) => void;
}

export default function ArticleCard({ article: raw, onToggleFavorite }: Props) {
  const { isAdmin } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  // 英文页：标题/摘要换成已审校的译文（没有译文就原样显示中文）
  const { article, counts } = useLocalizedArticle(raw);
  const meta = CATEGORY_META[article.category];
  /* ★ 字数（2026-09-22）：口径走 lib/wordCount.ts 的 formatCountLabel ——
     中文站＝`801 字`；英文站按**译文状态**说话：整篇没译＝`6,765 characters`、
     整篇译完＝`447 words`、只译了一部分＝`447 words · 6,765 characters`。 */
  const label = formatCountLabel(counts, article.content, locale, t);
  return (
    <div
      className="article-card"
      style={{ borderTop: `4px solid ${meta.color}` }}
    >
      <div className="card-top">
        {/* 第2g步：分类小签的底色＝该分类的色卡色实底（亮色），字色由 --cat-on 给；
            暗色由 index.css 的还原块改回「13% 淡底 + 同色系墨色字」。 */}
        <span className="card-cat" style={{ '--cat-color': meta.color, '--cat-ink': meta.ink, '--cat-on': meta.onFill } as CSSProperties}>
          {t(catKey(article.category))}
        </span>
        <div className="card-actions">
          {article.pinned && <span className="card-pin" title={t('cat.pinned')}>{t('cat.pinned')}</span>}
          {isAdmin ? (
            <button
            className={`fav-btn ${article.favorite ? 'fav-on' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite?.(article.id);
            }}
            title={article.favorite ? t('cat.unsave') : t('cat.save')}
          >
            {article.favorite ? '★' : '☆'}
          </button>
          ) : article.favorite ? (
            <span className="fav-btn fav-on" title={t('cat.save')}>★</span>
          ) : null}
        </div>
      </div>

      <Link to={`/article/${article.id}`} className="card-title">
        {article.title}
      </Link>

      {article.summary && <p className="card-summary">{article.summary}</p>}

      <div className="card-tags">
        {article.tags.map((tag) => (
          <span key={tag} className="tag">#{tag}</span>
        ))}
      </div>

      <div className="card-foot">
        <span className="card-date">
          {formatDate(article.date, locale)}
          {label && (
            <>
              <span className="card-meta-sep" aria-hidden="true">·</span>
              <span className="card-words">{label}</span>
            </>
          )}
        </span>
        <Link to={`/article/${article.id}`} className="read-more">{t('article.read')}</Link>
      </div>
    </div>
  );
}
