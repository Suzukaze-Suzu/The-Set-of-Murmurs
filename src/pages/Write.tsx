import { useState, useRef, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import type { CSSProperties } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META, Article, ArticleAttachment, Category, NovelChapter, NovelStatus } from '../types';
import { NOVEL_STATUS_META } from '../types';
import { uid, storageKey } from '../context/ArticleContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import NovelComposer from '../components/NovelComposer';
import TranslationWorkbench from '../components/TranslationWorkbench';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { usePageTitle } from '../hooks/usePageTitle';
import { isNovelArticle } from '../lib/novelPath';
import {
  readChapterDraft,
  writeChapterDraft,
  clearChapterDraft,
  listStaleChapterDrafts,
  ChapterDraft,
} from '../lib/draft';

// ── 草稿自动保存 ──────────────────────────────────────────────
// 写新文章 / 新小说时，把标题、正文、分类、标签、章节等实时存到 localStorage，
// 刷新页面、误关标签页或跳去别的页面后回来仍能接着写，不必重新写一遍。
// 仅对「新建」生效；编辑已有文章时以数据库内容为准，不写草稿。
const DRAFT_KEY = 'yiyuji_write_draft';

interface WriteDraft {
  title: string;
  content: string;
  category: Category;
  tags: string;
  favorite: boolean;
  composer: 'article' | 'novel';
  author: string;
  cover: string;
  nstatus: NovelStatus;
  synopsis: string;
  /** 中文摘要（2026-10-09 起可手写；老草稿没有这一项，读的时候按空串兜底） */
  summary: string;
  /** 摘要是不是手写的（没写过的草稿没有这一项 → 按「自动」处理） */
  summaryManual?: boolean;
  chapters: NovelChapter[];
  attachments: ArticleAttachment[];
  savedAt: string;
}

function loadDraft(): WriteDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as WriteDraft;
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}

function clearDraftStorage() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/**
 * 自动摘要＝正文（去掉 Markdown 记号、换行压成空格）的前 120 字。
 * ⚠️ 这条规则**与「摘要框」之前逐字一模一样**（老文章的摘要就是这么来的），
 *    现在只当兜底用：写作页的摘要框留空才走它。
 * 2026-10-09 用户原话「我希望中文也可以修改摘要」——之前摘要只能自动生成，改不了。
 */
export function autoSummaryOf(text: string): string {
  return text.replace(/[#>*`$\\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 120);
}

/**
 * 库里那条摘要是不是**人写的**：跟「按正文自动截出来」的结果不一样，就说明不是自动生成的。
 * 已发布的老文章都是自动生成的，所以打开时仍是「自动」状态（跟着正文走，跟改动前一样）；
 * 只有他自己写过的那条才会被当成手写、原样带进摘要框、不再跟着正文变。
 */
function isManualSummary(stored: string, content: string): boolean {
  const s = (stored || '').trim();
  return !!s && stored !== autoSummaryOf(content);
}

// 站外要用的静态图（放在 public/ 根目录，随 main 一起部署）。
// 链接写死成线上绝对地址：写作页在 /en/ 下也能拿到不带前缀的正确链接；贴到别处长期有效。
// ── IndexNow：主动把新文章推给 Bing 等搜索引擎 ──────────────────
// 为什么：Bing 会「发现」URL，但抓取是它自己排队的；新站没有外链 → 优先级极低，
// 后台会长期停在「已发现但未爬网」。IndexNow 是即时提交协议，POST 一下立刻进抓取队列。
// 提交由 api/indexnow.mjs 在服务端发（密钥不经过前端），这里只负责拼 URL 和显示结果。
const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '')
  || 'https://www.the-set-of-murmurs.me';

const ASSET_FILES = [
  { key: 'avatar', name: '头像原图（方形）', meta: '1444×1444 PNG', url: 'https://www.the-set-of-murmurs.me/avatar-original.png' },
  { key: 'home', name: '首页截图', meta: '2497×1469 PNG', url: 'https://www.the-set-of-murmurs.me/home-screenshot.png' },
];

export default function Write() {
  const { isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById, addArticle, updateArticle } = useArticles();

  const editing = id ? getById(id) : undefined;

  usePageTitle(editing ? '编辑文章' : '写作');

  // 新建时读取本地草稿（编辑已有文章不读，以数据库内容为准）；只取一次
  const [savedDraft] = useState<WriteDraft | null>(() => (id ? null : loadDraft()));

  const [title, setTitle] = useState(savedDraft?.title ?? editing?.title ?? '');
  const [content, setContent] = useState(savedDraft?.content ?? editing?.content ?? '');
  const [category, setCategory] = useState<Category>(savedDraft?.category ?? editing?.category ?? 'essay');
  const [tags, setTags] = useState(savedDraft?.tags ?? editing?.tags.join(', ') ?? '');
  const [favorite, setFavorite] = useState(savedDraft?.favorite ?? editing?.favorite ?? false);
  /* 中文摘要（2026-10-09 用户点名「我希望中文也可以修改摘要」）：
     之前它只由正文前 120 字自动截出来、写作页里连框都没有。
     现在：框里写什么就存什么；**留空＝照旧自动截取**（buildArticle 里兜底）。
     打开老文章时给的就是数据库里那条摘要（也就是现在自动生成的那段），不改就照旧。 */
  const [summary, setSummary] = useState(savedDraft?.summary ?? editing?.summary ?? '');
  /* 「自动」还是「手写」：自动时摘要跟着正文走（＝改动前的老行为，老文章打开就是这一档）；
     他一旦在框里打字就转成手写，从此按他写的来。 */
  const [summaryManual, setSummaryManual] = useState(() =>
    id ? isManualSummary(editing?.summary || '', editing?.content || '') : !!savedDraft?.summaryManual,
  );
  const [composer, setComposer] = useState<'article' | 'novel'>(savedDraft?.composer ?? (editing?.novel ? 'novel' : 'article'));
  const [previewing, setPreviewing] = useState(false);
  /* P3 翻译工作台：只在「编辑已有文章/小说」时可开（新文章还没 id，译文表按 id 存）。
     v2：支持 ?en=1 深链直接进英文工作台（翻译进度总览的「打开工作台」用它）。 */
  const [enOpen, setEnOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('en') === '1',
  );
  // 小说（chapter）编辑状态（仅 category=reading 使用）
  const [author, setAuthor] = useState(savedDraft?.author ?? editing?.novel?.author ?? '');
  const [cover, setCover] = useState(savedDraft?.cover ?? editing?.novel?.cover ?? '');
  const [nstatus, setNstatus] = useState<NovelStatus>(savedDraft?.nstatus ?? editing?.novel?.status ?? 'serializing');
  const [synopsis, setSynopsis] = useState(savedDraft?.synopsis ?? editing?.novel?.synopsis ?? '');
  const [chapters, setChapters] = useState<NovelChapter[]>(savedDraft?.chapters ?? editing?.novel?.chapters?.slice() ?? []);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [panel, setPanel] = useState<'image' | 'music' | 'attachment' | 'assets' | 'indexnow' | null>(null);
  // 外链素材面板：点一下就把链接复制到剪贴板（贴到别处用）
  const [copiedAsset, setCopiedAsset] = useState<string | null>(null);
  const copyAsset = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 剪贴板 API 不可用时（http / 旧浏览器）退回 execCommand
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopiedAsset(key);
    window.setTimeout(() => setCopiedAsset(null), 1800);
  };
  const [imgUploading, setImgUploading] = useState(false);
    const [musicInfo, setMusicInfo] = useState('');
  const [imgDragging, setImgDragging] = useState(false);
  const [attachments, setAttachments] = useState<ArticleAttachment[]>(savedDraft?.attachments ?? editing?.attachments ?? []);
  const attachInput = useRef<HTMLInputElement>(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachProg, setAttachProg] = useState<Record<string, number>>({});
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(savedDraft?.savedAt ? new Date(savedDraft.savedAt) : null);
  // 小说章节编辑（编辑已有书）
  const [editChId, setEditChId] = useState('');
  const [chDraftTitle, setChDraftTitle] = useState('');
  const [chDraftContent, setChDraftContent] = useState('');
  const [chPreview, setChPreview] = useState(false);
  const [chDraftPart, setChDraftPart] = useState('');
  // 章节草稿恢复提示：进入某章时检测到未保存的草稿
  const [chapterDraftPrompt, setChapterDraftPrompt] = useState<{
    chapterId: string;
    draft: ChapterDraft;
  } | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const chapterFileInput = useRef<HTMLInputElement>(null);

  // 自动保存草稿：内容变化后 600ms 写入 localStorage（仅新建文章/小说）
  useEffect(() => {
    if (id) return; // 编辑已有文章时不写草稿，避免覆盖数据库内容
    const hasSomething =
      title.trim() ||
      content.trim() ||
      synopsis.trim() ||
      summary.trim() ||
      chapters.some((c) => c.title.trim() || c.content.trim());
    if (!hasSomething) return;
    const timer = setTimeout(() => {
      const draft: WriteDraft = {
        title, content, category, tags, favorite, composer,
        author, cover, nstatus, synopsis, summary, summaryManual, chapters, attachments,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setDraftSavedAt(new Date());
      } catch { /* 存储配额不足等情况忽略，不影响写作 */ }
    }, 600);
    return () => clearTimeout(timer);
  }, [id, title, content, category, tags, favorite, composer, author, cover, nstatus, synopsis, summary, summaryManual, chapters, attachments]);

  /**
   * 摘要框没被手改过时，它跟着正文走 —— 就是摘要框出现**之前**的老行为（正文改完，摘要自动跟着变）。
   * 一旦他在框里打了字（summaryManual＝true）就停手，从此按他写的来。
   * ⚠️ `!content.trim()` 那道闸是给**异步加载**留的：直接打开 `/write/<id>` 时首帧正文还是空的，
   *    而补水 effect 在同一提交里才把正文塞进来，没有这道闸会用空串把摘要洗掉。
   */
  useEffect(() => {
    if (summaryManual) return;
    if (!content.trim()) return;
    setSummary(autoSummaryOf(content));
  }, [content, summaryManual]);

  // ★ 第 3 批：章节级草稿（编辑已有小说时）★
  // 进入某章：检测草稿 → 有则提示恢复/丢弃；切换章节时由下方 effect 自动存上一章
  const selectChapterWithDraft = (chId: string) => {
    // 切换章节时清掉上一章的恢复提示
    if (chapterDraftPrompt && chapterDraftPrompt.chapterId !== chId) {
      setChapterDraftPrompt(null);
    }
    const ch = chapters.find((c) => c.id === chId);
    if (!ch) return;
    setEditChId(chId);
    setChDraftTitle(ch.title);
    setChDraftContent(ch.content);
    setChDraftPart(ch.part || '');
    setChPreview(false);
    // 编辑已有文章时检查章节草稿
    if (id) {
      const draft = readChapterDraft(id, chId);
      if (draft) setChapterDraftPrompt({ chapterId: chId, draft });
    }
  };

  // 编辑已有小说时，章节改动 600ms 防抖写入章节级草稿
  useEffect(() => {
    if (!id || !editChId) return;
    const ch = chapters.find((c) => c.id === editChId);
    if (!ch) return;
    const timer = setTimeout(() => {
      const draft: ChapterDraft = {
        title: ch.title,
        content: ch.content,
        part: ch.part || '',
        savedAt: new Date().toISOString(),
      };
      writeChapterDraft(id, editChId, draft);
    }, 600);
    return () => clearTimeout(timer);
  }, [id, editChId, chapters]);

  /** 恢复章节草稿 */
  const restoreChapterDraft = () => {
    if (!chapterDraftPrompt) return;
    const { chapterId, draft } = chapterDraftPrompt;
    updateChapter(chapterId, { title: draft.title, content: draft.content, part: draft.part });
    setChDraftTitle(draft.title);
    setChDraftContent(draft.content);
    setChDraftPart(draft.part);
    setChapterDraftPrompt(null);
  };

  /** 丢弃章节草稿 */
  const discardChapterDraft = () => {
    if (id && chapterDraftPrompt) clearChapterDraft(id, chapterDraftPrompt.chapterId);
    setChapterDraftPrompt(null);
  };

  /** 清掉一篇文章下所有章节草稿 */
  const clearAllChapterDrafts = (articleId: string) => {
    const prefix = `yiyuji_write_ch_draft:${articleId}:`;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */
    }
  };

  /**
   * ★ 2026-09-21 修的老 bug ★
   * 直接打开或刷新 `/write/<id>` 时，articles 是**异步**到的：上面那一串 useState 的
   * 初值只在首帧取一次，而首帧里 `editing` 还是 undefined —— 于是编辑器整个是空的，
   * 只有「从站内点进来」（文章数据已在内存里）才正常。
   * 翻译工作台 v2 是拿**编辑器里的中文**当对照源的，这个 bug 会直接把工作台掏空，
   * 所以在这里补一次水：文章到达后填一次，且**只填一次**、只在他还没动手时填。
   */
  const hydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !editing || hydratedIdRef.current === id) return;
    hydratedIdRef.current = id;
    const untouched =
      !title.trim() && !content.trim() && !synopsis.trim() && !summary.trim() && chapters.length === 0;
    if (!untouched) return;
    setTitle(editing.title || '');
    setContent(editing.content || '');
    setCategory(editing.category);
    setTags(editing.tags.join(', '));
    setFavorite(editing.favorite);
    setComposer(editing.novel ? 'novel' : 'article');
    setAuthor(editing.novel?.author || '');
    setCover(editing.novel?.cover || '');
    setNstatus(editing.novel?.status || 'serializing');
    setSynopsis(editing.novel?.synopsis || '');
    setSummary(editing.summary || '');
    setSummaryManual(isManualSummary(editing.summary || '', editing.content || ''));
    setChapters(editing.novel?.chapters?.slice() || []);
    setAttachments(editing.attachments || []);
    // 依赖只有 id/editing：这是「文章到达」的时机，不跟着他打字跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editing]);

  // 清除草稿：清空本地存储与当前编辑内容
  const clearDraft = () => {    if (!window.confirm('确定清除草稿吗？\n\n当前未发布的内容会被清空，且无法恢复。')) return;
    clearDraftStorage();
    setTitle('');
    setContent('');
    setTags('');
    setFavorite(false);
    setComposer('article');
    setAuthor('');
    setCover('');
    setSynopsis('');
    setSummary('');
    setSummaryManual(false);
    setChapters([]);
    setAttachments([]);
    setDraftSavedAt(null);
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const isTex = /\.tex$/i.test(file.name);
      if (isTex) {
        setContent(text);
      } else {
        setContent(text);
      }
      // 用文件名作为标题（去掉扩展名）
      if (!title) setTitle(file.name.replace(/\.(md|markdown|txt|tex)$/i, ''));
      // 自动判断分类：根据文件名或内容关键词
      const low = (text + file.name).toLowerCase();
      if (/(数学|定理|证明|矩阵|导数|积分|linear|math|数分|线代|概率)/.test(low)) {
        setCategory('math');
      } else if (/(动漫|动画|番剧|看番|anime)/.test(low)) {
        setCategory('anime');
      } else if (/(读书|读后感|书评|阅读|读后感)/.test(low)) {
        setCategory('reading');
      } else if (/(学习|笔记|教程|方法|study)/.test(low)) {
        setCategory('study');
      }
    };
    reader.readAsText(file);
  };

  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };
  const insertAtCursor = (text: string) => {
    const ta = editorRef.current;
    if (!ta) { setContent((c) => c + text); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const prefix = content.slice(0, start);
    const suffix = content.slice(end);
    const next = prefix + text + suffix;
    setContent(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + text.length; }, 0);
  };

  const uploadArticleImage = async (file: File | null | undefined) => {
    if (!file) { alert('请选择图片文件'); return; }
    setImgUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
      if (error) { alert('图片上传失败：' + error.message); return; }
      const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
      const url = pub.publicUrl;
      insertAtCursor('\n![图片](' + url + ')\n');
    } catch (err) {
      alert('图片上传异常：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImgUploading(false);
      setPanel(null);
    }
  };

  const insertNetEaseMusic = () => {
    const m = musicInfo.trim();
    if (!m) { alert('请输入网易云歌曲 ID 或歌曲链接'); return; }
    if (/163cn\.tv/i.test(m)) {
      alert('这是网易云短链接。请这样拿数字 ID：\n\n1. 在手机或电脑浏览器打开这个短链接；\n2. 链接会跳转到 music.163.com/song?id=数字；\n3. 把等号后面的「数字」填到这里即可。\n\n或在网易云 App 分享时选「复制链接」，一般会带 song?id=。');
      return;
    }
    const idMatch = m.match(/(?:id=|id\/)(\d+)/) || m.match(/^\d+$/);
    const songId = idMatch ? idMatch[1] : '';
    if (!songId) { alert('未能识别网易云音乐 ID，请直接填写歌曲 ID 数字，或粘贴带 song?id= 的链接'); return; }
    const line = '\n<iframe class="ncm-embed" src="//music.163.com/outchain/player?type=2&id=' + songId + '&auto=0&height=66" width="100%" height="86" frameBorder="no" allow="autoplay; encrypted-media" loading="lazy"></iframe>\n\n[▶ 在网易云中播放这首歌曲](https://music.163.com/#/song?id=' + songId + ')\n';
    insertAtCursor(line);
    setMusicInfo('');
    setPanel(null);
  };


  const uploadOneProgress = (file: File, idx: string): Promise<ArticleAttachment> => {
    return new Promise(async (resolve, reject) => {
      const path = 'attachments/' + Date.now().toString(36) + '-' + file.name.replace(/[\\/:*?"<>|]/g, '_') + '_' + idx;
      try {
        const sess = await supabase.auth.getSession();
        const token = sess?.data?.session?.access_token || '';
        const xhr = new XMLHttpRequest();
        xhr.open('POST', SUPABASE_URL + '/storage/v1/object/articles/' + encodeURI(path));
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setAttachProg((prev) => ({ ...prev, [idx]: e.loaded / e.total }));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
            setAttachProg((prev) => ({ ...prev, [idx]: 1 }));
            resolve({ name: file.name, url: pub.publicUrl, size: file.size });
          } else {
            reject(new Error('HTTP ' + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.send(file);
      } catch (e) { reject(e); }
    });
  };

  const uploadAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachUploading(true);
    try {
      const tasks = Array.from(files).map((file, i) => {
        const idx = i + '_' + file.name;
        setAttachProg((prev) => ({ ...prev, [idx]: 0 }));
        return uploadOneProgress(file, idx).catch((e) => {
          alert('附件「' + file.name + '」上传失败：' + (e instanceof Error ? e.message : String(e)));
          return null;
        });
      });
      const results = await Promise.all(tasks);
      const added = (results.filter(Boolean) as ArticleAttachment[]);
      setAttachProg((prev) => Object.fromEntries(Object.entries(prev).filter(([, v]) => v < 1)));
      if (added.length) setAttachments((prev) => [...prev, ...added]);
    } finally {
      setAttachUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // —— 小说章节辅助 ——
  const splitByChapters = (text: string): { title: string; content: string }[] => {
    const lines = text.split(/\r?\n/);
    const headingRe = /^\s*第\s*([0-9一二三四五六七八九十百千零两]+)\s*[章卷节回部集]\s*(.*)$/;
    const result: { title: string; content: string }[] = [];
    let cur: { title: string; content: string } | null = null;
    for (const raw of lines) {
      const m = raw.match(headingRe);
      if (m) {
        if (cur) result.push(cur);
        cur = { title: raw.replace(/^\s+/, ''), content: '' };
      } else if (cur) {
        cur.content += raw + '\n';
      }
    }
    if (cur) result.push(cur);
    return result.length ? result : [{ title: '第1章', content: text }];
  };
  const mkChapterId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const addChapter = (chapterTitle = '', ccontent = '') => {
    const id = mkChapterId();
    setChapters((prev) => [...prev, { id, title: chapterTitle, content: ccontent, order: prev.length, wordCount: ccontent.replace(/\s/g, '').length }]);
    return id;
  };
  const updateChapter = (cid: string, patch: Partial<NovelChapter>) => {
    setChapters((prev) => prev.map((ch) =>
      ch.id === cid
        ? { ...ch, ...patch, order: ch.order, wordCount: patch.content !== undefined ? patch.content.replace(/\s/g, '').length : ch.wordCount }
        : ch
    ));
  };
  const removeChapter = (cid: string) => {
    setChapters((prev) => prev.filter((ch) => ch.id !== cid).map((ch, i) => ({ ...ch, order: i })));
  };
  const moveChapter = (cid: string, dir: -1 | 1) => {
    setChapters((prev) => {
      const idx = prev.findIndex((ch) => ch.id === cid);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const arr = [...prev];
      const cc = arr.splice(idx, 1)[0];
      arr.splice(to, 0, cc);
      return arr.map((ch, i) => ({ ...ch, order: i }));
    });
  };
  // 上传封面到 novel/cover/
  const uploadCover = async (file: File | null | undefined) => {
    if (!file) { alert('请选择封面图片'); return; }
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = 'novel/cover/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
      if (error) { alert('封面上传失败：' + error.message); return; }
      const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
      setCover(pub.publicUrl);
    } catch (err) {
      alert('封面上传异常：' + (err instanceof Error ? err.message : String(err)));
    }
  };
  const importChapterFile = (e: ChangeEvent<HTMLInputElement>, whole: boolean) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (whole) {
        const parts = splitByChapters(text);
        setChapters(parts.map((p, i) => ({ id: mkChapterId(), title: p.title, content: p.content, order: i, wordCount: p.content.replace(/\s/g, '').length })));
      } else {
        setChapters((prev) => [...prev, { id: mkChapterId(), title: '第' + (prev.length + 1) + '章', content: text, order: prev.length, wordCount: text.replace(/\s/g, '').length }]);
      }
    };
    reader.readAsText(file);
  };

  /** 从当前编辑器状态拼出要发布的 Article（save 与工作台的「先保存中文」共用） */
  const buildArticle = () => {
    if (!title.trim()) {
      alert('请填写标题');
      return null;
    }
    const tagsArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    // 小说模式：整理有效章节（标题为空时自动补编号）
    const isReading = category === 'reading';
    const validChapters = chapters
      .filter((ch) => ch.title.trim() || ch.content.trim())
      .map((ch, i) => ({
        ...ch,
        title: ch.title.trim() || ('第' + (i + 1) + '章'),
        order: i,
      }));
    if (isReading && validChapters.length === 0) {
      alert('作为小说发布需要至少一个章节。\n\n请在“章节”区域点「＋ 新增章节」并填写正文，\n或直接「导入 txt 自动分章」。');
      return null;
    }
    const isNovelMode = isReading && validChapters.length > 0;
    let novelObj: Article['novel'];
    if (isNovelMode) {
      const allWordCount = validChapters.reduce((s, ch) => s + (ch.content || '').replace(/\s/g, '').length, 0);
      novelObj = {
        author: author.trim() || undefined,
        cover: cover.trim() || undefined,
        status: nstatus,
        synopsis: synopsis.trim() || undefined,
        chapters: validChapters,
        wordCount: allWordCount,
      };
    }
    const novelSummary = (synopsis.trim() || validChapters[0]?.content.replace(/[#>*`$\\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 120) || '');
    const article: Article = {
      id: editing?.id || uid(),
      title: title.trim(),
      content: isNovelMode ? validChapters.map((ch) => ch.content).join('\n\n') : content,
      category,
      tags: tagsArr,
      date: editing?.date || new Date().toISOString().slice(0, 10),
      favorite,
      pinned: editing?.pinned || false,
      attachments,
      /* 手写过就按手写的来；没手写过（或清空了）走**逐字未改**的老规则 ——
         老规则不 trim（正文开头是「# 标题」时摘要会带一个前导空格），这里保持原样，
         免得老文章的摘要字符串在新旧版本之间悄悄变样。 */
      summary: isNovelMode ? novelSummary : (summaryManual && summary.trim() ? summary.trim() : autoSummaryOf(content)),
      novel: isNovelMode ? novelObj : undefined,
    };
    const confirmMsg = isNovelMode
      ? '即将发布小说《' + article.title + '》\n作者：' + (novelObj?.author || '（未填写）') + '\n章节数：' + validChapters.length + ' 章\n总字数：' + (novelObj?.wordCount || 0) + ' 字\n\n点击「确定」即可发布到小说书架。'
      : '即将发布文章《' + article.title + '》\n\n点击「确定」即可发布。';
    return { article, confirmMsg };
  };

  /* ── IndexNow 推送（后台手动入口） ───────────────────────── */
  const [pingBusy, setPingBusy] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; text: string; urls: string[] } | null>(null);
  const [pingUrlText, setPingUrlText] = useState('');

  // 「当前这篇」两条 URL（中文 + 英文）。新文章还没 id → 无法拼 URL，返回空。
  // 小说走**书架族地址**（2026-10-09「小说界面绑定到书架」）——推给搜索引擎的也是这个。
  const pingArticleUrls = useMemo(() => {
    if (!id) return [] as string[];
    if (editing && isNovelArticle(editing)) return [`${SITE_ORIGIN}/novels/${id}`, `${SITE_ORIGIN}/en/novels/${id}`];
    return [`${SITE_ORIGIN}/article/${id}`, `${SITE_ORIGIN}/en/article/${id}`];
  }, [id, editing]);

  const ping = useCallback(async (payload: { mode: 'items' | 'all'; urls?: string[]; includeHome?: boolean }) => {
    setPingBusy(true);
    setPingResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setPingResult({ ok: false, text: '没拿到登录凭证，请重新登录后再推。', urls: [] });
        return;
      }
      const r = await fetch('/api/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setPingResult({
          ok: false,
          text: `失败（HTTP ${r.status}）：${j?.error || ''} ${j?.detail || (j?.attempts ? JSON.stringify(j.attempts) : '')}`.trim(),
          urls: j?.urls || [],
        });
        return;
      }
      setPingResult({
        ok: true,
        text: `已提交 ${j.count} 条 · 引擎应答 ${j.indexnowStatus}（${j.endpoint}）`,
        urls: j.urls || [],
      });
    } catch (err) {
      setPingResult({ ok: false, text: `请求发不出去：${(err as Error).message}`, urls: [] });
    } finally {
      setPingBusy(false);
    }
  }, []);

  const save = () => {
    const built = buildArticle();
    if (!built) return;
    if (!window.confirm(built.confirmMsg)) return;
    if (editing) {
      updateArticle(built.article);
    } else {
      addArticle(built.article);
    }
    // 已发布，草稿使命完成，清掉本地草稿
    clearDraftStorage();
    // 清掉该文章的所有章节级草稿
    if (id) clearAllChapterDrafts(id);
    // 小说发布完落在书架族的阅读界面，普通文章仍回文章阅读页
    navigate(isNovelArticle(built.article) ? `/novels/${built.article.id}` : `/article/${built.article.id}`);
  };

  /**
   * 翻译工作台里的「先保存中文」（v2 新增，2026-09-21）：
   * 不弹发布确认、也不跳转——他的语境只是「让对照源与数据库一致」。
   */
  const saveZhFromWorkbench = () => {
    const built = buildArticle();
    if (!built || !editing) return;
    updateArticle(built.article);
  };

  /**
   * 翻译工作台用（v2）：编辑器里的中文是否与数据库那份不一致。
   * 只在工作台打开时才算；比较的是**归一化后的签名**（章节标题会补编号、
   * 空章节会被过滤），否则保存完还会一直显示「未保存」。
   * deps 里都是中文状态——在工作台右侧英文框里打字不会触发它重算。
   */
  const zhDirty = useMemo(() => {
    if (!enOpen || !editing) return false;
    const sig = (t: string, c: string, s: string, list: NovelChapter[]) =>
      JSON.stringify([
        t,
        c,
        s,
        list
          .filter((ch) => ch.title.trim() || ch.content.trim())
          .map((ch, i) => [ch.id, ch.title.trim() || '第' + (i + 1) + '章', ch.content, i]),
      ]);
    if (editing.novel) {
      return sig(title, '', synopsis, chapters) !== sig(editing.title, '', editing.novel.synopsis || '', editing.novel.chapters || []);
    }
    /* 普通文章：摘要也是「中文原稿」的一部分（2026-10-09 起可手写），改了它同样要提示未保存 */
    return sig(title, content, summary, []) !== sig(editing.title, editing.content || '', editing.summary || '', []);
  }, [enOpen, editing, title, content, summary, synopsis, chapters]);

  const exportAs = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = content.includes('$$') || content.includes('$') ? 'tex' : 'md';
    a.download = `${(title || 'untitled').replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    localStorage.removeItem(storageKey);
    clearDraftStorage();
    window.location.reload();
  };

  // 非博主无权访问写作页
  if (!isAdmin) {
    return (
      <div className="page">
        <p style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          无权访问写作页，请以博主身份登录后使用。
        </p>
      </div>
    );
  }

  if (composer === 'novel') {
    // 编辑已有小说：进入章节级编辑界面（点选某章修改，或增删章节/调整顺序/改书籍信息）
    if (editing?.novel) {
      // P3：整本书的英文译文工作台（逐章翻译）
      if (enOpen) {
        return (
          <div className="page write-page">
            <TranslationWorkbench
            article={editing}
            zhTitle={title}
            zhContent={content}
            zhSummary={summary}
            zhSynopsis={synopsis}
            zhChapters={chapters}
            zhDirty={zhDirty}
            onSaveZh={saveZhFromWorkbench}
            onClose={() => setEnOpen(false)}
          />
          </div>
        );
      }
      const editingCh = chapters.find((c) => c.id === editChId);
      return (
        <div className="page write-page">
          <h1 className="page-title">编辑小说《{editing.title}》</h1>
          <div className="composer-switch">
            <button className="mode-tab" onClick={() => setComposer('article')}>写普通文章</button>
            <button className="mode-tab on" onClick={() => setComposer('novel')}>写小说</button>
          </div>

          <div className="novel-edit-wrap card">
            <div className="novel-edit-cols">
              {/* 左：书籍信息 + 章节列表 */}
              <div className="novel-edit-left">
                <div className="novel-edit-section">
                  <div className="novel-edit-section-head">书籍信息</div>
                  <div className="novel-edit-cover-row">
                    <div className="novel-cover-preview">
                      {cover ? <img src={cover} alt="封面" className="novel-cover-img" /> : <span className="novel-cover-ph">{title.slice(0, 1) || '书'}</span>}
                    </div>
                    <div className="novel-cover-actions">
                      <button className="btn btn-light btn-sm" onClick={() => coverInput.current?.click()}>{cover ? '更换封面' : '上传封面'}</button>
                      <input ref={coverInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
                      <p className="novel-cover-hint">封面将显示在书架</p>
                    </div>
                  </div>
                  <div className="novel-fields">
                    <div className="meta-field"><label>书名（必填）</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="meta-field"><label>作者</label><input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="未填写" /></div>
                    <div className="meta-field"><label>状态</label>
                      <select value={nstatus} onChange={(e) => setNstatus(e.target.value as NovelStatus)}>
                        {Object.entries(NOVEL_STATUS_META).map(([k, m]) => (<option key={k} value={k}>{m.label}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="novel-field-full">
                    <label>简介</label>
                    <textarea rows={2} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="一句话介绍这本书…" />
                  </div>
                </div>

                <div className="novel-edit-section">
                  <div className="novel-edit-chlist-head">
                    <span className="novel-edit-chlist-title">章节（{chapters.length}）</span>
                    <div className="novel-edit-chlist-actions">
                      <button className="btn btn-light btn-sm" onClick={() => { const chId = addChapter('', ''); selectChapterWithDraft(chId); }}>＋ 新增章节</button>
                      <button className="btn btn-light btn-sm" onClick={() => chapterFileInput.current?.click()}>导入 txt 分章</button>
                      <input ref={chapterFileInput} type="file" accept=".txt,.md,.markdown" style={{ display: 'none' }} onChange={(e) => { importChapterFile(e, true); e.target.value = ''; }} />
                    </div>
                  </div>
                  <div className="novel-edit-chitems">
                    {chapters.length === 0 && (
                      <p className="novel-edit-empty">还没有章节，点「＋ 新增章节」或「导入 txt 分章」开始。</p>
                    )}
                    {chapters.map((ch, i) => (
                      <div key={ch.id} className={'novel-edit-chitem' + (editChId === ch.id ? ' active' : '')}>
                        <button
                          className="novel-edit-chname"
                          onClick={() => { selectChapterWithDraft(ch.id); }}
                        >
                          <span className="novel-edit-ch-order">{i + 1}</span>
                          <span className="novel-edit-ch-title-text">{ch.title || ('第' + (i + 1) + '章')}</span>
                          {ch.part ? <span className="novel-edit-ch-part">{ch.part}</span> : null}
                          <span className="novel-toc-wc">{ch.wordCount || 0} 字</span>
                        </button>
                        <div className="novel-edit-chops">
                          <button onClick={() => moveChapter(ch.id, -1)} disabled={i === 0} title="上移">↑</button>
                          <button onClick={() => moveChapter(ch.id, 1)} disabled={i === chapters.length - 1} title="下移">↓</button>
                          <button onClick={() => { if (window.confirm('确定删除该章节？')) removeChapter(ch.id); }} title="删除">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 右：章节编辑器 */}
              <div className="novel-edit-right">
                {editingCh ? (
                  <div className="novel-chapter-editor card">
                    {/* 章节草稿恢复提示 */}
                    {chapterDraftPrompt && chapterDraftPrompt.chapterId === editChId && (
                      <div className="chapter-draft-banner">
                        <span className="chapter-draft-text">检测到未保存的草稿（{new Date(chapterDraftPrompt.draft.savedAt).toLocaleString()}）</span>
                        <span className="chapter-draft-actions">
                          <button className="btn btn-sm btn-primary" onClick={restoreChapterDraft}>恢复</button>
                          <button className="btn btn-sm btn-light" onClick={discardChapterDraft}>丢弃</button>
                        </span>
                      </div>
                    )}
                    <div className="novel-ch-ed-head">
                      <input className="novel-ch-title-input" placeholder="本章标题" value={chDraftTitle} onChange={(e) => { setChDraftTitle(e.target.value); updateChapter(editChId, { title: e.target.value, content: chDraftContent, part: chDraftPart }); }} />
                      <input className="novel-ch-part-input" placeholder="所属部分（选填，如：第一卷 校园篇）" value={chDraftPart} onChange={(e) => { setChDraftPart(e.target.value); updateChapter(editChId, { title: chDraftTitle, content: chDraftContent, part: e.target.value }); }} />
                    </div>
                    <div className="editor-tabs">
                      <button className={'tab-btn' + (!chPreview ? ' active' : '')} onClick={() => setChPreview(false)}>编辑</button>
                      <button className={'tab-btn' + (chPreview ? ' active' : '')} onClick={() => setChPreview(true)}>预览</button>
                    </div>
                    {chPreview ? (
                      <div className="editor-preview"><MarkdownRenderer content={chDraftContent} /></div>
                    ) : (
                      <textarea className="editor-textarea" rows={16} value={chDraftContent} onChange={(e) => { setChDraftContent(e.target.value); updateChapter(editChId, { title: chDraftTitle, content: e.target.value, part: chDraftPart }); }} placeholder="本章正文（支持 Markdown 与 LaTeX）" />
                    )}

                  </div>
                ) : (
                  <div className="novel-edit-placeholder">
                    <p>从左侧点选一个章节进行编辑，或点「＋ 新增章节」「导入 txt 分章」。</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="write-actions">
            <button className="btn btn-primary" onClick={save}>保存修改</button>
            <button className="btn btn-light" onClick={() => setEnOpen(true)}>English 译文</button>
            <Link className="btn btn-light" to="/write/translations#tags">翻译进度 / 标签词典</Link>
          </div>
        </div>
      );
    }

    // 新建小说：走 NovelComposer
    return (
      <div className="page write-page">
        <h1 className="page-title">{editing ? '编辑小说' : '写小说'}</h1>
        <div className="composer-switch">
          <button className="mode-tab" onClick={() => setComposer('article')}>写普通文章</button>
          <button className="mode-tab on" onClick={() => setComposer('novel')}>写小说</button>
        </div>
        <p className="novel-composer-desc">小说逐章上传：首次创建书籍时填写书名 / 作者 / 封面 / 简介，之后只需选择书籍、上传新章节正文即可。</p>
        <NovelComposer />
      </div>
    );
  }

  /* ===== 「N1 样张直接做前端」（2026-10-08）=====
     写作页主体照样张 `design-mockups\g\n1-broadsheet\write.html` 行 449–494 重排：
       .pagehead（WRITE ／ 写作 ／ 一句话）→ `.bench` 两栏 = `.bench-main` 写作台 ＋ `.bench-side` 发布面板。
     · 标题 → `.title-input`；分类/标签/草稿状态 → `.bench-meta`；工具 → `.toolbar`；
       正文/预览/译文工作台 → `.editor-tabs` ＋ 本体；页脚统计 → `.bench-foot`。
     ⚠️ 样张里**没有**的东西（文章/小说模式切换、五个上传面板、小说章节编辑器、English 译文工作台）
        一律**保留功能**：切换摆进 `.toolbar` 最左（用 N1 的 `.seg` 语汇）、面板打开时落在工具栏下面、
        小说那一整套与译文工作台本体本轮照旧不动（样张没有画它们，等用户点名再做）。
     ⚠️ 面板/输入框这些「样张没给样式」的零件，外观走补齐层 `src/styles/n1-app.css`。
     ⚠️ 回退＝`git checkout -- src/pages/Write.tsx`。 */
  const plainWords = content.replace(/\s/g, '').length;
  const readMinutes = Math.max(1, Math.round(plainWords / 300));
  /* 摘要框小注里那段「现在会自动用的」，只取开头一点，免得一行小字拖成三行 */
  const autoPreview = autoSummaryOf(content).trim().slice(0, 64) || '（还没写正文）';

  return (
    <>
      <div className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">WRITE</div>
          <h1>{editing ? `编辑《${editing.title}》` : '写作'}</h1>
          <p className="lede">Markdown 与 LaTeX，写好了直接发布。</p>
        </div>
      </div>

      <section className="sec">
        <div className="bench">
          <div className="bench-main">
            <input
              type="text"
              className="title-input"
              placeholder="文章标题…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="bench-meta">
              {/* 分类：样张是一枚分类色小签，这里就地可改（色卡色原样取自 CATEGORY_META） */}
              <select
                className="mchip"
                style={{ '--c': CATEGORY_META[category].color } as CSSProperties}
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                aria-label="分类"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
              {/* 标签：样张是一排「# 标签」，这里直接可编辑（逗号分隔），下方实时预览 */}
              <input
                className="mtag mtag-input"
                type="text"
                placeholder="# 标签（用逗号分隔）"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <span className="msp" />
              <span className="msave">
                {draftSavedAt
                  ? `✓ 草稿已自动保存 · ${draftSavedAt.toLocaleTimeString('zh-CN', { hour12: false })}`
                  : '正文会自动存草稿'}
              </span>
            </div>

            {/* 摘要（2026-10-09 用户点名「我希望中文也可以修改摘要」）：
                设了它就按设的来，留空＝照旧自动取正文前 120 字。
                小注两种状态：空 → 把「现在会自动用的那段」念出来；非空 → 报字数。
                小说（category=reading）不显示这一行——小说走「简介」那栏。 */}
            {category !== 'reading' && (
              <div className="bench-summary">
                <textarea
                  className="summary-input"
                  rows={2}
                  placeholder="摘要 · 留空就自动取正文前 120 字"
                  value={summary}
                  onChange={(e) => { setSummaryManual(true); setSummary(e.target.value); }}
                  aria-label="摘要"
                />
                <p className="sum-hint">
                  {summaryManual
                    ? (summary.trim()
                        ? `${summary.trim().length} 字 · 按你写的来（首页头条、文章列表、搜索结果的描述都用它）`
                        : `留空＝自动取正文前 120 字：${autoPreview}`)
                    : `自动取正文前 120 字：${autoPreview}（改正文时它自己跟着变，在这里打字就改成你写的）`}
                </p>
              </div>
            )}

            <div className="toolbar">
              {/* 模式切换（样张没有这一件）：用 N1 的 .seg 分段按钮语汇 */}
              <span className="seg">
                <button type="button" className="on" onClick={() => setComposer('article')}>文章</button>
                <button type="button" onClick={() => setComposer('novel')}>小说</button>
              </span>
              <button onClick={exportAs}>导出 .md / .tex</button>
              <button onClick={() => fileInput.current?.click()}>导入文件</button>
              <input ref={fileInput} type="file" accept=".md,.markdown,.txt,.tex" style={{ display: 'none' }} onChange={onImport} />
              <button onClick={() => setPanel('image')}>插入图片</button>
              <button onClick={() => setPanel('music')}>插入音乐</button>
              <button onClick={() => setPanel('attachment')}>添加附件</button>
              <button onClick={clearAll}>重置数据</button>
              {/* P5：翻译进度 / 标签词典的入口（这两个页面只有博主能进，藏在 URL 里没人找得到） */}
              <Link to="/write/translations#tags">翻译进度 / 标签词典</Link>
              {/* 外链素材：头像原图 / 首页截图，点一下复制链接 */}
              <button onClick={() => setPanel('assets')}>外链素材</button>
              {/* 推给 Bing：新文章不必等它自己排队来抓（IndexNow） */}
              <button onClick={() => setPanel('indexnow')}>推给 Bing</button>
            </div>


      {panel === 'image' && (
        <div
          className={'media-panel card' + (imgDragging ? ' media-dragging' : '')}
          onDragOver={(e) => { e.preventDefault(); setImgDragging(true); }}
          onDragLeave={() => setImgDragging(false)}
          onDrop={(e) => { e.preventDefault(); setImgDragging(false); const fl = e.dataTransfer.files?.[0]; if (fl) uploadArticleImage(fl); }}
        >
          <h4>插入图片</h4>
          <div className="media-dropzone">
            <p className="media-drop-icon">＋</p>
            <p className="media-drop-text">{imgDragging ? '松开即可上传！' : '拖图片到这里，或点击选择'}</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadArticleImage(e.target.files?.[0])}
            />
          </div>
          {imgUploading && <p className="media-uploading">正在上传…</p>}
          <button className="btn btn-light" onClick={() => setPanel(null)}>关闭</button>
        </div>
      )}

      {panel === 'music' && (
        <div className="media-panel card">
          <h4>插入网易云音乐</h4>
          <p className="media-panel-desc">粘贴网易云歌曲链接（如 music.163.com/song?id=123456）或直接填写歌曲 ID。</p>
          <input
            type="text"
            placeholder="歌曲链接或 ID"
            value={musicInfo}
            onChange={(e) => setMusicInfo(e.target.value)}
          />
          <div className="media-actions">
            <button className="btn btn-primary" onClick={insertNetEaseMusic}>插入音乐</button>
            <button className="btn btn-light" onClick={() => setPanel(null)}>关闭</button>
          </div>
        </div>
      )}

      {panel === 'attachment' && (
        <div className="media-panel card">
          <h4>添加附件</h4>
          <p className="media-panel-desc">支持任意文件（PDF、Word、压缩包、图片等）。上传后将显示在文章详情页的“附件”区块，供读者下载。</p>
          <div className="attach-dropzone">
            <input ref={attachInput} type="file" multiple onChange={(e) => { uploadAttachments(e.target.files); e.target.value = ''; }} />
            <button className="btn btn-primary btn-sm" onClick={() => attachInput.current?.click()}>选择文件</button>
          </div>
          {Object.keys(attachProg).length > 0 && (
            <div className="attach-progress-list">
              {Object.entries(attachProg).map(([k, pct]) => (
                <div key={k} className="attach-progress-item">
                  <span className="attach-progress-name">{k.slice(k.indexOf('_') + 1)}</span>
                  <div className="attach-progress-bar"><div className="attach-progress-fill" style={{ width: Math.round(pct * 100) + '%' }} /></div>
                  <span className="attach-progress-pct">{Math.round(pct * 100)}%</span>
                </div>
              ))}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="attach-preview-list">
              {attachments.map((a, i) => (
                <div key={i} className="attach-preview-item">
                  <span className="detail-att-icon">📎</span>
                  <span className="attach-preview-name">{a.name}</span>
                  {a.size ? <span className="detail-att-size">{(a.size / 1024).toFixed(1)} KB</span> : null}
                  <button className="attach-remove" onClick={() => removeAttachment(i)} title="移除">×</button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-light" onClick={() => setPanel(null)}>关闭</button>
        </div>
      )}

      {panel === 'assets' && (
        <div className="media-panel card">
          <h4>外链素材</h4>
          <p className="media-panel-desc">站点根目录下的两张静态图，给别人填「头像链接 / 首页截图链接」时用。点「复制链接」直接粘走；这两个文件名可能已被外部引用，改名前先确认。</p>
          <div className="attach-preview-list">
            {ASSET_FILES.map((a) => (
              <div key={a.key} className="attach-preview-item">
                <span className="attach-preview-name">
                  {a.name} · {a.meta}
                  <br />
                  <code>{a.url}</code>
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => copyAsset(a.url, a.key)}>
                  {copiedAsset === a.key ? '已复制 ✓' : '复制链接'}
                </button>
                <a className="btn btn-light btn-sm" href={a.url} target="_blank" rel="noreferrer">打开</a>
              </div>
            ))}
          </div>
          <div className="media-actions">
            <button className="btn btn-light" onClick={() => setPanel(null)}>关闭</button>
          </div>
        </div>
      )}
      {panel === 'indexnow' && (
        <div className="media-panel card">
          <h4>推给 Bing（IndexNow）</h4>
          <p className="media-panel-desc">
            搜索引擎会「发现」网址，但抓取是它自己排队的——新站没外链，排在很后面，后台会一直显示「已发现但未爬网」。
            这里点一下就是<strong>直接通知</strong> Bing 立刻来抓（同一条协议也覆盖 Yandex、Seznam、Naver）。
            发布文章后推一次即可；改过老文章也可以重推。
          </p>
          <div className="media-actions">
            <button
              className="btn btn-primary"
              disabled={pingBusy || pingArticleUrls.length === 0}
              onClick={() => ping({ mode: 'items', urls: pingArticleUrls, includeHome: true })}
            >
              {pingBusy ? '推送中…' : '推当前这篇'}
            </button>
            <button className="btn btn-light" disabled={pingBusy} onClick={() => ping({ mode: 'all' })}>
              {pingBusy ? '推送中…' : '推全站（读 sitemap）'}
            </button>
            {!id && <span className="media-panel-desc">当前是新建、还没发布，没有网址可推。</span>}
          </div>
          {id && (
            <p className="media-panel-desc">
              本次会推这两条：<br />
              <code>{pingArticleUrls[0]}</code>
              <br />
              <code>{pingArticleUrls[1]}</code>
            </p>
          )}
          <p className="media-panel-desc">
            也可以手动贴要推的网址（一行一个，只能填本站域名下的）：
          </p>
          <textarea
            rows={3}
            placeholder={`${SITE_ORIGIN}/article/xxxxxx\n${SITE_ORIGIN}/about`}
            value={pingUrlText}
            onChange={(e) => setPingUrlText(e.target.value)}
          />
          <div className="media-actions">
            <button
              className="btn btn-light"
              disabled={pingBusy || !pingUrlText.trim()}
              onClick={() =>
                ping({
                  mode: 'items',
                  urls: pingUrlText.split('\n').map((s) => s.trim()).filter(Boolean),
                  includeHome: false,
                })
              }
            >
              推上面这些网址
            </button>
            <button className="btn btn-light" onClick={() => setPanel(null)}>关闭</button>
          </div>
          {pingResult && (
            <p className="media-panel-desc">
              {pingResult.ok ? '✅ ' : '❌ '}
              {pingResult.text}
              {pingResult.urls.length > 0 && (
                <>
                  <br />
                  本次推的网址：{pingResult.urls.join('、')}
                </>
              )}
            </p>
          )}
        </div>
      )}

        <div className="editor-tabs">
          <button className={`tab-btn ${!previewing && !enOpen ? 'active' : ''}`} onClick={() => { setPreviewing(false); setEnOpen(false); }}>
            编辑
          </button>
          <button className={`tab-btn ${previewing && !enOpen ? 'active' : ''}`} onClick={() => { setPreviewing(true); setEnOpen(false); }}>
            预览
          </button>
          {/* P3：英文译文工作台（仅编辑已有文章时出现——新文章还没有 id） */}
          {editing && (
            <button className={`tab-btn ${enOpen ? 'active' : ''}`} onClick={() => setEnOpen(true)}>
              English 译文
            </button>
          )}
        </div>

        {enOpen && editing ? (
          <TranslationWorkbench
            article={editing}
            zhTitle={title}
            zhContent={content}
            zhSummary={summary}
            zhSynopsis={synopsis}
            zhChapters={chapters}
            zhDirty={zhDirty}
            onSaveZh={saveZhFromWorkbench}
            onClose={() => setEnOpen(false)}
          />
        ) : previewing ? (
          <div className="editor-preview">
            <MarkdownRenderer content={content} />
          </div>
        ) : (
          <textarea
            ref={editorRef}
            className="editor-textarea"
            placeholder={'支持 Markdown 和 LaTeX 数学公式：\n\n- 块级公式使用 $$...$$\n  例如 $$\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}$$\n\n- 行内公式使用 $...$\n  例如 $\\int_0^1 x^2 dx = \\frac{1}{3}$\n\n- 代码块使用 ```lang'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
          />
        )}

            <div className="bench-foot">
              <span>{plainWords} 字</span>
              <span>预计阅读 {readMinutes} 分钟</span>
              <span className="msp" />
              <span>{editing ? 'Markdown · 编辑已有文章' : 'Markdown · 新建'}</span>
            </div>
          </div>

          {/* 发布面板（样张的 .bench-side）：状态/可见/分类/收藏 四行 ＋ 发布 ＋ 推给 Bing */}
          <aside className="bench-side">
            <h4>发布</h4>
            <div className="side-row">
              <span>状态</span>
              <b>{editing ? '已发布' : '草稿'}</b>
            </div>
            <div className="side-row">
              <span>可见</span>
              <b>{category === 'reading' ? '书架' : '公开'}</b>
            </div>
            <div className="side-row">
              <span>分类</span>
              <b>{CATEGORY_META[category].label}</b>
            </div>
            <div className="side-row">
              <span>收藏</span>
              <label className="side-check">
                <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
                {favorite ? '已收藏 / 星标' : '未收藏'}
              </label>
            </div>
            <button className="btn wide" onClick={save}>
              {editing ? '保存修改' : category === 'reading' ? '发布这本小说' : '发布文章'}
            </button>
            <button className="btn ghost wide" onClick={() => setPanel('indexnow')}>推给 Bing</button>
            <p className="side-note">发布后会自动写入 sitemap，并推送到 IndexNow。</p>
            {category === 'reading' && (
              <p className="side-note">
                你当前在小说模式：发布时会保存 书名、作者、封面、章节、简介，并在「小说书架」以封面形式展示；发布前若没有章节，会提示你补充。
              </p>
            )}
            {!editing && (
              <p className="side-note">
                {draftSavedAt
                  ? `草稿保存于 ${draftSavedAt.toLocaleString('zh-CN')}`
                  : '正文会自动保存为草稿，刷新或离开后回来仍能接着写'}
                {draftSavedAt && (
                  <>
                    {' '}
                    <button className="draft-clear" onClick={clearDraft} title="清除本地草稿">清除草稿</button>
                  </>
                )}
              </p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
