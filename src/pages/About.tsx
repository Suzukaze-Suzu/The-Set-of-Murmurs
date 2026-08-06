import { useState, ChangeEvent, useRef, FormEvent } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useAbout, AboutVersion } from '../context/AboutContext';
import { useFooter, FooterText } from '../context/SiteTextContext';
import ProfileCard from '../components/ProfileCard';
import AvatarCropModal from '../components/AvatarCropModal';
import MarkdownRenderer from '../components/MarkdownRenderer';

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function About() {
  const { profile, setProfile } = useProfile();
  const { isAdmin } = useAuth();
  const { current, versions, loading, saving, save, loadVersion, rollback, reset } = useAbout();
  const { footer, saving: savingFooter, saveFooter, histories } = useFooter();
  const [footerEdit, setFooterEdit] = useState(false);
  const [fSlogan, setFSlogan] = useState(footer.slogan);
  const [fCaption, setFCaption] = useState(footer.caption);
  const [fCopy, setFCopy] = useState(footer.copyright);
  const [showFooterHist, setShowFooterHist] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<AboutVersion | null>(null);
  const [nickname, setNickname] = useState(profile.nickname);
  const [signature, setSignature] = useState(profile.signature);
  const [intro, setIntro] = useState(profile.intro);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCropImage(String(reader.result)); };
    reader.readAsDataURL(file);
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfile({ ...profile, nickname, signature, intro });
    setEditMode(false);
    setMsg('资料已保存');
    setTimeout(() => setMsg(''), 2500);
  };

  const openEdit = () => { setEditText(current); setPreviewing(false); setEditMode(true); };
  const saveIntro = async () => {
    try {
      await save(editText);
      setEditMode(false);
      setMsg('简介已保存，已生成新版本');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      alert('保存失败：' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const openFooterEdit = () => { setFSlogan(footer.slogan); setFCaption(footer.caption); setFCopy(footer.copyright); setFooterEdit(true); };
  const saveFooterBtn = async () => {
    try { await saveFooter({ slogan: fSlogan, caption: fCaption, copyright: fCopy }); setFooterEdit(false); setMsg('页脚文字已更新'); setTimeout(() => setMsg(''), 2500); }
    catch (e) { alert('保存失败：' + (e instanceof Error ? e.message : String(e))); }
  };

  const doRollback = async (id: string) => {
    if (!window.confirm('将把该历史版本设为当前简介，并生成一条新版本记录。确定吗？')) return;
    await rollback(id);
    setShowHistory(false);
    setMsg('已恢复该版本');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="page about-page">
      <h1 className="page-title">关于本站</h1>

      <div className="about-grid">
        <ProfileCard />

        <div className="about-content card">
          {editMode ? (
            <>
              <div className="about-edit-head">
                <h2>编辑本站简介</h2>
                <div className="about-preview-tabs">
                  <button className={'tab-btn ' + (previewing ? '' : 'active')} onClick={() => setPreviewing(false)}>编辑</button>
                  <button className={'tab-btn ' + (previewing ? 'active' : '')} onClick={() => setPreviewing(true)}>预览</button>
                </div>
              </div>
              {previewing ? (
                <div className="editor-preview"><MarkdownRenderer content={editText} /></div>
              ) : (
                <textarea className="editor-textarea about-editor" value={editText} onChange={(e) => setEditText(e.target.value)} rows={16} placeholder={'支持 Markdown：\n## 标题\n正文…\n\n### 小标题\n更多内容'} />
              )}
              <div className="about-actions">
                <button className="btn btn-primary" onClick={saveIntro}>{saving ? '保存中…' : '保存并生成新版本'} </button>
                <button className="btn" onClick={() => setEditMode(false)}>取消</button>
              </div>
            </>
          ) : (
            <>
              <div className="about-content-head">
                <h2>本站简介</h2>
                {!loading && isAdmin && (
                <div className="about-head-actions">
                  <button className="btn btn-light btn-sm" onClick={() => { setPreviewVersion(null); setShowHistory(true); }}>历史版本({versions.length})</button>
                  <button className="btn btn-primary btn-sm" onClick={openEdit}>编辑简介</button>
                </div>
                )}
              </div>
              <div className="about-render">{loading ? <div className="about-loading"><span className="about-loading-spin"/><p>正在加载简介…</p></div> : <MarkdownRenderer content={current} />}</div>
            </>
          )}

          {msg && <p className="about-msg">{msg}</p>}

          {/* 配色装饰（固定） */}
          <div className="color-palette">
            <span style={{ background: '#5BA8D8' }} title="天空蓝" />
            <span style={{ background: '#E8C9A0' }} title="蜜金" />
            <span style={{ background: '#E89B8A' }} title="珊瑚粉" />
            <span style={{ background: '#4A9BB8' }} title="青蓝" />
            <span style={{ background: '#8A8F9A' }} title="灰蓝" />
            <span style={{ background: '#2F6B4F' }} title="森林绿" />
          </div>
        </div>
      </div>

      {/* 编辑个人资料（仅博主可见） */}
      {isAdmin && (
      <div className="edit-profile card">
          {editMode ? (
          <form onSubmit={saveProfile}>
            <h3>编辑个人资料</h3>
            <button type="button" className="avatar-upload-btn" onClick={() => avatarInput.current?.click()}>
              {profile.avatar ? <img src={profile.avatar} alt="头像" /> : <span className="avatar-upload-hint">＋<small>头像</small></span>}
            </button>
            <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
            <label>昵称</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <label>签名</label>
            <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} />
            <label>介绍</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={4} />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">保存</button>
              <button type="button" className="btn" onClick={() => setEditMode(false)}>取消</button>
            </div>
          </form>
        ) : (
          <div className="profile-controls">
            <h3>个人资料管理</h3>
            <p>你可以在这里上传头像、修改昵称、签名与介绍。</p>
            <button className="btn btn-primary" onClick={() => setEditMode(true)}>编辑个人资料</button>
          </div>
        )}
      </div>
      )}

      {showHistory && (
        <div className="modal-overlay about-history-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal about-history-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHistory(false)}>×</button>
            <h3 className="modal-title">简介修改历史</h3>
            <p className="history-hint">点击「预览」查看某个版本，点击「设为当前」回滚到该版本。</p>
            <div className="history-list">
              {versions.length === 0 ? (
                <p className="empty-tip">还没有历史版本。</p>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="history-item">
                    <div className="history-item-info">
                      <span className="history-badge">{i === 0 ? '当前' : '版本 ' + (i + 1)}</span>
                      <span className="history-date">{fmt(v.date)}</span>
                    </div>
                    <div className="history-actions">
                      <button className="btn btn-light btn-sm" onClick={() => setPreviewVersion(v)}>预览</button>
                      <button className="btn btn-primary btn-sm" onClick={() => doRollback(v.id)}>设为当前</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {previewVersion && (
              <div className="history-preview">
                <div className="history-preview-head">
                  <strong>正在预览版本</strong>
                  <span className="history-date">{fmt(previewVersion.date)}</span>
                  <button className="btn btn-light btn-sm" onClick={() => setPreviewVersion(null)}>收起</button>
                </div>
                <div className="history-preview-body"><MarkdownRenderer content={previewVersion.content} /></div>
              </div>
            )}
            {versions.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={() => reset()}>回到当前版本预览</button>
            )}
          </div>
        </div>
      )}


      {isAdmin && (
      <div className="edit-profile card footer-edit-card">
        {footerEdit ? (
          <>
            <h3>设置页脚文字</h3>
            <label>标语（第一行）</label>
            <input className="gallery-input" type="text" value={fSlogan} onChange={(e) => setFSlogan(e.target.value)} />
            <label>副标题（可选，留空不显示）</label>
            <input className="gallery-input" type="text" value={fCaption} onChange={(e) => setFCaption(e.target.value)} />
            <label>版权行（可用 &#123;year&#125; 表示当前年份）</label>
            <input className="gallery-input" type="text" value={fCopy} onChange={(e) => setFCopy(e.target.value)} />
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveFooterBtn}>{savingFooter ? '保存中…' : '保存页脚文字'}</button>
              <button className="btn" onClick={() => setFooterEdit(false)}>取消</button>
            </div>
          </>
        ) : (
          <div className="profile-controls">
            <h3>页脚文字管理</h3>
            <p className="footer-current">
              标语：{footer.slogan}<br/>
              {footer.caption && <>副标题：{footer.caption}<br/></>}
              版权：{footer.copyright.replace('{year}', String(new Date().getFullYear()))}
            </p>
            <div className="about-controls-row">
              <button className="btn btn-primary btn-sm" onClick={openFooterEdit}>编辑页脚文字</button>
              <button className="btn btn-light btn-sm" onClick={() => setShowFooterHist(true)}>历史记录</button>
            </div>
          </div>
        )}
      </div>
      )}

      {showFooterHist && (
        <div className="modal-overlay about-history-overlay" onClick={() => setShowFooterHist(false)}>
          <div className="modal about-history-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFooterHist(false)}>×</button>
            <h3 className="modal-title">页脚文字修改历史</h3>
            <div className="history-list">
              {Object.keys(histories).length === 0 ? (
                <p className="empty-tip">还没有历史记录。</p>
              ) : (
                Object.entries(histories).map(([k, list]) => (
                  <div key={k} className="history-key-block">
                    <div className="history-key-label">{k === 'footer_slogan' ? '标语' : k === 'footer_caption' ? '副标题' : '版权行'}</div>
                    {list.map((v, i) => (
                      <div key={v.id} className="history-item">
                        <div className="history-item-info">
                          <span className="history-badge">{i === 0 ? '当前' : '版本 ' + (i + 1)}</span>
                          <span className="history-date">{new Date(v.date).toLocaleString()}</span>
                        </div>
                        <div className="history-actions"><span className="history-text">{v.content}</span></div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <AvatarCropModal
        open={!!cropImage}
        imageSrc={cropImage}
        onCancel={() => setCropImage(null)}
        onConfirm={(cropped) => {
          setProfile({ ...profile, avatar: cropped });
          setCropImage(null);
        }}
      />
    </div>
  );
}
