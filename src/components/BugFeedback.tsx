import { useState, useEffect, FormEvent } from 'react';
import { BugReport, BUG_CATEGORIES } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useT, useLocale } from '../i18n';

export default function BugFeedback() {
  const { user, isAdmin } = useAuth();
  const { myProfile } = useProfile();
  const t = useT();
  const { dateLocale } = useLocale();
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
        if (data) setReports(data.map((r) => ({ id: r.id, userId: r.user_id || undefined, nickname: r.nickname || t('bug.anonymous'), category: r.category || 'other', content: r.content, status: r.status || t('bug.statusOpen'), date: r.date })));
      });
    return () => { mounted = false; };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { setError(t('bug.needContent')); return; }
    setError('');
    const nickname = (myProfile && myProfile.nickname ? myProfile.nickname : '').trim() || t('bug.anonymous');
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
        if (err) { setError(t('bug.submitFailed') + err.message); return; }
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
          setError(t('bug.statusFailed') + err.message);
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
        <h2 className="section-title">{t('bug.heading')}</h2>
        <p className="bug-feedback-desc">{t('bug.desc')}</p>
      </div>

      {!userCanSubmit ? (
        <div className="comment-login-tip">{t('bug.needLogin')}</div>
      ) : (
        <form className="comment-form" onSubmit={submit}>
          <select className="bug-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUG_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(`cat.${c.value}` as 'cat.bug')}</option>)}
          </select>
          <textarea
            className="comment-content"
            placeholder={t('bug.placeholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="bug-actions">
            <button type="submit" className="btn btn-primary">{t('bug.submit')}</button>
            {ok && <span className="submit-ok">{t('bug.submitted')}</span>}
          </div>
          {error && <p className="gallery-error">{error}</p>}
        </form>
      )}

      <div className="bug-list">
        {reports.length === 0 ? (
          <p className="empty-tip">{t('bug.empty')}</p>
        ) : (
          reports.map((rep) => {
            const cat = BUG_CATEGORIES.find((c) => c.value === rep.category);
            const done = rep.status !== '待处理';
            const stCls = done ? 'bug-status bug-status-done' : 'bug-status';
            return (
              <div key={rep.id} className="bug-item">
                <div className="bug-item-head">
                  {/* 2026-09-14 第2f步：分类标签的底是「颜色」，只用色卡色（珊瑚粉 / 灰蓝浅底）；
                      第2j步：字改成**同色系墨色**（粉底 → 珊瑚墨色，灰蓝浅底 → 灰墨），不再用黑字。 */}
                  <span className="bug-cat-tag" style={{ background: cat ? 'var(--coral-solid)' : 'color-mix(in srgb,var(--slate-blue) 33%,transparent)', color: cat ? 'var(--coral-ink)' : 'var(--slate-ink)' }}>{cat ? t(`cat.${cat.value}` as 'cat.bug') : rep.category}</span>
                  <span className={stCls}>{done ? t('bug.statusDone') : t('bug.statusOpen')}</span>
                  <span className="comment-date">{new Date(rep.date).toLocaleString(dateLocale)}</span>
                  {canEdit(rep) && (
                    <button
                      className="bug-toggle"
                      onClick={() => toggleStatus(rep)}
                    >
                      {done ? t('bug.markOpen') : t('bug.markDone')}
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
