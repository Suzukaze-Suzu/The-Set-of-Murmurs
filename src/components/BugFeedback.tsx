import { useState, useEffect, FormEvent } from 'react';
import { BugReport, BUG_CATEGORIES } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

export default function BugFeedback() {
  const { user, isAdmin } = useAuth();
  const { myProfile } = useProfile();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('bug');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('bug_reports')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!mounted) return;
        if (data) setReports(data.map((r) => ({ id: r.id, userId: r.user_id || undefined, nickname: r.nickname || '匿名', category: r.category || 'other', content: r.content, status: r.status || '待处理', date: r.date })));
      });
    return () => { mounted = false; };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { setError('请填写问题描述'); return; }
    setError('');
    const nickname = (myProfile && myProfile.nickname ? myProfile.nickname : '').trim() || '匿名用户';
    const id = 'bug_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const date = new Date().toISOString();
    const row: Record<string, unknown> = {
      id: id,
      content: content.trim(),
      category: category,
      status: '待处理',
      date: date,
      nickname: nickname
    };
    if (user) row.user_id = user.id;
    supabase
      .from('bug_reports')
      .insert(row)
      .then(({ error: err }) => {
        if (err) { setError('提交失败：' + err.message); return; }
        const newRep: BugReport = { id: id, userId: (user && user.id) || undefined, nickname: nickname, category: category, content: content.trim(), status: '待处理', date: date };
        setReports((prev) => [newRep, ...prev]);
        setContent('');
        setCategory('bug');
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      });
  };

  // 切换状态：待处理 <-> 已处理。博主可改任何，普通用户可改自己的。
  const toggleStatus = (rep: BugReport) => {
    const nextStatus = rep.status === '待处理' ? '已处理' : '待处理';
    // 乐观更新 UI
    setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, status: nextStatus } : r)));
    // 写入数据库；失败则回滚并提示，避免出现"假成功"（前端已改但数据库没写入）
    supabase
      .from('bug_reports')
      .update({ status: nextStatus })
      .eq('id', rep.id)
      .then(({ error: err }) => {
        if (err) {
          setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, status: rep.status } : r)));
          setError('状态更新失败：' + err.message);
        } else {
          setError('');
        }
      });
  };

  const canEdit = (rep: BugReport) => !!user && (isAdmin || rep.userId === user.id);

  const userCanSubmit = !!user;

  return (
    <div className="card bug-feedback">
      <div className="bug-feedback-head">
        <h2 className="section-title">Bug 反馈 / 报错</h2>
        <p className="bug-feedback-desc">遇到问题？把 bug、界面异常或功能建议填在这里反馈给我。</p>
      </div>

      {!userCanSubmit ? (
        <div className="comment-login-tip">登录后才能提交反馈哦～</div>
      ) : (
        <form className="comment-form" onSubmit={submit}>
          <select className="bug-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUG_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea
            className="comment-content"
            placeholder="请描述你遇到的问题或报错…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="bug-actions">
            <button type="submit" className="btn btn-primary">提交反馈</button>
            {ok && <span className="submit-ok">已提交，谢谢反馈！</span>}
          </div>
          {error && <p className="gallery-error">{error}</p>}
        </form>
      )}

      <div className="bug-list">
        {reports.length === 0 ? (
          <p className="empty-tip">还没有反馈，一切安好～</p>
        ) : (
          reports.map((rep) => {
            const cat = BUG_CATEGORIES.find((c) => c.value === rep.category);
            const done = rep.status !== '待处理';
            const stCls = done ? 'bug-status bug-status-done' : 'bug-status';
            return (
              <div key={rep.id} className="bug-item">
                <div className="bug-item-head">
                  <span className="bug-cat-tag" style={{ background: cat ? '#E89B8A' : '#8A8F9A' }}>{cat ? cat.label : rep.category}</span>
                  <span className={stCls}>{rep.status}</span>
                  <span className="comment-date">{new Date(rep.date).toLocaleString()}</span>
                  {canEdit(rep) && (
                    <button
                      className="bug-toggle"
                      onClick={() => toggleStatus(rep)}
                    >
                      {done ? '恢复待处理' : '标记已处理'}
                    </button>
                  )}
                </div>
                <p className="bug-item-content">{rep.content}</p>
                <span className="bug-item-author">— {rep.nickname}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
