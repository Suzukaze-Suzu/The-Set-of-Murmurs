import { useState, useRef, ChangeEvent } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META, Article, ArticleAttachment, Category, NovelChapter, NovelStatus } from '../types';
import { NOVEL_STATUS_META } from '../types';
import { uid, storageKey } from '../context/ArticleContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, SUPABASE_URL } from '../lib/supabase';

export default function Write() {
  const { isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById, addArticle, updateArticle } = useArticles();

  const editing = id ? getById(id) : undefined;

  const [title, setTitle] = useState(editing?.title || '');
  const [content, setContent] = useState(editing?.content || '');
  const [category, setCategory] = useState<Category>(editing?.category || 'essay');
  const [tags, setTags] = useState(editing?.tags.join(', ') || '');
  const [favorite, setFavorite] = useState(editing?.favorite || false);
  const [previewing, setPreviewing] = useState(false);
  // 小说（chapter）编辑状态（仅 category=reading 使用）
  const [author, setAuthor] = useState(editing?.novel?.author || '');
  const [cover, setCover] = useState(editing?.novel?.cover || '');
  const [nstatus, setNstatus] = useState<NovelStatus>(editing?.novel?.status || 'serializing');
  const [synopsis, setSynopsis] = useState(editing?.novel?.synopsis || '');
  const [chapters, setChapters] = useState<NovelChapter[]>(editing?.novel?.chapters?.slice() || []);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [panel, setPanel] = useState<'image' | 'music' | 'attachment' | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
    const [musicInfo, setMusicInfo] = useState('');
  const [imgDragging, setImgDragging] = useState(false);
  const [attachments, setAttachments] = useState<ArticleAttachment[]>(editing?.attachments || []);
  const attachInput = useRef<HTMLInputElement>(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachProg, setAttachProg] = useState<Record<string, number>>({});

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
    setChapters((prev) => [...prev, { id: mkChapterId(), title: chapterTitle, content: ccontent, order: prev.length, wordCount: ccontent.replace(/\s/g, '').length }]);
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

  const save = () => {
    if (!title.trim()) {
      alert('请填写标题');
      return;
    }
    const tagsArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    const isNovelMode = category === 'reading' && chapters.length > 0;
    const sortedChapters = chapters.slice().sort((a, b) => a.order - b.order);
    let novelObj: Article['novel'];
    if (isNovelMode) {
      const allWordCount = sortedChapters.reduce((s, ch) => s + (ch.content || '').replace(/\s/g, '').length, 0);
      novelObj = {
        author: author.trim() || undefined,
        cover: cover.trim() || undefined,
        status: nstatus,
        synopsis: synopsis.trim() || undefined,
        chapters: sortedChapters,
        wordCount: allWordCount,
      };
    }
    const novelSummary = (synopsis.trim() || sortedChapters[0]?.content.replace(/[#>*`$\\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 120) || '');
    const article: Article = {
      id: editing?.id || uid(),
      title: title.trim(),
      content: isNovelMode ? sortedChapters.map((ch) => ch.content).join('\n\n') : content,
      category,
      tags: tagsArr,
      date: editing?.date || new Date().toISOString().slice(0, 10),
      favorite,
      pinned: editing?.pinned || false,
      attachments,
      summary: isNovelMode ? novelSummary : content.replace(/[#>*`$\\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 120),
      novel: isNovelMode ? novelObj : undefined,
    };
    if (editing) {
      updateArticle(article);
    } else {
      addArticle(article);
    }
    navigate(`/article/${article.id}`);
  };

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

  return (
    <div className="page write-page">
      <h1 className="page-title">{editing ? '编辑文章' : '写作'}</h1>

      <div className="toolbar">
        <button className="btn btn-light" onClick={exportAs}>导出 .md / .tex</button>
        <button className="btn btn-light" onClick={() => fileInput.current?.click()}>
          导入文件
        </button>
        <input ref={fileInput} type="file" accept=".md,.markdown,.txt,.tex" style={{ display: 'none' }} onChange={onImport} />
        <button className="btn btn-light" onClick={() => setPanel('image')}>插入图片</button>
        <button className="btn btn-light" onClick={() => setPanel('music')}>插入音乐</button>
        <button className="btn btn-light" onClick={() => setPanel('attachment')}>添加附件</button>
        <button className="btn btn-light" onClick={clearAll}>重置数据</button>
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
      <div className="write-form card">
        <input
          type="text"
          className="write-title"
          placeholder="文章标题…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="write-meta">
          <div className="meta-field">
            <label>分类</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <div className="meta-field">
            <label>标签（用逗号分隔）</label>
            <input
              type="text"
              placeholder="如: 线代, 证明, 复习"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          <label className="fav-check">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
            收藏/星标
          </label>
        </div>

        {category === 'reading' && (
          <div className="novel-editor card">
            <h3 className="novel-editor-title">小说信息</h3>
            <div className="novel-fields">
              <div className="meta-field">
                <label>作者（名著主名）</label>
                <input type="text" placeholder="同学名字" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
              <div className="meta-field">
                <label>封面图 URL（可选）</label>
                <input type="text" placeholder="https://…/cover.jpg" value={cover} onChange={(e) => setCover(e.target.value)} />
              </div>
              <div className="meta-field">
                <label>状态</label>
                <select value={nstatus} onChange={(e) => setNstatus(e.target.value as NovelStatus)}>
                  {Object.entries(NOVEL_STATUS_META).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="novel-field-full">
              <label>简介</label>
              <textarea rows={2} placeholder="一句话介绍这本书…" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
            </div>

            <div className="novel-ch-tools">
              <h4>章节</h4>
              <button className="btn btn-light btn-sm" onClick={() => addChapter()}>＋ 新增章节</button>
              <label className="btn btn-light btn-sm file-btn">
                导入 txt 自动分章
                <input type="file" accept=".txt,.md,.markdown" style={{ display: 'none' }} onChange={(e) => importChapterFile(e, true)} />
              </label>
              <label className="btn btn-light btn-sm file-btn">
                追加 txt 为一章
                <input type="file" accept=".txt,.md,.markdown" style={{ display: 'none' }} onChange={(e) => importChapterFile(e, false)} />
              </label>
            </div>

            {chapters.length === 0 && (
              <p className="novel-empty-tip">还没有章节，可「新增章节」，或直接导入同学的 txt 自动分章。</p>
            )}

            <div className="novel-ch-list">
              {chapters.map((ch, ix) => (
                <div className="novel-ch-item" key={ch.id}>
                  <div className="novel-ch-head">
                    <input className="novel-ch-title-input" value={ch.title} onChange={(e) => updateChapter(ch.id, { title: e.target.value })} placeholder="章节标题" />
                    <span className="novel-ch-wc">{ch.wordCount ?? 0} 字</span>
                    <button className="btn btn-light btn-sm" disabled={ix === 0} onClick={() => moveChapter(ch.id, -1)}>↑</button>
                    <button className="btn btn-light btn-sm" disabled={ix === chapters.length - 1} onClick={() => moveChapter(ch.id, 1)}>↓</button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeChapter(ch.id)}>删除</button>
                  </div>
                  <textarea className="novel-ch-content" value={ch.content} onChange={(e) => updateChapter(ch.id, { content: e.target.value })} rows={6} placeholder="本章正文（支持 Markdown 与 LaTeX）" />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="editor-tabs">
          <button className={`tab-btn ${!previewing ? 'active' : ''}`} onClick={() => setPreviewing(false)}>
            编辑
          </button>
          <button className={`tab-btn ${previewing ? 'active' : ''}`} onClick={() => setPreviewing(true)}>
            预览
          </button>
        </div>

        {previewing ? (
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
      </div>

      <div className="write-actions">
        <button className="btn btn-primary" onClick={save}>
          {editing ? '保存修改' : '发布文章'}
        </button>
      </div>
    </div>
  );
}
