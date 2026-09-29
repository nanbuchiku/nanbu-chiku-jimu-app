import React, { useMemo, useState } from 'react';
import { getChapter, getSeminarType, formatDate, extractSummary, extractMsSummary, extractTag,
  extractMaterialLinks, extractMsMaterialLinks, extractStaffNotes } from '../utils';
import { STATUS } from '../constants';
import { OV, MOD, MH, BP, BC } from '../styles';

// 2つの講師レコードを項目ごとに見比べる画面。
// mode 'merge'   : 1件に統合する（項目ごとにA/Bどちらを残すか選ぶ）
// mode 'duplicate': 重複の疑いがある2件を見比べて、削除する側を選ぶ
export default function RecordCompareModal({ recordA, recordB, mode: initialMode, onClose, onMerge, onDelete }) {
  const [mode, setMode] = useState(initialMode || 'duplicate');

  const fields = useMemo(() => {
    const list = [
      { key: 'speakerName',  label: '講師名',       get: sp => sp.speakerName || '' },
      { key: 'chapterId',    label: '単会',         get: sp => getChapter(sp.chapterId)?.name || sp.chapterId || '' },
      { key: 'seminarType',  label: 'セミナー種別', get: sp => getSeminarType(sp.seminarType)?.label || sp.seminarType || '' },
      { key: 'seminarDate',  label: '開催日',       get: sp => sp.seminarDate ? formatDate(sp.seminarDate) : '' },
      { key: 'status',       label: 'ステータス',   get: sp => STATUS[sp.status]?.label || sp.status || '' },
      { key: 'topic',        label: 'テーマ',       get: sp => (sp.topic || '').trim() },
      { key: 'summary',      label: '内容要約',     get: sp => extractSummary(sp.notes) },
      { key: 'msTopic',      label: 'MSタイトル',   get: sp => (sp.msTopic || '').trim() },
      { key: 'msSummary',    label: 'MS内容要約',   get: sp => extractMsSummary(sp.notes) },
      { key: 'material01',   label: '資料',         get: sp => extractMaterialLinks(sp.notes).map(d => d.label).join('・') },
      { key: 'msMaterial',   label: 'MS資料',       get: sp => extractMsMaterialLinks(sp.notes).map(d => d.label).join('・') },
      { key: 'materialUrl',  label: '顔写真',       get: sp => sp.materialUrl ? '登録あり' : '' },
      { key: 'lodging',      label: '前泊',         get: sp => sp.lodging || '' },
      { key: 'printRequired',label: '印刷要否',     get: sp => sp.printRequired || '' },
      { key: 'phone',        label: '連絡先TEL',    get: sp => sp.phone || '' },
      { key: 'email',        label: 'メール',       get: sp => sp.email || '' },
      { key: 'transport',    label: '交通手段',     get: sp => extractTag(sp.notes, '交通手段') },
      { key: 'staffNotes',   label: '備考',         get: sp => extractStaffNotes(sp.notes) },
    ];
    return list.map(f => ({ ...f, a: f.get(recordA), b: f.get(recordB) }))
      .filter(f => f.a || f.b); // 両方空の項目は表示しない
  }, [recordA, recordB]);

  // 統合モード: 項目ごとにどちらの値を採用するか
  const [choices, setChoices] = useState(() => {
    const init = {};
    fields.forEach(f => {
      if (f.a && !f.b) init[f.key] = 'A';
      else if (!f.a && f.b) init[f.key] = 'B';
      else init[f.key] = null; // 両方に値があり異なる場合は要選択
    });
    return init;
  });
  const [baseId, setBaseId] = useState('A'); // どちらのレコードIDを残すか
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const conflicts = fields.filter(f => f.a && f.b && f.a !== f.b);
  const unresolved = conflicts.filter(f => !choices[f.key]);

  const pick = (key, side) => setChoices(prev => ({ ...prev, [key]: side }));

  const handleMerge = async () => {
    if (unresolved.length > 0) { setErr(`未選択の項目があります: ${unresolved.map(f => f.label).join('・')}`); return; }
    setErr('');
    setSaving(true);
    try {
      const keep = baseId === 'A' ? recordA : recordB;
      const drop = baseId === 'A' ? recordB : recordA;
      const pickVal = (f) => (choices[f.key] === 'B' ? recordB : recordA);
      // notes は選ばれた値から組み立て直す（タグ形式を維持）
      const notesLines = [];
      const summaryVal = choices.summary === 'B' ? extractSummary(recordB.notes) : extractSummary(recordA.notes);
      if (summaryVal) notesLines.push(`【内容要約】\n${summaryVal}`);
      const msSummaryVal = choices.msSummary === 'B' ? extractMsSummary(recordB.notes) : extractMsSummary(recordA.notes);
      if (msSummaryVal) notesLines.push(`【MS内容要約】\n${msSummaryVal}`);
      const matSrc = choices.material01 === 'B' ? recordB : recordA;
      extractMaterialLinks(matSrc.notes).forEach(d => notesLines.push(`【${d.label}】${d.url}`));
      const msMatSrc = choices.msMaterial === 'B' ? recordB : recordA;
      extractMsMaterialLinks(msMatSrc.notes).forEach(d => notesLines.push(`【${d.label}】${d.url}`));
      const transportVal = choices.transport === 'B' ? extractTag(recordB.notes, '交通手段') : extractTag(recordA.notes, '交通手段');
      if (transportVal) notesLines.push(`【交通手段】${transportVal}`);
      const staffVal = choices.staffNotes === 'B' ? extractStaffNotes(recordB.notes) : extractStaffNotes(recordA.notes);

      const merged = {
        ...keep,
        topic: (choices.topic === 'B' ? recordB.topic : recordA.topic) || '',
        msTopic: (choices.msTopic === 'B' ? recordB.msTopic : recordA.msTopic) || '',
        materialUrl: (choices.materialUrl === 'B' ? recordB.materialUrl : recordA.materialUrl) || keep.materialUrl,
        materialName: (choices.materialUrl === 'B' ? recordB.materialName : recordA.materialName) || keep.materialName,
        notes: [notesLines.join('\n'), staffVal].filter(Boolean).join('\n\n'),
      };
      await onMerge(merged, keep.id, drop.id);
    } catch (e) {
      setErr('統合に失敗しました: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSide = async (side) => {
    setSaving(true);
    try {
      await onDelete([side === 'A' ? recordA.id : recordB.id]);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBoth = async () => {
    setSaving(true);
    try {
      await onDelete([recordA.id, recordB.id]);
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ active, onClick, children, color }) => (
    <button onClick={onClick} disabled={saving}
      style={{
        flex: 1, textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
        border: active ? `2px solid ${color}` : '1px solid #E2E8F0',
        background: active ? (color === '#1565C0' ? '#E3F2FD' : '#E8F5E9') : '#fff',
        fontSize: 'var(--fs-xs)', color: '#101828', fontWeight: active ? 700 : 500,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
      {children || <span style={{ color: '#B0BEC5' }}>（空欄）</span>}
    </button>
  );

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" style={{ ...MOD, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={MH}>🔍 レコードの見比べ</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setMode('duplicate')}
            style={{ ...(mode === 'duplicate' ? BP : BC), flex: 1, fontSize: 'var(--fs-xs)' }}>重複を削除</button>
          <button onClick={() => setMode('merge')}
            style={{ ...(mode === 'merge' ? BP : BC), flex: 1, fontSize: 'var(--fs-xs)' }}>🔗 1件に統合</button>
        </div>

        {mode === 'merge' && (
          <div style={{ marginBottom: 10, padding: '8px 10px', background: '#FFF8D8', borderRadius: 8, fontSize: 'var(--fs-xs)', color: '#92400E' }}>
            差異がある項目は、残したい方をタップして選んでください。選ばれていない項目はオレンジ枠のままです。
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#667085' }}>
          <div>A（{formatDate(recordA.seminarDate) || '日付未定'}）</div>
          <div>B（{formatDate(recordB.seminarDate) || '日付未定'}）</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '46vh', overflowY: 'auto', marginBottom: 12 }}>
          {fields.map(f => {
            const differs = f.a !== f.b;
            return (
              <div key={f.key} style={{ border: `1px solid ${differs ? '#FFE066' : '#F0F4F8'}`, borderRadius: 8, padding: 8, background: differs ? '#FFFCED' : '#F8FAFC' }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#061B44', marginBottom: 5 }}>{f.label}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Chip active={mode === 'merge' ? choices[f.key] === 'A' : false} color="#1565C0"
                    onClick={() => mode === 'merge' && pick(f.key, 'A')}>{f.a}</Chip>
                  <Chip active={mode === 'merge' ? choices[f.key] === 'B' : false} color="#2E7D32"
                    onClick={() => mode === 'merge' && pick(f.key, 'B')}>{f.b}</Chip>
                </div>
              </div>
            );
          })}
          {fields.length === 0 && (
            <div style={{ textAlign: 'center', color: '#98A2B3', fontSize: 'var(--fs-xs)', padding: 20 }}>比較できる項目がありません</div>
          )}
        </div>

        {err && <div style={{ color: '#B71C1C', fontSize: 'var(--fs-xs)', marginBottom: 10 }}>⚠ {err}</div>}

        {mode === 'merge' ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#667085', marginBottom: 5 }}>残すレコード（ID・単会・開催日など基本情報の元になります）</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Chip active={baseId === 'A'} color="#1565C0" onClick={() => setBaseId('A')}>Aを残す</Chip>
                <Chip active={baseId === 'B'} color="#2E7D32" onClick={() => setBaseId('B')}>Bを残す</Chip>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ ...BC, flex: 1 }}>キャンセル</button>
              <button onClick={handleMerge} disabled={saving} style={{ ...BP, flex: 1, opacity: saving ? .6 : 1 }}>
                {saving ? '統合中...' : 'この内容で統合する'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onClose} style={{ ...BC, flex: 1, minWidth: 90 }}>キャンセル</button>
            <button onClick={() => handleDeleteSide('A')} disabled={saving}
              style={{ background: '#FFEBEE', color: '#B71C1C', border: '1px solid #FFCDD2', borderRadius: 10, padding: '7px 15px', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', flex: 1, minWidth: 90 }}>
              🗑 Aを削除
            </button>
            <button onClick={() => handleDeleteSide('B')} disabled={saving}
              style={{ background: '#FFEBEE', color: '#B71C1C', border: '1px solid #FFCDD2', borderRadius: 10, padding: '7px 15px', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', flex: 1, minWidth: 90 }}>
              🗑 Bを削除
            </button>
            <button onClick={handleDeleteBoth} disabled={saving}
              style={{ background: '#B71C1C', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 15px', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', flex: '1 1 100%' }}>
              🗑 両方削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
