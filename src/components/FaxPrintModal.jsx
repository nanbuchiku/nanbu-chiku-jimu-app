import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS, SEMINAR_TYPES } from '../constants';
import { getChapter, formatDate } from '../utils';
import { OV, MOD, MH, BC, BP } from '../styles';
import { printFaxForm } from '../faxPrint';

/**
 * 汎用FAX確認書 印刷モーダル
 * 単会・セミナー種別・講話日を選択 → 印刷
 */
export default memo(function FaxPrintModal({ defaultChapterId, onClose, showToast }) {
  const [chapterId,   setChapterId]   = useState(defaultChapterId && defaultChapterId !== 'all' ? defaultChapterId : CHAPTERS[0].id);
  const [seminarType, setSeminarType] = useState('ms');
  const [seminarDate, setSeminarDate] = useState(''); // 空 = 手書き

  const chapter = useMemo(() => getChapter(chapterId), [chapterId]);
  const typeLabel = useMemo(() => SEMINAR_TYPES.find(t => t.id === seminarType)?.label || '', [seminarType]);

  const handlePrint = useCallback(() => {
    printFaxForm({
      chapter,
      seminarDate,
      seminarType,
      chapterEmail: chapter?.email,
      showToast,
    });
    onClose();
  }, [chapter, seminarDate, seminarType, showToast, onClose]);

  const LB   = { display:"block", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#1A3A6B", marginBottom:4 };
  const INP2 = { width:"100%", border:"1.5px solid #90A4AE", borderRadius:6, padding:"8px 10px", fontSize:"clamp(13px,1.6vw,15px)", background:"#fff" };

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="FAX汎用フォーマット印刷" style={{ ...MOD, maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div style={MH}>🖨 FAX汎用フォーマット印刷</div>

        <div style={{ background:"linear-gradient(135deg,#E3F2FD,#E8EAF6)", border:"2px solid #1A3A6B", borderRadius:12, padding:"18px 20px", marginTop:12 }}>
          <div style={{ fontSize:"clamp(13px,1.8vw,16px)", fontWeight:800, color:"#1A3A6B", marginBottom:14 }}>
            印刷内容の選択
          </div>

          <div style={{ display:"grid", gap:12 }}>
            <div>
              <label style={LB}>単会 *</label>
              <select style={INP2} value={chapterId} onChange={e => setChapterId(e.target.value)}>
                {CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}単会</option>)}
              </select>
              <div style={{ fontSize:11, color:"#78909C", marginTop:3 }}>
                会場・開催時間は単会設定が事前印字されます
              </div>
            </div>

            <div>
              <label style={LB}>セミナー種別 *</label>
              <select style={INP2} value={seminarType} onChange={e => setSeminarType(e.target.value)}>
                {SEMINAR_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label style={LB}>講話日<span style={{ fontSize:11, fontWeight:400, color:"#78909C", marginLeft:6 }}>（空欄の場合は手書き欄になります）</span></label>
              <input type="date" style={INP2} value={seminarDate} onChange={e => setSeminarDate(e.target.value)} />
              {seminarDate && (
                <div style={{ fontSize:12, color:"#2E7D32", marginTop:3, fontWeight:600 }}>
                  → {formatDate(seminarDate)} で印字されます
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop:14, padding:"10px 12px", background:"#fff", borderRadius:6, border:"1px solid #B0BEC5", fontSize:"clamp(12px,1.4vw,14px)", lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:"#1A3A6B", marginBottom:4 }}>📄 印刷プレビュー</div>
            <div><strong>{chapter?.name}単会</strong>　／　<strong>{typeLabel}</strong></div>
            <div style={{ color:"#546E7A" }}>会場：{chapter?.venue || '（未設定）'}</div>
            <div style={{ color:"#546E7A" }}>時間：{chapter?.time  || '（未設定）'}</div>
            <div style={{ color:"#546E7A" }}>日付：{seminarDate ? formatDate(seminarDate) : '（手書き欄）'}</div>
          </div>

          <button
            onClick={handlePrint}
            style={{ marginTop:16, width:"100%", background:"#1A3A6B", color:"#fff", border:"none", borderRadius:8, padding:"13px", fontSize:"clamp(14px,1.8vw,16px)", fontWeight:700, cursor:"pointer" }}>
            🖨 印刷ダイアログを開く
          </button>

          <div style={{ fontSize:11, color:"#78909C", marginTop:8, lineHeight:1.6 }}>
            ※ Webフォームと同じ全項目（プロフィール／講話内容／当日準備／宿泊／資料／領収証／写真使用範囲）を手書きで記入できる確認書を2枚に印刷します。<br/>
            ※ 顔写真はFAX送付不可（メール添付または郵送の旨が明記されます）
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
          <button style={BC} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
});
