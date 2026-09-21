// ============================================================================
// 呓语集 · 段落切分与对齐（翻译 v2，2026-09-21）
// ----------------------------------------------------------------------------
// 为什么需要它：P3 的工作台是「左边整篇中文 / 右边整篇英文」，长文对不上行，
// 也看不出「这段到底译没译」。v2 把它改成**段对段**：中文按 Markdown 块切段，
// 每段独立存译文、独立判状态。
//
// 三条口径（Saber 2026-09-21 拍板）：
//   ① 段落是**内容寻址**的：段的 id = 该段中文文本的哈希（同段重复出现再加序号），
//      中文改了 → 哈希变了 → 旧译文自动落入「原文已变」档（珊瑚粉高亮），不会串行。
//   ② 中文改了以后**不自动吞掉**已写的东西：按 (哈希) → (位置) 两级匹配迁移；
//      实在对不上的才回到「未译」。
//   ③ 缺译段落回退中文原文、**不加任何标记**（他选的 A 口径）——见 mergeContent()。
//
// 这个文件是**纯函数**、零依赖，可以直接用 node 跑自检：
//     node .tmp-segments-selftest.mjs
// ============================================================================

/** 切出来的一段中文（id = 文本哈希＋重复序号） */
export interface ZhSegment {
  id: string;
  text: string;
}

/** 落库的一段译文（srcHash = 写它时对应中文的哈希，用来判「原文已变」） */
export interface TrSegment {
  id: string;
  srcHash: string;
  en: string;
  /** 保存时它在章节里的序号，中文改段后作为「按位置兜底匹配」的依据 */
  i: number;
}

/** 对齐后的一段（工作台逐段渲染用这个） */
export interface AlignedSegment {
  id: string;
  zh: string;
  en: string;
  index: number;
  /** empty=未译 / done=已译 / stale=原文改过（拿旧译文给他参考） */
  state: 'empty' | 'done' | 'stale';
  /**
   * 落库时写入 srcHash 的值＝**这段英文当初是对着哪版中文写的**。
   * 平时就等于 id；stale 的段保留旧哈希——**保存动作不会把它洗白**，
   * 只有他真在框里敲过字（组件里把 srcId 改成 id）才算复核过。
   */
  srcId: string;
  /** stale 时：改动前那版译文（他可以直接采用或重写） */
  staleEn: string;
}

/** FNV-1a 32 位（同步、够用）：哈希里带上长度，进一步压低碰撞 */
export function hashText(s: string): string {
  const t = (s || '').normalize('NFC');
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + '-' + t.length.toString(36);
}

/** 统一换行（站点里正文可能是 CRLF）并去掉行尾空白 */
export function normalizeSource(src: string): string {
  return (src || '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/^\n+/, '').replace(/\n+$/, '');
}

type Kind = 'text' | 'list' | 'table' | 'quote';

/** 行分类：决定「这一段该在哪断」 */
function kindOf(line: string): Kind {
  const l = line.replace(/^\s{0,3}/, '');
  if (/^\|/.test(l)) return 'table';
  if (/^>/.test(l)) return 'quote';
  if (/^([-*+]|\d+[.)])\s/.test(l)) return 'list';
  return 'text';
}

const isHeading = (line: string) => /^#{1,6}\s/.test(line.replace(/^\s{0,3}/, ''));
const isFence = (line: string) => /^(```|~~~)/.test(line.replace(/^\s{0,3}/, ''));
const isMathFence = (line: string) => /^\$\$/.test(line.replace(/^\s{0,3}/, ''));

/**
 * 把中文正文切成段。规则（块级 Markdown 感知）：
 *   · 空行断段；标题各自成段；
 *   · 列表的**每一项**各自成段（续行跟着那一项走）；
 *   · 表格 / 引用块：连续行算一段（表格切碎就没法译了）；
 *   · ``` 代码块、$$…$$ 公式块：整块一段，内部绝不切。
 */
export function splitSegments(src: string): ZhSegment[] {
  const lines = normalizeSource(src).split('\n');
  const texts: string[] = [];
  let buf: string[] = [];
  let bufKind: Kind = 'text';
  let mode: 'none' | 'fence' | 'math' = 'none';

  const flush = () => {
    const t = buf.join('\n').trim();
    if (t) texts.push(t);
    buf = [];
    bufKind = 'text';
  };

  for (const raw of lines) {
    const line = raw;

    // ── 代码围栏：整块不切
    if (mode === 'fence') {
      buf.push(line);
      if (isFence(line)) { flush(); mode = 'none'; }
      continue;
    }
    // ── 公式块：整块不切（单行 $$…$$ 自成一段）
    if (mode === 'math') {
      buf.push(line);
      if (isMathFence(line)) { flush(); mode = 'none'; }
      continue;
    }
    if (isFence(line)) { flush(); buf.push(line); mode = 'fence'; continue; }
    if (isMathFence(line)) {
      flush();
      buf.push(line);
      const closed = /^\$\$.+\$\$\s*$/.test(line);
      if (closed) flush();
      else mode = 'math';
      continue;
    }

    if (!line.trim()) { flush(); continue; }

    if (isHeading(line)) { flush(); buf.push(line); flush(); continue; }

    const k = kindOf(line);
    if (k === 'text') {
      if (bufKind === 'table' || bufKind === 'quote' || bufKind === 'list') flush();
      buf.push(line);
      bufKind = 'text';
      continue;
    }
    // 表格 / 引用：连续同类行算一段
    if (k === 'table' || k === 'quote') {
      if (bufKind !== k) flush();
      buf.push(line);
      bufKind = k;
      continue;
    }
    // 列表：每一项自己一段（续行并入当前项）
    flush();
    buf.push(line);
    bufKind = 'list';
  }
  flush();

  const seen = new Map<string, number>();
  return texts.map((text) => {
    const h = hashText(text);
    const n = seen.get(h) || 0;
    seen.set(h, n + 1);
    return { id: n === 0 ? h : h + '_' + n, text };
  });
}

/**
 * 把「已存的译文数组」对齐到「当前的中文段」。
 * 匹配顺序：① 段哈希完全命中 → 直接用；
 *          ② 同一位置(i)上有旧译文、但哈希不同 → 标 stale（原文已变，旧译文给他参考）；
 *          ③ 都不是 → 未译。
 * 中文段里**没有出现过**的旧译文自然被丢掉（历史版本里还留着）。
 */
export function alignSegments(zh: ZhSegment[], tr: TrSegment[] | null | undefined): AlignedSegment[] {
  const list = tr || [];
  const used = new Array(list.length).fill(false);

  // ① 哈希命中（先按相同 id 精确对，再不行按 srcHash）
  const byKey = new Map<string, number>();
  list.forEach((t, idx) => {
    if (!byKey.has(t.id)) byKey.set(t.id, idx);
    if (!byKey.has(t.srcHash)) byKey.set(t.srcHash, idx);
  });

  const primary: (number | null)[] = zh.map((z) => {
    const idx = byKey.get(z.id);
    if (idx !== undefined && !used[idx]) { used[idx] = true; return idx; }
    return null;
  });

  // ② 位置兜底：中文改过字 → 哈希变了，但大致还在原来的位置
  return zh.map((z, i) => {
    let hit = primary[i];
    let stale = false;
    if (hit === null) {
      const samePos = list.findIndex((t, idx) => !used[idx] && t.i === i);
      if (samePos >= 0) { used[samePos] = true; hit = samePos; stale = true; }
    }
    const en = hit === null ? '' : (list[hit].en || '');
    const srcId = hit === null
      ? z.id
      : (stale || (list[hit].srcHash && list[hit].srcHash !== z.id)
        ? (list[hit].srcHash || list[hit].id || z.id)
        : z.id);
    const state: AlignedSegment['state'] = hit === null
      ? 'empty'
      : (srcId !== z.id ? 'stale' : 'done');
    return {
      id: z.id,
      zh: z.text,
      en,
      index: i,
      // 有译文但内容为空的（历史脏数据）按未译处理，别让它显示成「已译」
      state: state === 'done' && !en.trim() ? 'empty' : state,
      srcId,
      staleEn: state === 'stale' ? en : '',
    };
  });
}

/** 对齐结果 + 序号 → 落库用的译文段（只留真正写了英文的段；i 记它当时的位置） */
export function toTrSegments(aligned: AlignedSegment[]): TrSegment[] {
  const out: TrSegment[] = [];
  aligned.forEach((a, i) => {
    if (!(a.en || '').trim()) return;
    out.push({ id: a.id, srcHash: a.srcId || a.id, en: a.en, i });
  });
  return out;
}

/**
 * ★ A 口径（Saber 拍板）：缺译的段**回退该段中文原文、不加任何标记**，
 * 目的是让英文页读起来不断裂——所以这里不能简单地 filter 掉空段。
 */
export function mergeContent(aligned: AlignedSegment[]): string {
  return aligned
    .filter((a) => a.zh.trim() || a.en.trim())
    .map((a) => (a.en.trim() ? a.en : a.zh))
    .join('\n\n');
}

/** 中文段落里有多少段是有译文的（进度条用） */
export function countAligned(aligned: AlignedSegment[]) {
  const total = aligned.length;
  const done = aligned.filter((a) => a.state === 'done').length;
  const stale = aligned.filter((a) => a.state === 'stale').length;
  return { total, done, stale, empty: total - done - stale };
}
