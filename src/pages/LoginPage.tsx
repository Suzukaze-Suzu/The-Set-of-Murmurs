import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

const REMEMBER_KEY = 'murmur_remembered';

function generateMathCaptcha(): { text: string; answer: number } {
  // 两位数运算，增加难度防机器人
  const a = Math.floor(Math.random() * 20) + 5;
  const b = Math.floor(Math.random() * 20) + 5;
  const ops = ['+', '-', 'x'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  if (op === '+') answer = a + b;
  else if (op === '-') answer = a - b;
  else answer = a * b;
  return { text: a + ' ' + op + ' ' + b + ' = ?', answer };
}

export default function LoginPage() {
  const t = useT();
  usePageTitle(t('login.pageTitle'));
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(true);
  const [captcha, setCaptcha] = useState(generateMathCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 载入时读取记住的邮箱和密码
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
      }
    } catch { /* ignore */ }
  }, []);

  const saveRemembered = () => {
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: email.trim(), password }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (loading) return;

    if (mode === 'signup') {
      if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(password)) {
        setError(t('login.errPasswordRule'));
        setCaptcha(generateMathCaptcha());
        return;
      }
      if (password !== confirm) {
        setError(t('login.errPasswordMismatch'));
        setCaptcha(generateMathCaptcha());
        return;
      }
      if (String(captcha.answer) !== captchaInput.trim()) {
        setError(t('login.errCaptcha'));
        setCaptcha(generateMathCaptcha());
        setCaptchaInput('');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        saveRemembered();
        const { error } = await signIn(email, password, remember);
        if (error) setError(error);
        else navigate('/');
      } else {
        const { error, session } = await signUp(email, password);
        if (error) setError(error);
        else if (session) {
          navigate('/');   // 免邮箱验证：注册即登录
        } else {
          setInfo(t('login.verifySent'));
          setPassword('');
          setConfirm('');
          setCaptchaInput('');
          setCaptcha(generateMathCaptcha());
          setMode('signin');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  /* 登录／注册两态互切：报头下面那排 `.seg` 分段键与底部「去注册」文字链都走这里
     （切态同时清错误、换一道验证码）。 */
  const goMode = (m: 'signin' | 'signup') => {
    setMode(m);
    setError(null); setInfo(null);
    setCaptcha(generateMathCaptcha()); setCaptchaInput('');
  };
  const switchMode = () => goMode(mode === 'signin' ? 'signup' : 'signin');

  /* 显示／隐藏密码：两个密码框（密码 ＋ 确认密码）共用一枚开关。
     原版是两个框各挂一只眼睛图标（SVG）；N1 这套语汇里没有图标按钮，
     收成 `.gfoot` 里一枚小字按钮。功能没少，控件少了一只。 */
  const reveal = () => {
    const next = !showPassword;
    setShowPassword(next);
    setShowConfirm(next);
  };

  /* ══════════════════════════════════════════════════════════════════════════════
     页身（2026-10-09「登录，个人主页和翻译界面未统一风格」）
     ──────────────────────────────────────────────────────────────────────────────
     这一页原来长在 Layout **之外**（`App.tsx` 里单独一条路由），页身是一整张五色渐变
     毛玻璃卡（`.login-page/.login-card-*`，index.css 597–642），连报头报尾都没有。
     本轮：① 路由移进 Layout；② 页身换成样张已有的三件 ——
       `.pagehead`（页头：kicker ＋ 大标题 ＋ 导语）
       `.seg`     （分段键：登录／注册，与小说阅读器同款）
       `.gform`   （留言板那套表单：细下划线输入框 ＋ `.gfoot` 动作行）
     ⚠️ 刻意去掉的只有装饰：左上角那枚 `.login-card-close`（×）—— 现在报头里本来就有
        「首页」与「登录」，多一枚 × 是重复；以及输入框里的两只 SVG 图标。
     回退＝把 `App.tsx` 那条 `<Route path="/login">` 移回 `LayoutRoute` 之外即可
     （`index.css` 里旧皮肤一行未删，随时能长回来）。
     ══════════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <section className="pagehead pagehead-auth">
        <div className="pagehead-txt">
          <div className="kicker">{mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}</div>
          <h1>{mode === 'signin' ? t('login.headSignIn') : t('login.headSignUp')}</h1>
          <p className="lede">{mode === 'signin' ? t('login.subSignIn') : t('login.subSignUp')}</p>
        </div>
      </section>

      <section className="sec">
        {/* 模式切换：照 N1 的 `.seg` 分段键（与小说阅读器的「上一章／目录」同款规格） */}
        <div className="seg">
          <button type="button" className={mode === 'signin' ? 'on' : undefined} onClick={() => goMode('signin')}>
            {t('login.signIn')}
          </button>
          <button type="button" className={mode === 'signup' ? 'on' : undefined} onClick={() => goMode('signup')}>
            {t('login.signUp')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="gform gform-auth">
          {info && <p className="note-box">{info}</p>}
          {error && <p className="note-box note-err">{error}</p>}

          {/* 邮箱 / 密码：每格左上方一行小字标签（`.glabel`，2026-10-09 用户拍板 A）。
              改前格子里只有 placeholder，一打字那行提示就没了——注册档四格打完就分不清谁是谁。 */}
          <div className="grow">
            <div className="fld">
              <label className="glabel" htmlFor="login-email">{t('login.lblEmail')}</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="fld">
              <label className="glabel" htmlFor="login-password">{t('login.lblPassword')}</label>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          {/* 确认密码：独占一行（`.grow` 的单子元素被 n1-app.css 铺满整行，不留半格空） */}
          {mode === 'signup' && (
            <div className="grow">
              <div className="fld">
                <label className="glabel" htmlFor="login-confirm">{t('login.lblConfirm')}</label>
                <input
                  id="login-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {/* 人机验证：样张里没有这一件 —— 左＝算术题（`.cap-q`），右＝答案格。
              标签跨两列（`.fld-cap`），窄屏那档竖排（n1-app.css 的 860px 媒体查询）。 */}
          {mode === 'signup' && (
            <div className="grow">
              <div className="fld fld-cap">
                <label className="glabel" htmlFor="login-captcha">{t('login.lblCaptcha')}</label>
                <span className="cap-q">{captcha.text}</span>
                <input
                  id="login-captcha"
                  type="text"
                  placeholder={t('login.captchaAnswer')}
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  required
                  aria-label={t('login.captchaAnswer')}
                />
              </div>
            </div>
          )}

          <div className="gfoot">
            {mode === 'signin' && (
              <label className="gnote login-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>{t('login.remember')}</span>
              </label>
            )}
            <button type="button" className="tbtn" onClick={reveal}>
              {showPassword ? t('login.hidePassword') : t('login.showPassword')}
            </button>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? t('login.submitting') : (mode === 'signin' ? t('login.signIn') : t('login.signUp'))}
            </button>
          </div>
        </form>

        <p className="auth-switch">
          <span>{mode === 'signin' ? t('login.noAccount') : t('login.haveAccount')}</span>
          <button type="button" onClick={switchMode} className="tbtn">
            {mode === 'signin' ? t('login.goSignUp') : t('login.goSignIn')}
          </button>
        </p>
      </section>
    </>
  );
}
