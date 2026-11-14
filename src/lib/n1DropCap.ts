/**
 * 正文首字下沉（Drop Cap）· 2026-11-14
 * ══════════════════════════════════════════════════════════════════════════════
 * 方案与拍板记录：`blog/first/dropcap/方案书.md`
 *   D1 落点＝文章正文 ＋ 首页头条；D2 三行；D3 手机降到两行；D4 中英同行数；
 *   D7 墨色（不新增颜色）；D8 用户「都听你的」⇒ 按推荐档直接落地。
 *
 * ★ 2026-11-14 二轮（用户原话「中文就不用了，有点蠢，只在翻译的文章中使用」）：
 *   ① 中文站／中文正文**不再下沉**——语言由 `MarkdownRenderer` / `Home` 用 `locale` 判定，
 *      中文线直接把插件关掉（不再靠 CSS 覆盖尺寸）；
 *   ② `latinOnly:true`：就算在英文线上，首字不是拉丁字母也不下沉
 *      （英文站没译文的文章会整篇回退中文正文，那种页面不该出现一枚汉字下沉）；
 *   ③ 顺手修的一处 bug（线上实测发现）：首段以**行内 code** 开头时，首字会被包进 `<code>`
 *      里——继承 code 的 `font-size:.9em`，还会被 code 的边框/底色带着跑。现在找首字时
 *      跳过 `code`/`pre` 等子树；若整段没有 code 之外的文字，就顺延到下一个有文字的段落。
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
/* 拉丁字母（2026-11-14 二轮）：英文线上只认这一族。汉字放大成 70~80px 用户觉得「蠢」，
   所以中文站整站不做；英文站里没译文、整篇回退中文的那些文章，也不做。 */
const LATIN = /[A-Za-z]/;
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
 * `latinOnly`（2026-11-14 二轮）：首字必须是拉丁字母（汉字/日文/阿拉伯文等一律不下沉）。
 */
export function splitDropCap(
  text: string,
  opts: { latinOnly?: boolean } = {},
): DropCapParts | null {
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
  if (opts.latinOnly && !LATIN.test(cap)) return null;
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

/** 深度优先按文档顺序收集「有文字的 <p>」；纯图片段落、代码、引用、播放器整块跳过 */
function collectTextParagraphs(node: HNode, out: HNode[] = []): HNode[] {
  for (const child of node.children || []) {
    if (child.type !== 'element' || skip(child)) continue;
    if (child.tagName === 'p') {
      if (textOf(child).trim()) out.push(child);
      continue;
    }
    collectTextParagraphs(child, out);
  }
  return out;
}

/**
 * 段落里第一个含字母的文本节点（可能被 <strong>/<a> 包着），连同它的父节点与下标。
 * ⚠️ 2026-11-14 二轮：`skip()` 的子树（行内 code / pre / 播放器 / 公式）**不进入**——
 *   原先会走进去，于是首段以行内 code 开头时首字被包进 `<code>`（继承 .9em，还被灰框带着跑），
 *   线上实测在 `日记四则` 那篇里看得很清楚。
 */
function findFirstLetterNode(el: HNode): { parent: HNode; index: number; node: HNode } | null {
  const children = el.children || [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.type === 'text') {
      if (LETTER.test(c.value || '')) return { parent: el, index: i, node: c };
      continue;
    }
    if (c.type === 'element') {
      if (skip(c)) continue;
      const loc = findFirstLetterNode(c);
      if (loc) return loc;
    }
  }
  return null;
}

/** 这一段能不能包成下沉首字：'wrapped' 成了；'noletters' 这一段的文字都在 code 里（换下一段）；'stop' 规则不让做（整篇不作） */
type WrapResult = 'wrapped' | 'noletters' | 'stop';

function wrapFirstLetter(p: HNode, opts: { latinOnly?: boolean }): WrapResult {
  const loc = findFirstLetterNode(p);
  if (!loc) return 'noletters';
  const value = loc.node.value || '';
  const parts = splitDropCap(value, opts);
  if (!parts) return 'stop';

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
  return 'wrapped';
}

/**
 * rehype 插件：整份正文只做一次。`enabled:false` ＝ 这一篇不做（中文站整条线都传 false）。
 * `latinOnly:true` ＝ 首字必须是拉丁字母（英文站上没译文、回退中文正文的文章也不下沉）。
 */
export default function rehypeDropCap(options: { enabled?: boolean; latinOnly?: boolean } = {}) {
  return (tree: HNode) => {
    if (options.enabled === false) return;
    /* 顺延规则：首段文字全在 code 里（或整段是图片）→ 换下一段；
       规则本身不让做（单笔画字／非拉丁首字／前缀不合法）→ 整篇就此不作，不再往后找。 */
    for (const p of collectTextParagraphs(tree)) {
      const r = wrapFirstLetter(p, options);
      if (r === 'wrapped' || r === 'stop') return;
    }
  };
}
