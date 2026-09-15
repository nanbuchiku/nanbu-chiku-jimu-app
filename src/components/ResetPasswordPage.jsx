import React, { useState } from 'react';
import { db } from '../lib/supabase';

export default function ResetPasswordPage({ onDone }) {
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (password.trim().length < 6) { setError('パスワードは6文字以上で入力してください。'); return; }
    if (password !== password2) { setError('パスワードが一致しません。'); return; }
    setLoading(true);
    const { error } = await db.auth.updateUser({ password: password.trim() });
    setLoading(false);
    if (error) { setError('パスワードの更新に失敗しました：' + error.message); return; }
    setDone(true);
    setTimeout(() => onDone?.(), 1500);
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
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg,#061B44,#2E6DA4)',
            fontSize: 28, color: '#fff', fontWeight: 800, marginBottom: 14,
            boxShadow: '0 4px 12px rgba(26,58,107,.3)',
          }}>倫</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#061B44', letterSpacing: '0.05em' }}>
            新しいパスワードの設定
          </div>
        </div>

        {done ? (
          <div style={{
            background: '#E8F5E9', border: '1px solid #A5D6A7',
            borderRadius: 8, padding: '12px 14px',
            fontSize: 13.5, color: '#1B5E20', fontWeight: 600, lineHeight: 1.7, textAlign: 'center',
          }}>
            ✓ パスワードを更新しました。このままアプリをご利用いただけます。
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                新しいパスワード
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="new-password" placeholder="6文字以上"
                style={INP}
                onFocus={e => e.target.style.borderColor = '#061B44'}
                onBlur={e => e.target.style.borderColor = '#D9E1EE'}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#667085', display: 'block', marginBottom: 5 }}>
                新しいパスワード（確認）
              </label>
              <input
                type="password" value={password2} onChange={e => setPassword2(e.target.value)}
                required autoComplete="new-password" placeholder="もう一度入力"
                style={INP}
                onFocus={e => e.target.style.borderColor = '#061B44'}
                onBlur={e => e.target.style.borderColor = '#D9E1EE'}
              />
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
              {loading ? '更新中...' : 'パスワードを更新'}
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
