import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

// 生成一个简单的数学算式验证码
function generateMathCaptcha(): { text: string; answer: number } {
  const a = Math.floor(Math.random() * 9) + 1; // 1-9
  const b = Math.floor(Math.random() * 9) + 1; // 1-9
  const ops = ['+', '−', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  switch (op) {
    case '+': answer = a + b; break;
    case '−': answer = a - b; break;
    default: answer = a * b; break;
  }
  return { text: `${a} ${op} ${b} = ?`, answer };
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

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else {
        resetForm();
        setShow(false);
      }
    } else {
      // 注册：两遍密码一致性 + 验证码
      if (password !== confirm) {
        setError('两次输入的密码不一致');
        setCaptcha(generateMathCaptcha());
        return;
      }
      const input = captchaInput.trim();
      if (String(captcha.answer) !== input) {
        setError('验证码不正确，请重新输入');
        setCaptcha(generateMathCaptcha());
        setCaptchaInput('');
        return;
      }
      const { error } = await signUp(email, password);
      if (error) {
        setError(error);
      } else {
        // 邮箱验证模式：提示去验证邮件
        setInfo('注册成功！我们已向你的邮箱发送验证链接，请点击验证后再登录。');
        setPassword('');
        setConfirm('');
        setCaptchaInput('');
        setCaptcha(generateMathCaptcha());
        setMode('signin');
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const switchMode = () => {
    const next = mode === 'signin' ? 'signup' : 'signin';
    setMode(next);
    setError(null);
    setInfo(null);
    setCaptcha(generateMathCaptcha());
    setCaptchaInput('');
  };

  return (
    <>
      {user ? (
        <button className="btn btn-primary btn-sm" onClick={handleLogout} title="退出登录">
          {isAdmin ? '博主' : '已登录'} · 退出
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => { setShow(true); resetForm(); }}>
          登录
        </button>
      )}

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="intro-modal auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShow(false)}>×</button>
            <h2 className="intro-name">{mode === 'signin' ? '登录' : '注册账号'}</h2>

            {info && <p className="captcha-info">{info}</p>}

            <form onSubmit={handleSubmit} className="auth-form">
              <input
                type="email"
                className="gallery-input"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="gallery-input"
                placeholder="密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {mode === 'signup' && (
                <input
                  type="password"
                  className="gallery-input"
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
                    className="gallery-input captcha-input"
                    placeholder="填答案"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && <p className="gallery-error">{error}</p>}
              <button type="submit" className="btn btn-primary">
                {mode === 'signin' ? '登录' : '注册'}
              </button>
            </form>
            <button className="auth-switch" onClick={switchMode}>
              {mode === 'signin' ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
