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
//    · 友链（2026-10-11 原话「**友链被忘记了**」）→ 见 N1_ROUTES_NAMED 里的 `/friends`
//    仍未点名、继续走旧外壳的只剩：**写作台 `/write/:id`、404**。
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
   所以按口径把它们退回旧外壳。要再改回来只需把 `exactOnly` 去掉。

   ══════════════════════════════════════════════════════════════════════════════
   ★ 2026-10-13 撤销上面那道闸（用户原话只有两个字：「**丙**」）★
   ══════════════════════════════════════════════════════════════════════════════
   他报「点击编辑文章页面风格不统一」，我给甲乙丙三案，他点第三档（活最大）＝
   `/write/:id` 并入 N1 **并且**把小说编辑器／章节编辑器／译文工作台一起按样张零件重排。

   **为什么当初那道闸现在可以撤**（两道前提，都已实测复查）：
     ① 闸的唯一目的是保护 `/write/translations` 不被 `/write/:id` 的连带匹配卷进来。
        而 `/write/translations` 已在 2026-10-09 进了上面的 `N1_ROUTES_NAMED`，
        且 `isN1Route()` 里**它排在 `N1_ROUTES` 之前**（第 56 行先判 NAMED）——
        精确项先短路，所以 `/write` 改回前缀匹配**卷不到它**。
     ② `/write/:id` 本来就在原计划内：`first\n1-as-frontend\本轮计划书.md` 行 38 的映射表
        写的是 `write.html` → `/write`、**`/write/:id`** → `pages/Write.tsx`，标记 **✅ 做**。
        那道闸是 2026-10-08 为躲连带项临时加的保险，理由消失后一直没回头撤 ——
        这正是「前置条件消失但决策没回头撤」的典型（教训已入记忆库）。

   实测证据（`first\n1-write-edit\probe-routes.mjs`，改前 → 改后）：
     · `/write/<id>`        false（旧壳，页身 `.bench` 一套 n1.css 规则全部落空） → true
     · `/write/translations` true（且在 NAMED 里短路，**不受影响**）            → true
     · `/write`             true                                                → true

   ⚠️ 保留 `N1_EXACT_ONLY` 这个常量本身（形状不变、便于以后再挂钩），只是把它清空。
      要整体回退＝把 `'/write'` 放回下面这个数组。 */
const N1_EXACT_ONLY = [] as const;

/* ★ 2026-10-09「登录、个人主页和翻译界面未统一风格」（用户原话）★
   —— 他点名这三页（＝对这三页解禁），于是把「未换壳页」里的三张搬进 N1：
     · `/login`    登录／注册（同时从 LayoutRoute 之外移进 Layout，见 App.tsx）
     · `/profile`  个人主页（含访客态 `?userId=`）
     · `/write/translations` 翻译进度 ＋ 标签词典
   三条都是**精确匹配**（`startsWith(p + '/')` 那半段对它们无意义）：
   尤其 `/write/translations` 必须精确 —— 否则 `/write/<文章id>` 也会被连带套进 N1。
   ⚠️ 2026-10-13 更新：写作台本体（`/write`、`/write/:id`）用户**已点名**（原话「丙」），
      现在整个 `/write` 族都走 N1；这条精确项仍保留，它现在的作用是**短路**——
      排在 `N1_ROUTES` 之前先判，保证 `/write/translations` 的归属不会因为
      `/write` 改成前缀匹配而受影响（见上面 `N1_EXACT_ONLY` 那段）。
   回退＝删掉这条常量与下面那一行。 */

/* ★ 2026-10-11「友链被忘记了」（用户原话只有这五个字）★
   —— 他点名 `/friends`，于是把「未换壳页」里又一张搬进 N1。
   三条同族缺口一起补（`first\n1-friends\本轮计划书.md` §1 有实测证据）：
     ① 本文件＝解禁路由；② `N1Shell.tsx` 的 `N1_NAV` 补「友链」这一项
     （样张那 7 项里没有友链，真站点从 N1 任何一页都点不进友链页）；
     ③ `pages\Friends.tsx` 页身由旧三层改写成样张零件。
   精确匹配（`/friends` 没有子路由）。回退＝删掉这一项，页面立刻回旧外壳旧样式。 */
const N1_ROUTES_NAMED = ['/login', '/profile', '/write/translations', '/friends'] as const;

export function isN1Route(pathname: string): boolean {
  if ((N1_ROUTES_NAMED as readonly string[]).includes(pathname)) return true;
  if (N1_ROUTES_ARTICLES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return N1_ROUTES.some((p) => {
    if (p === '/') return pathname === '/';
    if ((N1_EXACT_ONLY as readonly string[]).includes(p)) return pathname === p;
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}
