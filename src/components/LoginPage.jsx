import React, { useState } from 'react';
import { db } from '../lib/supabase';

export default function LoginPage() {
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      setError('送信に失敗しました: ' + (error.message || JSON.stringify(error)));
    } else {
      setSent(true);
    }
    setLoading(false);
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

        {sent ? (
          /* 送信完了メッセージ */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#061B44', marginBottom: 10 }}>
              ログインメールを送信しました
            </div>
            <div style={{ fontSize: 14, color: '#667085', lineHeight: 1.8, marginBottom: 20 }}>
              <strong>{email}</strong> 宛にログインリンクを送信しました。<br />
              メールに記載されたリンクをクリックしてログインしてください。
            </div>
            <div style={{ fontSize: 13, color: '#98A2B3', background: '#F5F5F5', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </div>
            <button onClick={() => { setSent(false); setEmail(''); }} style={{
              background: 'none', border: '1px solid #D9E1EE', borderRadius: 8,
              padding: '8px 20px', fontSize: 13, color: '#667085',
              cursor: 'pointer', fontWeight: 600,
            }}>
              別のアドレスでログイン
            </button>
          </div>
        ) : (
          /* 入力フォーム */
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
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
              <div style={{ fontSize: 12, color: '#98A2B3', marginTop: 6, lineHeight: 1.6 }}>
                登録済みのメールアドレスを入力してください。<br />
                ログインリンクがメールで届きます。
              </div>
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
              {loading ? '送信中...' : 'ログインリンクを送信'}
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
