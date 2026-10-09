// ============================================================================
// 呓语集 · 标签词典编辑区（P5，2026-09-21）
// ----------------------------------------------------------------------------
// Saber 的指令：「支持标签翻译」。这一块就是那个功能的操作台，挂在
// 「翻译进度」页（/write/translations）上——标签与文章译文放在同一个地方看，
// 不用再多一个入口。
//
// 口径：
//   · **一个中文标签一行**，翻一次全站生效（标签是跨文章复用的自由文本）。
//   · 改了自动存（1.5 秒防抖），但要**点「上线」**英文站才显示——草稿只有自己看得见。
//   · 清空输入框＝删掉这个词条，英文页退回显示中文标签。
//   · 缺译就显示中文标签，不加任何标记（他 2026-09-21 选的 A 案）。
//
// 这一页只有博主能进（Translations.tsx 已经把门），所以文案保持中文，
// 与 Write.tsx / 工作台一致——按他的口径「只有博主自己坐进去用的编辑器不翻」。
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { TranslationStatus } from '../lib/translations';
import {
  TagTranslation,
  deleteTagTranslation,
  fetchAllTagTranslations,
  saveTagTranslation,
} from '../lib/tagTranslations';

interface Row {
  tag: string;
  /** 有多少篇文章在用这个标签 */
  count: number;
  translation: string;
  status: TranslationStatus;
  /** 库里有没有这一行（没有＝完全没碰过） */
  stored: boolean;
}

const isAscii = (s: string) => /^[\x20-\x7e]+$/.test(s);
const statusLabel = (s: TranslationStatus) => (s === 'reviewed' ? '已上线' : '草稿');

export default function TagGlossary() {
  const { articles } = useArticles();
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { translation: string; status: TranslationStatus }>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [onlyTodo, setOnlyTodo] = useState(false);

  // 读词典（博主登录态：连草稿一起）
  useEffect(() => {
    let mounted = true;
    fetchAllTagTranslations('en').then((list: TagTranslation[]) => {
      if (!mounted) return;
      const next: Record<string, { translation: string; status: TranslationStatus }> = {};
      for (const t of list) next[t.tag] = { translation: t.translation, status: t.status };
      setDrafts(next);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /** 全站文章实际用到的标签 + 出现篇数（词典里多出来的孤儿词条也要显示出来） */
  const rows: Row[] = useMemo(() => {
    const count = new Map<string, number>();
    for (const a of articles) {
      for (const t of a.tags || []) count.set(t, (count.get(t) || 0) + 1);
    }
    for (const t of Object.keys(drafts)) if (!count.has(t)) count.set(t, 0);

    const list: Row[] = [];
    for (const [tag, n] of count) {
      const d = drafts[tag];
      list.push({
        tag,
        count: n,
        translation: d?.translation ?? '',
        status: d?.status ?? 'draft',
        stored: !!d,
      });
    }
    const rank = (r: Row) => (r.translation.trim() ? (r.status === 'reviewed' ? 2 : 1) : 0);
    return list.sort((a, b) => rank(a) - rank(b) || b.count - a.count || a.tag.localeCompare(b.tag));
  }, [articles, drafts]);

  const sum = useMemo(() => {
    const c = { none: 0, draft: 0, reviewed: 0 };
    for (const r of rows) {
      if (!r.translation.trim()) c.none++;
      else if (r.status === 'reviewed') c.reviewed++;
      else c.draft++;
    }
    return c;
  }, [rows]);

  const shown = onlyTodo ? rows.filter((r) => !r.translation.trim() || r.status !== 'reviewed') : rows;

  // ── 保存 ──────────────────────────────────────────────────────────────────
  const latest = useRef({ drafts, dirty });
  latest.current = { drafts, dirty };

  const flush = async (tags?: string[], forceStatus?: TranslationStatus) => {
    const cur = latest.current;
    const list = tags || Array.from(cur.dirty);
    if (!list.length) return;
    setSaving(true);
    let failed = '';
    for (const tag of list) {
      const d = cur.drafts[tag] || { translation: '', status: 'draft' as TranslationStatus };
      const status = forceStatus ?? d.status;
      const res = await saveTagTranslation(tag, 'en', { translation: d.translation, status });
      if (res.error) {
        failed = res.error;
        break;
      }
      setDrafts((prev) => {
        const next = { ...prev };
        if (!d.translation.trim()) delete next[tag];
        else next[tag] = { translation: d.translation, status };
        return next;
      });
    }
    setSaving(false);
    setDirty((prev) => new Set(Array.from(prev).filter((t) => !list.includes(t))));
    setMsg(failed ? '保存失败：' + failed : `已保存 ${list.length} 个标签词条。`);
  };

  // 自动保存：1.5 秒防抖（与工作台同一套手感）
  useEffect(() => {
    if (saving || !loaded || dirty.size === 0) return;
    const timer = setTimeout(() => { void flush(); }, 1500);
    return () => clearTimeout(timer);
  }, [dirty, saving, loaded, drafts]);

  const patch = (tag: string, p: Partial<{ translation: string; status: TranslationStatus }>) => {
    setDrafts((prev) => {
      const old = prev[tag] || { translation: '', status: 'draft' as TranslationStatus };
      return { ...prev, [tag]: { ...old, ...p } };
    });
    setDirty((prev) => new Set(prev).add(tag));
    setMsg('');
  };

  const remove = async (tag: string) => {
    const { error } = await deleteTagTranslation(tag, 'en');
    if (error) { setMsg('删除失败：' + error); return; }
    setDrafts((prev) => { const n = { ...prev }; delete n[tag]; return n; });
    setDirty((prev) => { const n = new Set(prev); n.delete(tag); return n; });
    setMsg(`已删除「${tag}」，英文页退回显示中文标签。`);
  };

  /** 把已经写过英文、但还挂着草稿的一批一次性推上线 */
  const publishAll = async () => {
    const todo = rows.filter((r) => r.translation.trim() && r.status !== 'reviewed').map((r) => r.tag);
    if (!todo.length) { setMsg('没有「写着英文但还没上线」的词条。'); return; }
    if (!window.confirm(`把这 ${todo.length} 个词条标为「已上线」？英文站立刻显示它们的英文。`)) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const t of todo) if (next[t]) next[t] = { ...next[t], status: 'reviewed' };
      return next;
    });
    await flush(todo, 'reviewed');
  };

  /* ══════════════════════════════════════════════════════════════════════════════
     页身（2026-10-09 随「翻译界面未统一风格」一起换到 N1 语汇）
     ──────────────────────────────────────────────────────────────────────────────
     这一块原来是自己一套 `.tag-gloss/.tg-head/.tg-row/.tg-input/.tr-mini-btn`，
     现在接到 N1 上：区块＝`.sec` ＋ `.sec-head`（自动「第 N 版」），
     输入＝`.gform input` 同款细下划线，小动作＝`.tbtn` 小字按钮，
     只有「一行四格」这个网格样张里没有（`.tag-row`），落 `n1-app.css` 第⑤段。
     取数、防抖自动保存、上线／转草稿／删除的逻辑**一行未改**。
     ══════════════════════════════════════════════════════════════════════════════ */
  return (
    <section className="sec" id="tags">
      <div className="sec-head">
        <h2>标签词典（Tags）</h2>
        <small>{rows.length} TAGS</small>
      </div>

      {/* 词典的汇总带：与上面文章那张同一件 `.tiles`，四色仍旧取站点色卡 */}
      <div className="tiles">
        <span className="tile" style={{ '--c': 'var(--sky)' } as CSSProperties}>
          <b>共</b><span className="n">{rows.length}</span>
        </span>
        <span className="tile" style={{ '--c': 'var(--teal)' } as CSSProperties}>
          <b>已上线</b><span className="n">{sum.reviewed}</span>
        </span>
        <span className="tile" style={{ '--c': 'var(--honey)' } as CSSProperties}>
          <b>草稿</b><span className="n">{sum.draft}</span>
        </span>
        <span className="tile" style={{ '--c': 'var(--gray)' } as CSSProperties}>
          <b>未译</b><span className="n">{sum.none}</span>
        </span>
        {saving && <span className="tile"><span className="n">保存中…</span></span>}
      </div>

      <p className="gnote">
        标签是<strong>全站共用</strong>的：一个中文标签只翻一次，所有文章上的它一起变。
        改完 1.5 秒自动存草稿，点<strong>「上线」</strong>英文站才显示；没翻的标签英文页照旧显示中文（不加标记）。
        清空输入框＝删掉这个词条。
      </p>

      <div className="tag-tools">
        <label className="gnote">
          <input type="checkbox" checked={onlyTodo} onChange={(e) => setOnlyTodo(e.target.checked)} />
          只看还没上线的
        </label>
        <button type="button" className="tbtn" onClick={() => void publishAll()} disabled={saving}>
          把已写好的都上线
        </button>
        {msg && <span className="gnote">{msg}</span>}
      </div>

      {!loaded ? (
        <p className="gnote">正在读取标签词典…</p>
      ) : !shown.length ? (
        <p className="gnote">没有要处理的标签。</p>
      ) : (
        <div className="tag-list">
          {shown.map((r) => {
            const empty = !r.translation.trim();
            return (
              <div className="tag-row" key={r.tag}>
                <span className="tag-cn">
                  #{r.tag}
                  <i>{r.count} 篇</i>
                  {empty && isAscii(r.tag) && <i className="tag-note">看起来已经是英文</i>}
                </span>
                <input
                  type="text"
                  value={r.translation}
                  placeholder={r.tag}
                  aria-label={`${r.tag} 的英文`}
                  onChange={(e) => patch(r.tag, { translation: e.target.value })}
                />
                <span className={'tag-state' + (empty ? '' : r.status === 'reviewed' ? ' on' : ' draft')}>
                  {empty ? (r.stored ? '未译（已清空）' : '未译') : statusLabel(r.status)}
                </span>
                <span className="tag-acts">
                  {!empty && r.status !== 'reviewed' && (
                    <button
                      type="button"
                      className="tbtn"
                      onClick={() => { patch(r.tag, { status: 'reviewed' }); void flush([r.tag], 'reviewed'); }}
                    >
                      上线
                    </button>
                  )}
                  {!empty && r.status === 'reviewed' && (
                    <button type="button" className="tbtn" onClick={() => { patch(r.tag, { status: 'draft' }); void flush([r.tag], 'draft'); }}>
                      转草稿
                    </button>
                  )}
                  {r.stored && (
                    <button type="button" className="tbtn tag-del" onClick={() => void remove(r.tag)}>删除</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
