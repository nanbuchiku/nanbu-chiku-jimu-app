import React, { useMemo, useState } from 'react';
import { OV, MOD, MH, BP, BC } from '../styles';
import { getChapter, formatDate } from '../utils';
import { markLatest, reflectionStatus } from '../lib/formInbox';

// 回答の受信箱：講師がフォームで送った入力（保管表 form_submissions）を一覧にし、
// 講師の行に入っていないもの（未反映）を見つけて、ワンクリックで反映し直せる画面。
const STATUS_LABEL = {
  ok:      { text: '反映済み',       color: '#2E7D32', bg: '#E8F5E9' },
  stale:   { text: '⚠ 未反映',       color: '#B71C1C', bg: '#FFEBEE' },
  missing: { text: '⚠ 講師の行がない', color: '#B71C1C', bg: '#FFEBEE' },
  old:     { text: '以前の回答',     color: '#78909C', bg: '#F1F5F9' },
};

export default function FormInboxModal({ submissions, error, loading, speakers, onApply, onReload, onClose }) {
  const [onlyPending, setOnlyPending] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const rows = useMemo(() => markLatest(submissions || []).map(s => {
    const r = s.latest ? reflectionStatus(s, speakers) : { status: 'old', row: null };
    return { ...s, ...r };
  }), [submissions, speakers]);
  const pending = rows.filter(r => r.status === 'stale' || r.status === 'missing');
  const shown = onlyPending ? pending : rows;

  const apply = async (r) => {
    setBusyId(r.id);
    try { await onApply(r); } finally { setBusyId(null); }
  };

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="回答の受信箱" onClick={e => e.stopPropagation()}
        style={{ ...MOD, maxWidth: 760, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...MH, marginBottom: 6 }}>📥 回答の受信箱（講師フォームの入力）</div>
        <div style={{ fontSize: 'clamp(12px,1.4vw,14px)', color: '#667085', lineHeight: 1.6, marginBottom: 10 }}>
          講師がフォームで送った入力は、すべてここに残ります。<strong style={{ color: '#B71C1C' }}>「未反映」</strong>は、講師の行に入っていない回答です。「講師の行に反映」を押すと、入力どおりに入ります。
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'clamp(12px,1.4vw,14px)', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} />
            未反映だけを表示（{pending.length}件）
          </label>
          <span style={{ flex: 1 }} />
          <button style={BC} onClick={onReload} disabled={loading}>{loading ? '⏳ 読み込み中...' : '🔄 最新にする'}</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {error ? (
            <div style={{ color: '#B71C1C', fontSize: 'clamp(12px,1.4vw,14px)', padding: 12 }}>⚠ 受信箱を読み込めませんでした（{error}）。データベースの準備（安全網のSQL）がまだの可能性があります。</div>
          ) : shown.length === 0 ? (
            <div style={{ color: '#2E7D32', fontSize: 'clamp(13px,1.6vw,15px)', padding: 16, textAlign: 'center' }}>
              {onlyPending ? '✓ 未反映の回答はありません' : '回答はまだありません'}
            </div>
          ) : shown.map(r => {
            const p = r.payload || {};
            const ch = getChapter(r.chapter_id);
            const st = STATUS_LABEL[r.status];
            const at = new Date(r.submitted_at);
            return (
              <div key={r.id} style={{ border: '1px solid #E4E7EC', borderRadius: 8, padding: '9px 11px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: st.bg, color: st.color, fontWeight: 700, borderRadius: 12, padding: '2px 10px', fontSize: 'clamp(11px,1.3vw,13px)' }}>{st.text}</span>
                  <strong style={{ fontSize: 'clamp(13px,1.6vw,15px)' }}>{r.speaker_name || p.speaker_name || '（名前なし）'}</strong>
                  <span style={{ color: ch.color || '#667085', fontWeight: 700, fontSize: 'clamp(12px,1.4vw,14px)' }}>{ch.name}</span>
                  <span style={{ color: '#667085', fontSize: 'clamp(12px,1.4vw,14px)' }}>{r.seminar_date ? formatDate(r.seminar_date) : ''}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: '#98A2B3', fontSize: 'clamp(11px,1.3vw,13px)' }}>送信 {isNaN(at) ? '' : `${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`}</span>
                </div>
                <div style={{ fontSize: 'clamp(12px,1.4vw,14px)', color: '#37474F', marginTop: 4 }}>テーマ：{p.topic || '（なし）'}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <button style={{ ...BC, padding: '4px 10px' }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? '▲ 閉じる' : '▼ 入力内容を見る'}</button>
                  {(r.status === 'stale' || r.status === 'missing') && (
                    <button style={{ ...BP, padding: '4px 12px' }} disabled={busyId === r.id} onClick={() => apply(r)}>
                      {busyId === r.id ? '⏳ 反映中...' : r.status === 'missing' ? '＋ 講師の行を作って反映' : '↩ 講師の行に反映'}
                    </button>
                  )}
                </div>
                {openId === r.id && (
                  <pre style={{ background: '#F8FAFC', borderRadius: 6, padding: 10, marginTop: 6, whiteSpace: 'pre-wrap', fontSize: 'clamp(11px,1.3vw,13px)', lineHeight: 1.7 }}>
{[
  `ふりがな：${p.speaker_kana || ''}`, `所属法人会：${p.speaker_unit || ''}　役職：${p.role || ''}`,
  `勤務先：${p.company || ''}　${p.company_role || ''}`, `TEL：${p.phone || ''}　メール：${p.email || ''}`,
  `前泊：${p.lodging || ''}　資料印刷：${p.print_required || ''}`, '', p.notes || '',
].join('\n')}
                  </pre>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button style={BC} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
