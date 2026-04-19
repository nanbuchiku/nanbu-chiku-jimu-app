import React, { useState } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter, formatDate } from '../utils';
import { OV, MOD, MH, BC } from '../styles';

export default function FormURLModal({ speaker: spProp, onClose, showToast }) {
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
  const BASE = 'https://hosina0447-ctrl.github.io/rinri-nanbu/form.html';
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
  const formUrl = `${BASE}?${params.toString()}`;
  const canGenerate = !isNew || (form.speakerName && form.seminarDate && form.email);

  const displayName  = isNew ? form.speakerName : sp.speakerName;
  const displayDate  = isNew ? form.seminarDate : sp.seminarDate;
  const displayEmail = isNew ? form.email       : sp.email;

  const mailSubject = `【${ch?.name}単会 モーニングセミナー】講師確認フォームのご案内`;
  const mailBody =
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
Mail：nanbugoudou.jimu@gmail.com
━━━━━━━━━━━━━━━━━`;

  const copyUrl  = () => { navigator.clipboard?.writeText(formUrl).catch(()=>{}); showToast('フォームURLをコピーしました 📋'); };
  const copyMail = () => { navigator.clipboard?.writeText(`件名：${mailSubject}\n\n${mailBody}`).catch(()=>{}); showToast('メール文をコピーしました 📧'); onClose(); };
  const openMail = () => { window.open(`mailto:${displayEmail || ''}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`, '_blank'); onClose(); };

  const LB   = { display:"block", fontSize:11, fontWeight:700, color:"#4527A0", marginBottom:3 };
  const INP2 = { width:"100%", border:"1px solid #CE93D8", borderRadius:6, padding:"7px 9px", fontSize:12, background:"#fff" };

  return (
    <div style={OV} onClick={onClose}>
      <div style={{ ...MOD, maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div style={MH}>📝 講話依頼確認フォーム作成</div>

        {isNew && !generated && (
          <div style={{ background:"linear-gradient(135deg,#EDE7F6,#F3E5F5)", border:"2px solid #7E57C2", borderRadius:12, padding:"18px 20px", marginTop:12 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#4527A0", marginBottom:14 }}>事務局入力項目</div>
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
                <label style={LB}>所属組織（単会・研究所など）</label>
                <input type="text" style={INP2} placeholder="例：川口倫理法人会" value={form.speakerUnit} onChange={e => setForm(f => ({ ...f, speakerUnit: e.target.value }))} />
              </div>
              <div>
                <label style={LB}>倫理法人会の役職</label>
                <input type="text" style={INP2} placeholder="例：幹事" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
              <div>
                <label style={LB}>セミナー種別</label>
                <select style={INP2} value={form.seminarType} onChange={e => setForm(f => ({ ...f, seminarType: e.target.value }))}>
                  <option value="ms">モーニングセミナー</option>
                  <option value="msbasic">MS基礎</option>
                  <option value="ethics">倫経セミナー</option>
                  <option value="tsudoi">集い</option>
                  <option value="other">その他セミナー</option>
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LB}>講師メールアドレス *</label>
                <input type="email" style={INP2} placeholder="example@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <button
              style={{ marginTop:16, width:"100%", background: canGenerate ? "#7E57C2" : "#B0BEC5", color:"#fff", border:"none", borderRadius:8, padding:"12px", fontSize:13, fontWeight:700, cursor: canGenerate ? "pointer" : "not-allowed" }}
              disabled={!canGenerate}
              onClick={() => setGenerated(true)}>
              フォームURLを生成する →
            </button>
          </div>
        )}

        {generated && (
          <div style={{ background:"linear-gradient(135deg,#EDE7F6,#F3E5F5)", border:"2px solid #7E57C2", borderRadius:12, padding:"20px 22px", marginTop:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ background:"#7E57C2", color:"#fff", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>📝</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:"#4527A0" }}>{displayName || '（名前未入力）'} 様への確認フォーム</div>
                <div style={{ fontSize:12, color:"#7E57C2", marginTop:2 }}>{ch?.name}単会　{displayDate ? formatDate(displayDate) : '日程未定'}</div>
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:8, padding:"10px 12px", marginBottom:12, border:"1px solid #CE93D8" }}>
              <div style={{ fontSize:10, color:"#9C27B0", fontWeight:700, marginBottom:4 }}>フォームURL</div>
              <div style={{ fontSize:11, color:"#37474F", wordBreak:"break-all", lineHeight:1.6 }}>{formUrl}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <button style={{ background:"#7E57C2", color:"#fff", border:"none", borderRadius:8, padding:"11px", fontSize:12, fontWeight:700, cursor:"pointer" }} onClick={copyUrl}>📋 URLだけコピー</button>
              <button style={{ background:"#4527A0", color:"#fff", border:"none", borderRadius:8, padding:"11px", fontSize:12, fontWeight:700, cursor:"pointer" }} onClick={openMail}>✉ メールアプリで開く</button>
              <button style={{ background:"#fff", color:"#4527A0", border:"2px solid #7E57C2", borderRadius:8, padding:"11px", fontSize:12, fontWeight:700, cursor:"pointer", gridColumn:"1/-1" }} onClick={copyMail}>📋 メール文ごとコピー（手動送信）</button>
            </div>
          </div>
        )}

        {generated && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:"#78909C", fontWeight:700, marginBottom:5 }}>送付メール本文プレビュー</div>
            <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:11, lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:200, overflowY:"auto", border:"1px solid #E0E0E0" }}>{mailBody}</pre>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
          {isNew && generated && <button style={{ ...BC, background:"#EDE7F6", color:"#4527A0", border:"1px solid #B39DDB" }} onClick={() => setGenerated(false)}>← 入力に戻る</button>}
          <button style={{ ...BC, marginLeft:"auto" }} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
