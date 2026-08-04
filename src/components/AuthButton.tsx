import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

function generateMathCaptcha(): { text: string; answer: number } {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const ops = ['+', '-', 'x'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  switch (op) {
    case '+': answer = a + b; break;
    case '-': answer = a - b; break;
    default: answer = a * b; break;
  }
  return { text: a + ' ' + op + ' ' + b + ' = ?', answer };
}

export default function AuthButton() {
  const { user, isAdmin, signIn, signUp, signOut } = useAuth();
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captcha, setCaptcha] = useState(generateMathCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirm('');
    setCaptchaInput('');
    setCaptcha(generateMathCaptcha());
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (loading) return;
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) { setError(error); }
        else resetForm();
      } else {
        if (password !== confirm) {
          setError('两次输入的密码不一致');
          setCaptcha(generateMathCaptcha());
          return;
        }
        if (String(captcha.answer) !== captchaInput.trim()) {
          setError('验证码不正确，请重新输入');
          setCaptcha(generateMathCaptcha());
          setCaptchaInput('');
          return;
        }
        const { error } = await signUp(email, password);
        if (error) { setError(error); }
        else {
          setInfo('注册成功！我们已向你的邮箱发送验证链接，请点击验证后再登录。');
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

  const handleLogout = async () => {
    if (!loading) { setLoading(true); await signOut(); setLoading(false); }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null); setInfo(null);
    setCaptcha(generateMathCaptcha()); setCaptchaInput('');
  };

  // 已登录：仅显示状态按钮（点击登出）
  if (user) {
    return (
      <>
        <button className="btn btn-primary btn-sm" onClick={handleLogout} title="退出登录" disabled={loading}>
          {loading ? '…' : (isAdmin ? '博主' : '已登录')} · 退出
        </button>
      </>
    );
  }

  // 未登录：显示登录按钮，以及全屏登录/注册页面
  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShow(true); }}>
        登录
      </button>

      {show && (
        <div className="auth-fullscreen">
          <div className="auth-fullscreen-bg" />
          <div className="auth-card">
            <button className="auth-card-close" onClick={() => setShow(false)} aria-label="关闭">×</button>
            <h2 className="auth-card-title">{mode === 'signin' ? '登录呓语集' : '注册账号'}</h2>

            {info && <p className="captcha-info">{info}</p>}

            <form onSubmit={handleSubmit} className="auth-card-form">
              <input
                type="email"
                className="auth-card-input"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="auth-card-input"
                placeholder="密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {mode === 'signup' && (
                <input
                  type="password"
                  className="auth-card-input"
                  placeholder="确认密码"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                />
              )}
              {mode === 'signup' && (
                <div className="captcha-row">
                  <span className="captcha-question">{captcha.text}</span>
                  <input
                    type="text"
                    className="auth-card-input captcha-input"
                    placeholder="填答案"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    required
                  />
                </div>
              )}
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="btn btn-primary auth-card-btn" disabled={loading}>
                {loading ? '提交中…' : (mode === 'signin' ? '登录' : '注册')}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'signin' ? '没有账号？' : '已有账号？'}
              <button type="button" onClick={switchMode} className="auth-switch-btn">
                {mode === 'signin' ? '去注册' : '去登录'}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}