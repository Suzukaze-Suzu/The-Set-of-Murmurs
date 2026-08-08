import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArticles, uid } from '../context/ArticleContext';
import { Article, NovelChapter, NovelStatus, NOVEL_STATUS_META } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { supabase } from '../lib/supabase';

export default function NovelComposer() {
  const navigate = useNavigate();
  const { articles, getById, addArticle, updateArticle } = useArticles();

  const books = articles
    .filter((a) => a.category === 'reading' && (a.novel?.chapters?.length || 0) > 0)
    .sort((x, y) => y.date.localeCompare(x.date));

  const [mode, setMode] = useState<'new' | 'existing'>('new');

  // 新建书的附加信息
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookStatus, setBookStatus] = useState<NovelStatus>('serializing');
  const [bookCover, setBookCover] = useState('');
  const [bookSynopsis, setBookSynopsis] = useState('');

  // 已有书
  const [bookId, setBookId] = useState('');

  // 本章正文
  const [chTitle, setChTitle] = useState('');
  const [content, setContent] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const txtInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);

  const insertAtCursor = (text: string) => {
    const ta = editorRef.current;
    if (!ta) { setContent((c) => c + text); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + text.length; }, 0);
  };

  const uploadImage = async (file: File | undefined | null) => {
    if (!file) { alert('请选择图片'); return; }
    setImgUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = 'novel/img/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
      if (error) { alert('图片上传失败：' + error.message); return; }
      const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
      insertAtCursor('\n![图片](' + pub.publicUrl + ')\n');
    } catch (err) {
      alert('图片上传异常：' + (err instanceof Error ? err.message : String(err)));
    } finally { setImgUploading(false); }
  };

  const uploadCover = async (file: File | undefined | null) => {
    if (!file) { alert('请选择封面图片'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = 'novel/cover/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await supabase.storage.from('articles').upload(path, file, { upsert: false });
      if (error) { alert('封面上传失败：' + error.message); return; }
      const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
      setBookCover(pub.publicUrl);
    } catch (err) {
      alert('封面上传异常：' + (err instanceof Error ? err.message : String(err)));
    } finally { setUploading(false); }
  };

  const importTxt = (file: File | undefined | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result || ''));
      if (!chTitle.trim()) setChTitle('第1章');
    };
    reader.readAsText(file);
  };

  const saveNew = () => {
    if (!bookTitle.trim()) { alert('请填写书名'); return; }
    if (!content.trim()) { alert('请填写本章正文'); return; }
    const chapter: NovelChapter = {
      id: uid(),
      title: chTitle.trim() || '第一章',
      content,
      order: 0,
      wordCount: content.replace(/\s/g, '').length,
    };
    const article: Article = {
      id: uid(),
      title: bookTitle.trim(),
      content,
      category: 'reading',
      tags: [],
      date: new Date().toISOString().slice(0, 10),
      favorite: false,
      pinned: false,
      summary: bookSynopsis.trim() || content.replace(/[#>*`$\\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 120),
      novel: {
        author: bookAuthor.trim() || undefined,
        cover: bookCover.trim() || undefined,
        status: bookStatus,
        synopsis: bookSynopsis.trim() || undefined,
        chapters: [chapter],
        wordCount: chapter.wordCount,
      },
    };
    const msg = '即将创建小说《' + article.title + '》\n作者：' + (article.novel?.author || '（未填写）') + '\n第一章 · ' + (chapter.wordCount || 0) + ' 字\n\n点击「确定」发布。';
    if (!window.confirm(msg)) return;
    addArticle(article);
    navigate('/article/' + article.id);
  };

  const saveExisting = () => {
    if (!bookId) { alert('请先选择已有的书'); return; }
    if (!content.trim()) { alert('请填写本章正文'); return; }
    const book = getById(bookId);
    if (!book || !book.novel) { alert('未找到这本书'); return; }
    const chapters = (book.novel.chapters || []).slice();
    const newCh: NovelChapter = {
      id: uid(),
      title: chTitle.trim() || ('第' + (chapters.length + 1) + '章'),
      content,
      order: chapters.length,
      wordCount: content.replace(/\s/g, '').length,
    };
    chapters.push(newCh);
    const updated: Article = { ...book, novel: { ...book.novel, chapters, wordCount: (book.novel.wordCount || 0) + (newCh.wordCount || 0) } };
    const msg = '即将向《' + book.title + '》追加「' + newCh.title + '」\n现在共 ' + chapters.length + ' 章。\n\n点击「确定」发布。';
    if (!window.confirm(msg)) return;
    updateArticle(updated);
    navigate('/article/' + bookId);
  };

  const switchBook = (id: string) => { setBookId(id); setChTitle(''); };

  const activeBook = bookId ? getById(bookId) : undefined;

  return (
    <div className="novel-composer">
      <p className="novel-composer-desc">一次上传一章。首次创建一本书时填写附加信息，之后只需选中这本书、上传新章节即可。</p>

      <div className="novel-switch">
        <button className={'mode-tab' + (mode === 'new' ? ' on' : '')} onClick={() => setMode('new')}>新建一本书</button>
        <button className={'mode-tab' + (mode === 'existing' ? ' on' : '')} onClick={() => setMode('existing')}>给已有书写新章</button>
      </div>

      {mode === 'new' ? (
        <div className="novel-newbox card">
          <div className="novel-fields">
            <div className="meta-field"><label>书名（必填）</label><input type="text" placeholder="这本书的名字" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} /></div>
            <div className="meta-field"><label>作者</label><input type="text" placeholder="同学的名字" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} /></div>
            <div className="meta-field"><label>状态</label>
              <select value={bookStatus} onChange={(e) => setBookStatus(e.target.value as NovelStatus)}>
                {Object.entries(NOVEL_STATUS_META).map(([k, m]) => (<option key={k} value={k}>{m.label}</option>))}
              </select>
            </div>
          </div>
          <div className="novel-cover-row">
            <div className="novel-cover-preview">
              {bookCover ? <img src={bookCover} alt="封面" className="novel-cover-img" /> : <span className="novel-cover-ph">{bookTitle.slice(0, 1) || '书'}</span>}
            </div>
            <div className="novel-cover-actions">
              <button className="btn btn-light btn-sm" onClick={() => coverInput.current?.click()}>{uploading ? '上传中…' : '上传本地封面'}</button>
              <input ref={coverInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
              <p className="novel-cover-hint">支持 jpg / png / webp，将自动上传并作为书架封面。</p>
            </div>
          </div>
          <div className="novel-field-full">
            <label>简介</label>
            <textarea rows={2} placeholder="一句话介绍这本书…" value={bookSynopsis} onChange={(e) => setBookSynopsis(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="novel-existingbox card">
          <div className="meta-field">
            <label>选择已有书</label>
            <select value={bookId} onChange={(e) => switchBook(e.target.value)}>
              <option value="">-- 选择一本书 --</option>
              {books.map((b) => (<option key={b.id} value={b.id}>《{b.title}》· {b.novel?.chapters?.length || 0} 章</option>))}
            </select>
          </div>
          {activeBook && activeBook.novel && (
            <p className="novel-book-tip">《{activeBook.title}》 · 作者 {activeBook.novel.author || '—'} · 现有 {activeBook.novel.chapters?.length || 0} 章 · 共 {activeBook.novel.wordCount || 0} 字</p>
          )}
        </div>
      )}

      {/* 本章正文编辑器 */}
      <div className="novel-chapter-editor card">
        <div className="novel-ch-ed-head">
          <input className="novel-ch-title-input" placeholder={mode === 'new' ? '本章标题（默认：第一章）' : '本章标题（默认：自动编号）'} value={chTitle} onChange={(e) => setChTitle(e.target.value)} />
        </div>
        <div className="toolbar">
          <button className="btn btn-light" onClick={() => txtInput.current?.click()}>导入 txt</button>
          <input ref={txtInput} type="file" accept=".txt,.md,.markdown" style={{ display: 'none' }} onChange={(e) => { importTxt(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn btn-light" disabled={imgUploading} onClick={() => imgInput.current?.click()}>{imgUploading ? '上传中…' : '插图'}</button>
          <input ref={imgInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <div className="editor-tabs">
          <button className={'tab-btn' + (!previewing ? ' active' : '')} onClick={() => setPreviewing(false)}>编辑</button>
          <button className={'tab-btn' + (previewing ? ' active' : '')} onClick={() => setPreviewing(true)}>预览</button>
        </div>
        {previewing ? (
          <div className="editor-preview"><MarkdownRenderer content={content} /></div>
        ) : (
          <textarea ref={editorRef} className="editor-textarea" rows={14} value={content} onChange={(e) => setContent(e.target.value)} placeholder={'本章正文（支持 Markdown 与 LaTeX）：\n\n- 块级公式 $$...$$\n- 行内公式 $...$\n- 代码块 ```lang'} />
        )}
      </div>

      <div className="write-actions">
        <button className="btn btn-primary" onClick={mode === 'new' ? saveNew : saveExisting}>
          {mode === 'new' ? '发布这本书（含第一章）' : '追加本章'}
        </button>
      </div>
    </div>
  );
}