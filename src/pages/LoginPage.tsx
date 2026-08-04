import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
        setError('密码需至少8位，且同时包含字母和数字');
        setCaptcha(generateMathCaptcha());
        return;
      }
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

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null); setInfo(null);
    setCaptcha(generateMathCaptcha()); setCaptchaInput('');
  };

  return (
    <div className="login-page">
      <div className="login-deco login-deco-1" />
      <div className="login-deco login-deco-2" />
      <div className="login-card">
        <button className="login-card-close" onClick={() => navigate('/')} aria-label="返回">×</button>

        <h1 className="login-card-title">{mode === 'signin' ? '呓语集' : '加入呓语集'}</h1>
        <p className="login-card-sub">{mode === 'signin' ? '登录你的账号，继续书写呓语' : '创建一个新账号'}</p>

        {info && <p className="captcha-info">{info}</p>}
        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="login-card-form">
          <div className="login-field">
            <span className="login-field-icon">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
            </span>
            <input
              type="email"
              className="login-input"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <span className="login-field-icon">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <input
              type="password"
              className="login-input"
              placeholder="密码（至少8位，含字母和数字）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'signup' && (
            <div className="login-field">
              <span className="login-field-icon">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
              <input
                type="password"
                className="login-input"
                placeholder="确认密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === 'signin' && (
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>记住登录（保持登录，下次免输入）</span>
            </label>
          )}

          {mode === 'signup' && (
            <div className="captcha-row">
              <span className="captcha-question">{captcha.text}</span>
              <input
                type="text"
                className="login-input captcha-input"
                placeholder="填答案"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '提交中…' : (mode === 'signin' ? '登 录' : '注 册')}
          </button>
        </form>

        <p className="login-switch">
          {mode === 'signin' ? '没有账号？' : '已有账号？'}
          <button type="button" onClick={switchMode} className="login-switch-btn">
            {mode === 'signin' ? '去注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
}