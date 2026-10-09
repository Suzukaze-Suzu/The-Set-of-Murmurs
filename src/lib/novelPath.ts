// ============================================================================
// 小说路径口径（2026-10-09「把小说界面直接绑定到小说书架界面」）
// ----------------------------------------------------------------------------
// 用户原话：「书架逻辑修改，把小说界面直接绑定到小说书架界面，去掉无用按钮，加入整本书评论」
// 判读（用户在选项里点名 A）：小说阅读界面不再挂在「文章」路由下，而是**归书架族**——
//   书架 `/novels` 上的书名指向书介页 `/novels/<书id>`；目录每一章指向**阅读界面**
//   `/novels/<书id>/read?ch=<章id>`（2026-10-09 第二轮：正文单独开一页）。
//   `/article/<id>` 遇到小说只做一次 replace 重定向（见 pages/ArticleDetail.tsx），
//   所以旧链接照样能用，但小说永远不会停在文章页。
// 全站「条目 → 详情」一律调 articleHref()，别再手写 `/article/${id}`。
// ============================================================================
import type { Article } from '../types';

type NovelLike = Pick<Article, 'id' | 'category' | 'novel'>;

/** 小说判据（全站同一口径）：分类 reading 且**有章节**——与书架页、首页「书籍更新」一致 */
export function isNovelArticle(a: NovelLike | undefined | null): boolean {
  return !!a && a.category === 'reading' && !!(a.novel?.chapters?.length);
}

/** 书介页在书架路由下的地址（书讯／目录／设置／整本评论都在这页） */
export function novelHref(id: string, chapterId?: string): string {
  return `/novels/${id}${chapterId ? `?ch=${encodeURIComponent(chapterId)}` : ''}`;
}

/* ★ 2026-10-09「阅读的时候把文字单独开一个界面，就像之前的阅读器一样，但是要统一风格」：
   **正文单独一页**，地址 `/novels/<书id>/read?ch=<章id>`——可复制分享、浏览器后退键正常。
   书介页 `/novels/<书id>` 从此不放正文，只留书讯／目录／设置／整本评论，目录每条指向本函数。
   （旧地址 `/novels/<id>?ch=<章id>` 由页导航做一次 replace 重定向过来，见 pages/NovelDetail.tsx） */
export function novelReadHref(id: string, chapterId?: string): string {
  return `/novels/${id}/read${chapterId ? `?ch=${encodeURIComponent(chapterId)}` : ''}`;
}

/** 站内条目 → 详情地址：小说进书架下的阅读界面，其余进文章阅读页 */
export function articleHref(a: NovelLike): string {
  return isNovelArticle(a) ? novelHref(a.id) : `/article/${a.id}`;
}
