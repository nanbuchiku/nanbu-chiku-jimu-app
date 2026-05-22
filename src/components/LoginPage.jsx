import React, { useState } from 'react';
import { db } from '../lib/supabase';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) setError('メールアドレスまたはパスワードが正しくありません');
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100dvh', background: '#F0F2F5',
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
            background: 'linear-gradient(135deg,#1A3A6B,#2E6DA4)',
            fontSize: 28, color: '#fff', fontWeight: 800, marginBottom: 14,
            boxShadow: '0 4px 12px rgba(26,58,107,.3)',
          }}>倫</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A3A6B', letterSpacing: '0.05em' }}>
            南部地区事務局
          </div>
          <div style={{ fontSize: 13, color: '#90A4AE', marginTop: 4 }}>
            5単会タスク管理システム
          </div>
        </div>

        {/* フォーム */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#546E7A', display: 'block', marginBottom: 5 }}>
              メールアドレス
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email" placeholder="admin@example.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #CFD8DC', borderRadius: 8,
                padding: '10px 12px', fontSize: 14, outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = '#1A3A6B'}
              onBlur={e => e.target.style.borderColor = '#CFD8DC'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#546E7A', display: 'block', marginBottom: 5 }}>
              パスワード
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password" placeholder="••••••••"
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #CFD8DC', borderRadius: 8,
                padding: '10px 12px', fontSize: 14, outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = '#1A3A6B'}
              onBlur={e => e.target.style.borderColor = '#CFD8DC'}
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
            width: '100%', background: loading ? '#90A4AE' : '#1A3A6B',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '12px 0', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background .15s',
            boxShadow: '0 2px 8px rgba(26,58,107,.25)',
          }}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#B0BEC5' }}>
          倫理法人会 埼玉南部地区合同事務局
        </div>
      </div>
    </div>
  );
}
