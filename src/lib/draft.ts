// ============================================================================
// 呓语集 · 章节级草稿（第 3 批，2026-09-29）
// ----------------------------------------------------------------------------
// 编辑已有小说的某章时，把改动存到 localStorage（键 DRAFT_KEY:ch:articleId:chapterId）。
// 重新进入该章时提示「恢复/丢弃」；保存成功即清；绝不自动写数据库；
// localStorage 满/隐私模式静默失败；TTL 7 天。
// ============================================================================

const PREFIX = 'yiyuji_write_ch_draft:';
const TTL_DAYS = 7;

export interface ChapterDraft {
  title: string;
  content: string;
  part: string;
  savedAt: string; // ISO
}

/** 章节草稿的 localStorage 键 */
export function chapterDraftKey(articleId: string, chapterId: string): string {
  return `${PREFIX}${articleId}:${chapterId}`;
}

/** 读单章草稿，不存在/损坏/过期返回 null */
export function readChapterDraft(articleId: string, chapterId: string): ChapterDraft | null {
  try {
    const raw = localStorage.getItem(chapterDraftKey(articleId, chapterId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ChapterDraft;
    if (!d || typeof d.savedAt !== 'string') return null;
    // TTL 检查
    const age = Date.now() - new Date(d.savedAt).getTime();
    if (age > TTL_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(chapterDraftKey(articleId, chapterId));
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

/** 写单章草稿（配额不足/隐私模式静默失败） */
export function writeChapterDraft(articleId: string, chapterId: string, draft: ChapterDraft): void {
  try {
    localStorage.setItem(chapterDraftKey(articleId, chapterId), JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** 清单章草稿 */
export function clearChapterDraft(articleId: string, chapterId: string): void {
  try {
    localStorage.removeItem(chapterDraftKey(articleId, chapterId));
  } catch {
    /* ignore */
  }
}

/** 列出一篇文章下所有过期的章节草稿（供清理用） */
export function listStaleChapterDrafts(articleId: string): string[] {
  const stale: string[] = [];
  const prefix = `${PREFIX}${articleId}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const d = JSON.parse(raw) as ChapterDraft;
        const age = Date.now() - new Date(d.savedAt).getTime();
        if (age > TTL_DAYS * 24 * 60 * 60 * 1000) stale.push(key);
      } catch {
        stale.push(key);
      }
    }
  } catch {
    /* ignore */
  }
  return stale;
}
