import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Article, CATEGORY_META, NOVEL_STATUS_META } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLocalizedArticle } from '../context/TranslationContext';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey, novelStatusKey } from '../i18n/dict';
import { formatCountLabel, sumChapterCounts, formatCount } from '../lib/wordCount';
import { articleHref } from '../lib/novelPath';

interface Props {
  article: Article;
  /** ⚠️ 与 ArticleCard 同一口径：列表页**不传**（那里的收藏按钮点了无效，是既有语义坑，照原样迁） */
  onToggleFavorite?: (id: string) => void;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BsEntry · 报纸「纯文字条目」（2026-10-08，批次② P3 列表与分类）
   ──────────────────────────────────────────────────────────────────────────────
   /articles 与 /category/:c 的列表从「卡片网格」换成**三栏纯文字流**（版式见
   `styles/broadsheet.css` 的「P3」段；样张依据＝计划书 §5 P3「三栏纯文字流（栏间竖线）」）。

   它替换的是 ArticleCard / NovelCard 在这一页上的显示，**信息一条没少**：
     · 文章：分类名 ＋ 色点、置顶签、收藏星（仅博主）、标题、摘要、标签串、日期 · 字数、阅读›
     · 小说：同上，另加 连载状态签 ＋「共 N 章 · M 字」＋ 阅读入口（原 NovelCard 的「开始阅读」）
   硬约束：**文章一律不配图**（书封只在书架/书籍报讯块里出现），所以这里不渲染任何图片。

   ⚠️ 字数口径走 `formatCountLabel`（英文站按译文状态说 words / characters），与全站一致。
   ⚠️ 分类色只画「名字前面的小方块」（与首页索引带 `.bs-tile` 同一语言），**字仍走墨色**。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function BsEntry({ article: raw, onToggleFavorite }: Props) {
  const { isAdmin } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const { article, counts } = useLocalizedArticle(raw);

  const meta = CATEGORY_META[article.category];
  const chapters = (article.novel?.chapters || []).slice().sort((a, b) => a.order - b.order);
  const isNovel = article.category === 'reading' && chapters.length > 0;
  const statusMeta = article.novel?.status ? NOVEL_STATUS_META[article.novel.status] : null;

  const body = chapters.map((ch) => ch.content || '').join('\n');
  const label = isNovel
    ? formatCountLabel(sumChapterCounts(chapters), body, locale, t) ||
      t('count.words', { n: formatCount(article.novel?.wordCount || 0) })
    : formatCountLabel(counts, article.content, locale, t);

  const href = articleHref(article);

  return (
    <article className="bs-entry" style={{ '--c': meta.color } as CSSProperties}>
      <div className="bs-entry-k">
        <span className="bs-entry-dot" aria-hidden="true" />
        <span className="bs-entry-cat">{t(catKey(article.category))}</span>
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

      <h3 className="bs-entry-title">
        <Link to={href}>{article.title}</Link>
      </h3>

      {article.summary && <p className="bs-entry-sum">{article.summary}</p>}

      {isNovel && (
        <div className="bs-entry-book">
          {statusMeta && (
            <span
              className="bs-book-status"
              style={{ '--chip-color': statusMeta.color, '--chip-ink': statusMeta.ink } as CSSProperties}
            >
              {article.novel?.status ? t(novelStatusKey(article.novel.status)) : statusMeta.label}
            </span>
          )}
          <span>{t('count.chaptersWords', { n: chapters.length, m: label })}</span>
        </div>
      )}

      {article.tags.length > 0 && (
        <p className="bs-entry-tags">
          {article.tags.map((tag) => (
            <span key={tag} className="tag">#{tag}</span>
          ))}
        </p>
      )}

      <p className="bs-entry-meta">
        <span>{formatDate(article.date, locale)}</span>
        {!isNovel && label && <span>{label}</span>}
        <Link to={href} className="bs-entry-read">
          {isNovel ? t('shelf.startReading') : t('article.read')} ›
        </Link>
      </p>
    </article>
  );
}
