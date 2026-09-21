// ============================================================================
// 呓语集 · 英文翻译工作台 v2（段落对照 + 更新逻辑，2026-09-21）
// ----------------------------------------------------------------------------
// Saber 的原话：「全部翻译，但是翻译部分我自己来，或者说要让我能修改翻译成果」，
// 以及 v2 的起因：「提升英文翻译的方式，最好支持在写作页直接有翻译，此外更新逻辑，
// 现在不算很好用，给我一个方案」。→ 他拍板**不加机翻/AI**，把力气花在：
//
//  v2 相对 P3 的五处变化：
//   ① **段对段对照**：中文按 Markdown 切段，右边一段一个框，长文不再各滚各的；
//      每段独立状态：未译 / 已译 / 原文已变（珊瑚粉）。
//   ② **直接吃编辑器里的中文**：不再读数据库里那份旧中文——中文改了没保存也能对照，
//      顶部还直接给一个「先保存中文」按钮（P3 的「请先保存修改再回来」到此为止）。
//   ③ **原文已改不会被保存动作洗白**：段落的 srcHash 保留「当初对着哪版中文写的」，
//      只有真在框里敲过字（srcId 归位）才算复核过。
//   ④ **逐章保存 + 并发检查**：改哪章写哪章；库里的 updated_at 变了就报冲突，
//      给「保留我的 / 载入库里的」，不再静默覆盖（他习惯同时开几个窗口）。
//   ⑤ **自动保存 + 离开拦截 + 历史版本**：1.5s 防抖自动存草稿，Ctrl+S 仍在，
//      未保存离开会拦一下；每次保存由数据库触发器留快照，可「回到这一版」。
//
// 缺译口径（他 2026-09-21 选的 A 案）：**缺译的那段回退该段中文原文，不加任何标记**——
//   目的是让英文页读起来不断裂、读者感知最小。见 lib/segments.ts mergeContent()。
//
// 回滚：删掉本文件与 Write.tsx 里的挂载点即可（数据在 article_translations /
//   article_translation_chapters / article_translation_versions 三张表里）。
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Article, NovelChapter } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { LOCALE_BASE } from '../i18n';
import { countWords } from '../lib/wordCount';
import {
  AlignedSegment,
  TrSegment,
  alignSegments,
  countAligned,
  mergeContent,
  splitSegments,
  toTrSegments,
} from '../lib/segments';
import {
  TranslatedChapter,
  TranslationStatus,
  TranslationVersion,
  articleSourceHash,
  chapterSourceHash,
  deleteArticleTranslation,
  deleteChapterTranslation,
  fetchArticleTranslation,
  listTranslationVersions,
  saveArticleTranslation,
  saveChapterTranslation,
} from '../lib/translations';
import { TagTranslation, fetchAllTagTranslations } from '../lib/tagTranslations';

interface Props {
  /** 已保存的中文文章（拿 id、分类、novel 结构） */
  article: Article;
  /** ↓↓↓ 编辑器里**当前**的中文（可能还没保存）——v2 就是拿这些当对照源 */
  zhTitle: string;
  zhContent: string;
  zhSynopsis: string;
  zhChapters: NovelChapter[];
  /** 编辑器里有未保存的中文改动 */
  zhDirty: boolean;
  /** 触发写作页自己的「保存修改」 */
  onSaveZh: () => void;
  onClose: () => void;
}

/** 单元：非小说的正文与标题摘要同属 'meta'；小说每章一个 'ch:<章节id>' */
const META = 'meta';
const chUnit = (id: string) => 'ch:' + id;

const stateLabelOf = (s: AlignedSegment['state'], edited: boolean) => {
  if (s === 'stale') return '原文已变';
  if (s === 'empty') return '未译';
  return edited ? '已改' : '已译';
};

export default function TranslationWorkbench({
  article,
  zhTitle,
  zhContent,
  zhSynopsis,
  zhChapters,
  zhDirty,
  onSaveZh,
  onClose,
}: Props) {
  const isNovel = zhChapters.length > 0;

  // ── 已加载的译文 ──────────────────────────────────────────────────────────
  const [loaded, setLoaded] = useState(false);
  const [meta, setMeta] = useState({
    title: '',
    summary: '',
    status: 'draft' as TranslationStatus,
    sourceHash: '',
    updatedAt: '',
  });
  const [segs, setSegs] = useState<TrSegment[] | null>(null); // 非小说段落
  const [chs, setChs] = useState<Record<string, TranslatedChapter>>({}); // 逐章

  // ── 编辑态 ────────────────────────────────────────────────────────────────
  const [chapterId, setChapterId] = useState(zhChapters[0]?.id || '');
  const [edited, setEdited] = useState<Set<string>>(new Set()); // `${unit}::${segId}`
  const [dirty, setDirty] = useState<Set<string>>(new Set()); // 待存单元
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [preview, setPreview] = useState(false);
  const [historyUnit, setHistoryUnit] = useState<string | null>(null);
  const [versions, setVersions] = useState<TranslationVersion[] | null>(null);
  const [conflict, setConflict] = useState<null | { unit: string; remote: string }>(null);
  /** P5：全站标签词典（中文标签 → 词条）。标签是全站共用的，所以只读一次 */
  const [tagTrs, setTagTrs] = useState<Record<string, TagTranslation>>({});

  const unit: string = isNovel ? chUnit(chapterId) : META;

  // 读译文（博主登录态，草稿也读得到）
  useEffect(() => {
    let mounted = true;
    setLoaded(false);
    fetchArticleTranslation(article.id, 'en').then((tr) => {
      if (!mounted) return;
      setMeta({
        title: tr?.title ?? '',
        summary: tr?.summary ?? '',
        status: tr?.status ?? 'draft',
        sourceHash: tr?.sourceHash ?? '',
        updatedAt: tr?.updatedAt ?? '',
      });
      setSegs(tr?.segments ?? null);
      const map: Record<string, TranslatedChapter> = {};
      for (const c of tr?.chapters || []) map[c.id] = c;
      setChs(map);
      setDirty(new Set());
      setEdited(new Set());
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [article.id]);

  // 标签词典：读一次就够（它跟文章无关，改它去 /write/translations#tags）
  useEffect(() => {
    let mounted = true;
    fetchAllTagTranslations('en').then((list) => {
      if (!mounted) return;
      const map: Record<string, TagTranslation> = {};
      for (const t of list) map[t.tag] = t;
      setTagTrs(map);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ── 对照源（永远是编辑器里那份中文） ──────────────────────────────────────
  const zhChapter = isNovel ? zhChapters.find((c) => c.id === chapterId) : undefined;
  const sourceText = isNovel ? (zhChapter?.content || '') : zhContent;
  const storedSegs = isNovel ? (chs[chapterId]?.segments ?? null) : segs;

  /**
   * 极重要：把「已存译文 + 当前中文 + 本次会话的手改」合成渲染用的对齐数组。
   * 手改过的段 srcId 归位到当前中文 id ＝「这段我复核过了」。
   */
  const aligned = useMemo(() => {
    const list = alignSegments(splitSegments(sourceText), storedSegs);
    return list.map((a) => {
      const e = edited.has(unit + '::' + a.id);
      // 手改过 → 视为对着当前中文复核过（srcId 归位）
      return e && a.srcId !== a.id ? { ...a, srcId: a.id, state: a.en.trim() ? 'done' as const : a.state } : a;
    });
  }, [sourceText, storedSegs, edited, unit]);

  const stats = useMemo(() => countAligned(aligned), [aligned]);

  /** 各章进度（章节列表的小圆点） */
  const chapterStats = useMemo(() => {
    const out: Record<string, { total: number; done: number; stale: number }> = {};
    for (const c of zhChapters) {
      const list = alignSegments(splitSegments(c.content || ''), chs[c.id]?.segments ?? null);
      const s = countAligned(list);
      out[c.id] = { total: s.total, done: s.done, stale: s.stale };
    }
    return out;
  }, [zhChapters, chs]);

  /** 中文原稿在译文之后改过（整篇级别） */
  const draftArticle: Article = useMemo(
    () => ({
      ...article,
      title: zhTitle,
      content: zhContent,
      novel: isNovel
        ? { ...(article.novel as NonNullable<Article['novel']>), synopsis: zhSynopsis, chapters: zhChapters }
        : undefined,
    }),
    [article, zhTitle, zhContent, zhSynopsis, zhChapters, isNovel],
  );
  const sourceHashNow = articleSourceHash(draftArticle);
  const metaStale = !!meta.sourceHash && meta.sourceHash !== sourceHashNow;
  const staleCount =
    stats.stale +
    (isNovel ? Object.values(chapterStats).reduce((s, c) => s + c.stale, 0) : 0);

  // ── 最新值引用（自动保存/快捷键回调里读它，避免闭包过期） ──────────────────
  const latest = useRef({ meta, segs, chs, aligned, edited, dirty, isNovel, chapterId, sourceHashNow, zhChapters, zhContent, zhTitle });
  latest.current = { meta, segs, chs, aligned, edited, dirty, isNovel, chapterId, sourceHashNow, zhChapters, zhContent, zhTitle };

  // ── 编辑一段 ──────────────────────────────────────────────────────────────
  const commitAligned = useCallback((u: string, list: AlignedSegment[]) => {
    const next = toTrSegments(list);
    const anyEn = list.some((a) => a.en.trim());
    if (u === META) {
      setSegs(anyEn ? next : null);
      return;
    }
    const id = u.slice(3);
    setChs((prev) => {
      const old = prev[id];
      const zh = latest.current.zhChapters.find((c) => c.id === id);
      return {
        ...prev,
        [id]: {
          id,
          title: old?.title || '',
          content: anyEn ? mergeContent(list) : '',
          segments: anyEn ? next : null,
          srcHash: zh ? chapterSourceHash(zh) : (old?.srcHash || ''),
          updatedAt: old?.updatedAt || '',
        },
      };
    });
  }, []);

  const markDirty = useCallback((u: string) => {
    setDirty((prev) => (prev.has(u) ? prev : new Set(prev).add(u)));
    setMsg('');
  }, []);

  const onSegEdit = (a: AlignedSegment, value: string) => {
    const next = aligned.map((s) => (s.id === a.id ? { ...s, en: value, srcId: s.id } : s));
    commitAligned(unit, next);
    setEdited((prev) => new Set(prev).add(unit + '::' + a.id));
    markDirty(unit);
  };

  // 文章级字段（标题 / 摘要）
  const patchMeta = (p: Partial<typeof meta>) => {
    setMeta((prev) => ({ ...prev, ...p }));
    markDirty(META);
  };
  const patchChapterTitle = (value: string) => {
    if (!isNovel) return;
    setChs((prev) => {
      const old = prev[chapterId];
      const zh = zhChapters.find((c) => c.id === chapterId);
      return {
        ...prev,
        [chapterId]: {
          id: chapterId,
          title: value,
          content: old?.content || '',
          segments: old?.segments ?? null,
          srcHash: zh ? chapterSourceHash(zh) : (old?.srcHash || ''),
          updatedAt: old?.updatedAt || '',
        },
      };
    });
    setEdited((prev) => new Set(prev).add(chUnit(chapterId) + '::title'));
    markDirty(chUnit(chapterId));
  };

  // ── 保存 ──────────────────────────────────────────────────────────────────
  /** 存「文章级」：标题、摘要、非小说正文（段落）、状态、原文哈希 */
  const saveMeta = useCallback(
    async (status: TranslationStatus, force = false): Promise<boolean> => {
      const cur = latest.current;
      const alignedMeta = cur.isNovel
        ? []
        : alignSegments(splitSegments(cur.zhContent), cur.segs);
      const payload = {
        articleId: article.id,
        locale: 'en' as const,
        title: cur.meta.title,
        summary: cur.meta.summary,
        content: cur.isNovel ? '' : (alignedMeta.some((a) => a.en.trim()) ? mergeContent(alignedMeta) : ''),
        segments: cur.isNovel ? null : (cur.segs && cur.segs.length ? cur.segs : null),
        chapters: null,
        status,
        sourceHash: cur.sourceHashNow,
        updatedAt: cur.meta.updatedAt,
      };
      const res = await saveArticleTranslation(payload, force ? undefined : (cur.meta.updatedAt || undefined));
      if (res.conflict) {
        setConflict({ unit: META, remote: res.conflict.remoteUpdatedAt });
        return false;
      }
      if (res.error) {
        setMsg('保存失败：' + res.error);
        return false;
      }
      setMeta((prev) => ({ ...prev, status, sourceHash: cur.sourceHashNow, updatedAt: res.updatedAt || prev.updatedAt }));
      return true;
    },
    [article.id],
  );

  /** 存「一章」：改哪章写哪章 */
  const saveChapter = useCallback(
    async (chapterKey: string, force = false): Promise<boolean> => {
      const cur = latest.current;
      const id = chapterKey.slice(3);
      const zh = cur.zhChapters.find((c) => c.id === id);
      if (!zh) return true;
      const row = cur.chs[id];
      const stored = row?.segments ?? null;
      // 当前正在编辑的那一章，用组件里最新的对齐结果（可能还没进 chs）
      const list = id === cur.chapterId
        ? cur.aligned
        : alignSegments(splitSegments(zh.content || ''), stored);
      const anyEn = list.some((a) => a.en.trim());
      const res = await saveChapterTranslation(
        article.id,
        'en',
        {
          id,
          title: row?.title || '',
          content: anyEn ? mergeContent(list) : '',
          segments: anyEn ? toTrSegments(list) : null,
          srcHash: chapterSourceHash(zh),
          updatedAt: row?.updatedAt || '',
        },
        { expectUpdatedAt: force ? undefined : (row?.updatedAt || undefined) },
      );
      if (res.conflict) {
        setConflict({ unit: chapterKey, remote: res.conflict.remoteUpdatedAt });
        return false;
      }
      if (res.error) {
        setMsg('保存失败：' + res.error);
        return false;
      }
      setChs((prev) => ({
        ...prev,
        [id]: {
          id,
          title: row?.title || '',
          content: anyEn ? mergeContent(list) : '',
          segments: anyEn ? toTrSegments(list) : null,
          srcHash: chapterSourceHash(zh),
          updatedAt: res.updatedAt || row?.updatedAt || '',
        },
      }));
      return true;
    },
    [article.id],
  );

  /**
   * 保存指定单元（默认＝所有脏单元）。
   * status 传了才改状态，否则**保持当前状态**——这就是自动保存的口径：
   * 已上线的译文改动会直接更新英文页（这正是「更新逻辑好用」的意思），
   * 想先不公开就点「退回草稿」或关掉自动保存。
   */
  const flush = useCallback(
    async (opts: { status?: TranslationStatus; force?: boolean; units?: string[] } = {}) => {
      const cur = latest.current;
      const units = opts.units || Array.from(cur.dirty);
      const status = opts.status ?? cur.meta.status;
      const needMeta = units.includes(META);
      const chapters = units.filter((u) => u.startsWith('ch:'));
      if (!needMeta && !chapters.length) return true;
      setSaving(true);
      setConflict(null);
      let ok = true;
      if (needMeta) ok = await saveMeta(status, opts.force);
      for (const ck of chapters) {
        if (!ok) break;
        ok = await saveChapter(ck, opts.force);
      }
      setSaving(false);
      if (!ok) return false;
      const saved = new Set(units);
      setDirty((prev) => new Set(Array.from(prev).filter((u) => !saved.has(u))));
      setEdited((prev) => {
        const next = new Set(prev);
        for (const u of units) for (const k of Array.from(next)) if (k.startsWith(u + '::')) next.delete(k);
        return next;
      });
      setMsg(
        status === 'reviewed'
          ? '已保存并标记为「已审校」——英文页现在会显示它了。'
          : '已保存（草稿：英文页仍显示中文原文）。',
      );
      return true;
    },
    [saveChapter, saveMeta],
  );

  // 自动保存：1.5s 防抖。deps 里带上内容，输入过程会不断重置计时器
  useEffect(() => {
    if (!autoSave || saving || !loaded || dirty.size === 0 || conflict) return;
    const timer = setTimeout(() => { void flush(); }, 1500);
    return () => clearTimeout(timer);
  }, [autoSave, saving, loaded, dirty, conflict, flush, segs, chs, meta]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

  // 未保存就离开页面 → 拦一下
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.size === 0 && !zhDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, zhDirty]);

  // ── 历史版本 ──────────────────────────────────────────────────────────────
  const openHistory = async (u: string) => {
    setHistoryUnit(u);
    setVersions(null);
    const v = await listTranslationVersions(article.id, 'en', u === META ? 'article' : 'chapter:' + u.slice(3));
    setVersions(v);
  };

  /** 回到这一版：**只装进编辑器**（标成未保存），点保存才落库，避免误覆盖 */
  const restoreVersion = (v: TranslationVersion) => {
    if (!historyUnit) return;
    if (!window.confirm('把这一版装回编辑器？\n\n它只会在你点「保存」之后才写回数据库。')) return;
    if (historyUnit === META) {
      setMeta((prev) => ({ ...prev, title: v.title, summary: v.summary }));
      setSegs(v.segments);
    } else {
      const id = historyUnit.slice(3);
      setChs((prev) => ({
        ...prev,
        [id]: {
          id,
          title: v.title,
          content: v.content,
          segments: v.segments,
          srcHash: v.sourceHash,
          updatedAt: prev[id]?.updatedAt || '',
        },
      }));
    }
    markDirty(historyUnit);
    setHistoryUnit(null);
    setMsg('已把这版装进编辑器，点「保存」才写回数据库。');
  };

  // ── 删除 ──────────────────────────────────────────────────────────────────
  const removeTranslation = async () => {
    if (!window.confirm('删除这篇的英文译文？\n\n删除后英文页会回到「显示中文原文＋一行提示」。')) return;
    const { error } = await deleteArticleTranslation(article.id, 'en');
    if (error) { alert('删除失败：' + error); return; }
    setMeta({ title: '', summary: '', status: 'draft', sourceHash: '', updatedAt: '' });
    setSegs(null);
    setChs({});
    setDirty(new Set());
    setEdited(new Set());
    setMsg('已删除英文译文。');
  };
  const removeChapter = async () => {
    if (!window.confirm('删除这一章的英文译文？\n\n英文页这一章会回到中文原文。')) return;
    const { error } = await deleteChapterTranslation(article.id, 'en', chapterId);
    if (error) { alert('删除失败：' + error); return; }
    setChs((prev) => { const n = { ...prev }; delete n[chapterId]; return n; });
    setDirty((prev) => new Set(Array.from(prev).filter((u) => u !== unit)));
    setMsg('已删除这一章的译文。');
  };

  // ── 字数 ──────────────────────────────────────────────────────────────────
  const enWords = isNovel
    ? countWords(Object.values(chs).map((c) => c.content || '').join('\n'), 'en')
    : countWords(aligned.map((a) => a.en || '').join('\n'), 'en');
  const zhWords = isNovel
    ? countWords(zhChapters.map((c) => c.content || '').join('\n'), 'zh')
    : countWords(zhContent, 'zh');
  const allEn = aligned.some((a) => a.en.trim());

  const statusLabel = meta.status === 'reviewed' ? '已审校 · 线上可见' : '草稿 · 仅自己可见';
  const dirtyList = Array.from(dirty);
  const dirtyLabel = dirtyList.length
    ? `未保存 ${dirtyList.length} 处${autoSave ? '（1.5 秒后自动保存）' : ''}`
    : '';

  return (
    <div className="tr-workbench">
      <div className="tr-head">
        <div className="tr-head-main">
          <h2 className="tr-title">英文译文（English）</h2>
          <span className={'tr-status tr-status-' + meta.status}>{statusLabel}</span>
          {dirtyLabel && <span className="tr-dirty">{dirtyLabel}</span>}
          {saving && <span className="tr-saving">保存中…</span>}
        </div>
        <div className="tr-head-actions">
          <a className="btn btn-light btn-sm" href={`${LOCALE_BASE.en}/article/${article.id}`} target="_blank" rel="noreferrer">看英文页</a>
          <a className="btn btn-light btn-sm" href={`/article/${article.id}`} target="_blank" rel="noreferrer">看中文页</a>
          <a className="btn btn-light btn-sm" href="/write/translations">翻译进度</a>
          <button className="btn btn-light btn-sm" onClick={onClose}>返回中文编辑</button>
        </div>
      </div>

      <p className="tr-hint">
        左边是<strong>中文</strong>（编辑器里这份，没保存也能对照），右边是<strong>英文</strong>——机器不翻译，全部由你自己写。
        每段一个框，一段一段来；「存草稿」随时存，标成「已审校」之后英文页才显示它。
        {isNovel && ' 小说逐章翻译：左侧点章节，改哪章存哪章。'}
      </p>

      {/* P5：这篇的标签。标签是全站共用的，改它去标签词典（不在本工作台里翻） */}
      {article.tags.length > 0 && (
        <div className="tr-tags">
          <span className="tr-tags-label">标签</span>
          {article.tags.map((zh) => {
            const t = tagTrs[zh];
            const en = (t?.translation || '').trim();
            const state = !en ? 'none' : t!.status;
            return (
              <span
                className={'tr-tag tr-tag-' + state}
                key={zh}
                title={en ? `${zh} → ${en}` : `${zh}：还没翻，英文页照旧显示中文`}
              >
                <span className="tr-tag-zh">#{zh}</span>
                <span className="tr-tag-arrow">→</span>
                <span className="tr-tag-en">{en || zh}</span>
                <span className="tr-tag-state">
                  {!en ? '未译' : t!.status === 'reviewed' ? '已上线' : '草稿'}
                </span>
              </span>
            );
          })}
          <a className="tr-mini-btn" href="/write/translations#tags">去标签词典</a>
        </div>
      )}

      {zhDirty && (
        <div className="tr-note tr-note-warn">
          中文编辑器里还有<strong>未保存</strong>的改动，这里对照的就是你正在改的这份。
          <button className="tr-mini-btn" onClick={onSaveZh}>先保存中文</button>
          <span className="tr-note-sub">（保存中文不会影响已写的英文；只有中文真的变了，对应段落才会标「原文已变」）</span>
        </div>
      )}

      {metaStale && (
        <div className="tr-note tr-note-stale">
          中文原稿在这份译文之后改过{staleCount ? `——标成珊瑚色的 ${staleCount} 段就是改了的那几段` : ''}，复核一遍再标「已审校」更稳妥。
        </div>
      )}

      {meta.status === 'reviewed' && autoSave && (
        <div className="tr-note tr-note-warn">
          这篇<strong>已经上线</strong>：自动保存会<strong>直接更新英文页</strong>（约 1.5 秒后生效）。
          想先改好再放出去，就关掉下面的「自动保存」，或者先点「退回草稿」。
        </div>
      )}

      {conflict && (
        <div className="tr-note tr-note-conflict">
          <strong>另一个窗口改过这份译文</strong>（库里更新于 {conflict.remote.replace('T', ' ').slice(0, 16)}）。本次**没有**写入，免得把你的另一份改动覆盖掉。
          <button className="btn btn-primary btn-sm" onClick={() => void flush({ force: true })}>用我这里这份覆盖</button>
          <button className="btn btn-light btn-sm" onClick={() => window.location.reload()}>载入库里那一份</button>
        </div>
      )}

      {!loaded ? (
        <div className="tr-loading">正在读取英文译文…</div>
      ) : (
        <>
          <div className="tr-meta-row">
            <label className="tr-field">
              <span className="tr-label">英文标题（English title）</span>
              <input
                type="text"
                className="tr-input"
                value={meta.title}
                onChange={(e) => patchMeta({ title: e.target.value })}
                placeholder={zhTitle}
              />
            </label>
            <label className="tr-field">
              <span className="tr-label">{isNovel ? '英文简介（Synopsis）' : '英文摘要（Summary）'}</span>
              <textarea
                className="tr-textarea tr-textarea-sm"
                rows={2}
                value={meta.summary}
                onChange={(e) => patchMeta({ summary: e.target.value })}
                placeholder={isNovel ? zhSynopsis : article.summary || ''}
              />
            </label>
          </div>

          <div className={'tr-body' + (isNovel ? ' tr-body-novel' : '')}>
            {isNovel && (
              <div className="tr-chapter-rail">
                <div className="tr-rail-head">
                  章节 · 已译 {Object.values(chapterStats).filter((c) => c.total > 0 && c.done === c.total).length}/{zhChapters.length}
                </div>
                {zhChapters.map((c, i) => {
                  const st = chapterStats[c.id] || { total: 0, done: 0, stale: 0 };
                  const full = st.total > 0 && st.done === st.total;
                  return (
                    <button
                      key={c.id}
                      className={'tr-chapter-item' + (c.id === chapterId ? ' active' : '')}
                      onClick={() => { setChapterId(c.id); setPreview(false); }}
                    >
                      <span
                        className={'tr-chapter-dot' + (st.stale ? ' stale' : full ? ' on' : st.done ? ' part' : '')}
                        title={st.stale ? '有段落原文已变' : full ? '整章已译' : `已译 ${st.done}/${st.total} 段`}
                      />
                      <span className="tr-chapter-name">{i + 1}. {c.title || '（无标题）'}</span>
                      <span className="tr-chapter-wc">{st.done}/{st.total} 段</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="tr-seg-pane">
              <div className="tr-pane-head">
                <span className="tr-pane-title">
                  {isNovel
                    ? `第 ${Math.max(1, zhChapters.findIndex((c) => c.id === chapterId) + 1)} 章 · ${zhChapter?.title || '（无标题）'}`
                    : '正文（逐段对照）'}
                </span>
                <span className="tr-pane-stats">
                  已译 {stats.done}/{stats.total} 段{stats.stale ? ` · ${stats.stale} 段待复核` : ''}
                </span>
                <button className="tr-mini-btn" onClick={() => setPreview((p) => !p)}>
                  {preview ? '回到编辑' : '预览英文'}
                </button>
                <button className="tr-mini-btn" onClick={() => void openHistory(unit)}>历史版本</button>
                {isNovel && <button className="tr-mini-btn tr-mini-danger" onClick={() => void removeChapter()}>删除本章译文</button>}
              </div>

              {isNovel && (
                <input
                  type="text"
                  className="tr-input tr-input-ch"
                  value={chs[chapterId]?.title || ''}
                  onChange={(e) => patchChapterTitle(e.target.value)}
                  placeholder={zhChapter?.title ? `${zhChapter.title} → 英文标题` : 'Chapter title in English'}
                />
              )}

              {!stats.total && (
                <div className="tr-empty-seg">
                  这一{isNovel ? '章' : '篇'}还没有中文正文可对照{isNovel ? '（先在左边编辑这一章的正文）' : '（先在编辑器里写正文）'}。
                </div>
              )}

              {preview ? (
                <div className="tr-preview">
                  <MarkdownRenderer content={allEn ? mergeContent(aligned) : sourceText} />
                  {!allEn && <p className="tr-preview-note">还没有英文，这里显示的是中文原文（英文页此时也是这个效果）。</p>}
                </div>
              ) : (
                <div className="tr-seg-list">
                  {aligned.map((a, i) => {
                    const key = unit + '::' + a.id;
                    const isEdited = edited.has(key);
                    return (
                      <div className={'tr-seg tr-seg-' + a.state + (isEdited ? ' tr-seg-edited' : '')} key={a.id}>
                        <div className="tr-seg-zh">
                          <span className="tr-seg-no">{i + 1}</span>
                          <div className="tr-seg-zh-text">{a.zh}</div>
                        </div>
                        <div className="tr-seg-en">
                          <textarea
                            className="tr-seg-input"
                            value={a.en}
                            onChange={(e) => onSegEdit(a, e.target.value)}
                            rows={Math.min(14, Math.max(3, Math.ceil(a.zh.length / 38)))}
                            placeholder={a.state === 'stale' ? '这段中文改过了，旧译文见下方——复核或重写…' : '译这一段…'}
                          />
                          <div className="tr-seg-bar">
                            <span className={'tr-seg-dot tr-seg-dot-' + a.state + (isEdited ? ' edited' : '')} />
                            <span className="tr-seg-state">{stateLabelOf(a.state, isEdited)}</span>
                            {a.state === 'stale' && a.staleEn && (
                              <details className="tr-seg-old">
                                <summary>看旧译文</summary>
                                <div className="tr-seg-old-text">{a.staleEn}</div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="tr-count-line">
                {isNovel ? `本章已译 ${stats.done}/${stats.total} 段` : `已译 ${stats.done}/${stats.total} 段`}
                {' · '}
                {countWords(aligned.map((a) => a.en || '').join(' '), 'en')} words（全篇 {enWords}）· 中文 {zhWords} 字
              </div>
            </div>
          </div>

          <div className="tr-actions">
            <button className="btn btn-primary" onClick={() => void flush()} disabled={saving}>
              {saving ? '保存中…' : '保存（Ctrl+S）'}
            </button>
            {meta.status === 'reviewed' ? (
              <button className="btn btn-light" onClick={() => void flush({ status: 'draft', units: Array.from(new Set([META, ...Array.from(dirty)])) })} disabled={saving}>
                退回草稿（英文页先不显示）
              </button>
            ) : (
              <button className="btn btn-light" onClick={() => void flush({ status: 'reviewed', units: Array.from(new Set([META, ...Array.from(dirty)])) })} disabled={saving}>
                标记为已审校并上线
              </button>
            )}
            <label className="tr-autosave">
              <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
              自动保存
            </label>
            <button className="btn btn-danger btn-sm" onClick={() => void removeTranslation()}>删除译文</button>
            {msg && <span className="tr-msg">{msg}</span>}
          </div>
        </>
      )}

      {historyUnit && (
        <div className="tr-history-mask" onClick={() => setHistoryUnit(null)}>
          <div className="tr-history" onClick={(e) => e.stopPropagation()}>
            <div className="tr-history-head">
              <strong>历史版本{historyUnit === META ? '（标题 / 摘要 / 正文）' : '（本章）'}</strong>
              <button className="tr-mini-btn" onClick={() => setHistoryUnit(null)}>关闭</button>
            </div>
            <p className="tr-history-desc">每次保存数据库都会自动留一份，最多留最近 30 版。「回到这一版」只把它装进编辑器，点保存才写回。</p>
            {versions === null ? (
              <div className="tr-loading">正在读取…</div>
            ) : versions.length === 0 ? (
              <div className="tr-empty-seg">还没有历史版本（保存过一次之后就有了）。</div>
            ) : (
              <ul className="tr-history-list">
                {versions.map((v) => (
                  <li key={v.id}>
                    <span className="tr-history-time">{v.savedAt.replace('T', ' ').slice(0, 16)}</span>
                    <span className={'tr-status tr-status-' + v.status}>{v.status === 'reviewed' ? '已审校' : '草稿'}</span>
                    <span className="tr-history-words">
                      {countWords(v.segments?.map((s) => s.en).join(' ') || v.content || '', 'en')} words
                    </span>
                    <button className="tr-mini-btn" onClick={() => restoreVersion(v)}>回到这一版</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
