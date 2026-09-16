import React, { useState } from 'react';
import { db } from '../lib/supabase';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [passphrase,   setPassphrase]   = useState('');
  const [newPassword,  setNewPassword]  = useState('');
  const [resetError,   setResetError]   = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone,    setResetDone]    = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // コピペ時に紛れ込む前後の空白・改行で認証失敗しないよう除去
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません。');
    }
    setLoading(false);
  };

  const handleReset = async e => {
    e.preventDefault();
    setResetError('');
    if (!email.trim() || !passphrase.trim() || !newPassword) {
      setResetError('すべての項目を入力してください。');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('新しいパスワードは6文字以上にしてください。');
      return;
    }
    setResetLoading(true);
    const { error } = await db.rpc('reset_password_by_email', {
      p_email: email.trim(), p_new_password: newPassword, p_passphrase: passphrase.trim(),
    });
    setResetLoading(false);
    if (error) {
      if (error.message?.includes('invalid_passphrase')) setResetError('合言葉が違います。');
      else if (error.message?.includes('user_not_found')) setResetError('そのメールアドレスのアカウントが見つかりません。');
      else setResetError('再設定に失敗しました：' + error.message);
      return;
    }
    setResetDone(true);
    setPassword(''); setPassphrase(''); setNewPassword('');
  };

  const backToLogin = () => {
    setMode('login'); setResetError(''); setResetDone(false); setPassphrase(''); setNewPassword('');
  };

  const INP = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #D9E1EE', borderRadius: 8,
    padding: '10px 12px', fontSize: 14, outline: 'none',
    transition: 'border-color .15s',
  };

  return (
    <div style={{
      minHeight: '100dvh', background: '#F4F5F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,.12)',
      }}>
        {/* ロゴ */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg,#061B44,#2E6DA4)',
            fontSize: 28, color: '#fff', fontWeight: 800, marginBottom: 14,
            boxShadow: '0 4px 12px rgba(26,58,107,.3)',
          }}>倫</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#061B44', letterSpacing: '0.05em' }}>
            南部地区事務局
          </div>
          <div style={{ fontSize: 13, color: '#98A2B3', marginTop: 4 }}>
            5単会タスク管理システム
          </div>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                メールアドレス
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="example@gmail.com"
                style={INP}
                onFocus={e => e.target.style.borderColor = '#061B44'}
                onBlur={e => e.target.style.borderColor = '#D9E1EE'}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                パスワード
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" placeholder="パスワードを入力"
                style={INP}
                onFocus={e => e.target.style.borderColor = '#061B44'}
                onBlur={e => e.target.style.borderColor = '#D9E1EE'}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); }}
                style={{ background: 'none', border: 'none', padding: 0, color: '#2E6DA4', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                パスワードをお忘れですか？
              </button>
            </div>

            {error && (
              <div style={{
                background: '#FFEBEE', border: '1px solid #FFCDD2',
                borderRadius: 8, padding: '9px 12px', marginBottom: 14,
                fontSize: 13, color: '#B71C1C', fontWeight: 600,
              }}>
                ⚠ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? '#98A2B3' : '#061B44',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 0', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
              boxShadow: '0 2px 8px rgba(26,58,107,.25)',
            }}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            {resetDone ? (
              <div style={{
                background: '#E8F5E9', border: '1px solid #A5D6A7',
                borderRadius: 8, padding: '12px 14px', marginBottom: 16,
                fontSize: 13.5, color: '#1B5E20', fontWeight: 600, lineHeight: 1.7,
              }}>
                ✓ パスワードを再設定しました。新しいパスワードでログインしてください。
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: '#78909C', marginBottom: 14, lineHeight: 1.6 }}>
                  メールアドレス・合言葉・新しいパスワードを入力すると、その場でパスワードを再設定できます。
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                    メールアドレス
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" placeholder="example@gmail.com"
                    style={INP}
                    onFocus={e => e.target.style.borderColor = '#061B44'}
                    onBlur={e => e.target.style.borderColor = '#D9E1EE'}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                    合言葉
                  </label>
                  <input
                    type="text" value={passphrase} onChange={e => setPassphrase(e.target.value)}
                    required placeholder="合言葉を入力"
                    style={INP}
                    onFocus={e => e.target.style.borderColor = '#061B44'}
                    onBlur={e => e.target.style.borderColor = '#D9E1EE'}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                    新しいパスワード
                  </label>
                  <input
                    type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    required autoComplete="new-password" placeholder="6文字以上"
                    style={INP}
                    onFocus={e => e.target.style.borderColor = '#061B44'}
                    onBlur={e => e.target.style.borderColor = '#D9E1EE'}
                  />
                </div>

                {resetError && (
                  <div style={{
                    background: '#FFEBEE', border: '1px solid #FFCDD2',
                    borderRadius: 8, padding: '9px 12px', marginBottom: 14,
                    fontSize: 13, color: '#B71C1C', fontWeight: 600,
                  }}>
                    ⚠ {resetError}
                  </div>
                )}

                <button type="submit" disabled={resetLoading} style={{
                  width: '100%', background: resetLoading ? '#98A2B3' : '#061B44',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px 0', fontSize: 15, fontWeight: 700,
                  cursor: resetLoading ? 'not-allowed' : 'pointer',
                  transition: 'background .15s',
                  boxShadow: '0 2px 8px rgba(26,58,107,.25)',
                  marginBottom: 14,
                }}>
                  {resetLoading ? '設定中...' : 'パスワードを再設定する'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={backToLogin}
              style={{ width: '100%', background: 'none', border: 'none', padding: 0, color: '#2E6DA4', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >
              ← ログイン画面に戻る
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#B0BEC5' }}>
          倫理法人会 埼玉南部地区合同事務局
        </div>
      </div>
    </div>
  );
}
