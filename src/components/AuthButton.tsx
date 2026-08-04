import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthButton() {
  const { user, isAdmin, signIn, signUp, signOut } = useAuth();
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else {
        setShow(false);
        setEmail('');
        setPassword('');
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error);
      else {
        setError('注册成功，请返回登录（若为邮箱登录需先确认邮件）。');
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      {user ? (
        <button className="btn btn-primary btn-sm" onClick={handleLogout} title="退出登录">
          {isAdmin ? '博主' : '已登录'} · 退出
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => setShow(true)}>
          登录
        </button>
      )}

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="intro-modal auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShow(false)}>×</button>
            <h2 className="intro-name">{mode === 'signin' ? '登录' : '注册'}</h2>
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
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {error && <p className="gallery-error">{error}</p>}
              <button type="submit" className="btn btn-primary">
                {mode === 'signin' ? '登录' : '注册'}
              </button>
            </form>
            <button
              className="auth-switch"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
            >
              {mode === 'signin' ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
