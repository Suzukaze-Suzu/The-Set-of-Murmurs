import { useState, useRef, ChangeEvent } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META, Article, ArticleAttachment, Category } from '../types';
import { uid, storageKey } from '../context/ArticleContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [panel, setPanel] = useState<'image' | 'music' | 'attachment' | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
    const [musicInfo, setMusicInfo] = useState('');
  const [imgDragging, setImgDragging] = useState(false);
  const [attachments, setAttachments] = useState<ArticleAttachment[]>(editing?.attachments || []);
  const attachInput = useRef<HTMLInputElement>(null);
  const [attachUploading, setAttachUploading] = useState(false);

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


  const uploadAttachments = async (files: FileList | null, uploadDisabled?: boolean) => {
    if (!files || files.length === 0) return;
    setAttachUploading(true);
    const added: ArticleAttachment[] = [];
    try {
      for (const file of Array.from(files)) {
        const path = 'attachments/' + Date.now().toString(36) + '-' + file.name.replace(/[\/:*?"<>|]/g, '_');
        const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
        if (error) { alert('附件「' + file.name + '」上传失败：' + error.message); continue; }
        const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
        added.push({ name: file.name, url: pub.publicUrl, size: file.size });
      }
    } finally {
      setAttachUploading(false);
    }
    if (added.length) setAttachments((prev) => [...prev, ...added]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = () => {
    if (!title.trim()) {
      alert('请填写标题');
      return;
    }
    const tagsArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    const article: Article = {
      id: editing?.id || uid(),
      title: title.trim(),
      content,
      category,
      tags: tagsArr,
      date: editing?.date || new Date().toISOString().slice(0, 10),
      favorite,
      pinned: editing?.pinned || false,
      attachments,
      summary: content.replace(/[#>*`$\\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 120),
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
          {attachUploading && <p className="media-uploading">正在上传附件…</p>}
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
