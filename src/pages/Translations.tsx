// ============================================================================
// 呓语集 · 翻译进度总览（翻译 v2 第 3 包，2026-09-21）
// ----------------------------------------------------------------------------
// 解决 P3 的一个真实痛点：没有一个地方能一眼看出「还有哪几篇没译 / 哪几篇的
// 中文改过、英文该复核了」。这一页把全站文章排成一张表：
//   状态（未译 / 草稿 / 已上线 / 待复核）· 段落或章节进度 · 英文词数 · 最后更新时间，
// 点一行直接带着 `?en=1` 进写作页的英文工作台。
//
// 数据：articles × article_translations（+ 逐章表），全部在浏览器里算，
// 不发新的后端请求。状态判定与工作台同源（articleSourceHash / chapterSourceHash），
// 所以两边看到的「待复核」永远一致。
//
// ★ 2026-10-09「登录，个人主页和翻译界面未统一风格」（用户原话）★
//   页身从旧皮肤（`.page write-page` ＋ `.tov-list/.tov-row/.tov-chip` 那张自建表）
//   换成 N1 样张已有的语汇：
//     `.pagehead` 页头（kicker ＋ 大标题 ＋ 导语）
//     `.tiles`    汇总带（首页「分类索引带」那件：色点方块 ＋ 名字 ＋ 数字）
//     `.list`/`.item` 条目流（档案页那套三栏纯文字条目）＋ `.bar` 细进度线
//   判定逻辑、排序、数据来源**一行未改**；`--c` 只用来给状态点取四色之一。
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useArticles } from '../context/ArticleContext';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import TagGlossary from '../components/TagGlossary';
import type { Article } from '../types';
import { countWords } from '../lib/wordCount';
import { alignSegments, splitSegments } from '../lib/segments';
import {
  ArticleTranslation,
  articleSourceHash,
  chapterSourceHash,
  fetchAllTranslations,
} from '../lib/translations';

type RowState = 'none' | 'draft' | 'reviewed' | 'stale';

interface Row {
  article: Article;
  state: RowState;
  done: number;
  total: number;
  unit: string; // '段' 或 '章'
  enWords: number;
  updatedAt: string;
  enTitle: string;
}

/* 状态 → 文案（色点由 `n1-app.css` 第⑤段的 `.tov-<state> .st` 给：四色取站点色卡） */
const STATE_LABEL: Record<RowState, string> = {
  none: '未译',
  stale: '待复核',
  reviewed: '已上线',
  draft: '草稿',
};

export default function Translations() {
  const { isAdmin } = useAuth();
  const { articles } = useArticles();
  const [trs, setTrs] = useState<ArticleTranslation[] | null>(null);
  usePageTitle('翻译进度');

  useEffect(() => {
    let mounted = true;
    fetchAllTranslations('en').then((list) => {
      if (mounted) setTrs(list);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    if (!trs) return [];
    const byId = new Map(trs.map((t) => [t.articleId, t]));
    return articles.map((a) => {
      const tr = byId.get(a.id);
      const hash = articleSourceHash(a);
      const isNovel = !!a.novel?.chapters?.length;
      let done = 0;
      let total = 0;
      let unit = '段';
      let enWords = 0;

      if (isNovel) {
        unit = '章';
        const zhChs = a.novel?.chapters || [];
        total = zhChs.length;
        const byCh = new Map((tr?.chapters || []).map((c) => [c.id, c]));
        done = zhChs.filter((zh) => {
          const c = byCh.get(zh.id);
          return !!c && (!!c.segments?.length || !!c.content.trim() || !!c.title.trim());
        }).length;
        enWords = countWords((tr?.chapters || []).map((c) => c.content || '').join('\n'), 'en');
      } else {
        const list = alignSegments(splitSegments(a.content || ''), tr?.segments ?? null);
        total = list.length;
        done = list.filter((s) => s.en.trim()).length;
        enWords = countWords((tr?.segments || []).map((s) => s.en).join(' '), 'en');
      }

      // 「待复核」的两种来源：整篇原文哈希变了；或某一章的中文变了
      const chaptersChanged = isNovel
        ? (a.novel?.chapters || []).some((zh) => {
            const c = (tr?.chapters || []).find((x) => x.id === zh.id);
            return !!c && !!c.srcHash && c.srcHash !== chapterSourceHash(zh);
          })
        : false;
      const stale = !!tr?.sourceHash && (tr.sourceHash !== hash || chaptersChanged);

      const hasAny = !!tr && (!!tr.title.trim() || !!tr.content.trim() || !!tr.segments?.length || !!tr.chapters?.length || done > 0);
      const state: RowState = !hasAny ? 'none' : stale ? 'stale' : (tr!.status === 'reviewed' ? 'reviewed' : 'draft');

      return {
        article: a,
        state,
        done,
        total,
        unit,
        enWords,
        updatedAt: tr?.updatedAt || '',
        enTitle: tr?.title || '',
      };
    });
  }, [articles, trs]);

  const order: Record<RowState, number> = { stale: 0, none: 1, draft: 2, reviewed: 3 };
  const sorted = useMemo(
    () => rows.slice().sort((x, y) => order[x.state] - order[y.state] || y.article.date.localeCompare(x.article.date)),
    [rows],
  );
  const sum = useMemo(() => {
    const c = { none: 0, draft: 0, reviewed: 0, stale: 0 } as Record<RowState, number>;
    for (const r of rows) c[r.state]++;
    return c;
  }, [rows]);

  /* 汇总带：照首页 `.tiles`（色点方块 ＋ 名字 ＋ 数字），色号取站点四色，不新增 */
  const tiles: { label: string; n: number; c: string }[] = [
    { label: '共', n: rows.length, c: 'var(--sky)' },
    { label: '已上线', n: sum.reviewed, c: 'var(--teal)' },
    { label: '草稿', n: sum.draft, c: 'var(--honey)' },
    { label: '未译', n: sum.none, c: 'var(--gray)' },
    { label: '待复核', n: sum.stale, c: 'var(--coral)' },
  ];

  if (!isAdmin) {
    return (
      <>
        <section className="pagehead">
          <div className="pagehead-txt">
            <div className="kicker">TRANSLATIONS</div>
            <h1>翻译进度</h1>
          </div>
        </section>
        <section className="sec">
          <p className="gnote">无权访问，请以博主身份登录后使用。</p>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">TRANSLATIONS</div>
          <h1>翻译进度（English）</h1>
          <p className="lede">
            「待复核」＝中文原稿在译文之后改过（整篇级别或某一章级别）。
            点一行进工作台，里面会精确标出是哪几段改了。
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="tiles">
          {tiles.map((x) => (
            <span className="tile" key={x.label} style={{ '--c': x.c } as CSSProperties}>
              <b>{x.label}</b>
              <span className="n">{x.n}</span>
            </span>
          ))}
        </div>
        <p className="tov-back">
          <Link className="btn" to="/write">回写作页</Link>
        </p>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2>文章</h2>
          <small>{rows.length} ARTICLES</small>
        </div>

        {!trs ? (
          <p className="gnote">正在读取…</p>
        ) : !sorted.length ? (
          <p className="gnote">还没有文章。</p>
        ) : (
          <div className="list tov-list">
            {sorted.map((r) => {
              const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
              return (
                <div className={`item tov-item tov-${r.state}`} key={r.article.id}>
                  <div className="item-txt">
                    <h3>
                      <Link to={`/write/${r.article.id}?en=1`}>{r.article.title}</Link>
                    </h3>
                    {r.enTitle && <p className="en">{r.enTitle}</p>}
                    <div className="meta">
                      <span className="st">{STATE_LABEL[r.state]}</span>
                      <span>{r.done}/{r.total} {r.unit}</span>
                      <span>{r.enWords ? `${r.enWords} words` : '—'}</span>
                      {r.updatedAt && <span>{r.updatedAt.slice(0, 10)}</span>}
                    </div>
                    <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* P5：标签词典。标签是全站共用的，所以放在文章列表下面单独一块 */}
      <TagGlossary />
    </>
  );
}
