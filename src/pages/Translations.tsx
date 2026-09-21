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
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
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

  if (!isAdmin) {
    return (
      <div className="page">
        <p style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          无权访问，请以博主身份登录后使用。
        </p>
      </div>
    );
  }

  return (
    <div className="page write-page">
      <h1 className="page-title">翻译进度（English）</h1>
      <div className="tov-wrap">
        <div className="tov-sum">
          <span className="tov-chip">共 <b>{rows.length}</b> 篇</span>
          <span className="tov-chip tov-chip-done">已上线 <b>{sum.reviewed}</b></span>
          <span className="tov-chip">草稿 <b>{sum.draft}</b></span>
          <span className="tov-chip">未译 <b>{sum.none}</b></span>
          <span className="tov-chip tov-chip-stale">待复核 <b>{sum.stale}</b></span>
          <Link className="btn btn-light btn-sm" to="/write">回写作页</Link>
        </div>

        <p className="tr-hint">
          「待复核」＝中文原稿在译文之后改过（整篇级别或某一章级别）。点一行进工作台，
          里面会精确标出是哪几段改了。
        </p>

        {!trs ? (
          <div className="tov-loading">正在读取…</div>
        ) : (
          <div className="tov-list">
            {sorted.map((r) => {
              const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
              return (
                <div className={'tov-row tov-row-' + (r.state === 'reviewed' ? 'review' : r.state === 'stale' ? 'stale' : r.state === 'draft' ? 'draft' : 'none')} key={r.article.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="tov-title">{r.article.title}</div>
                    {r.enTitle && <div className="tov-title-en">{r.enTitle}</div>}
                  </div>
                  <span className={'tov-state tov-state-' + (r.state === 'none' ? 'none' : r.state)}>
                    {r.state === 'none' ? '未译' : r.state === 'stale' ? '待复核' : r.state === 'reviewed' ? '已上线' : '草稿'}
                  </span>
                  <div className="tov-col-extra">
                    <div className="tov-bar"><span style={{ width: pct + '%' }} /></div>
                    <div className="tov-col">{r.done}/{r.total} {r.unit}</div>
                  </div>
                  <div className="tov-col tov-col-extra">{r.enWords ? r.enWords + ' words' : '—'}</div>
                  <div className="tov-col tov-col-extra">
                    <Link className="tr-mini-btn" to={`/write/${r.article.id}?en=1`}>打开工作台</Link>
                  </div>
                </div>
              );
            })}
            {!sorted.length && <div className="tov-loading">还没有文章。</div>}
          </div>
        )}

        {/* P5：标签词典。标签是全站共用的，所以放在文章列表下面单独一块 */}
        <TagGlossary />
      </div>
    </div>
  );
}
