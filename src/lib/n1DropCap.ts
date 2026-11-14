/**
 * 正文首字下沉（Drop Cap）· 2026-11-14
 * ══════════════════════════════════════════════════════════════════════════════
 * 方案与拍板记录：`blog/first/dropcap/方案书.md`
 *   D1 落点＝文章正文 ＋ 首页头条；D2 三行；D3 手机降到两行；D4 中英同行数；
 *   D7 墨色（不新增颜色）；D8 用户「都听你的」⇒ 按推荐档直接落地。
 *
 * 为什么不用纯 CSS `::first-letter`（甲路线）：
 *   ① 按规范，`::first-letter` 会把**前置标点算进首字母** ⇒ 文章以「“」或「「」开头时，
 *      引号会跟着一起放大成 100px 的黑块；
 *   ② 首块是图片／歌曲卡／代码块时，`p:first-of-type` 会落在「只有图片的那一段」上，
 *      那一段没有字母 ⇒ **整篇静默没有首字**，而且从代码上看不出来。
 *   所以这里在 hast 阶段把首字包成 `<span class="n1-cap">`：标点单独装进 `.n1-cap-q`（缩小上标），
 *   首块没有文字的段落自动跳过去找下一段。
 *
 * 风格约定：与样张 `.lede::first-letter`（n1.css:121）同一条配方——浮动、`--disp`、600、墨色。
 * 只在 `MarkdownRenderer` 里挂，样式只作用于 `.prose-read` 与 `.lead-body`，关于页（`.prose`）不受影响。
 * 关掉某一篇：正文里写 `<!-- n1:dropcap=off -->`（见 MarkdownRenderer 里的开关）。
 */
const QUOTE = /[「『』“”‘’"'（(【《〈]/;   // 允许挂在首字前面的引号/开括号（≤2 个）
const LETTER = /[\p{L}\p{N}]/u;            // 首字：字母或数字（汉字属 \p{L}）
/* 单笔画字（一 / 丨 / 丿 …）：放到 80px 就是一道横线或一根针，读起来像分隔符。
   样张在 `.about-hero .lede::first-letter` 复位同一件事（n1.css:138 的注释：首字是「一」，
   放大后像一条破折号）。2026-11-14 夹具页实测确认：`#case-heng` 那张就是一横加个小箭头。
   ⇒ 这类首字直接不做下沉，段落照常排（不新增任何作者操作）。
   注意：「二 / 三」是两道、三道横，仍能认出是字，不拦。 */
const THIN_STROKE = new Set(['一', '丨', '丿', '丶', '亅', '乀', '乙']);

/* hast 里要跳过的子树：代码块、图表、引用、列表，以及自绘播放器/公式 */
const SKIP_TAG = new Set(['pre', 'code', 'figure', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'ul', 'ol', 'li']);
const SKIP_CLASS = /(^|\s)(ncm|ncm-card|katex|math|code-block)(\s|$)/;

export interface DropCapParts {
  /** 首字前面的标点（可能为空串） */
  punct: string;
  /** 首字本身 */
  cap: string;
  /** 首字之后剩下的全部文字 */
  rest: string;
}

/**
 * 拆出「标点 / 首字 / 其余」。返回 null 表示这一段不该做首字下沉：
 * 没有字母数字、或前面挂着的不是引号（例如残留的 Markdown 符号或超长前缀）。
 */
export function splitDropCap(text: string): DropCapParts | null {
  const chars = [...String(text || '')];
  let i = 0;
  while (i < chars.length && /\s/.test(chars[i])) i++;   // 前导空白由调用方保留，这里只跳过
  const head = i;
  let q = 0;
  while (i < chars.length && !LETTER.test(chars[i])) {
    if (q >= 2 || !QUOTE.test(chars[i])) return null;
    q++;
    i++;
  }
  if (i >= chars.length) return null;
  const cap = chars[i];
  if (THIN_STROKE.has(cap)) return null;
  return { punct: chars.slice(head, i).join(''), cap, rest: chars.slice(i + 1).join('') };
}

/* ── hast 小工具（不引类型包，字段按 hast 规范手写）────────────────────────── */
type HNode = { type: string; value?: string; tagName?: string; properties?: Record<string, any>; children?: HNode[] };

function classNameOf(node: HNode): string {
  const cls = node.properties?.className;
  return Array.isArray(cls) ? cls.join(' ') : String(cls || '');
}

function skip(node: HNode): boolean {
  if (node.type !== 'element' || !node.tagName) return false;
  if (SKIP_TAG.has(node.tagName)) return true;
  return SKIP_CLASS.test(classNameOf(node));
}

function textOf(node: HNode): string {
  if (node.type === 'text') return node.value || '';
  let s = '';
  for (const c of node.children || []) s += textOf(c);
  return s;
}

/** 深度优先找第一个「有文字的 <p>」；纯图片段落、代码、引用、播放器整块跳过 */
function findTextParagraph(node: HNode): HNode | null {
  for (const child of node.children || []) {
    if (child.type !== 'element' || skip(child)) continue;
    if (child.tagName === 'p') {
      if (textOf(child).trim()) return child;
      continue;
    }
    const found = findTextParagraph(child);
    if (found) return found;
  }
  return null;
}

/** 段落里第一个含字母的文本节点（可能被 <strong>/<a> 包着），连同它的父节点与下标 */
function findFirstLetterNode(el: HNode): { parent: HNode; index: number; node: HNode } | null {
  const children = el.children || [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.type === 'text') {
      if (LETTER.test(c.value || '')) return { parent: el, index: i, node: c };
      continue;
    }
    if (c.type === 'element') {
      const loc = findFirstLetterNode(c);
      if (loc) return loc;
    }
  }
  return null;
}

function wrapFirstLetter(p: HNode): boolean {
  const loc = findFirstLetterNode(p);
  if (!loc) return false;
  const value = loc.node.value || '';
  const parts = splitDropCap(value);
  if (!parts) return false;

  /* 原文的前导空白原样留在浮动之前（不改变任何既有字符） */
  const indent = (value.match(/^\s+/) || [''])[0];
  const capSpan: HNode = {
    type: 'element',
    tagName: 'span',
    properties: { className: ['n1-cap'] },
    children: [
      ...(parts.punct
        ? [{ type: 'element', tagName: 'span', properties: { className: ['n1-cap-q'] }, children: [{ type: 'text', value: parts.punct }] } as HNode]
        : []),
      { type: 'text', value: parts.cap } as HNode,
    ],
  };
  const replacement: HNode[] = [
    ...(indent ? [{ type: 'text', value: indent } as HNode] : []),
    capSpan,
    ...(parts.rest ? [{ type: 'text', value: parts.rest } as HNode] : []),
  ];
  loc.parent.children!.splice(loc.index, 1, ...replacement);
  return true;
}

/** rehype 插件：整份正文只做一次（第一个有文字的段落）。`enabled:false` ＝ 这一篇不做。 */
export default function rehypeDropCap(options: { enabled?: boolean } = {}) {
  return (tree: HNode) => {
    if (options.enabled === false) return;
    const p = findTextParagraph(tree);
    if (p) wrapFirstLetter(p);
  };
}
