import type { RefObject } from 'react';
import { useMemo } from 'react';
import type { Article, Comment, NovelChapter } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import N1Comments from './n1/N1Comments';
import NovelToc from './novel/NovelToc';
import ReaderSettings, { FONT_SIZES, LINE_HEIGHTS } from './novel/ReaderSettings';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useT } from '../i18n';
import { novelReadHref } from '../lib/novelPath';

/* ══════════════════════════════════════════════════════════════════════════════
   小说阅读界面·页身（2026-10-09 第二轮「正文单独开一页」）
   ──────────────────────────────────────────────────────────────────────────────
   用户原话：「阅读的时候把文字单独开一个界面，就像之前的阅读器一样，但是要统一风格」
   并在选项里点名：单独一页（`/novels/<书id>/read?ch=<章id>`）；里面放
   **本章正文 ＋ 章目录 ＋ 字号/行距/深浅设置 ＋ 本章评论**；不勾「进度」那一行。

   本文件＝那个界面里 `.pagehead` 以下的**页身**（报头由 pages/NovelRead.tsx 给）：
     ① `.sec` 本章正文   `.prose.prose-read`（单栏，占满整幅）＋ 分卷题头
     ② `.chnav` 翻章     上一章／下一章（带章名）＋ `3 / 12`
     ③ `.sec` 章目录      `.toc`（共享零件 components/novel/NovelToc.tsx），当前章 `.on`
     ④ `.sec` 阅读设置    `.reader`（共享零件 components/novel/ReaderSettings.tsx，**三行**：字号／行距／深浅）
     ⑤ `.sec` 本章评论    N1Comments（评论串＝`书id::章id`）

   **顺序说明（本轮我自己拍的，汇报里点名让用户删减）**：正文排在目录之前——
   用户要的是「文字单独一个界面」，点进来第一眼就该是字；目录/设置/评论当工具排在正文后面。

   与上一版（同一文件里的旧实现）的差别：
     · 撤掉**书讯** `.book.big` 与**整本评论**那一栏 —— 它们跟着书介页 `/novels/<id>` 走；
     · 撤掉「进度」那一行（用户没勾）；
     · 章状态与翻章由 `pages/NovelRead.tsx` 持有（地址即真值），本文件只渲染；
       正文段的滚动锚点由父级通过 `bodyRef` 传进来。

   逻辑一行没丢：字号 `novel-font` 四档、行距 `novel-line` 三档（localStorage，全站共用一份）、
   夜间模式走站内主题、分卷题头、中英双语字数口径（`formatCountLabel`）、
   本章评论串 `书id::章id`。**文案全部沿用既有字典键，没加新文案。**
   回退＝`git checkout -- src/components/NovelReader.tsx`；
   整块回退＝删 `src/pages/NovelRead.tsx` ＋ `App.tsx` 里 `/novels/:id/read` 那一行。
   ══════════════════════════════════════════════════════════════════════════════ */
interface Props {
  article: Article;
  /** 已按 order 排好的章节（父级给） */
  chapters: NovelChapter[];
  /** 当前章序号（0 起）——地址里的 `?ch=` 决定，父级持有 */
  curIx: number;
  /** 翻章（父级负责同步地址与存进度） */
  onGoTo: (ix: number) => void;
  allComments: Comment[];
  onAddComment: (articleId: string, input: { name: string; content: string; parentId?: string; parentName?: string; avatar?: string }) => void;
  onDeleteComment: (id: string) => void;
  currentUserId?: string;
  /** 正文那一段的锚点（父级翻章后滚到这里） */
  bodyRef: RefObject<HTMLElement>;
}

export default function NovelReader({
  article,
  chapters,
  curIx,
  onGoTo,
  allComments,
  onAddComment,
  onDeleteComment,
  currentUserId,
  bodyRef,
}: Props) {
  const t = useT();

  const [fontIx] = useLocalStorage<number>('novel-font', 1);
  const [lineIx] = useLocalStorage<number>('novel-line', 1);

  const total = chapters.length;
  const cur = chapters[curIx];

  // 当前章评论（评论串＝`书id::章id`）
  const curComments = useMemo(
    () => (cur ? allComments.filter((c) => c.articleId === article.id + '::' + cur.id) : []),
    [allComments, article.id, cur]
  );

  if (total === 0 || !cur) return null;

  return (
    <>
      {/* ① 本章正文：单栏、占满整幅（用户口径「单栏，类似报纸大版，不变窄」）。
             字号/行距写在外层 `.prose-read`，由它 inherit 进 Markdown 渲染层。 */}
      <section className="sec" ref={bodyRef}>
        <div className="sec-head">
          <h2>{cur.title}</h2>
          <small>{curIx + 1} / {total}</small>
        </div>
        {cur.part && (curIx === 0 || chapters[curIx - 1]?.part !== cur.part) && (
          <p className="chap-part"># {cur.part}</p>
        )}
        <article
          className="prose prose-read"
          style={{ fontSize: FONT_SIZES[fontIx], lineHeight: LINE_HEIGHTS[lineIx] }}
        >
          <MarkdownRenderer content={cur.content} />
        </article>

        {/* ② 翻章：上一章／下一章（带章名，与沉浸阅读页底部的翻页条同一份信息） */}
        <div className="chnav">
          <button className="btn ghost" disabled={curIx <= 0} onClick={() => onGoTo(curIx - 1)}>
            ‹ {t('shelf.prevChapter')}{curIx > 0 ? ` · ${chapters[curIx - 1].title}` : ''}
          </button>
          <span className="gnote">{curIx + 1} / {total}</span>
          <button className="btn ghost" disabled={curIx >= total - 1} onClick={() => onGoTo(curIx + 1)}>
            {t('shelf.nextChapter')} ›{curIx < total - 1 ? ` · ${chapters[curIx + 1].title}` : ''}
          </button>
        </div>
      </section>

      {/* ③ 目录：照样张 `.toc` 点线索引；分卷出一行居中题头。当前章 `.on`（青蓝），
             点哪儿都是**原地换章**（onSelect 拦下跳转），地址同步由父级做。 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('shelf.contents')}</h2>
          <small>{t('count.chapters', { n: total })}</small>
        </div>
        <NovelToc
          chapters={chapters}
          hrefOf={(ch) => novelReadHref(article.id, ch.id)}
          activeIx={curIx}
          onSelect={onGoTo}
          partBreak
        />
      </section>

      {/* ④ 阅读设置：样张 `.reader` 的三行（字号／行距／深浅）。
             用户本轮**没勾**「进度（章号/百分比）」那一行，所以这里是三行不是四行。 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('shelf.settings')}</h2>
          <small>READER</small>
        </div>
        <ReaderSettings showProgress={false} />
      </section>

      {/* ⑤ 本章评论（用户点名追加在阅读界面里）：位置在正文之后、设置之后 */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('shelf.chapterComments', { n: curComments.length })}</h2>
          <small>LETTERS</small>
        </div>
        <N1Comments
          comments={curComments}
          onAdd={(name, content, parentId, parentName, avatar) => onAddComment(article.id + '::' + cur.id, { name, content, parentId, parentName, avatar })}
          currentUserId={currentUserId}
          onDelete={(cid) => onDeleteComment(cid)}
        />
      </section>
    </>
  );
}
