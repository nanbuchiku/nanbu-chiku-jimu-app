import React, { useState, useMemo, memo } from 'react';
import { getChapter, formatDate } from '../utils';
import { OV, MOD, MH, BP, BC, BG, INP } from '../styles';

export default memo(function EmailModal({ speaker: sp, defaultType, onClose, onDone, chapterSettings }) {
  const ch = getChapter(sp.chapterId);
  const chEmail = chapterSettings?.[sp.chapterId]?.chapterEmail || '';
  const [mailType, setMailType] = useState(defaultType || "material");
  const [freeSubject, setFreeSubject] = useState("");
  const [freeBody,    setFreeBody]    = useState("");

  const matDL = useMemo(() => {
    if (!sp.seminarDate) return '';
    const [y, m, d] = sp.seminarDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 14);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }, [sp.seminarDate]);

  const sig = chEmail
    ? `━━━━━━━━━━━━━━━━━\n倫理法人会 ${ch.name}単会 事務局\nMail：${chEmail}\n━━━━━━━━━━━━━━━━━`
    : `━━━━━━━━━━━━━━━━━\n倫理法人会 ${ch.name}単会 事務局\n━━━━━━━━━━━━━━━━━`;

  const summary = useMemo(() => {
    if (!sp.notes) return '';
    const normalized = String(sp.notes).replace(/\\n/g, '\n');
    const m = normalized.match(/【内容要約】\n([\s\S]*?)(?=\n【|$)/);
    return m ? m[1].trim() : '';
  }, [sp.notes]);

  const photoBlock = sp.materialUrl ? `\n▼ 講師 顔写真\n${sp.materialUrl}\n` : '';

  const TEMPLATES = useMemo(() => ({
    material: {
      label: "📎 資料・写真の催促",
      subject: `【${ch.name}単会 MS】顔写真・講話資料のご送付のお願い`,
      body:
`${sp.speakerName} 様

いつもお世話になっております。${ch.name}単会 事務局です。

${formatDate(sp.seminarDate)}（${ch.time}）にご登壇いただきますが、現在下記の資料がまだ届いておりません。

【ご送付をお願いしたい資料】
□ 顔写真（データ形式：JPG/PNG、合同チラシ掲載に使用）
□ 当日のレジュメ・資料ファイル（あれば）
□ 講話タイトル（未決定の場合はお知らせください）

お手数ですが、 ${matDL} までにご送付いただけますようお願いいたします。${chEmail ? `\n\nMail：${chEmail}` : ''}

何かご不明な点がございましたら、お気軽にご連絡ください。
引き続きどうぞよろしくお願いいたします。

${sig}`,
    },
    promo: {
      label: "📣 講話の宣伝・ご案内",
      subject: `【${ch.name}単会MS】${formatDate(sp.seminarDate)} ${sp.speakerName}様 ご講話のご案内`,
      body:
`各位

いつもお世話になっております。${ch.name}単会 事務局です。

このたびのモーニングセミナーにて、${sp.company ? `${sp.company}${sp.companyRole ? `　${sp.companyRole}` : ""}の` : ""}${sp.speakerName}様にご講話をいただきます。${[sp.speakerUnit, sp.role].filter(Boolean).join("　") ? `\n（倫理法人会：${[sp.speakerUnit, sp.role].filter(Boolean).join("　")}）` : ""}

┏━━━━━━━━━━━━━━━━━┓
　演題「${sp.topic || '（未定）'}」
┗━━━━━━━━━━━━━━━━━┛
${summary ? `\n【講話内容】\n${summary}\n` : ''}${photoBlock}
【開催日時】${formatDate(sp.seminarDate)}（毎週${ch.dayName}　${ch.time}）
【会　　場】${ch.venue}
【住　　所】${ch.address || ch.venue}

会員の皆様はもちろん、ご友人・お知り合いの経営者の方もお誘い合わせの上、ぜひご参加ください。早朝のひとときが一日の活力となります。

皆様のご参加を心よりお待ちしております。

${sig}`,
    },
    reminder: {
      label: "🔔 前日リマインダー",
      subject: `【${ch.name}単会 モーニングセミナー】明日のご講話について`,
      body:
`${sp.speakerName} 様

明日、${ch.name}単会 モーニングセミナーにてご講話をいただきます。
どうぞよろしくお願いいたします。

【開催日時】${formatDate(sp.seminarDate)}　${ch.time}
【会　　場】${ch.venue}
【住　　所】${ch.address || ch.venue}

開始の15分前（5:45頃）にお越しいただけますと幸いです。
ご不明な点がございましたら、お気軽にご連絡ください。

お忙しいところ恐れ入りますが、明日のご登壇をどうぞよろしくお願いいたします。

${sig}`,
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

${sig}`,
    },
    free: {
      label: "✏️ フリーメール",
      subject: "",
      body: "",
    },
  }), [sp.speakerName, sp.seminarDate, sp.topic, sp.company, sp.companyRole, sp.speakerUnit, sp.role, ch.name, ch.venue, ch.dayName, ch.address, ch.time, matDL, sig, summary, photoBlock]);

  const isFree  = mailType === "free";
  const subject = isFree ? freeSubject : TEMPLATES[mailType].subject;
  const body    = isFree ? freeBody    : TEMPLATES[mailType].body;

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="メール送信" style={{ ...MOD, maxWidth:580 }} onClick={e => e.stopPropagation()}>
        <div style={MH}>📧 メール送信</div>

        <div style={{ background: sp.email ? "#E3F2FD" : "#FFEBEE", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#667085" }}>送信先</div>
          {sp.email
            ? <div style={{ fontWeight:700, fontSize:"clamp(13px,1.8vw,16px)", color:"#1565C0" }}>{sp.email}</div>
            : <div style={{ fontWeight:700, fontSize:"clamp(13px,1.8vw,16px)", color:"#B71C1C" }}>⚠ メールアドレスが未登録です</div>
          }
          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#667085", marginTop:2 }}>{sp.speakerName}　{formatDate(sp.seminarDate)}</div>
        </div>

        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>メールの種類</div>
        <select style={{ ...INP, width:"100%", marginBottom:12, fontSize:"clamp(12px,1.4vw,14px)" }} value={mailType} onChange={e => setMailType(e.target.value)}>
          {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>件名</div>
        {isFree
          ? <input style={{ ...INP, width:"100%", marginBottom:10 }} placeholder="件名を入力..." value={freeSubject} onChange={e => setFreeSubject(e.target.value)} />
          : <div style={{ fontSize:"clamp(12px,1.4vw,14px)", background:"#F5F5F5", padding:"7px 11px", borderRadius:6, marginBottom:10 }}>{subject}</div>
        }

        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>本文</div>
        {isFree
          ? <textarea style={{ ...INP, width:"100%", minHeight:180, resize:"vertical", fontSize:"clamp(12px,1.4vw,14px)", lineHeight:1.8 }} placeholder="本文を入力..." value={freeBody} onChange={e => setFreeBody(e.target.value)} />
          : <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:"clamp(12px,1.4vw,14px)", lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:220, overflowY:"auto" }}>{body}</pre>
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
