import { useState, useRef, ChangeEvent } from 'react';
import { useArticles } from '../context/ArticleContext';
import { CATEGORIES, CATEGORY_META, Article, Category } from '../types';
import { uid, storageKey } from '../context/ArticleContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
        <button className="btn btn-light" onClick={clearAll}>重置数据</button>
      </div>

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
