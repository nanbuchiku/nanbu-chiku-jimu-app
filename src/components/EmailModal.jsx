import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { getChapter, getSeminarType, formatDate, hasNextDayMs as getHasNextDayMs } from '../utils';
import { OV, MOD, MH, BP, BC, BG, INP } from '../styles';
import DocumentView, { elementToPdfBase64, makePdfFilename } from './DocumentView';
import { db } from '../lib/supabase';
import { MAX_FILES, DIRECT_BUDGET, fmtSize, prepareAttachment, planAttachments, fileToBase64, uploadForLink } from '../lib/mailAttachments';

// 単会自身のメールアドレスを差出人として送信するGASウェブアプリ（未設定ならこの機能は表示しない）
// ※ from に単会メールを指定するには、事前に rinri.nanbu@gmail.com のGmail設定で
//    そのアドレスを「他のメールアドレスを追加（Send mail as）」として確認済みにしておく必要がある
//   （手順は gas/rinri_mail_send.gs 参照）
const MAIL_SEND_URL   = import.meta.env.VITE_MAIL_SEND_URL || '';
const MAIL_SEND_TOKEN = import.meta.env.VITE_MAIL_SEND_TOKEN || '';

export default memo(function EmailModal({ speaker: sp, defaultType, onClose, onDone, chapterSettings, showToast, onSaveSettings, scopeChapter }) {
  const ch = getChapter(sp.chapterId);
  const chSettings = chapterSettings?.[sp.chapterId] || {};
  const chEmail = chSettings.chapterEmail || '';
  const [mailType, setMailType] = useState(defaultType || "material");
  const [promoIdx, setPromoIdx] = useState(0);
  const [freeSubject, setFreeSubject] = useState("");
  const [freeBody,    setFreeBody]    = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  // フリーメール：単会ごとのテンプレート（単会設定 chapter_settings の mailTemplates に保存）と、写真・動画の添付
  const templates = useMemo(() => Array.isArray(chSettings.mailTemplates) ? chSettings.mailTemplates : [], [chSettings.mailTemplates]);
  // 単会のログインは自分の単会のテンプレートだけ編集できる。管理者（合同事務局）は全単会
  const canEditTemplates = !scopeChapter || scopeChapter === sp.chapterId;
  const [tplId, setTplId] = useState('');
  const [savingTplName, setSavingTplName] = useState(null); // null=名前入力欄は閉じている
  const [attachItems, setAttachItems] = useState([]);
  const [attachBusy, setAttachBusy] = useState(false);
  // 差出人として使えるアドレス（合同事務局のGmailに「他のメールアドレス」として登録済みのもの）。null=確認前／確認できない
  const [aliases, setAliases] = useState(null);
  useEffect(() => {
    if (!MAIL_SEND_URL || !MAIL_SEND_TOKEN || !chEmail) return;
    let cancelled = false;
    fetch(MAIL_SEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: MAIL_SEND_TOKEN, action: 'aliases' }) })
      .then(r => r.json()).then(d => { if (!cancelled && d?.ok && Array.isArray(d.aliases)) setAliases(d.aliases.map(a => String(a).toLowerCase())); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chEmail]);
  // true=単会アドレスで送れる／false=送れない（合同事務局から送り、返信先とCCを単会にする）／null=不明
  const canSendAsChapter = aliases ? aliases.includes(chEmail.toLowerCase()) : null;
  // 確認書送付メールでは、確認書（講師依頼確認書）をPDFにして自動で添付する。
  // PDFは確認書画面と同じ描画を画面外に置いて変換する（基礎講座・経営者の集い等は前夜分とMS分の2枚）。
  const [attachPdf, setAttachPdf] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const docMainRef = useRef(null);
  const docMsRef = useRef(null);

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

  // 【タグ】値 形式の自由記述メモから、確認書送付メールに再掲する項目を拾う
  const parsedNotes = useMemo(() => {
    if (!sp.notes) return {};
    const normalized = String(sp.notes).replace(/\\n/g, '\n');
    const result = {};
    const tagLine = /【([^】]+)】([^\n【]*)/g;
    let m;
    while ((m = tagLine.exec(normalized)) !== null) {
      if (m[1] !== '内容要約') result[m[1]] = m[2].trim();
    }
    return result;
  }, [sp.notes]);

  const isKiso = sp.seminarType === 'kiso';
  const isTsudoiType = sp.seminarType === 'tsudoi';
  // 前夜開催タイプ（基礎講座・経営者の集い）かどうかは一次情報(SEMINAR_TYPES.nextDayMs)を必ず参照する。
  // ここをisKisoだけで判定すると、経営者の集いの翌日MS情報が抜け落ちたり、
  // 単会の定例曜日（毎週◯曜日）が前夜の実際の曜日と食い違って表示される不具合になる。
  const hasNextDayMs = getHasNextDayMs(sp.seminarType);
  const kisoMsDateStr = useMemo(() => {
    if (!hasNextDayMs || !sp.seminarDate) return '';
    const [y, m, d] = sp.seminarDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }, [hasNextDayMs, sp.seminarDate]);
  const needsLodging = sp.lodging && sp.lodging !== '不要' && sp.lodging !== 'なし';
  const isMsType = !sp.seminarType || sp.seminarType === 'ms';
  const eventLabel = isKiso ? '倫理経営基礎講座' : isTsudoiType ? '経営者の集い' : isMsType ? 'モーニングセミナー' : getSeminarType(sp.seminarType).label;
  // 種別ごとの会場・開催時間テキスト。基礎講座・MS以外（経営者の集い・倫理経営講演会・
  // イブニング・自主企画）は開催ごとに会場・時間が変わるため、単会固定のMS会場に
  // フォールバックしてはならず、必ずその講師レコード自身のsp.venue/sp.eventTimeを使う。
  const eventVenue = isKiso
    ? (chSettings.kisoVenue || '')
    : isMsType
      ? (chSettings.msVenue || ch.venue)
      : (sp.venue || '');
  const eventAddress = isKiso
    ? (chSettings.kisoAddress || '')
    : isMsType
      ? (chSettings.msAddress || ch.address)
      : (sp.venue || '');
  const eventTimeText = isKiso
    ? (chSettings.kisoTime || ch.time || '')
    : isMsType
      ? `毎週${ch.dayName}　${ch.time}`
      : (sp.eventTime || '');

  const TEMPLATES = useMemo(() => ({
    confirm_doc: {
      label: "📋 確認書送付",
      subject: `【${ch.name}単会 ${eventLabel}】講師依頼確認書のご送付（${sp.speakerName || ''}様）`,
      body: (() => {
        const msVenue   = chSettings.msVenue   || ch.venue;
        const msAddress = chSettings.msAddress || ch.address;
        const msMapUrl  = chSettings.msMapUrl  || ch.mapUrl;
        const msTel     = chSettings.msVenueTel|| ch.venueTel;

        const venueBlock = isKiso ? `
【基礎講座 会場のご案内】
　開催日　：${formatDate(sp.seminarDate)}
　会　場　：${chSettings.kisoVenue || ''}
　住　所　：${chSettings.kisoAddress || ''}${chSettings.kisoMapUrl ? `\n　地図　　：${chSettings.kisoMapUrl}` : ''}

【翌日 モーニングセミナー 会場のご案内】
　開催日　：${formatDate(kisoMsDateStr)}
　会　場　：${msVenue}
　住　所　：${msAddress}${chSettings.msParking ? `\n　駐車場　：${chSettings.msParking}` : ''}${msMapUrl ? `\n　地図　　：${msMapUrl}` : ''}${msTel ? `\n　会場連絡先：${msTel}` : ''}` : hasNextDayMs ? `
【${eventLabel} 会場のご案内】
　開催日　：${formatDate(sp.seminarDate)}${sp.eventTime ? `（${sp.eventTime}）` : ''}
　会　場　：${sp.venue || ''}

【翌日 モーニングセミナー 会場のご案内】
　開催日　：${formatDate(kisoMsDateStr)}
　会　場　：${msVenue}
　住　所　：${msAddress}${chSettings.msParking ? `\n　駐車場　：${chSettings.msParking}` : ''}${msMapUrl ? `\n　地図　　：${msMapUrl}` : ''}${msTel ? `\n　会場連絡先：${msTel}` : ''}` : isMsType ? `
【会場のご案内】
　開催日　：${formatDate(sp.seminarDate)}（毎週${ch.dayName}　${ch.time}）
　会　場　：${msVenue}
　住　所　：${msAddress}${chSettings.msParking ? `\n　駐車場　：${chSettings.msParking}` : ''}${msMapUrl ? `\n　地図　　：${msMapUrl}` : ''}${msTel ? `\n　会場連絡先：${msTel}` : ''}` : `
【会場のご案内】
　開催日　：${formatDate(sp.seminarDate)}${sp.eventTime ? `（${sp.eventTime}）` : ''}
　会　場　：${sp.venue || ''}`;

        return `${sp.speakerName || ''} 様

お世話になっております。${ch.name}倫理法人会です。
講師依頼確認フォームへのご入力、誠にありがとうございました。
ご入力いただいた内容を確認書としてまとめました。一読くださいますようお願いいたします。${attachPdf && MAIL_SEND_URL ? '\n確認書（PDF）を添付しておりますので、あわせてご確認ください。' : ''}
${venueBlock}
${needsLodging ? '\n宿泊情報については追ってご連絡いたします。\n' : ''}
【当日の待ち合わせ場所確認について】
日程が近くなりましたら、お電話させて頂きます。

内容にお気づきの点がございましたら、本メールへご返信ください。
当日はどうぞよろしくお願いいたします。

${sig}`;
      })(),
    },
    material: {
      label: "📎 資料・写真の催促",
      subject: `【${ch.name}単会 ${eventLabel}】顔写真・講話資料のご送付のお願い`,
      body:
`${sp.speakerName} 様

いつもお世話になっております。${ch.name}単会 事務局です。

${formatDate(sp.seminarDate)}${eventTimeText ? `（${eventTimeText}）` : ''}にご登壇いただきますが、現在下記の資料がまだ届いておりません。

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
      subject: `【${ch.name}単会 ${eventLabel}】${formatDate(sp.seminarDate)} ${sp.speakerName}様 ご講話のご案内`,
      body: (() => {
        const intros = [
          `${eventLabel}にて、${sp.company ? `${sp.company}${sp.companyRole ? `　${sp.companyRole}` : ""}の` : ""}${sp.speakerName}様にご講話をいただきます。`,
          `${sp.speakerName}様をお迎えしてご講話をいただきます。`,
          `${sp.speakerName}様による講話のご案内です。`,
          `${sp.speakerName}様をお招きし、貴重なお話を伺います。`,
          `${sp.speakerName}様にご登壇いただきます。`,
          `今回の${eventLabel}は${sp.speakerName}様の講話です。`,
          `${sp.speakerName}様から学びの時間をいただきます。`,
          `${sp.speakerName}様のご講話をお届けします。`,
          `${sp.speakerName}様にお越しいただきます。`,
          `${sp.speakerName}様の特別講話のご案内です。`,
        ];
        const appeals = [
          `経営や日々の生き方にすぐ活かせる学びが詰まった講話です。ぜひご参加ください。`,
          `実践に直結するヒントが満載です。お誘い合わせの上、ぜひお越しください。`,
          `明日からの仕事と人生が変わるきっかけになるかもしれません。お聴き逃しなく。`,
          `ここでしか聴けない貴重なお話です。ぜひ足をお運びください。`,
          `朝の1時間が、あなたの一日を大きく変えます。奮ってご参加ください。`,
          `きっと新しい気づきと出会える朝になります。皆様のお越しをお待ちしております。`,
          `経営者として、人として、深い学びが得られる機会です。お聴き逃しなく。`,
          `心に響くお話を、ぜひ一緒に聴きませんか？ご参加お待ちしております。`,
          `仲間と共に学ぶ朝のひとときが、最高のスタートになります。ぜひどうぞ。`,
          `聴いた方の心が動く、そんな講話になること間違いなしです。ぜひお越しください。`,
        ];
        const pi = promoIdx % intros.length;
        const affiliation = [sp.speakerUnit, sp.role].filter(Boolean).join("　");
        return `各位

いつもお世話になっております。${ch.name}単会 事務局です。

${appeals[pi]}

┏━━━━━━━━━━━━━━━━━┓
　演題「${sp.topic || '（未定）'}」
┗━━━━━━━━━━━━━━━━━┛
${summary ? `\n【講話内容】\n${summary}\n` : ''}${photoBlock}
🎤 ${sp.speakerName} 様${sp.company ? `（${sp.company}${sp.companyRole ? `　${sp.companyRole}` : ""}）` : ""}${affiliation ? `\n（倫理法人会：${affiliation}）` : ""}
${intros[pi]}

【開催日時】${formatDate(sp.seminarDate)}${eventTimeText ? `（${eventTimeText}）` : ''}
【会　　場】${eventVenue}
【住　　所】${eventAddress}

皆様のご参加を心よりお待ちしております。

${sig}`;
      })(),
    },
    reminder: {
      label: "🔔 前日リマインダー",
      subject: `【${ch.name}単会 ${eventLabel}】明日のご講話について`,
      body:
`${sp.speakerName} 様

明日、${ch.name}単会 ${eventLabel}にてご講話をいただきます。
どうぞよろしくお願いいたします。

【開催日時】${formatDate(sp.seminarDate)}${eventTimeText ? `　${eventTimeText}` : ''}
【会　　場】${eventVenue}
【住　　所】${eventAddress}

${isMsType ? '開始の15分前（5:45頃）にお越しいただけますと幸いです。' : '開始時間の15分前にはお越しいただけますと幸いです。'}
ご不明な点がございましたら、お気軽にご連絡ください。

お忙しいところ恐れ入りますが、明日のご登壇をどうぞよろしくお願いいたします。

${sig}`,
    },
    thanks: {
      label: "🙏 講話後お礼",
      subject: `【${ch.name}単会 ${eventLabel}】ご講話のお礼`,
      body:
`${sp.speakerName} 様

先日は、${ch.name}単会 ${eventLabel}にてご講話をいただき、誠にありがとうございました。

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
  }), [sp.speakerName, sp.seminarDate, sp.topic, sp.company, sp.companyRole, sp.speakerUnit, sp.role, sp.lodging, sp.seminarType, sp.venue, sp.eventTime, ch, chSettings, matDL, sig, summary, photoBlock, promoIdx, parsedNotes, isKiso, isTsudoiType, needsLodging, kisoMsDateStr, eventLabel, isMsType, eventVenue, eventAddress, eventTimeText, attachPdf]);

  const isFree  = mailType === "free";
  // フリーメールの差し込み：{講師名} {日付} {単会名} {講話テーマ} を、この講師の情報に置き換える
  const expandVars = (t) => String(t || '')
    .replace(/\{講師名\}/g, sp.speakerName || '')
    .replace(/\{日付\}/g, formatDate(sp.seminarDate))
    .replace(/\{単会名\}/g, ch.name || '')
    .replace(/\{講話テーマ\}/g, sp.topic || '');
  const subject = isFree ? expandVars(freeSubject) : TEMPLATES[mailType].subject;
  const body    = isFree ? expandVars(freeBody)    : TEMPLATES[mailType].body;

  const applyTemplate = (id) => {
    const t = templates.find(x => x.id === id);
    if (!t) { setTplId(''); return; }
    if ((freeSubject.trim() || freeBody.trim()) && !window.confirm('今の入力内容は、テンプレートの内容に置き換わります。よろしいですか？')) return;
    setTplId(id); setFreeSubject(t.subject || ''); setFreeBody(t.body || '');
  };
  const saveTemplate = (name) => {
    const n = (name || '').trim();
    if (!n) return;
    if (!freeSubject.trim() && !freeBody.trim()) { showToast?.('⚠ 件名か本文を入力してから保存してください'); return; }
    const exist = templates.find(t => t.name === n);
    if (!exist && templates.length >= 30) { showToast?.('⚠ テンプレートは30件までです。不要なものを削除してください'); return; }
    if (exist && !window.confirm(`テンプレート「${n}」を、今の内容で上書きします。よろしいですか？`)) return;
    const id = exist ? exist.id : 't' + Date.now().toString(36);
    const next = exist ? templates.map(t => t.id === id ? { ...t, subject: freeSubject, body: freeBody } : t)
                       : [...templates, { id, name: n, subject: freeSubject, body: freeBody }];
    onSaveSettings?.(sp.chapterId, { ...chSettings, mailTemplates: next });
    setTplId(id); setSavingTplName(null);
  };
  const deleteTemplate = () => {
    const t = templates.find(x => x.id === tplId);
    if (!t || !window.confirm(`テンプレート「${t.name}」を削除します。よろしいですか？`)) return;
    onSaveSettings?.(sp.chapterId, { ...chSettings, mailTemplates: templates.filter(x => x.id !== tplId) });
    setTplId('');
  };
  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = Math.max(0, MAX_FILES - attachItems.length);
    if (files.length > room) showToast?.(`⚠ 写真・動画は${MAX_FILES}つまでです（${files.length - room}つは追加しませんでした）`);
    setAttachBusy(true);
    const added = [];
    for (const f of files.slice(0, room)) {
      try { added.push(await prepareAttachment(f)); } catch (err) { showToast?.('⚠ ' + err.message); }
    }
    setAttachItems(prev => [...prev, ...added].slice(0, MAX_FILES));
    setAttachBusy(false);
  };
  const attachPlan = useMemo(() => planAttachments(attachItems), [attachItems]);

  const wantPdf = !!MAIL_SEND_URL && attachPdf && mailType === 'confirm_doc';

  // 単会自身のメールアドレスを差出人としてGAS経由で送信する
  const doSendViaChapter = useCallback(async () => {
    setSending(true);
    try {
      let attachments;
      if (wantPdf) {
        attachments = [];
        const main = docMainRef.current?.querySelector('#print-doc');
        const mainB64 = await elementToPdfBase64(main);
        if (!mainB64) throw new Error('確認書PDFの作成に失敗しました');
        attachments.push({ base64: mainB64, filename: makePdfFilename(sp, hasNextDayMs ? '_前夜' : ''), mimeType: 'application/pdf' });
        if (hasNextDayMs) {
          const msB64 = await elementToPdfBase64(docMsRef.current?.querySelector('#print-doc-ms'));
          if (!msB64) throw new Error('確認書(MS)PDFの作成に失敗しました');
          attachments.push({ base64: msB64, filename: makePdfFilename(sp, '_MS'), mimeType: 'application/pdf' });
        }
      }
      // フリーメールの写真・動画：メールに収まるものは添付、大きな動画は保存先にあげてリンクを本文に入れる
      let sendBody = body;
      if (isFree && attachItems.length) {
        const plan = planAttachments(attachItems);
        attachments = attachments || [];
        for (const it of plan.direct) {
          attachments.push({ base64: await fileToBase64(it.file), filename: it.name, mimeType: it.file.type || (it.kind === 'image' ? 'image/jpeg' : 'video/mp4') });
        }
        if (plan.link.length) {
          const lines = [];
          for (const it of plan.link) lines.push(`・${it.name}（${fmtSize(it.size)}）\n  ${await uploadForLink(db, it, sp.chapterId, sp.seminarDate)}`);
          sendBody = `${body}\n\n▼ 動画など大きなファイルは、下記のリンクからご覧・ダウンロードいただけます。\n${lines.join('\n')}`;
        }
      }
      const res = await fetch(MAIL_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          token: MAIL_SEND_TOKEN, to: sp.email, cc: chEmail,
          subject, body: sendBody, from: chEmail, senderName: `倫理法人会 ${ch.name}単会`,
          ...(attachments ? { attachments } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      showToast?.(data.sentAs === 'office'
        ? `合同事務局のアドレスから送信しました（返信先・CC：${ch.name}単会）✓`
        : `${ch.name}単会から送信しました ✓`);
      onDone();
    } catch (e) {
      showToast?.('⚠ 送信に失敗しました: ' + (e.message || ''));
    } finally {
      setSending(false);
      setConfirmingSend(false);
    }
  }, [sp, chEmail, subject, body, ch.name, showToast, onDone, wantPdf, hasNextDayMs, isFree, attachItems]);

  // 誤送信防止のため、送信ボタンを押すと上の件名・本文を表示したまま
  // その場で「本当に送信するか」を尋ねる（内容を隠さない）
  const sendViaChapter = useCallback(() => {
    if (!sp.email) { showToast?.('⚠ 講師のメールアドレスが未入力です'); return; }
    setConfirmingSend(true);
  }, [sp.email, showToast]);

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
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
          <select style={{ ...INP, flex:1, fontSize:"clamp(12px,1.4vw,14px)" }} value={mailType} onChange={e => setMailType(e.target.value)}>
            {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {mailType === "promo" && (
            <button style={{ background:"#F5F5F5", color:"#37474F", border:"1px solid #D0D7E2", borderRadius:6, padding:"7px 12px", fontSize:"clamp(11px,1.3vw,13px)", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}
              onClick={() => setPromoIdx(i => i + 1)}>
              🔄 {(promoIdx % 10) + 1}/10
            </button>
          )}
        </div>

        {isFree && (
          <div style={{ border:"1px solid #D0D7E2", background:"#F8FAFF", borderRadius:8, padding:"9px 11px", marginBottom:10 }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", fontWeight:700, marginBottom:6 }}>📑 {ch.name}単会のテンプレート</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
              <select style={{ ...INP, flex:"1 1 180px", fontSize:"clamp(12px,1.4vw,14px)" }} value={tplId} onChange={e => applyTemplate(e.target.value)}>
                <option value="">{templates.length ? '（テンプレートを選ぶ）' : '（保存済みのテンプレートはありません）'}</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {canEditTemplates && savingTplName === null && (
                <button style={{ ...BC, whiteSpace:"nowrap" }} onClick={() => setSavingTplName(templates.find(t => t.id === tplId)?.name || '')}>💾 今の内容を保存</button>
              )}
              {canEditTemplates && tplId && savingTplName === null && (
                <button style={{ ...BC, whiteSpace:"nowrap", color:"#B71C1C" }} onClick={deleteTemplate}>🗑 削除</button>
              )}
            </div>
            {canEditTemplates && savingTplName !== null && (
              <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                <input style={{ ...INP, flex:"1 1 180px", fontSize:"clamp(12px,1.4vw,14px)" }} placeholder="テンプレートの名前（例：講話後のお礼）" value={savingTplName} onChange={e => setSavingTplName(e.target.value)} autoFocus />
                <button style={{ ...BP, whiteSpace:"nowrap" }} disabled={!savingTplName.trim()} onClick={() => saveTemplate(savingTplName)}>保存する</button>
                <button style={{ ...BC, whiteSpace:"nowrap" }} onClick={() => setSavingTplName(null)}>やめる</button>
              </div>
            )}
            {!canEditTemplates && <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#98A2B3", marginTop:6 }}>※ ログイン中の単会以外のテンプレートは、選ぶだけで、保存・削除はできません。</div>}
            <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#78909C", marginTop:6, lineHeight:1.6 }}>
              差し込み：<code>{'{講師名}'}</code> <code>{'{日付}'}</code> <code>{'{単会名}'}</code> <code>{'{講話テーマ}'}</code>（送るとき、この講師の情報に置き換わります）
            </div>
          </div>
        )}

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

        {isFree && /\{(講師名|日付|単会名|講話テーマ)\}/.test(freeSubject + freeBody) && (
          <div style={{ marginTop:8, border:"1px dashed #B0BEC5", borderRadius:8, padding:"8px 10px", background:"#FAFAFA" }}>
            <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#78909C", fontWeight:700, marginBottom:4 }}>👁 実際に送られる内容（差し込み後）</div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, marginBottom:4 }}>{subject}</div>
            <pre style={{ margin:0, fontSize:"clamp(12px,1.4vw,14px)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{body}</pre>
          </div>
        )}

        {isFree && (
          <div style={{ marginTop:10, border:"1px solid #D0D7E2", borderRadius:8, padding:"9px 11px" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", fontWeight:700, marginBottom:6 }}>📷 講話の様子の写真・動画（{MAX_FILES}つまで）</div>
            {!(MAIL_SEND_URL && chEmail) ? (
              <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#B71C1C" }}>⚠ 添付つきで送るには、{ch.name}単会のメールアドレスを設定画面で登録してください。</div>
            ) : (
              <>
                <input type="file" multiple accept="image/*,video/*" disabled={attachBusy || attachItems.length >= MAX_FILES} onChange={onPickFiles}
                  style={{ fontSize:"clamp(12px,1.4vw,14px)" }} />
                {attachBusy && <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#5C35CC", marginTop:4 }}>⏳ 読み込み中...</div>}
                {attachItems.map(it => {
                  const viaLink = attachPlan.link.some(l => l.id === it.id);
                  return (
                    <div key={it.id} style={{ display:"flex", gap:8, alignItems:"center", marginTop:6, fontSize:"clamp(12px,1.4vw,14px)" }}>
                      <span>{it.kind === 'image' ? '🖼' : '🎬'}</span>
                      <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
                      <span style={{ color:"#78909C" }}>{fmtSize(it.size)}</span>
                      <span style={{ color: viaLink ? "#E65100" : "#2E7D32", fontWeight:700, whiteSpace:"nowrap" }}>{viaLink ? 'リンクで共有' : 'メールに添付'}</span>
                      <button style={{ ...BC, padding:"2px 8px" }} onClick={() => setAttachItems(prev => prev.filter(x => x.id !== it.id))}>✕</button>
                    </div>
                  );
                })}
                <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#78909C", marginTop:6, lineHeight:1.6 }}>
                  写真は自動で縮小して添付します。動画は、メールに付けられる合計 {fmtSize(DIRECT_BUDGET)} までは添付し、それを超えるものは、ダウンロード用リンクを本文に入れて送ります（50MBまで）。
                  {attachPlan.link.length > 0 && <div style={{ color:"#E65100", marginTop:2 }}>※ リンクは、URLを知っている人なら誰でも見られます。送る相手以外には共有しないでください。</div>}
                  <div>※ 添付は、下の「直接送信」で送るときだけ付きます（メールアプリで開く・コピーでは付きません）。</div>
                </div>
              </>
            )}
          </div>
        )}

        {mailType === 'confirm_doc' && MAIL_SEND_URL && (
          <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", cursor:"pointer" }}>
            <input type="checkbox" checked={attachPdf} onChange={e => setAttachPdf(e.target.checked)} />
            📎 確認書をPDFで添付して送る{hasNextDayMs ? '（前夜分・MS分の2枚）' : ''}
            <span style={{ fontSize:"clamp(11px,1.2vw,12px)", color:"#98A2B3" }}>※「直接送信」のとき自動添付</span>
          </label>
        )}
        {wantPdf && (
          <div aria-hidden="true" style={{ position:"fixed", left:-12000, top:0, width:900, pointerEvents:"none" }}>
            <div ref={docMainRef}>
              <DocumentView speakers={[sp]} docSpeaker={{ ...sp, _virtualType: undefined }} setDocSpeaker={() => {}} today={new Date()} chapterSettings={chapterSettings} showToast={() => {}} />
            </div>
            {hasNextDayMs && (
              <div ref={docMsRef}>
                <DocumentView speakers={[sp]} docSpeaker={{ ...sp, _virtualType: 'ms' }} setDocSpeaker={() => {}} today={new Date()} chapterSettings={chapterSettings} showToast={() => {}} />
              </div>
            )}
          </div>
        )}

        {chEmail && (
          <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#78909C", marginTop:8 }}>
            {!MAIL_SEND_URL ? <>CC：{chEmail}（{ch.name}単会）</>
              : canSendAsChapter === false ? <>差出人：<strong style={{ color:"#E65100" }}>南部地区合同事務局（rinri.nanbu@gmail.com）</strong>　返信先・CC：{ch.name}単会（{chEmail}）<div style={{ color:"#E65100", marginTop:2 }}>※ {chEmail} は差出人として登録されていないため、合同事務局のアドレスから送ります。講師の返信は{ch.name}単会に届きます。</div></>
              : canSendAsChapter === true ? <>差出人：<strong style={{ color:"#2E7D32" }}>{ch.name}単会（{chEmail}）</strong>　CC：{chEmail}</>
              : <>差出人：{ch.name}単会（{chEmail}）　CC：{chEmail}<div style={{ marginTop:2 }}>※ {chEmail} が差出人として登録されていない場合は、合同事務局のアドレスから送り、返信先とCCを{ch.name}単会にします。</div></>}
          </div>
        )}

        {MAIL_SEND_URL && chEmail ? (
          confirmingSend ? (
            <div style={{ marginTop:10, background:"#FFF3E0", border:"1px solid #FFB74D", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:"clamp(12px,1.6vw,15px)", fontWeight:700, color:"#7A4A00", marginBottom:8 }}>
                {canSendAsChapter === false
                  ? <>↑ 上の件名・本文の内容で、合同事務局のアドレスから送信します（返信先・CC：{ch.name}単会）。よろしいですか？</>
                  : <>↑ 上の件名・本文の内容で、{ch.name}単会（{chEmail}）から送信します。よろしいですか？</>}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ flex:1, background:"#fff", color:"#7A4A00", border:"1px solid #FFB74D", borderRadius:8, padding:"10px", fontSize:"clamp(12px,1.6vw,15px)", fontWeight:700, cursor:"pointer" }}
                  onClick={() => setConfirmingSend(false)} disabled={sending}>キャンセル</button>
                <button style={{ flex:1, background: sending ? "#B39DDB" : "#2E7D32", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:"clamp(12px,1.6vw,15px)", fontWeight:800, cursor: sending ? "not-allowed" : "pointer" }}
                  onClick={doSendViaChapter} disabled={sending}>{sending ? '⏳ 送信中...' : '✓ 送信する'}</button>
              </div>
            </div>
          ) : (
            <button
              style={{ width:"100%", marginTop:10, background:"#2E7D32", color:"#fff", border:"none", borderRadius:8, padding:"13px", fontSize:"clamp(13px,1.8vw,16px)", fontWeight:800, cursor: !sp.email ? "not-allowed" : "pointer", opacity: sp.email ? 1 : .5 }}
              onClick={sendViaChapter} disabled={!sp.email}>
              {canSendAsChapter === false ? <>✉ 合同事務局から送信（返信先・CC：{ch.name}単会）</> : <>✉ {ch.name}単会（{chEmail}）から直接送信</>}
            </button>
          )
        ) : (
          <div style={{ background:"#FFF3E0", border:"1px solid #FFB74D", borderRadius:8, padding:"9px 12px", marginTop:10, fontSize:"clamp(11px,1.3vw,13px)", color:"#7A4A00", lineHeight:1.6 }}>
            ⚠ 送信元アカウントの確認：メールアプリが開いたら、差出人（From）が
            {chEmail ? <> <strong>{chEmail}（{ch.name}単会）</strong> </> : <> <strong>{ch.name}単会のメールアドレス</strong> </>}
            になっているか必ず確認し、違う場合は送信前にアカウントを切り替えてください。（自分個人のアドレスのまま送信してしまう事故を防ぐためです）
            {!chEmail && <div style={{ marginTop:4 }}>※ {ch.name}単会のメールアドレスが未設定です。設定画面から登録してください。</div>}
          </div>
        )}

        {MAIL_SEND_URL && chEmail ? (
          <>
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button style={{ ...BC, flex:1 }} onClick={() => setShowOther(v => !v)}>{showOther ? "▲ 他の送り方を閉じる" : "▼ 他の送り方（メールアプリ・コピー）"}</button>
              <button style={BC} onClick={onClose}>閉じる</button>
            </div>
            {showOther && (
              <div style={{ marginTop:8, border:"1px solid #EF9A9A", background:"#FFF5F5", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:"clamp(11px,1.3vw,13px)", color:"#B71C1C", lineHeight:1.6, marginBottom:8 }}>
                  ⚠ メールアプリで開くと、<strong>このパソコンの標準アカウント（個人のアドレス等）</strong>から送信されます。{ch.name}単会からは送られません。通常は上の送信ボタンをお使いください。
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ ...BC, flex:1, opacity: sp.email ? 1 : .4 }} disabled={!sp.email} onClick={() => { window.open(`mailto:${sp.email}?${chEmail ? `cc=${encodeURIComponent(chEmail)}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank"); onDone(); }}>✉ メールアプリで開く（このパソコンのアカウント）</button>
                  <button style={{ ...BC, flex:1 }} onClick={() => { navigator.clipboard?.writeText(`件名：${subject}\n\n${body}`).catch(() => {}); onDone(); }}>📋 コピーして手動送信</button>
                </div>
              </div>
            )}
          </>
        ) : (
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button style={{ ...BG, flex:1, opacity: sp.email ? 1 : .4, cursor: sp.email ? "pointer" : "not-allowed" }} disabled={!sp.email} onClick={() => { window.open(`mailto:${sp.email}?${chEmail ? `cc=${encodeURIComponent(chEmail)}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank"); onDone(); }}>✉ メールアプリで開く</button>
          <button style={{ ...BG, flex:1 }} onClick={() => { navigator.clipboard?.writeText(`件名：${subject}\n\n${body}`).catch(() => {}); onDone(); }}>📋 コピーして手動送信</button>
          <button style={BC} onClick={onClose}>閉じる</button>
        </div>
        )}
      </div>
    </div>
  );
});
