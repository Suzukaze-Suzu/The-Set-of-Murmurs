import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captcha, setCaptcha] = useState(generateMathCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (loading) return;
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
        else navigate('/');
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
        if (error) setError(error);
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

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null); setInfo(null);
    setCaptcha(generateMathCaptcha()); setCaptchaInput('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button className="login-card-close" onClick={() => navigate('/')} aria-label="返回">×</button>
        <h1 className="login-card-title">{mode === 'signin' ? '登录呓语集' : '注册账号'}</h1>

        {info && <p className="captcha-info">{info}</p>}
        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="login-card-form">
          <input
            type="email"
            className="login-input"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="login-input"
            placeholder="密码（至少6位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {mode === 'signup' && (
            <input
              type="password"
              className="login-input"
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
                className="login-input captcha-input"
                placeholder="填答案"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                required
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? '提交中…' : (mode === 'signin' ? '登录' : '注册')}
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