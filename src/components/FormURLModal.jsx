import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS, SEMINAR_TYPES } from '../constants';
import { getChapter, formatDate } from '../utils';
import { OV, MOD, MH, BC } from '../styles';

export default memo(function FormURLModal({ speaker: spProp, onClose, showToast }) {
  const isNew = !spProp;
  const [form, setForm] = useState({
    chapterId:   spProp?.chapterId   || 'kawaguchi',
    speakerName: spProp?.speakerName || '',
    speakerUnit: spProp?.speakerUnit || '',
    seminarDate: spProp?.seminarDate || '',
    seminarType: spProp?.seminarType || 'ms',
    role:        spProp?.role        || '',
    email:       spProp?.email       || '',
  });
  const [generated, setGenerated] = useState(!isNew);

  const sp = isNew ? { ...form, id: '' } : spProp;
  const ch = getChapter(isNew ? form.chapterId : sp.chapterId);

  const formUrl = useMemo(() => {
    const BASE = 'https://nanbuchiku.github.io/nanbu-chiku-jimu-app/form.html';
    const params = new URLSearchParams({
      id:     sp.id || '',
      name:   (isNew ? form.speakerName : sp.speakerName)  || '',
      unit:   (isNew ? form.speakerUnit : sp.speakerUnit)  || ch?.name || '',
      date:   (isNew ? form.seminarDate : sp.seminarDate)  || '',
      ch:     (isNew ? form.chapterId   : sp.chapterId)    || '',
      type:   (isNew ? form.seminarType : sp.seminarType)  || 'ms',
      ethics: (isNew ? form.role        : sp.role)         || '',
      email:  (isNew ? form.email       : sp.email)        || '',
    });
    return `${BASE}?${params.toString()}`;
  }, [isNew, form, sp, ch]);

  const canGenerate = !isNew || (form.speakerName && form.seminarDate && form.email);

  const displayName  = isNew ? form.speakerName : sp.speakerName;
  const displayDate  = isNew ? form.seminarDate : sp.seminarDate;
  const displayEmail = isNew ? form.email       : sp.email;

  const mailSubject = useMemo(() => `【${ch?.name}単会 モーニングセミナー】講師確認フォームのご案内`, [ch]);
  const mailBody = useMemo(() =>
`${displayName || '　　　'} 様

このたびは、${ch?.name}単会 モーニングセミナーの講師をお引き受けいただき、誠にありがとうございます。

以下のURLより、講師情報のご入力と顔写真・資料のご提出をお願いいたします。

──────────────────────
▼ 講話依頼確認フォーム
${formUrl}
──────────────────────

開催日：${displayDate ? formatDate(displayDate) : '　　　年　　月　　日'}
会　場：${ch?.venue || ''}
時　間：${ch?.time  || ''}

ご不明な点がございましたら、お気軽にご連絡ください。

━━━━━━━━━━━━━━━━━
倫理法人会 南部地区合同事務局
Mail：rinri.nanbu@gmail.com
━━━━━━━━━━━━━━━━━`, [displayName, displayDate, ch, formUrl]);

  const copyUrl  = useCallback(() => { navigator.clipboard?.writeText(formUrl).catch(()=>{}); showToast('フォームURLをコピーしました 📋'); }, [formUrl, showToast]);
  const copyMail = useCallback(() => { navigator.clipboard?.writeText(`件名：${mailSubject}\n\n${mailBody}`).catch(()=>{}); showToast('メール文をコピーしました 📧'); onClose(); }, [mailSubject, mailBody, showToast, onClose]);
  const openMail = useCallback(() => { window.open(`mailto:${displayEmail || ''}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`, '_blank'); onClose(); }, [displayEmail, mailSubject, mailBody, onClose]);

  // ── FAX用紙印刷（手書き提出用） ─────────────────────────────────
  const printForm = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) { showToast('⚠ ポップアップを許可してください'); return; }
    const formattedDate = displayDate ? formatDate(displayDate) : '　　　年　　月　　日（　）';
    const stType = isNew ? form.seminarType : sp.seminarType;
    const seminarTypeLabel = SEMINAR_TYPES.find(t => t.id === stType)?.label || 'モーニングセミナー';
    const chapterEmail = ch?.email || 'rinri.nanbu@gmail.com';
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>講話依頼確認書 - ${esc(ch?.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 10.5pt; line-height: 1.55; color: #000; margin: 0; }
  h1 { text-align: center; font-size: 19pt; margin: 0 0 4mm 0; letter-spacing: 0.4em; font-weight: 800; }
  .org { text-align: center; font-size: 10pt; margin-bottom: 6mm; color: #333; }
  .section { border: 1.8px solid #000; margin-bottom: 4mm; }
  .section-title { font-size: 11.5pt; font-weight: 800; background: #1A3A6B; color: #fff; padding: 2mm 4mm; }
  .section-body { padding: 3mm 5mm; }
  .row { display: flex; padding: 1.8mm 0; border-bottom: 1px dotted #888; min-height: 8mm; align-items: center; }
  .row:last-child { border-bottom: none; }
  .label { width: 40mm; font-weight: 700; flex-shrink: 0; color: #1A3A6B; }
  .value { flex: 1; padding-left: 2mm; }
  .blank { flex: 1; border-bottom: 1.2px solid #000; min-height: 7mm; margin-left: 2mm; }
  .blank-tall { min-height: 12mm; }
  .photo-area { display: flex; gap: 5mm; align-items: flex-start; padding: 3mm 5mm; }
  .photo-box { width: 32mm; height: 42mm; border: 1.8px dashed #444; display: flex; align-items: center; justify-content: center; color: #777; font-size: 9pt; flex-shrink: 0; }
  .photo-note { flex: 1; font-size: 9.5pt; }
  .photo-note p { margin: 0 0 1.5mm 0; }
  .footer { margin-top: 5mm; padding: 4mm 5mm; border: 1.8px solid #000; background: #FFF8E1; text-align: center; }
  .footer .title { font-weight: 800; margin-bottom: 2mm; font-size: 11pt; color: #B71C1C; }
  .note { font-size: 9pt; color: #555; margin-top: 2mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .noprint { display: none; } }
  .noprint { text-align: center; margin: 6mm 0; }
  .noprint button { background: #1A3A6B; color: #fff; border: none; border-radius: 6px; padding: 8px 24px; font-size: 12pt; cursor: pointer; }
</style></head><body>

<h1>講 話 依 頼 確 認 書</h1>
<div class="org">倫理法人会 南部地区合同事務局</div>

<div class="section">
  <div class="section-title">■ 講話の依頼内容（事務局記入済）</div>
  <div class="section-body">
    <div class="row"><div class="label">単 会 名</div><div class="value">${esc(ch?.name)}単会</div></div>
    <div class="row"><div class="label">セミナー種別</div><div class="value">${esc(seminarTypeLabel)}</div></div>
    <div class="row"><div class="label">開 催 日</div><div class="value">${esc(formattedDate)}</div></div>
    <div class="row"><div class="label">開催時間</div><div class="value">${esc(ch?.time)}</div></div>
    <div class="row"><div class="label">会　　場</div><div class="value">${esc(ch?.venue)}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">■ 講師情報（講師ご本人にてご記入ください）</div>
  <div class="section-body">
    <div class="row"><div class="label">講師名（漢字）</div><div class="blank"></div></div>
    <div class="row"><div class="label">ふ り が な</div><div class="blank"></div></div>
    <div class="row"><div class="label">所属法人会名</div><div class="blank"></div></div>
    <div class="row"><div class="label">法人会役職</div><div class="blank"></div></div>
    <div class="row"><div class="label">勤 務 先</div><div class="blank"></div></div>
    <div class="row"><div class="label">勤務先役職</div><div class="blank"></div></div>
    <div class="row"><div class="label">講話テーマ<br><span style="font-size:8.5pt;font-weight:400;color:#666;">（30字以内）</span></div><div class="blank blank-tall"></div></div>
    <div class="row"><div class="label">メールアドレス</div><div class="blank"></div></div>
    <div class="row"><div class="label">携帯電話番号</div><div class="blank"></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">■ 顔写真・配布資料</div>
  <div class="photo-area">
    <div class="photo-box">顔写真<br>貼付欄</div>
    <div class="photo-note">
      <p>● 顔写真（縦長・上半身）を本紙に貼付、または別紙にてご送付ください</p>
      <p>● 講話で配布される資料がございましたら併せてご送付ください</p>
      <p class="note">※ デジタルデータ（JPEG / PDF等）でメール添付も承ります</p>
    </div>
  </div>
</div>

<div class="footer">
  <div class="title">▼ ご記入後の返信先 ▼</div>
  <div style="font-weight:700;">倫理法人会 南部地区合同事務局　${esc(ch?.name)}単会</div>
  <div style="margin-top:1.5mm;">Mail：${esc(chapterEmail)}</div>
  <div class="note">本確認書をご記入の上、上記メールアドレスまたはFAX等にてご返信ください。<br>ご不明な点がございましたら、お気軽にお問い合わせください。</div>
</div>

<div class="noprint"><button onclick="window.print()">🖨 印刷する</button></div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),400);});</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
    showToast('🖨 印刷ダイアログを開きます');
  }, [ch, displayDate, isNew, form, sp, showToast]);

  const LB   = { display:"block", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#4527A0", marginBottom:3 };
  const INP2 = { width:"100%", border:"1px solid #CE93D8", borderRadius:6, padding:"7px 9px", fontSize:"clamp(12px,1.4vw,14px)", background:"#fff" };

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="講話依頼確認フォーム作成" style={{ ...MOD, maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div style={MH}>📝 講話依頼確認フォーム作成</div>

        {isNew && !generated && (
          <div style={{ background:"linear-gradient(135deg,#EDE7F6,#F3E5F5)", border:"2px solid #7E57C2", borderRadius:12, padding:"18px 20px", marginTop:12 }}>
            <div style={{ fontSize:"clamp(13px,1.8vw,16px)", fontWeight:800, color:"#4527A0", marginBottom:14 }}>事務局入力項目</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LB}>単会 *</label>
                <select style={INP2} value={form.chapterId} onChange={e => setForm(f => ({ ...f, chapterId: e.target.value }))}>
                  {CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LB}>講話日 *</label>
                <input type="date" style={INP2} value={form.seminarDate} onChange={e => setForm(f => ({ ...f, seminarDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LB}>講師名 *</label>
                <input type="text" style={INP2} placeholder="例：山田 太郎" value={form.speakerName} onChange={e => setForm(f => ({ ...f, speakerName: e.target.value }))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LB}>所属法人会名</label>
                <input type="text" style={INP2} placeholder="例：川口倫理法人会" value={form.speakerUnit} onChange={e => setForm(f => ({ ...f, speakerUnit: e.target.value }))} />
              </div>
              <div>
                <label style={LB}>法人会役職</label>
                <input type="text" style={INP2} placeholder="例：幹事" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
              <div>
                <label style={LB}>セミナー種別</label>
                <select style={INP2} value={form.seminarType} onChange={e => setForm(f => ({ ...f, seminarType: e.target.value }))}>
                  {SEMINAR_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LB}>講師メールアドレス *</label>
                <input type="email" style={INP2} placeholder="example@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <button
              style={{ marginTop:16, width:"100%", background: canGenerate ? "#7E57C2" : "#B0BEC5", color:"#fff", border:"none", borderRadius:8, padding:"12px", fontSize:"clamp(13px,1.8vw,16px)", fontWeight:700, cursor: canGenerate ? "pointer" : "not-allowed" }}
              disabled={!canGenerate}
              onClick={() => setGenerated(true)}>
              フォームURLを生成する →
            </button>
          </div>
        )}

        {generated && (
          <div style={{ background:"linear-gradient(135deg,#EDE7F6,#F3E5F5)", border:"2px solid #7E57C2", borderRadius:12, padding:"20px 22px", marginTop:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ background:"#7E57C2", color:"#fff", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(20px,3vw,28px)", flexShrink:0 }}>📝</div>
              <div>
                <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:800, color:"#4527A0" }}>{displayName || '（名前未入力）'} 様への確認フォーム</div>
                <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#7E57C2", marginTop:2 }}>{ch?.name}単会　{displayDate ? formatDate(displayDate) : '日程未定'}</div>
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:8, padding:"10px 12px", marginBottom:12, border:"1px solid #CE93D8" }}>
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#9C27B0", fontWeight:700, marginBottom:4 }}>フォームURL</div>
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", wordBreak:"break-all", lineHeight:1.6 }}>{formUrl}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <button style={{ background:"#7E57C2", color:"#fff", border:"none", borderRadius:8, padding:"11px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:"pointer" }} onClick={copyUrl}>📋 URLだけコピー</button>
              <button style={{ background:"#4527A0", color:"#fff", border:"none", borderRadius:8, padding:"11px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:"pointer" }} onClick={openMail}>✉ メールアプリで開く</button>
              <button style={{ background:"#fff", color:"#4527A0", border:"2px solid #7E57C2", borderRadius:8, padding:"11px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:"pointer", gridColumn:"1/-1" }} onClick={copyMail}>📋 メール文ごとコピー（手動送信）</button>
            </div>

            {/* FAX用紙印刷（メールが使えない場合） */}
            <div style={{ marginTop:14, paddingTop:12, borderTop:"1px dashed #B39DDB" }}>
              <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#7E57C2", marginBottom:6, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                <span>📠 メール・URLが使えない場合</span>
              </div>
              <button
                style={{ width:"100%", background:"#fff", color:"#1A3A6B", border:"2px solid #1A3A6B", borderRadius:8, padding:"11px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:"pointer" }}
                onClick={printForm}>
                🖨 FAX用紙を印刷（手書き提出用）
              </button>
              <div style={{ fontSize:"clamp(11px,1.2vw,12px)", color:"#78909C", marginTop:5, lineHeight:1.6 }}>
                依頼内容（単会・日時・会場）が事前印字された確認書を印刷します。<br/>
                講師名・テーマ等の記入欄は空欄になっています。
              </div>
            </div>
          </div>
        )}

        {generated && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", fontWeight:700, marginBottom:5 }}>送付メール本文プレビュー</div>
            <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:"clamp(12px,1.4vw,14px)", lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:200, overflowY:"auto", border:"1px solid #E0E0E0" }}>{mailBody}</pre>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
          {isNew && generated && <button style={{ ...BC, background:"#EDE7F6", color:"#4527A0", border:"1px solid #B39DDB" }} onClick={() => setGenerated(false)}>← 入力に戻る</button>}
          <button style={{ ...BC, marginLeft:"auto" }} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
});
