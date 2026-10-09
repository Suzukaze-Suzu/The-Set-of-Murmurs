import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Article, CATEGORY_META, NOVEL_STATUS_META } from '../../types';
import { useLocalizedArticle } from '../../context/TranslationContext';
import { useT, useLocale, formatDate } from '../../i18n';
import { catKey, novelStatusKey } from '../../i18n/dict';
import { formatCountLabel, sumChapterCounts, formatCount } from '../../lib/wordCount';
import { articleHref } from '../../lib/novelPath';

interface Props {
  article: Article;
}

/* ══════════════════════════════════════════════════════════════════════════════
   N1Entry · 报纸「三栏纯文字条目」（2026-10-09，文章档案页 / 分类页）
   ──────────────────────────────────────────────────────────────────────────────
   版式**逐块照样张** `design-mockups\g\n1-broadsheet\index.html` 行 481-505 与
   `novel.html`「同分类文章」段：`.item` → `.item-txt` → `.cat` → `h3>a` → `p` → `.meta`。
   类名一个不改，样式全在生成物 `styles/n1.css`（`.n1 .list` 三栏栅格 + `.n1 .item`）。

   它替换的是旧报纸层的 `BsEntry`（`.bs-entry`，仍在仓库里作回退对照），**信息一条没少**：
     · 文章：分类名＋色点、标题、摘要、日期、字数、置顶签、收藏星、阅读入口
     · 小说：另加 连载状态签 ＋「共 N 章 · M 字」＋阅读入口（走 `shelf.startReading`）
   硬约束：**文章一律不配图**（书籍封面只出现在书架与首页书讯块），这里不渲染任何图片。
   ⚠️ 分类色只当 `.cat::before` 那枚小方块（`--c`，样张写法），**字仍是墨色**。
   ⚠️ 置顶/收藏在列表页是**信息**不是按钮（旧页面的 ☆ 点了没有反应，是既有语义坑，照原样迁）。
   ══════════════════════════════════════════════════════════════════════════════ */
export default function N1Entry({ article: raw }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const { article, counts } = useLocalizedArticle(raw);

  const meta = CATEGORY_META[article.category];
  const chapters = (article.novel?.chapters || []).slice().sort((a, b) => a.order - b.order);
  const isNovel = article.category === 'reading' && chapters.length > 0;
  const statusMeta = article.novel?.status ? NOVEL_STATUS_META[article.novel.status] : null;

  const body = chapters.map((ch) => ch.content || '').join('\n');
  const words = isNovel
    ? formatCountLabel(sumChapterCounts(chapters), body, locale, t) ||
      t('count.words', { n: formatCount(article.novel?.wordCount || 0) })
    : formatCountLabel(counts, article.content, locale, t);

  const href = articleHref(article);

  return (
    <article className="item" style={{ '--c': meta.color } as CSSProperties}>
      <div className="item-txt">
        <span className="cat">{t(catKey(article.category))}</span>
        <h3>
          <Link to={href}>{article.title}</Link>
        </h3>
        {article.summary && <p>{article.summary}</p>}
        <div className="meta">
          <span>{formatDate(article.date, locale)}</span>
          {isNovel ? (
            <>
              <span>{t('count.chaptersWords', { n: chapters.length, m: words })}</span>
              {statusMeta && (
                <span className="st">
                  {article.novel?.status ? t(novelStatusKey(article.novel.status)) : statusMeta.label}
                </span>
              )}
            </>
          ) : (
            words && <span>{words}</span>
          )}
          {article.pinned && <span className="pin">{t('cat.pinned')}</span>}
          {article.favorite && <span className="pin">★</span>}
          <Link to={href} className="go">
            {isNovel ? t('shelf.startReading') : t('article.read')} ›
          </Link>
        </div>
      </div>
    </article>
  );
}
