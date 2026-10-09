import { Fragment } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { NovelChapter } from '../../types';
import { useT, useLocale } from '../../i18n';
import { formatCountLabel, formatCount } from '../../lib/wordCount';

/* ══════════════════════════════════════════════════════════════════════════════
   小说目录（共享零件，2026-10-09「正文单独开一页」拆分时抽出）
   ──────────────────────────────────────────────────────────────────────────────
   样张 `design-mockups\g\n1-broadsheet\novel.html` 468-474 的 `.toc`（`.no`/`.tt`/`.meta`/`.go`），
   类名一个不改。三个地方用它，**同一份标记**，不再各写一遍：
     · 书架 `/novels`            —— hrefOf 指阅读界面，无当前章、无分卷题头（原样）
     · 书介页 `/novels/<id>`     —— hrefOf 指阅读界面，有分卷题头
     · 阅读界面 `/novels/<id>/read` —— hrefOf 指本页 `?ch=`，给 activeIx（当前章高亮）
                                       且传 onSelect（原地切章，不整页重载）
   字数口径统一走 `lib/wordCount.ts`：章没有 `counts`（未译）时按中文字数，退回 `wordCount`。
   ══════════════════════════════════════════════════════════════════════════════ */
interface Props {
  chapters: NovelChapter[];
  /** 每一条指向哪里（各页自己决定） */
  hrefOf: (ch: NovelChapter, ix: number) => string;
  /** 阅读界面：当前章序号 → `.on` 高亮；不传＝没有当前章（书架／书介页） */
  activeIx?: number;
  /** 传了就拦下跳转、原地切章（阅读界面用，配 replace 同步地址） */
  onSelect?: (ix: number) => void;
  /** 是否在分卷首章前插一行居中题头（书架现状不出，其余两页出） */
  partBreak?: boolean;
}

export default function NovelToc({ chapters, hrefOf, activeIx, onSelect, partBreak }: Props) {
  const t = useT();
  const { locale } = useLocale();

  const click = onSelect
    ? (e: MouseEvent, ix: number) => { e.preventDefault(); onSelect(ix); }
    : undefined;

  return (
    <ol className="toc">
      {chapters.map((ch, ix) => {
        const isPartStart =
          !!partBreak && !!ch.part && (ix === 0 || chapters[ix - 1]?.part !== ch.part);
        const words =
          formatCountLabel(ch.counts, ch.content, locale, t) ||
          t('count.words', { n: formatCount(ch.wordCount || 0) });
        return (
          <Fragment key={ch.id}>
            {isPartStart && <li className="toc-part">{ch.part}</li>}
            <li className={ix === activeIx ? 'on' : undefined}>
              <span className="no">{String(ix + 1).padStart(2, '0')}</span>
              <Link
                className="tt"
                to={hrefOf(ch, ix)}
                onClick={click ? (e) => click(e, ix) : undefined}
              >
                {ch.title}
              </Link>
              <span className="meta">{words}</span>
              <Link
                className="go"
                to={hrefOf(ch, ix)}
                onClick={click ? (e) => click(e, ix) : undefined}
              >
                {t('article.read')} ›
              </Link>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
