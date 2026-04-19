import React, { useState, useMemo, memo } from 'react';
import { getChapter, formatDate } from '../utils';
import { OV, MOD, MH, BP, BC, BG, INP } from '../styles';

export default memo(function EmailModal({ speaker: sp, onClose, onDone }) {
  const ch = getChapter(sp.chapterId);
  const [mailType, setMailType] = useState("request");
  const [freeSubject, setFreeSubject] = useState("");
  const [freeBody,    setFreeBody]    = useState("");

  const matDL = useMemo(() => {
    const d = new Date(sp.seminarDate); d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  }, [sp.seminarDate]);

  const TEMPLATES = useMemo(() => ({
    request: {
      label: "📋 講師依頼確認",
      subject: `【${ch.name}単会 モーニングセミナー】講師依頼のご確認`,
      body:
`${sp.speakerName} 様

このたびは、${ch.name}単会 モーニングセミナーの講師をお引き受けいただき、誠にありがとうございます。

開催日：${formatDate(sp.seminarDate)}（毎週${ch.dayName}　午前6時〜7時）
会　場：${ch.venue}

下記の内容をご確認・ご回答いただけますようお願いいたします。

【ご確認いただきたい内容】
① 顔写真のご送付（合同チラシ・当日資料に使用いたします）
② 講話タイトルのご連絡
③ 当日資料（レジュメ等）の有無
   ※「あり」の場合は ${matDL} までにデータをご送付ください
④ 前泊の有無
   ※「あり」の場合はホテルを手配いたしますのでお知らせください

ご不明な点がございましたら、お気軽にご連絡ください。

━━━━━━━━━━━━━━━━━
倫理法人会 南部地区事務局
${ch.name}単会 担当
━━━━━━━━━━━━━━━━━`,
    },
    thanks: {
      label: "🙏 講話後お礼",
      subject: `【${ch.name}単会 モーニングセミナー】ご講話のお礼`,
      body:
`${sp.speakerName} 様

先日は、${ch.name}単会 モーニングセミナーにてご講話をいただき、誠にありがとうございました。

開催日：${formatDate(sp.seminarDate)}

${sp.speakerName}様の貴重なお話は、参加者一同にとって大変心に響くものでございました。
「${sp.topic}」というテーマのもと、深い洞察と温かいお人柄が伝わる講話に、会場全体が感動に包まれました。

お忙しい中、お時間をいただきましたこと、改めて心より感謝申し上げます。
またの機会にも、ぜひよろしくお願いいたします。

━━━━━━━━━━━━━━━━━
倫理法人会 南部地区事務局
${ch.name}単会 担当
━━━━━━━━━━━━━━━━━`,
    },
    free: {
      label: "✏️ フリーメール",
      subject: "",
      body: "",
    },
  }), [sp.speakerName, sp.seminarDate, sp.topic, ch.name, ch.venue, ch.dayName, matDL]);

  const isFree  = mailType === "free";
  const subject = isFree ? freeSubject : TEMPLATES[mailType].subject;
  const body    = isFree ? freeBody    : TEMPLATES[mailType].body;

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="メール送信" style={{ ...MOD, maxWidth:580 }} onClick={e => e.stopPropagation()}>
        <div style={MH}>📧 メール送信</div>

        <div style={{ background: sp.email ? "#E3F2FD" : "#FFEBEE", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#546E7A" }}>送信先</div>
          {sp.email
            ? <div style={{ fontWeight:700, fontSize:14, color:"#1565C0" }}>{sp.email}</div>
            : <div style={{ fontWeight:700, fontSize:13, color:"#B71C1C" }}>⚠ メールアドレスが未登録です</div>
          }
          <div style={{ fontSize:11, color:"#546E7A", marginTop:2 }}>{sp.speakerName}　{formatDate(sp.seminarDate)}</div>
        </div>

        <div style={{ fontSize:11, color:"#78909C", marginBottom:4, fontWeight:600 }}>メールの種類</div>
        <select style={{ ...INP, width:"100%", marginBottom:12, fontSize:12 }} value={mailType} onChange={e => setMailType(e.target.value)}>
          {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>件名</div>
        {isFree
          ? <input style={{ ...INP, width:"100%", marginBottom:10 }} placeholder="件名を入力..." value={freeSubject} onChange={e => setFreeSubject(e.target.value)} />
          : <div style={{ fontSize:12, background:"#F5F5F5", padding:"7px 11px", borderRadius:6, marginBottom:10 }}>{subject}</div>
        }

        <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>本文</div>
        {isFree
          ? <textarea style={{ ...INP, width:"100%", minHeight:180, resize:"vertical", fontSize:11, lineHeight:1.8 }} placeholder="本文を入力..." value={freeBody} onChange={e => setFreeBody(e.target.value)} />
          : <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:11, lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:220, overflowY:"auto" }}>{body}</pre>
        }

        <div style={{ display:"flex", gap:8, marginTop:14 }}>
          <button style={{ ...BP, flex:1, opacity: sp.email ? 1 : .4, cursor: sp.email ? "pointer" : "not-allowed" }} disabled={!sp.email} onClick={() => { window.open(`mailto:${sp.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank"); onDone(); }}>✉ メールアプリで開く</button>
          <button style={{ ...BG, flex:1 }} onClick={() => { navigator.clipboard?.writeText(`件名：${subject}\n\n${body}`).catch(() => {}); onDone(); }}>📋 コピーして手動送信</button>
          <button style={BC} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
});
