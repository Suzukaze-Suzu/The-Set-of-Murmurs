import { useState, ChangeEvent, useRef, FormEvent, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useArticles } from '../context/ArticleContext';
import { useAbout, AboutVersion } from '../context/AboutContext';
import { useFooter, FooterText } from '../context/SiteTextContext';
import AvatarCropModal from '../components/AvatarCropModal';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale, formatDate } from '../i18n';
import { catKey } from '../i18n/dict';
import { formatCount } from '../lib/wordCount';

/* ══════════════════════════════════════════════════════════════════════════════
   关于页（2026-10-08「样张直接做前端」）
   ──────────────────────────────────────────────────────────────────────────────
   主体逐块照 `design-mockups\g\n1-broadsheet\about.html`，类名一个不改：
     · `.hero.about-hero` ＝ `.hero-txt`(.kicker/h1/.slogan/.lede/.stats) ＋ `.hero-face.big`
       ← 样张 449-458（样张里的站点副题「未知的梦话与胡言乱语」＝字典 brand.tagline）
     · `.sec#about`  ＋ `.sec-head` ＋ `.prose`          ← 样张 459-466（「关于呓语集」）
     · `.sec#palette`＋ `.sec-head` ＋ `.swatches`(.sw/.swatch/.sw-note)  ← 样张 467-475
     · `.sec`        ＋ `.sec-head` ＋ `.facts`        ← 样张 476-485（「站点信息」）
   外壳（报头／报尾）由 N1Shell 提供，这里只写主体。

   数据接法：样张那两块静态文案里，**能量化的接真数据**——
     · h1      ＝站长昵称（样张「凉风凉」），取 `profile.nickname`
     · slogan  ＝签名（`profile.signature`），提要 lede＝自我介绍（`profile.intro`）：
                 与 N1Shell 报头用的同一套取值与兜底，`profile` 一个字没丢
     · `.stats`＝样张「2026 建站 / 12 篇文章 / 中 EN 双站」，其中「篇文章」取真实文章数
     · `.prose`＝AboutContext 的当前简介（MarkdownRenderer 渲染的 `current`），
                 即原来 `.about-render` 的正文，一字未改地挪进样张的 `.prose`
     · `.facts`＝样张原样（建站/技术/写作/语言/联系）
   样张里**没有**的站长能力（编辑简介 / 历史版本 / 个人资料 / 页脚文字 / 头像裁剪）
   全部保留在页面末尾，只用既有类名，未新增样式；见交付报告缺口清单。
   ══════════════════════════════════════════════════════════════════════════════ */

/* 报眼方框里的头像（站点既有素材）：取不到站长头像时兜底，与首页同一个常量 */
const AVATAR_FALLBACK = '/avatar-original.png';

/* 样张「主题灵感」四色（about.html 470-473）：**色号是红线**——
   天空蓝 #5BA8D8／读后感、蜜金 #E8C9A0／小说、珊瑚粉 #E89B8A／随笔、青蓝 #4A9BB8／数学笔记，
   原样照抄、不加第五色（#5BA8D8/#E8C9A0/#E89B8A/#4A9BB8 也与 CATEGORY_META 里四类的色卡色相同）。
   色名与分类名照样张原文（色名走字典键，英文站不露中文；分类名走 `cat.*`）。 */
const SWATCHES: { key: 'anime' | 'reading' | 'essay' | 'math'; color: string; nameKey: 'about.swatchSky' | 'about.swatchHoney' | 'about.swatchCoral' | 'about.swatchAqua' }[] = [
  { key: 'anime', color: '#5BA8D8', nameKey: 'about.swatchSky' },
  { key: 'reading', color: '#E8C9A0', nameKey: 'about.swatchHoney' },
  { key: 'essay', color: '#E89B8A', nameKey: 'about.swatchCoral' },
  { key: 'math', color: '#4A9BB8', nameKey: 'about.swatchAqua' },
];

export default function About() {
  const t = useT();
  const { locale } = useLocale();
  const location = useLocation();
  usePageTitle(t('about.title'));
  const { profile, setProfile } = useProfile();
  const { isAdmin } = useAuth();
  const { articles } = useArticles();
  const { current, versions, loading, saving, hasOwnVersion, save, loadVersion, rollback, reset } = useAbout();
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

  // 中文页上那个「编辑英文简介 →」链接会把 ?edit=1 带过来，落到英文页直接开编辑器。
  // 用 ref 保证**只自动开一次**：存完之后 loading 会再翻一次，没这个开关会把编辑器又弹回来
  // （2026-09-21 踩过：存完英文版页面仍停在编辑器里）。
  const autoEditDone = useRef(false);
  useEffect(() => {
    if (autoEditDone.current || loading || editMode || !isAdmin) return;
    if (new URLSearchParams(location.search).get('edit') === '1') {
      autoEditDone.current = true;
      setEditText(current);
      setPreviewing(false);
      setEditMode(true);
    }
  }, [loading, isAdmin, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
      {/* ===== ① 报眼：逐行照样张 about.html 449-458（.hero.about-hero）=====
          h1＝站长昵称、标语＝签名、提要＝自我介绍（与 N1Shell 报头同一套取值与兜底），
          统计条 3 项＝样张那一行（建站年份照样张/站点信息那行；篇文章数取真实数据）。 */}
      <section className="hero about-hero">
        <div className="hero-txt">
          <div className="kicker">ABOUT</div>
          {/* ★ 2026-10-09 用户裁决「选择 Suzu Suzukaze」：英文页大标题用拉丁署名，
              中文页仍是资料里的昵称（没填才退到字典兜底）。 */}
          <h1>{locale === 'en' ? t('brand.author') : profile.nickname || t('brand.author')}</h1>
          <p className="slogan">{locale === 'en' ? t('brand.tagline') : profile.signature || t('brand.tagline')}</p>
          <p className="lede">{locale === 'en' ? t('brand.intro') : profile.intro || t('brand.intro')}</p>
          <ul className="stats">
            <li><b>2026</b><span>{t('about.statSince')}</span></li>
            <li><b>{formatCount(articles.length)}</b><span>{t('about.statPosts')}</span></li>
            <li><b>{t('about.statBilingualVal')}</b><span>{t('about.statBilingual')}</span></li>
          </ul>
        </div>
        <figure className="hero-face big">
          <img
            src={profile.avatar || AVATAR_FALLBACK}
            alt={locale === 'en' ? t('brand.author') : profile.nickname || t('brand.author')}
            width={200}
            height={200}
          />
        </figure>
      </section>

      {/* ===== ② 关于呓语集：照样张 459-466（.sec#about ＋ .sec-head ＋ .prose）=====
          正文＝AboutContext 的当前简介（原 `.about-render` 的内容），编辑态仍是原来那一套。
          样张没有站长入口，故「历史版本 / 编辑简介 / 编辑英文简介」照旧只给管理员、排在正文上方。 */}
      <section className="sec" id="about">
        <div className="sec-head">
          <h2>{t('about.heading')}</h2>
          <small>THE SITE</small>
        </div>

        {/* 2026-09-22 用户要求：去掉这里原来的「本站简介 / About this site」标题
            （中英共用同一个组件，所以中英两侧都不再显示；标题键 about.introTitle 保留在字典里没删，
             要退回只需把下面这行注释打开）。
        <h2>{t('about.introTitle')}</h2>
        */}
        {!editMode && !loading && isAdmin && (
          <div className="about-head-actions">
            {versions.length > 0 && (
              <button className="btn btn-light btn-sm" onClick={() => { setPreviewVersion(null); setShowHistory(true); }}>{t('about.history', { n: versions.length })}</button>
            )}
            {/* 入口按钮跟着页面语言走（英文页上不能是中文按钮）；点开后的编辑器仍是中文（博主后台） */}
            <button className="btn btn-primary btn-sm" onClick={openEdit}>{t('about.editIntro')}</button>
            {/* 中文页上再给一个直达英文版编辑器的入口：英文简介只在 /en/about 上写，这边不指路就等于没有入口。
                必须用普通 <a> 走整页跳转——react-router 的 <Link> 是客户端跳转，不会换 locale（语言只由 URL 决定）。 */}
            {locale === 'zh' && (
              <a className="btn btn-light btn-sm" href="/en/about?edit=1">编辑英文简介</a>
            )}
          </div>
        )}

        {editMode ? (
          <>
            <div className="about-edit-head">
              <h2>{locale === 'en' ? '编辑英文简介' : '编辑本站简介'}</h2>
              <div className="about-preview-tabs">
                <button className={'tab-btn ' + (previewing ? '' : 'active')} onClick={() => setPreviewing(false)}>编辑</button>
                <button className={'tab-btn ' + (previewing ? 'active' : '')} onClick={() => setPreviewing(true)}>预览</button>
              </div>
            </div>
            {locale === 'en' && (
              <p className="detail-i18n-notice">
                正在编辑英文版：下面预填的是中文原文，改写成英文再保存即可；中文版正文一个字都不会动。
              </p>
            )}
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
            {/* 英文页还没写过英文版关于页：显示中文原文（current 已回退），此行点明原因 */}
            {locale === 'en' && !loading && !hasOwnVersion && (
              <p className="detail-i18n-notice">{t('about.zhOnly')}</p>
            )}
            <div className="prose">
              {loading ? <div className="about-loading"><span className="about-loading-spin"/><p>{t('about.loading')}</p></div> : <MarkdownRenderer content={current} />}
            </div>
          </>
        )}

        {msg && <p className="about-msg">{msg}</p>}
      </section>

      {/* ===== ③ 主题灵感：照样张 467-475（.swatches/.sw/.swatch/.sw-note）=====
          四色红线原样照抄：色号、色名、分类名与样张一致，不加第五色。
          （原来那颗装饰用的 `.color-palette` 四色点就是这四色，已被本块取代。） */}
      <section className="sec" id="palette">
        <div className="sec-head">
          <h2>{t('about.themeInspiration')}</h2>
          <small>PALETTE</small>
        </div>
        <div className="swatches">
          {SWATCHES.map((s) => (
            <div className="sw" key={s.color} style={{ '--c': s.color } as CSSProperties}>
              <span className="swatch" />
              <b>{t(s.nameKey)}</b>
              <i>{s.color}</i>
              <span className="sw-note">{t(catKey(s.key))}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ④ 站点信息：照样张 476-485（.facts）——样张里就是写死的站点介绍，版式原样照抄。
           ★ 2026-10-09：文案改走字典（原来 h2 与 5 条 dt/dd 全是写死中文，英文页会整块露汉字）。
             中文栏＝样张原文一字不改；英文栏是等价的英文改写。 ===== */}
      <section className="sec">
        <div className="sec-head">
          <h2>{t('about.factsTitle')}</h2>
          <small>SITE INFO</small>
        </div>
        <dl className="facts">
          <div><dt>{t('about.factFounded')}</dt><dd>{t('about.factFoundedVal')}</dd></div>
          <div><dt>{t('about.factStack')}</dt><dd>React 18 + TypeScript + Vite</dd></div>
          <div><dt>{t('about.factWriting')}</dt><dd>{t('about.factWritingVal')}</dd></div>
          <div><dt>{t('about.factLang')}</dt><dd>{t('about.factLangVal')}</dd></div>
          <div><dt>{t('about.factContact')}</dt><dd>{t('about.factContactVal')}</dd></div>
        </dl>
      </section>

      {/* ===== 以下三块样张里没有（站长后台能力），全部保留、只用既有类名 ===== */}

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
                <p className="empty-tip">{locale === 'en' ? '英文版还没有历史版本（中文版的历史在 /about 上看）。' : '还没有历史版本。'}</p>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="history-item">
                    <div className="history-item-info">
                      <span className="history-badge">{i === 0 ? '当前' : '版本 ' + (i + 1)}</span>
                      <span className="history-date">{formatDate(v.date, locale)}</span>
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
                  <span className="history-date">{formatDate(previewVersion.date, locale)}</span>
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
    </>
  );
}
