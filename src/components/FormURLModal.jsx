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

  // ── FAX用紙印刷（手書き提出用・セミナー種別ごと） ────────────────
  const printForm = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) { showToast('⚠ ポップアップを許可してください'); return; }
    const formattedDate = displayDate ? formatDate(displayDate) : '　　　年　　月　　日（　）';
    const stType = isNew ? form.seminarType : sp.seminarType;
    const stInfo = SEMINAR_TYPES.find(t => t.id === stType) || SEMINAR_TYPES[0];
    const seminarTypeLabel = stInfo.label;
    const chapterEmail = ch?.email || 'rinri.nanbu@gmail.com';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    // セミナー種別ごとの講話時間目安
    const lectureTime = ({
      ms:      '35分',
      kiso:    '90分',
      tsudoi:  '60分',
      evening: '60分',
      koen:    '90分',
    })[stType] || '所定時間';

    // 宿泊の扱い（イブニングのみ任意）
    const isLodgingOptional = stInfo.hasLodging === 'optional';

    // チェックボックス用HTMLヘルパー
    const cb = (label) => `<span class="cb"><span class="cb-box"></span>${esc(label)}</span>`;

    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>${esc(seminarTypeLabel)}講師依頼確認書 - ${esc(ch?.name)}</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 9.5pt; line-height: 1.45; color: #000; margin: 0; }
  h1 { text-align: center; font-size: 16pt; margin: 0 0 2mm 0; letter-spacing: 0.25em; font-weight: 800; }
  .stype-badge { text-align: center; font-size: 11pt; font-weight: 700; color: #fff; background: #1A3A6B; display: inline-block; padding: 1.5mm 8mm; border-radius: 3mm; margin: 0 auto; }
  .stype-wrap { text-align: center; margin-bottom: 3mm; }
  .org { text-align: center; font-size: 9pt; margin-bottom: 3mm; color: #333; }
  .section { border: 1.5px solid #000; margin-bottom: 2.5mm; }
  .section-title { font-size: 10pt; font-weight: 800; background: #1A3A6B; color: #fff; padding: 1.5mm 3mm; }
  .section-body { padding: 2mm 3mm; }
  .row { display: flex; padding: 1.2mm 0; border-bottom: 1px dotted #999; min-height: 7mm; align-items: center; }
  .row:last-child { border-bottom: none; }
  .row.tall { min-height: 12mm; align-items: flex-start; padding-top: 2mm; }
  .row.xtall { min-height: 22mm; align-items: flex-start; padding-top: 2mm; }
  .label { width: 32mm; font-weight: 700; flex-shrink: 0; color: #1A3A6B; font-size: 9pt; }
  .label .hint { font-size: 7.5pt; font-weight: 400; color: #666; display: block; margin-top: 0.5mm; }
  .value { flex: 1; padding-left: 2mm; font-size: 9.5pt; }
  .blank { flex: 1; border-bottom: 1px solid #000; min-height: 6mm; margin-left: 2mm; }
  .blank-area { flex: 1; border: 1px solid #000; min-height: 20mm; margin-left: 2mm; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 4mm; }
  .two-col .row { border-bottom: 1px dotted #999; }
  .cb { display: inline-flex; align-items: center; gap: 1.5mm; margin-right: 5mm; font-size: 9.5pt; white-space: nowrap; }
  .cb-box { display: inline-block; width: 3.5mm; height: 3.5mm; border: 1.2px solid #000; }
  .cbrow { display: flex; flex-wrap: wrap; gap: 1mm 0; padding: 0.5mm 0; }
  .footer { margin-top: 3mm; padding: 3mm 4mm; border: 1.5px solid #000; background: #FFF8E1; text-align: center; }
  .footer .title { font-weight: 800; margin-bottom: 1.5mm; font-size: 10pt; color: #B71C1C; }
  .note { font-size: 8pt; color: #444; margin-top: 1.5mm; line-height: 1.5; }
  .photo-warn { background:#FFEBEE; border:1px solid #E53935; color:#B71C1C; padding:1.5mm 3mm; font-size:8.5pt; font-weight:700; margin-bottom:2.5mm; border-radius:1mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .noprint { display: none; } }
  .noprint { text-align: center; margin: 6mm 0; }
  .noprint button { background: #1A3A6B; color: #fff; border: none; border-radius: 6px; padding: 8px 24px; font-size: 12pt; cursor: pointer; }
  .page-break { page-break-before: always; }
</style></head><body>

<h1>講 話 依 頼 確 認 書</h1>
<div class="stype-wrap"><span class="stype-badge">${esc(seminarTypeLabel)}</span></div>
<div class="org">倫理法人会 南部地区合同事務局　${esc(ch?.name)}単会</div>

<div class="photo-warn">⚠ 顔写真はFAXでは送付できません。メール添付または郵送にて別途お送りください。</div>

<!-- ① 依頼内容 -->
<div class="section">
  <div class="section-title">① 講話の依頼内容（事務局記入済）</div>
  <div class="section-body">
    <div class="row"><div class="label">単 会 名</div><div class="value">${esc(ch?.name)}単会</div></div>
    <div class="row"><div class="label">セミナー種別</div><div class="value">${esc(seminarTypeLabel)}（講話${esc(lectureTime)}）</div></div>
    <div class="row"><div class="label">開 催 日</div><div class="value">${esc(formattedDate)}</div></div>
    <div class="row"><div class="label">開催時間</div><div class="value">${esc(ch?.time)}</div></div>
    <div class="row"><div class="label">会　　場</div><div class="value">${esc(ch?.venue)}</div></div>
  </div>
</div>

<!-- ② 講師プロフィール -->
<div class="section">
  <div class="section-title">② 講師プロフィール</div>
  <div class="section-body">
    <div class="row"><div class="label">講師名（漢字）</div><div class="blank"></div></div>
    <div class="row"><div class="label">ふ り が な<span class="hint">ひらがな</span></div><div class="blank"></div></div>
    <div class="row"><div class="label">所属法人会名</div><div class="blank"></div></div>
    <div class="row"><div class="label">法人会役職</div><div class="blank"></div></div>
    <div class="row"><div class="label">勤　務　先<span class="hint">チラシ記載</span></div><div class="blank"></div></div>
    <div class="row"><div class="label">勤務先役職名<span class="hint">チラシ記載</span></div><div class="blank"></div></div>
    <div class="row"><div class="label">連絡先TEL</div><div class="blank"></div></div>
    <div class="row"><div class="label">メールアドレス</div><div class="blank"></div></div>
  </div>
</div>

<!-- ③ 講話内容 -->
<div class="section">
  <div class="section-title">③ 講話内容</div>
  <div class="section-body">
    <div class="row tall"><div class="label">講話タイトル<span class="hint">（30字以内）</span></div><div class="blank" style="min-height:10mm;"></div></div>
    <div class="row xtall"><div class="label">内 容 要 約<span class="hint">300字以内<br>${esc(lectureTime)}の講話</span></div><div class="blank-area" style="min-height:32mm;"></div></div>
  </div>
</div>

<div class="page-break"></div>

<h1 style="font-size:14pt;margin-bottom:2mm;">講 話 依 頼 確 認 書（つづき）</h1>
<div class="stype-wrap"><span class="stype-badge" style="font-size:9pt;padding:1mm 5mm;">${esc(seminarTypeLabel)}　／　${esc(ch?.name)}単会　${esc(formattedDate)}</span></div>

<!-- ④ 当日のご準備 -->
<div class="section">
  <div class="section-title">④ 当日のご準備</div>
  <div class="section-body">
    <div class="row"><div class="label">交通手段</div><div class="value"><div class="cbrow">${cb('お車')}${cb('電車')}${cb('その他（　　　　　　　）')}</div></div></div>
    <div class="row tall"><div class="label">必要機材<span class="hint">複数選択可</span></div><div class="value"><div class="cbrow">${cb('プロジェクタ')}${cb('パソコン')}${cb('ホワイトボード')}${cb('その他')}${cb('無し')}</div></div></div>
  </div>
</div>

<!-- ⑤ 宿泊について -->
<div class="section">
  <div class="section-title">⑤ 宿泊について${isLodgingOptional ? '（任意）' : ''}</div>
  <div class="section-body">
    <div class="row"><div class="label">前 泊 要 否</div><div class="value"><div class="cbrow">${cb('要（ホテルを手配します）')}${cb('不要')}</div></div></div>
    <div class="row"><div class="label">禁煙ルーム希望</div><div class="value"><div class="cbrow">${cb('禁煙')}${cb('喫煙')}${cb('どちらでも')}</div></div></div>
    <div class="row"><div class="label">お迎えの要否</div><div class="value"><div class="cbrow">${cb('要')}${cb('不要')}</div></div></div>
  </div>
</div>

<!-- ⑥ 講話資料 -->
<div class="section">
  <div class="section-title">⑥ 講話資料</div>
  <div class="section-body">
    <div class="row"><div class="label">資料の有無</div><div class="value"><div class="cbrow">${cb('あり')}${cb('なし')}</div></div></div>
    <div class="row"><div class="label">印刷の要否<span class="hint">「あり」の場合</span></div><div class="value"><div class="cbrow">${cb('要（単会で印刷）')}${cb('不要（持参）')}</div></div></div>
  </div>
</div>

<!-- ⑦ 領収証 -->
<div class="section">
  <div class="section-title">⑦ 領収証</div>
  <div class="section-body">
    <div class="row"><div class="label">宛　　名</div><div class="value"><div class="cbrow">${cb('個人宛')}${cb('会社宛')}</div></div></div>
    <div class="row"><div class="label">郵便番号<span class="hint">7桁</span></div><div class="blank" style="max-width:60mm;"></div></div>
    <div class="row tall"><div class="label">住　　所</div><div class="blank" style="min-height:11mm;"></div></div>
  </div>
</div>

<!-- ⑧ 顔写真の使用範囲 -->
<div class="section">
  <div class="section-title">⑧ 顔写真の使用範囲（チラシ・広報物）</div>
  <div class="section-body">
    <div class="row tall"><div class="value"><div class="cbrow" style="gap:1.5mm 0;">${cb('全ての媒体を承諾します')}${cb('公式ホームページのみ')}${cb('Facebookのみ')}${cb('要相談')}</div></div></div>
  </div>
</div>

<div class="footer">
  <div class="title">▼ ご記入後の返信先 ▼</div>
  <div style="font-weight:700;">倫理法人会 南部地区合同事務局　${esc(ch?.name)}単会</div>
  <div style="margin-top:1mm;">Mail：${esc(chapterEmail)}</div>
  <div class="note">本確認書をご記入の上、FAXまたは上記メールアドレスにてご返信ください。<br><strong style="color:#B71C1C;">※ 顔写真はメール添付または郵送にて別途お送りください（FAXでは送付不可）</strong></div>
</div>

<div class="noprint"><button onclick="window.print()">🖨 印刷する</button></div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),400);});</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
    showToast(`🖨 ${seminarTypeLabel}用の印刷ダイアログを開きます`);
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
                🖨 FAX用紙を印刷（{SEMINAR_TYPES.find(t => t.id === (isNew ? form.seminarType : sp.seminarType))?.label || ''}用）
              </button>
              <div style={{ fontSize:"clamp(11px,1.2vw,12px)", color:"#78909C", marginTop:5, lineHeight:1.6 }}>
                Webフォームと同じ全項目（プロフィール／講話内容／当日準備／宿泊／資料／領収証／写真使用範囲）を手書きで記入できる確認書を、<strong>セミナー種別に合わせて</strong>2枚に印刷します。<br/>
                依頼内容（単会・日時・会場）は事前印字されます。
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
