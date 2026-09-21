import { Link } from 'react-router-dom';
import { Article } from '../types';
import { NOVEL_STATUS_META } from '../types';
import { useLocalizedArticle } from '../context/TranslationContext';
import { useT, useLocale } from '../i18n';
import { novelStatusKey } from '../i18n/dict';
import { countWords, formatCount } from '../lib/wordCount';

interface Props {
  article: Article;
}

export default function NovelCard({ article: raw }: Props) {
  const t = useT();
  const { locale } = useLocale();
  // 英文页：书名/简介/章节正文换成已审校的译文（未译的逐项回退中文）
  const { article } = useLocalizedArticle(raw);
  const novel = article.novel;
  const chapters = (novel?.chapters || []).slice().sort((a, b) => a.order - b.order);
  const status = novel?.status;
  const statusMeta = status ? NOVEL_STATUS_META[status] : null;

  /* ★ 数字口径（2026-09-21）：按当前语言实时算——中文＝去空白字数（与历史数字一致），
     英文＝真词数；novel.wordCount 只在内容缺失时兜底。 */
  const words =
    countWords(chapters.map((ch) => ch.content || '').join('\n'), locale) || novel?.wordCount || 0;

  return (
    <div className="novel-card">
      {novel?.cover ? (
        <div className="novel-cover-wrap">
          <img src={novel.cover} alt={article.title} className="novel-cover" loading="lazy" />
        </div>
      ) : (
        <div className="novel-cover novel-cover-placeholder">
          <span className="novel-cover-char">{article.title.slice(0, 1)}</span>
        </div>
      )}

      <div className="novel-card-body">
        <Link to={`/article/${article.id}`} className="novel-title">{article.title}</Link>
        {novel?.author && <div className="novel-author">{t('shelf.byAuthor', { name: novel.author })}</div>}

        {statusMeta && (
          <span className="novel-status-badge" style={{ background: statusMeta.color + '22', color: statusMeta.ink }}>
            {status ? t(novelStatusKey(status)) : statusMeta.label}
          </span>
        )}

        {novel?.synopsis && <p className="novel-synopsis">{novel.synopsis}</p>}

        <div className="novel-stats">
          <span>{t('count.chapters', { n: chapters.length })}</span>
          <span>·</span>
          <span>{words ? t('count.words', { n: formatCount(words) }) : ''}</span>
        </div>

        <Link to={`/article/${article.id}`} className="read-more">{t('shelf.startReading')}</Link>
      </div>
    </div>
  );
}
