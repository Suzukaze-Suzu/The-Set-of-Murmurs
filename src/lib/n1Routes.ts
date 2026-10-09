// ============================================================================
// 迁移路由表（2026-10-08「N1 样张直接做前端」）
// ----------------------------------------------------------------------------
// 样张 `design-mockups\g\n1-broadsheet\` 有的页面，才走 N1 外壳与新样式层；
// 样张里没有的界面（文章列表/分类、文章详情、友链、登录、个人、译文台、404）
// **保持旧外壳旧样式一点不动**，等用户点名再做。
//
// 用户原话：「我不想这么改了，你把那个静态样张直接作为前端，不够的按钮我再加，
//             没有做的界面等我告诉你做」
//
// ⚠️ 2026-10-09 复看：上面那条「等他点名」是**流程**，不是永久冻结。此后他已陆续点名：
//    · 文章列表/分类/阅读页 → 见下面 N1_ROUTES_ARTICLES
//    · 登录 / 个人主页 / 译文台 → 见下面 N1_ROUTES_NAMED
//    仍未点名、继续走旧外壳的只剩：**友链 `/friends`、写作台 `/write/:id`、404**。
// ============================================================================

/** 与样张一一对应的真前端路由（样张页 → 路由见 first\n1-as-frontend\本轮计划书.md §2） */
export const N1_ROUTES = ['/', '/about', '/gallery', '/guestbook', '/novels', '/write'] as const;

/* ★ 2026-10-09「文章界面与阅读界面迁入 N1」（用户原话「修改文章界面以及具体阅读界面，
   设计为与其他页面类似风格」，并裁决「三页一起做」）：
   样张里**没有**画这三页，但用户点名要做，且指定全部用样张已有的零件拼——
   条目＝三栏纯文字流 `.list`/`.item`，正文＝「单栏，类似报纸大版，不变窄」。
   三条前缀对应 /articles（档案页）、/category/:c（分类页）、/article/:id（阅读页）。
   回退＝删掉这三条，三页立刻回旧外壳旧样式（页面文件本体不受影响）。 */
export const N1_ROUTES_ARTICLES = ['/articles', '/category', '/article'] as const;

/* ⚠️ 2026-10-08 修：原来对 `/write` 用了 `startsWith('/write/')`，于是 `/write/translations`
   与 `/write/:id`（编辑既有文章）也被套进了 N1 外壳 —— 与本文件开头「译文台保持旧外壳」的
   口径自相矛盾，实测（first\unify-audit\probe-tokens.mjs）这两页的页身 `.tr-*` 仍是旧层 CSS、
   却顶着 N1 的报头报尾，是**全站唯一一处「外壳与页身不同族」**。样张里没有这两页，
   所以按口径把它们退回旧外壳。要再改回来只需把 `exactOnly` 去掉。 */
const N1_EXACT_ONLY = ['/write'] as const;

/* ★ 2026-10-09「登录、个人主页和翻译界面未统一风格」（用户原话）★
   —— 他点名这三页（＝对这三页解禁），于是把「未换壳页」里的三张搬进 N1：
     · `/login`    登录／注册（同时从 LayoutRoute 之外移进 Layout，见 App.tsx）
     · `/profile`  个人主页（含访客态 `?userId=`）
     · `/write/translations` 翻译进度 ＋ 标签词典
   三条都是**精确匹配**（`startsWith(p + '/')` 那半段对它们无意义）：
   尤其 `/write/translations` 必须精确 —— 否则 `/write/<文章id>` 也会被连带套进 N1，
   而写作台本体（`/write`、`/write/:id`）用户本轮**没点名**，维持旧口径不动。
   回退＝删掉这条常量与下面那一行。 */
const N1_ROUTES_NAMED = ['/login', '/profile', '/write/translations'] as const;

export function isN1Route(pathname: string): boolean {
  if ((N1_ROUTES_NAMED as readonly string[]).includes(pathname)) return true;
  if (N1_ROUTES_ARTICLES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return N1_ROUTES.some((p) => {
    if (p === '/') return pathname === '/';
    if ((N1_EXACT_ONLY as readonly string[]).includes(p)) return pathname === p;
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}
