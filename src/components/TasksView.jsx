import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { CHAPTERS, ALL_CHAPTER, DISTRICT_ID } from '../constants';
import { getChapter, parseDate } from '../utils';
import { db } from '../lib/supabase';
import { CARD, BP, BSM, SEL, INP, TBL, TH, TD, PILL } from '../styles';

const PRIO = { high:{ label:"高", bg:"#FFEBEE", color:"#C62828" }, medium:{ label:"中", bg:"#FFF8E1", color:"#F57F17" }, low:{ label:"低", bg:"#E8F5E9", color:"#2E7D32" } };

// ─── Gmail OAuth2 定数 ───────────────────────────────────────────
const GMAIL_CLIENT_ID = '181247594167-n0fb727pkc3v0hsch52vmedoed4jt43r.apps.googleusercontent.com';
const GMAIL_REDIRECT_URI = 'https://nanbuchiku.github.io/nanbu-chiku-jimu-app/';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

const COMMITTEES = [
  '広報委員','キャリア委員','イメージ向上委員',
  'モーニングセミナー委員','研修委員','朝礼委員',
  '女性委員','青年委員','後継者倫理塾委員',
];

// ─── Gmail ヘルパー関数 ──────────────────────────────────────────
function decodeBase64Url(b64) {
  if (!b64) return '';
  try {
    const b64std = b64.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64std), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return b64; }
}

function findTextPlain(payload) {
  if (!payload) return null;
  if (payload.mimeType === 'text/plain' && payload.body?.data) return payload.body.data;
  if (payload.parts) {
    for (const part of payload.parts) {
      const found = findTextPlain(part);
      if (found) return found;
    }
  }
  // HTML フォールバック
  if (payload.mimeType === 'text/html' && payload.body?.data) return payload.body.data;
  return null;
}

function findAttachments(payload, list = []) {
  if (!payload) return list;
  if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId) {
    list.push({
      filename: payload.filename,
      mimeType: payload.mimeType || 'application/octet-stream',
      attachmentId: payload.body.attachmentId,
      size: payload.body.size || 0,
    });
  }
  if (payload.parts) {
    for (const part of payload.parts) findAttachments(part, list);
  }
  return list;
}

function parseTokenFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.includes('access_token')) return null;
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  if (!token) return null;
  return { token, expiresAt: Date.now() + expiresIn * 1000 };
}

function getStoredToken() {
  const token = sessionStorage.getItem('gmail_token');
  const exp = sessionStorage.getItem('gmail_token_exp');
  if (token && exp && Date.now() < parseInt(exp, 10)) return token;
  return null;
}

// ─── メール本文から「意味のあるURL」を抽出（署名・団体サイトのトップは除外）───
// 調整さん・各種入力フォーム等の「入力用URL」を優先的に拾う。
function pickRelatedUrl(body) {
  let raw = (body || '').slice(0, 12000);
  // ★ <...> で囲まれたURLは長いと途中で改行されることがある。
  //   角括弧内の空白・改行を除去してURLを復元する（途中で切れたリンク対策）。
  raw = raw.replace(/<\s*(https?:\/\/[\s\S]*?)>/g, (m, u) => '<' + u.replace(/\s+/g, '') + '>');
  const stripTail = u => u.replace(/[.,。、）)＞>]+$/, '');
  const URL_TOKEN = 'https?:\\/\\/[^\\s\\n　）)＞>「」]{10,400}';
  const URL_EXCLUDE = [
    'rinri-saitama.org',   // 県連の一般サイト（署名に毎回入る）
    'rinri.or.jp',         // 倫理研究所サイト
    'www.rinri',
  ];
  // 入力/回答/予定調整に使われる代表的なサービス（優先的に採用）
  const FORM_HINTS = [
    'chouseisan.com',        // 調整さん
    'forms.gle', 'docs.google.com/forms', 'forms.google',  // Googleフォーム
    'forms.office.com', 'forms.microsoft.com', 'sharepoint.com',  // Microsoftフォーム/共有
    'questant.jp', 'surveymonkey', 'formrun.io', 'form.run',
    'creator.zoho', 'kutu.jp', 'select-type.com', 'forms.', '/forms/',
    'airrsv.net', 'tayori.com', 'shutto', 'logoform.jp',
  ];
  const cands = (raw.match(new RegExp(URL_TOKEN, 'g')) || [])
    .map(stripTail)
    .filter(u => {
      const host = (u.replace(/^https?:\/\//, '').split(/[/?#]/)[0] || '').toLowerCase();
      const path = u.replace(/^https?:\/\/[^/]+/, '');
      const isExcludedHost = URL_EXCLUDE.some(d => host.includes(d));
      if (isExcludedHost && path.replace(/\/$/, '').length < 2) return false;
      return true;
    });
  if (!cands.length) return '';
  // ⓪ 「南部地区」とセットで現れるURLを最優先
  //   地区ごとにURLが並ぶメール（南部地区/中部地区/西部地区…）で南部地区のものだけ拾う。
  //   まず【南部地区…】の見出し直後を探し、無ければ素の「南部地区」の直後を探す。
  let nd = raw.match(new RegExp('【\\s*南部地区[^】]*】[\\s\\S]{0,120}?(' + URL_TOKEN + ')'));
  if (!nd) nd = raw.match(new RegExp('南部地区[\\s\\S]{0,120}?(' + URL_TOKEN + ')'));
  if (nd) {
    const u = stripTail(nd[1]);
    if (u) return u;
  }
  // ① フォーム系URLを最優先
  const formUrl = cands.find(u => { const l = u.toLowerCase(); return FORM_HINTS.some(h => l.includes(h)); });
  if (formUrl) return formUrl;
  // ② 「入力」「回答」「フォーム」「調整」等のラベル行にあるURLを次点で優先
  const labeledLine = raw.split('\n').find(line =>
    /(入力|回答|申込|申し込み|登録|フォーム|アンケート|調整|提出)/.test(line) && /https?:\/\//.test(line)
  );
  if (labeledLine) {
    const m = labeledLine.match(new RegExp(URL_TOKEN));
    if (m) {
      const u = stripTail(m[0]);
      if (cands.includes(u)) return u;
    }
  }
  // ③ それ以外は最初の非除外URL
  return cands[0];
}

// ─── メール要約（パターン抽出） ─────────────────────────────────
function extractEmailSummary(subject, body) {
  const raw = (body || '').slice(0, 8000); // 長すぎる本文は安全のため制限
  const bullets = [];

  // ── ① ラベル付き項目を「元の本文」から直接抽出（挨拶・署名削除の影響を受けない）──
  // 全角/半角コロン・スペース区切りに対応。同じラベルが複数行あれば結合（例: 場所が会場名＋住所の2行）
  const grabLabeled = (labels) => {
    const results = [];
    const labelAlt = labels.join('|');
    const re = new RegExp(`(?:^|\\n)[ \\t　]*(?:${labelAlt})[ \\t　]*[：:][ \\t　]*([^\\n]{1,50})`, 'g');
    let m;
    while ((m = re.exec(raw)) !== null) {
      const v = m[1].trim().replace(/[。、]$/, '');
      if (v && !results.includes(v)) results.push(v);
    }
    return results;
  };

  // 📌 何を（件名を整形）
  const cleanSubject = subject.replace(/【[^】]*】/g, '').replace(/Re:|Fw:/gi, '').trim();
  if (cleanSubject) bullets.push(`📌 何を: ${cleanSubject}`);

  // 締切に使われている日付を収集（「いつ」と区別するため）
  const deadlineDateSet = new Set();
  const subjSlashDL = subject.match(/(\d{1,2})\/(\d{1,2})(?:締切|迄|まで)/);
  if (subjSlashDL) deadlineDateSet.add(`${subjSlashDL[1]}月${subjSlashDL[2]}日`);
  const dlBodyRe = /(\d{1,2}月\d{1,2}日)[^\n]{0,15}?(?:まで|迄|締切|期限|ご回答|ご連絡|返信)/g;
  let dlm;
  while ((dlm = dlBodyRe.exec(subject + '\n' + raw)) !== null) deadlineDateSet.add(dlm[1]);

  // 📅 いつ（日時ラベル優先 → なければ日付パターン）
  const dtLabeled = grabLabeled(['日時', '開催日時', '開催日', '日程', '期日']);
  // 締切日と被るものは除外
  const dtFiltered = dtLabeled.filter(d => {
    const base = d.match(/\d{1,2}月\d{1,2}日/)?.[0];
    return !base || !deadlineDateSet.has(base);
  });
  if (dtFiltered.length) {
    bullets.push(`📅 いつ: ${dtFiltered.slice(0, 2).join('・')}`);
  } else {
    const dateRe = /(?:令和|R)\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日(?:\s*[\(（][月火水木金土日][\)）])?(?:\s*\d+[:：]\d+(?:\s*[〜～~]\s*\d+[:：]\d+)?)?|\d{1,2}月\d{1,2}日(?:\s*[\(（][月火水木金土日][\)）])?(?:\s*\d+[:：]\d+(?:\s*[〜～~]\s*\d+[:：]\d+)?)?/g;
    const allDates = [...new Set((raw.match(dateRe) || []).map(d => d.trim()))];
    const eventDates = allDates.filter(d => {
      const base = d.match(/\d{1,2}月\d{1,2}日/)?.[0];
      return base && !deadlineDateSet.has(base);
    });
    if (eventDates.length) bullets.push(`📅 いつ: ${eventDates.slice(0, 2).join('・')}`);
  }

  // 📍 どこで（場所・会場ラベル優先 → なければ施設名パターン）
  const placeLabeled = grabLabeled(['場所', '会場', '開催場所', '開催会場', '開催地', '住所']);
  if (placeLabeled.length) {
    bullets.push(`📍 どこで: ${placeLabeled.slice(0, 2).join(' / ')}`);
  } else {
    const venueName = raw.match(/([^\n　]{2,20}?(?:会館|ホール|センター|会議室|ビル|ホテル|公民館|研修室|倫理会館|コミュニティ)[^\n。、]{0,10})/);
    if (venueName) bullets.push(`📍 どこで: ${venueName[1].trim()}`);
  }

  // 💰 会費・参加費
  const feeLabeled = grabLabeled(['会費', '参加費', '費用', '参加費用', '受講料', '料金']);
  if (feeLabeled.length) bullets.push(`💰 会費: ${feeLabeled[0]}`);

  // ☎ 連絡先（電話）
  const telLabeled = grabLabeled(['電話', 'TEL', 'Tel', '連絡先', 'お問合せ', 'お問い合わせ']);
  if (telLabeled.length) bullets.push(`☎ 連絡先: ${telLabeled[0]}`);

  // 👥 対象者
  const targetLabeled = grabLabeled(['対象', '対象者', '参加対象', 'ご参加対象', '対象単会']);
  if (targetLabeled.length) {
    bullets.push(`👥 対象: ${targetLabeled[0]}`);
  } else {
    const toMatch = raw.match(/^([^\n]{2,25}?(?:の皆様|事務局長|会長|委員長|担当者))/m);
    if (toMatch) bullets.push(`👥 対象: ${toMatch[1].replace(/様$/, '').trim()}`);
  }

  // ⚡ 締め切り・回答期限
  const dlLabeled = grabLabeled(['締切', '締め切り', '〆切', '申込締切', '回答期限', '提出期限', '申込期限']);
  if (dlLabeled.length) {
    bullets.push(`⚡ 締切: ${dlLabeled[0]}`);
  } else {
    const dlMatch = raw.match(/(?:締め?切[りり]?|〆切|回答期限|期日|ご回答|ご返信)[：:は　\s]*([^\n。、]{3,25})/);
    if (dlMatch) bullets.push(`⚡ 締切: ${dlMatch[1].trim()}`);
  }

  // 🔗 フォーム・URL（署名・フッターの団体サイト等は除外し、意味のあるURLのみ）
  const relatedUrl = pickRelatedUrl(raw);
  if (relatedUrl) bullets.push(`🔗 URL: ${relatedUrl}`);

  // 🎯 目的（案内文の主要行）─ 挨拶・締切行を除いた最初の要点
  if (bullets.length < 4) {
    let text = raw;
    text = text.replace(/^[^\n]*(?:皆様|事務局|いつも|お世話)[^\n]*\n?/gm, '');
    text = text.replace(/お世話になっております。?\n?/g, '');
    text = text.replace(/平素より.*?申し上げます。?\n?/g, '');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 8 && l.length < 120);
    const isDeadlineLine = l => /まで|迄|締切|期限|期日|ご回答期限/.test(l);
    const keyLine = lines.find(l =>
      /ご案内|開催|実施|募集|確認のお願い|お知らせ|ご依頼|ご参加|お申込み|入力/.test(l) && !isDeadlineLine(l)
    );
    if (keyLine) bullets.push(`🎯 目的: ${keyLine.replace(/。$/, '').trim()}`);
  }

  // 📝 ほとんど取れなかった場合のフォールバック
  if (bullets.length <= 1) {
    let text = (body || '').replace(/^[^\n]*(?:皆様|事務局|いつも|お世話)[^\n]*\n?/gm, '').replace(/\n{2,}/g, '\n').trim();
    const shortBody = text.slice(0, 150).replace(/\n/g, ' ').trim();
    if (shortBody) bullets.push(`📝 内容: ${shortBody}${text.length > 150 ? '…' : ''}`);
  }

  return bullets.length >= 1 ? bullets.join('\n') : '（要約できませんでした）';
}

// ─── GmailInbox コンポーネント ─────────────────────────────────
function GmailInbox({ today, showToast, onAddTaskDirect, onAddTaskBatchDirect, lockChapterId }) {
  const [open,       setOpen]       = useState(true);
  const [token,      setToken]      = useState(() => getStoredToken());
  const [keyword,    setKeyword]    = useState('');
  const [committee,  setCommittee]  = useState('');
  const [emails,     setEmails]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [details,    setDetails]    = useState({});   // id → { body, attachments }
  const [detLoading, setDetLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [summaries,  setSummaries]  = useState({});   // id → 要約テキスト
  const [copied,     setCopied]     = useState('');
  const [taskForms,  setTaskForms]  = useState({});   // id → { open, title, dueDate, priority, chapterId }
  const [taskAdding, setTaskAdding] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [period,     setPeriod]     = useState(28);   // 抽出期間（日数）

  // ① OAuthリダイレクト後にURLハッシュからトークンを取得
  useEffect(() => {
    const parsed = parseTokenFromHash();
    if (parsed) {
      sessionStorage.setItem('gmail_token',     parsed.token);
      sessionStorage.setItem('gmail_token_exp', String(parsed.expiresAt));
      setToken(parsed.token);
      // URLのハッシュをクリア
      window.history.replaceState({}, document.title,
        window.location.pathname + window.location.search);
    }
  }, []);

  // ② トークンがあれば自動でメール取得
  useEffect(() => { if (token) fetchEmails(keyword, committee, token); }, [token]); // eslint-disable-line

  const login = () => {
    const p = new URLSearchParams({
      client_id:     GMAIL_CLIENT_ID,
      redirect_uri:  GMAIL_REDIRECT_URI,
      response_type: 'token',
      scope:         GMAIL_SCOPE,
      prompt:        'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  };

  const logout = () => {
    sessionStorage.removeItem('gmail_token');
    sessionStorage.removeItem('gmail_token_exp');
    setToken(null);
    setEmails([]);
    setSelectedId(null);
    setDetails({});
    setError('');
  };

  const fetchEmails = async (kw = keyword, cm = committee, tk = token, days = period) => {
    if (!tk) return;
    setLoading(true);
    setError('');
    try {
      // 受信トレイのみ（送信済み・アーカイブ・迷惑メール等は除外）
      // 件名で委員名絞り込み・指定期間分のみ
      const qParts = ['in:inbox'];
      if (cm) qParts.push(`subject:${cm}`);
      if (kw.trim()) qParts.push(kw.trim());
      qParts.push(`newer_than:${days}d`);
      const q = qParts.join(' ');
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (data.error) { setError(data.error.message || 'APIエラー'); setLoading(false); return; }
      if (!data.messages?.length) { setEmails([]); setLoading(false); return; }

      // メタデータ一括取得（Subject/From/Date）
      const metaList = await Promise.all(
        data.messages.map(m =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata` +
            `&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${tk}` } }
          ).then(r => r.json())
        )
      );
      const getH = (headers, name) => headers?.find(h => h.name === name)?.value || '';
      const parsed = metaList.map(msg => {
        const headers = msg.payload?.headers || [];
        const subject = getH(headers, 'Subject');
        const snippet = msg.snippet || '';
        // 「締切」ラベルは明示的なキーワードがある場合のみ（返信・回答・お願いは除外）
        const hasDeadline  = /締切|〆切|期限|締め切り|提出|迄|まで|返信|回答/.test(subject + snippet);
        const hasImportant = /重要|緊急|至急/.test(subject);
        const hasAttachment = !!(msg.payload?.mimeType?.startsWith('multipart/'));
        // 締め切り日：「迄」「まで」が明示されている日付のみ（開催日・参加日は除外）
        const dmatch = subject.match(/(\d{1,2})[\/月](\d{1,2})[日]?(?:迄|まで)/);
        const deadlineDate = dmatch ? `${dmatch[1]}/${dmatch[2]}迄` : null;
        return {
          id:          msg.id,
          subject:     subject || '（件名なし）',
          from:        getH(headers, 'From'),
          date:        getH(headers, 'Date'),
          snippet,
          hasDeadline,
          hasImportant,
          hasAttachment,
          deadlineDate,
        };
      });
      setEmails(parsed);
    } catch (e) {
      setError('通信エラー: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    if (details[id]) return;
    setDetLoading(true);
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msg = await res.json();
      const rawBody = findTextPlain(msg.payload);
      const body = rawBody
        ? decodeBase64Url(rawBody)
            .replace(/\r\n/g, '\n')
            .replace(/\n{2,}/g, '\n')   // 複数の空行をまとめる（行間なし）
            .trim()
        : (msg.snippet || '（本文なし）');
      const attachments = findAttachments(msg.payload);
      setDetails(d => ({ ...d, [id]: { body, attachments } }));
    } catch (e) {
      setDetails(d => ({ ...d, [id]: { body: '（取得エラー）', attachments: [] } }));
    } finally {
      setDetLoading(false);
    }
  };

  const downloadAttachment = async (msgId, attId, filename, mimeType) => {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.data) return;
      const bytes = Uint8Array.from(
        atob(data.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)
      );
      const blob = new Blob([bytes], { type: mimeType });
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('ダウンロードに失敗しました: ' + e.message); }
  };

  const openAttachment = async (msgId, attId, filename, mimeType) => {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.data) return;
      const bytes = Uint8Array.from(
        atob(data.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)
      );
      const blob = new Blob([bytes], { type: mimeType });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { alert('ファイルを開けませんでした: ' + e.message); }
  };

  // ── 対応済み（Gmailゴミ箱移動 + DB削除） ───────────────────────
  const handleDone = async (e, em) => {
    e.stopPropagation();
    if (!window.confirm(`「${em.subject.slice(0, 30)}…」を対応済みにしてGmailのゴミ箱へ移動しますか？`)) return;
    setDeletingId(em.id);
    try {
      // 1. Gmail ゴミ箱へ移動
      const gmailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${em.id}/trash`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (gmailRes.status === 401) { logout(); return; }
      if (gmailRes.status === 403) {
        setError('権限不足です。一度ログアウトして再ログインしてください（削除には再認証が必要です）');
        return;
      }
      if (!gmailRes.ok) throw new Error(`Gmail API エラー: ${gmailRes.status}`);

      // 2. Supabase の rinri_emails テーブルに同じ件名があれば削除
      const { data: dbRows } = await db.from('rinri_emails').select('id').eq('subject', em.subject);
      if (dbRows?.length > 0) {
        await db.from('rinri_emails').delete().eq('subject', em.subject);
      }

      // 3. ローカルのメール一覧から削除
      setEmails(prev => prev.filter(m => m.id !== em.id));
      if (selectedId === em.id) setSelectedId(null);
      showToast?.('✅ 対応済み！Gmailのゴミ箱へ移動しました');
    } catch (err) {
      setError('削除に失敗しました: ' + err.message);
    } finally {
      setDeletingId('');
    }
  };

  // ── メールからタスク追加 ──────────────────────────────────────
  const openTaskForm = (emailId, subject, deadlineDate, body) => {
    setTaskForms(f => {
      if (f[emailId]?.open) return { ...f, [emailId]: { ...f[emailId], open: false } };
      // 締め切り日をYYYY-MM-DDに変換
      let dueDate = '';
      if (deadlineDate) {
        const m = deadlineDate.match(/(\d{1,2})\/(\d{1,2})/);
        if (m) {
          const y = (today || new Date()).getFullYear();
          dueDate = `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
        }
      }
      const title = subject.replace(/【[^】]*】/g, '').replace(/Re:|Fw:/gi, '').trim();
      const url = pickRelatedUrl(body);   // 本文から関連URLを自動抽出
      return { ...f, [emailId]: { open: true, title, dueDate, priority:'medium', chapterId: lockChapterId || ALL_CHAPTER.id, url } };
    });
  };

  const updateTaskForm = (emailId, key, val) =>
    setTaskForms(f => ({ ...f, [emailId]: { ...f[emailId], [key]: val } }));

  const submitTaskForm = async (emailId) => {
    const form = taskForms[emailId];
    if (!form?.title?.trim()) { showToast?.('⚠ タスク内容を入力してください'); return; }
    if (!form.dueDate)        { showToast?.('⚠ 期限を入力してください'); return; }
    setTaskAdding(emailId);
    try {
      if (form.chapterId === ALL_CHAPTER.id && onAddTaskBatchDirect) {
        // 「全単会」選択時は各単会ごとに個別タスクを追加
        await onAddTaskBatchDirect({
          title:      form.title.trim(),
          dueDate:    form.dueDate,
          priority:   form.priority,
          url:        form.url || '',
          chapterIds: CHAPTERS.map(c => c.id),
        });
        showToast?.('✅ 各単会にタスクを追加しました');
      } else {
        await onAddTaskDirect({
          chapterId: form.chapterId,
          title:     form.title.trim(),
          dueDate:   form.dueDate,
          priority:  form.priority,
          url:       form.url || '',
        });
        showToast?.('✅ タスクを追加しました');
      }
      setTaskForms(f => ({ ...f, [emailId]: { ...f[emailId], open: false } }));
    } catch (e) {
      showToast?.('⚠ タスク追加に失敗しました: ' + e.message);
    } finally {
      setTaskAdding('');
    }
  };

  const generateSummary = (id, subject, body) => {
    if (summaries[id]) {
      setSummaries(s => { const n = { ...s }; delete n[id]; return n; });
      return;
    }
    setSummaries(s => ({ ...s, [id]: extractEmailSummary(subject, body) }));
  };

  const copyToLine = async (id, subject, summaryText) => {
    const msg = `【倫理法人会 メール要約】\n${summaryText}\n\n（件名）${subject}`;
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      const el = document.createElement('textarea');
      el.value = msg;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSelect = id => {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);
    fetchDetail(id);
  };

  const handleCommittee = c => {
    const next = committee === c ? '' : c;
    setCommittee(next);
    fetchEmails(keyword, next);
  };

  const handleSearch = e => {
    e.preventDefault();
    fetchEmails(keyword, committee);
  };

  const fmtDate = str => {
    if (!str) return '';
    try {
      const d = new Date(str);
      return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return str; }
  };

  return (
    <div style={{ ...CARD, marginBottom:14 }}>
      {/* ヘッダー */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: open ? 10 : 0, flexWrap:"wrap" }}>
        <span style={{ fontSize:"clamp(13px,1.8vw,16px)", fontWeight:700, color:"#061B44" }}>
          📬 倫理メール受信ボックス
        </span>
        {token && emails.length > 0 && (
          <span style={{ background:"#1565C0", color:"#fff", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, padding:"1px 7px", borderRadius:10 }}>
            {emails.length}
          </span>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {token
            ? <button onClick={logout}
                style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"4px 10px",
                  fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#667085" }}>
                ログアウト
              </button>
            : <button onClick={login}
                style={{ background:"#1565C0", color:"#fff", border:"none", borderRadius:6, padding:"5px 12px",
                  fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:700 }}>
                🔑 Gmailでログイン
              </button>
          }
          <button onClick={() => setOpen(v => !v)}
            style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"4px 10px",
              fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }}>
            {open ? "▲ 閉じる" : "▼ 開く"}
          </button>
        </div>
      </div>

      {open && (
        !token ? (
          <div style={{ color:"#98A2B3", fontSize:"clamp(12px,1.4vw,14px)", padding:"18px 0", textAlign:"center" }}>
            「Gmailでログイン」ボタンを押して認証してください
          </div>
        ) : (
          <div>
            {/* 委員会フィルター */}
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
              {COMMITTEES.map(c => (
                <button key={c} onClick={() => handleCommittee(c)}
                  style={{ padding:"3px 9px", fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700,
                    borderRadius:14, border:"none", cursor:"pointer", transition:"background .15s",
                    background: committee === c ? "#061B44" : "#F1F5F9",
                    color:      committee === c ? "#fff"    : "#667085" }}>
                  {c}
                </button>
              ))}
              {committee && (
                <button onClick={() => { setCommittee(''); fetchEmails(keyword, ''); }}
                  style={{ padding:"3px 9px", fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700,
                    borderRadius:14, border:"1px solid #D9E1EE", cursor:"pointer",
                    background:"#fff", color:"#B71C1C" }}>
                  ✕ 解除
                </button>
              )}
            </div>

            {/* 抽出期間 */}
            <div style={{ display:"flex", gap:6, marginBottom:10, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700, color:"#667085" }}>📅 期間</span>
              {[["1週間",7],["2週間",14],["4週間",28],["3ヶ月",90]].map(([label, days]) => (
                <button key={days} type="button"
                  onClick={() => { setPeriod(days); fetchEmails(keyword, committee, token, days); }}
                  style={{ padding:"3px 11px", fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700,
                    borderRadius:14, cursor:"pointer",
                    border:`1px solid ${period===days ? "#061B44" : "#D9E1EE"}`,
                    background: period===days ? "#061B44" : "#fff",
                    color: period===days ? "#fff" : "#667085" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* キーワード検索 */}
            <form onSubmit={handleSearch} style={{ display:"flex", gap:6, marginBottom:10 }}>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="キーワード検索（例: 締切、資料、回答）"
                style={{ ...INP, flex:1, fontSize:"clamp(12px,1.4vw,14px)" }}
              />
              <button type="submit" style={{ ...BP, padding:"6px 14px", fontSize:"clamp(12px,1.4vw,14px)" }}>
                🔍 検索
              </button>
              {(keyword || committee) && (
                <button type="button"
                  onClick={() => { setKeyword(''); setCommittee(''); fetchEmails('', ''); }}
                  style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"6px 12px",
                    fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", color:"#667085", fontWeight:600 }}>
                  クリア
                </button>
              )}
            </form>

            {error && (
              <div style={{ color:"#C62828", fontSize:"clamp(12px,1.4vw,14px)", marginBottom:8, padding:"6px 10px", background:"#FFEBEE", borderRadius:6 }}>
                ⚠ {error}
              </div>
            )}

            {loading ? (
              <div style={{ color:"#78909C", fontSize:"clamp(12px,1.4vw,14px)", padding:"14px 0", textAlign:"center" }}>
                📨 メール取得中...
              </div>
            ) : emails.length === 0 ? (
              <div style={{ color:"#98A2B3", fontSize:"clamp(12px,1.4vw,14px)", padding:"14px 0", textAlign:"center" }}>
                メールが見つかりません
              </div>
            ) : (
              <div>
                {emails.map(em => {
                  const det = details[em.id];
                  const isOpen = selectedId === em.id;
                  return (
                    <div key={em.id} style={{ marginBottom:3 }}>
                      {/* メール行 */}
                      <div onClick={() => handleSelect(em.id)}
                        style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 10px",
                          borderRadius:7, cursor:"pointer",
                          background: isOpen ? "#E3F2FD" : "#F8FAFB",
                          border:"1px solid " + (em.hasDeadline || em.hasImportant ? "#FFCDD2" : "#E0E0E0") }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          {/* 件名行：締め切り・重要を赤字で先頭に表示 */}
                          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:600, color:"#1A237E",
                            display:"flex", alignItems:"center", overflow:"hidden" }}>
                            {em.hasDeadline && (
                              <span style={{ color:"#C62828", fontWeight:700, marginRight:4, flexShrink:0,
                                fontSize:"clamp(11px,1.3vw,12px)" }}>締め切り</span>
                            )}
                            {em.hasImportant && (
                              <span style={{ color:"#C62828", fontWeight:700, marginRight:4, flexShrink:0,
                                fontSize:"clamp(11px,1.3vw,12px)" }}>重要</span>
                            )}
                            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {em.subject}
                            </span>
                          </div>
                          {/* メタ行：締め切り日（赤）・差出人・添付あり（青） */}
                          <div style={{ fontSize:"clamp(11px,1.3vw,12px)", marginTop:2,
                            display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                            {em.deadlineDate
                              ? <span style={{ color:"#C62828", fontWeight:700 }}>📅 {em.deadlineDate}</span>
                              : <span style={{ color:"#78909C" }}>{fmtDate(em.date)}</span>
                            }
                            <span style={{ color:"#78909C", overflow:"hidden", textOverflow:"ellipsis",
                              whiteSpace:"nowrap", maxWidth:180 }}>
                              {em.from}
                            </span>
                            {em.hasAttachment && (
                              <span style={{ color:"#1565C0", fontWeight:600 }}>📎 添付あり</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:5, flexShrink:0, alignSelf:"center" }}>
                          <button
                            onClick={e => handleDone(e, em)}
                            disabled={deletingId === em.id}
                            title="対応済みにしてGmailのゴミ箱へ移動"
                            style={{ fontSize:"clamp(11px,1.3vw,11px)", padding:"3px 7px",
                              borderRadius:5, border:"1px solid #A5D6A7", background:"#E8F5E9",
                              color:"#2E7D32", cursor:"pointer", fontWeight:700,
                              opacity: deletingId === em.id ? .5 : 1,
                              whiteSpace:"nowrap" }}>
                            {deletingId === em.id ? '…' : '✅ 対応済み'}
                          </button>
                          <span style={{ fontSize:"clamp(11px,1.3vw,12px)", color:"#98A2B3", alignSelf:"center" }}>
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* 展開：本文 + 添付 */}
                      {isOpen && (
                        <div style={{ margin:"0 4px 6px", padding:"10px 12px", background:"#FAFAFA",
                          borderRadius:"0 0 6px 6px", border:"1px solid #E0E0E0", borderTop:"none" }}>
                          {detLoading && !det ? (
                            <div style={{ color:"#98A2B3", fontSize:"clamp(12px,1.4vw,14px)" }}>読み込み中...</div>
                          ) : det ? (
                            <>
                              {/* ── タスク追加エリア ── */}
                              <div style={{ marginBottom:8 }}>
                                <button
                                  onClick={e => { e.stopPropagation(); openTaskForm(em.id, em.subject, em.deadlineDate, det.body); }}
                                  style={{ fontSize:"clamp(11px,1.3vw,12px)", padding:"4px 12px",
                                    borderRadius:5, border:"1px solid #A5D6A7", background:"#E8F5E9",
                                    color:"#1B5E20", cursor:"pointer", fontWeight:700 }}>
                                  {taskForms[em.id]?.open ? '✕ キャンセル' : '＋ タスク追加'}
                                </button>

                                {taskForms[em.id]?.open && (
                                  <div onClick={e => e.stopPropagation()}
                                    style={{ marginTop:8, padding:"10px 12px", background:"#F1F8E9",
                                      borderRadius:7, border:"1px solid #A5D6A7", display:"flex",
                                      flexDirection:"column", gap:6 }}>
                                    {/* タスク内容 */}
                                    <input
                                      value={taskForms[em.id].title}
                                      onChange={e => updateTaskForm(em.id, 'title', e.target.value)}
                                      placeholder="タスク内容"
                                      style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)", width:"100%", boxSizing:"border-box" }}
                                    />
                                    {/* 関連URL（本文から自動入力・編集可） */}
                                    <input
                                      type="url"
                                      value={taskForms[em.id].url || ''}
                                      onChange={e => updateTaskForm(em.id, 'url', e.target.value)}
                                      placeholder="関連URL（本文から自動入力）"
                                      style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)", width:"100%", boxSizing:"border-box" }}
                                    />
                                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                                      {/* 期限 */}
                                      <input
                                        type="date"
                                        value={taskForms[em.id].dueDate}
                                        onChange={e => updateTaskForm(em.id, 'dueDate', e.target.value)}
                                        style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)" }}
                                      />
                                      {/* 単会 */}
                                      <select
                                        value={taskForms[em.id].chapterId}
                                        onChange={e => updateTaskForm(em.id, 'chapterId', e.target.value)}
                                        style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }}>
                                        {!lockChapterId && <option value={ALL_CHAPTER.id}>全単会（各単会に個別追加）</option>}
                                        {(lockChapterId ? CHAPTERS.filter(c => c.id === lockChapterId) : CHAPTERS).map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                                      </select>
                                      {/* 優先度 */}
                                      <select
                                        value={taskForms[em.id].priority}
                                        onChange={e => updateTaskForm(em.id, 'priority', e.target.value)}
                                        style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }}>
                                        <option value="high">🔴 高</option>
                                        <option value="medium">🟡 中</option>
                                        <option value="low">🟢 低</option>
                                      </select>
                                      {/* 追加ボタン */}
                                      <button
                                        disabled={taskAdding === em.id}
                                        onClick={e => { e.stopPropagation(); submitTaskForm(em.id); }}
                                        style={{ ...BP, fontSize:"clamp(12px,1.4vw,14px)", padding:"5px 14px",
                                          opacity: taskAdding === em.id ? .6 : 1 }}>
                                        {taskAdding === em.id ? '追加中...' : '追加'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* ── 要約エリア ── */}
                              <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                                <button
                                  onClick={e => { e.stopPropagation(); generateSummary(em.id, em.subject, det.body); }}
                                  style={{ fontSize:"clamp(11px,1.3vw,12px)", padding:"4px 12px",
                                    borderRadius:5, border:"1px solid #CE93D8", background:"#F3E5F5",
                                    color:"#6A1B9A", cursor:"pointer", fontWeight:700 }}>
                                  {summaries[em.id] ? '✨ 要約を閉じる' : '✨ 要約を作成'}
                                </button>
                                {summaries[em.id] && (
                                  <button
                                    onClick={e => { e.stopPropagation(); copyToLine(em.id, em.subject, summaries[em.id]); }}
                                    style={{ fontSize:"clamp(11px,1.3vw,12px)", padding:"4px 12px",
                                      borderRadius:5, fontWeight:700, cursor:"pointer",
                                      border: copied === em.id ? "1px solid #4CAF50" : "1px solid #69F0AE",
                                      background: copied === em.id ? "#E8F5E9" : "#F1F8E9",
                                      color: copied === em.id ? "#1B5E20" : "#2E7D32" }}>
                                    {copied === em.id ? '✅ コピー完了！' : '📋 LINEへコピー'}
                                  </button>
                                )}
                              </div>

                              {/* 要約カード */}
                              {summaries[em.id] && (
                                <div style={{ background:"#EDE7F6", borderRadius:6, padding:"8px 12px",
                                  fontSize:"clamp(12px,1.4vw,14px)", color:"#311B92", lineHeight:1.7,
                                  whiteSpace:"pre-wrap", border:"1px solid #CE93D8", marginBottom:8 }}>
                                  {summaries[em.id]}
                                </div>
                              )}

                              {/* 本文：行間を詰める */}
                              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", lineHeight:1.35,
                                whiteSpace:"pre-wrap", maxHeight:260, overflowY:"auto", marginBottom: det.attachments.length > 0 ? 8 : 0 }}>
                                {det.body}
                              </div>

                              {/* 添付ファイル */}
                              {det.attachments.length > 0 && (
                                <div style={{ borderTop:"1px solid #E0E0E0", paddingTop:6 }}>
                                  <div style={{ fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700, color:"#667085", marginBottom:4 }}>
                                    📎 添付ファイル
                                  </div>
                                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                    {det.attachments.map((att, i) => (
                                      <div key={i} style={{ display:"flex", gap:4, alignItems:"center" }}>
                                        <button
                                          onClick={e => { e.stopPropagation(); openAttachment(em.id, att.attachmentId, att.filename, att.mimeType); }}
                                          style={{ fontSize:"clamp(11px,1.3vw,12px)", padding:"3px 10px",
                                            borderRadius:5, border:"1px solid #A5D6A7", background:"#E8F5E9",
                                            color:"#2E7D32", cursor:"pointer", fontWeight:600 }}>
                                          📂 開く
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); downloadAttachment(em.id, att.attachmentId, att.filename, att.mimeType); }}
                                          style={{ fontSize:"clamp(11px,1.3vw,12px)", padding:"3px 10px",
                                            borderRadius:5, border:"1px solid #90CAF9", background:"#E3F2FD",
                                            color:"#1565C0", cursor:"pointer", fontWeight:600 }}>
                                          ⬇ {att.filename}{att.size > 0 ? ` (${(att.size/1024).toFixed(0)}KB)` : ''}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

export default memo(function TasksView({ tasks, emails = [], today, newTask, setNewTask, onToggle, onDelete, onAdd, onAddBatch, onUpdate, onDeleteDone, onAddTaskDirect, onAddTaskBatchDirect, showToast, lockChapterId }) {
  // 単会ユーザーは自分の単会のみ（全単会・他単会は選べない）
  const chapterOptions = lockChapterId ? CHAPTERS.filter(c => c.id === lockChapterId) : CHAPTERS;
  const [showDone,    setShowDone]    = useState(true);
  const [filterCh,   setFilterCh]    = useState("all");
  const [filterPrio, setFilterPrio]  = useState("all");
  const [editingId,  setEditingId]   = useState(null);
  const [editForm,   setEditForm]    = useState({});

  const visible = useMemo(
    () => tasks
      .filter(t =>
        (showDone || !t.done) &&
        (filterCh === "all" || t.chapterId === filterCh) &&
        (filterPrio === "all" || t.priority === filterPrio)
      )
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [tasks, showDone, filterCh, filterPrio]
  );
  const undoneCount = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);
  const doneCount   = useMemo(() => tasks.filter(t => t.done).length, [tasks]);
  const overdueCount = useMemo(() => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return tasks.filter(t => !t.done && t.dueDate && t.dueDate < todayStr).length;
  }, [tasks, today]);

  const startEdit = useCallback(t => {
    setEditingId(t.id);
    setEditForm({ title: t.title, dueDate: t.dueDate, priority: t.priority, chapterId: t.chapterId, url: t.url || "" });
  }, []);

  const saveEdit = useCallback(id => {
    if (!editForm.title?.trim()) { showToast?.("⚠ タスク内容を入力してください"); return; }
    if (!editForm.dueDate) { showToast?.("⚠ 期限を入力してください"); return; }
    onUpdate?.(id, editForm);
    setEditingId(null);
  }, [editForm, onUpdate, showToast]);

  const exportCSV = useCallback(() => {
    const headers = ["単会","タスク内容","期限","優先度","ステータス","完了日時"];
    const rows = visible.map(t => {
      const ch = getChapter(t.chapterId);
      return [ch.name, t.title, t.dueDate, PRIO[t.priority]?.label || t.priority, t.done ? "完了" : "未完了", t.completedAt ? t.completedAt.slice(0,16).replace("T"," ") : ""];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"})), download:`タスク一覧_${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast?.("CSVをエクスポートしました 📥");
  }, [visible, showToast]);

  const exportICS = useCallback(() => {
    const targets = visible.filter(t => !t.done && t.dueDate);
    if (targets.length === 0) { showToast?.("⚠ 出力できる未完了タスクがありません"); return; }
    const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const pad = n => String(n).padStart(2, "0");
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//rinri-nanbu//task//JA",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:南部地区タスク",
    ];
    targets.forEach(t => {
      const ch = getChapter(t.chapterId);
      const ymd = t.dueDate.replace(/-/g, "");
      const prio = PRIO[t.priority]?.label || t.priority || "";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${t.id}@rinri-nanbu`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${ymd}T090000`,
        `DTEND:${ymd}T093000`,
        `SUMMARY:${esc(`【${ch.name}】${t.title}`)}`,
        `DESCRIPTION:${esc(`単会：${ch.name}／優先度：${prio}／期限：${t.dueDate}${t.url ? `\n関連URL：${t.url}` : ''}`)}`,
        ...(t.url ? [`URL:${t.url}`] : []),
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-P1D",
        `DESCRIPTION:${esc(`【明日が期限】${t.title}`)}`,
        "END:VALARM",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    const ics = lines.join("\r\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8;" })),
      download: `南部地区タスク_${new Date().toISOString().slice(0,10)}.ics`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast?.(`${targets.length}件をカレンダー形式で出力しました 📅`);
  }, [visible, showToast]);

  const [groupByDate, setGroupByDate] = useState(true);
  const hasFilter = filterCh !== "all" || filterPrio !== "all";

  const chapterStats = useMemo(() => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return chapterOptions.map(ch => {
      const chTasks = tasks.filter(t => t.chapterId === ch.id && !t.done);
      const overdue = chTasks.filter(t => t.dueDate && t.dueDate < todayStr).length;
      const thisWeek = chTasks.filter(t => { if (!t.dueDate) return false; const dl = Math.ceil((parseDate(t.dueDate) - today) / 86400000); return dl >= 0 && dl <= 7; }).length;
      return { ch, total: chTasks.length, overdue, thisWeek };
    }).filter(s => s.total > 0);
  }, [tasks, today]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:700, color:"#061B44", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          タスク管理
          {overdueCount > 0 && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, background:"#FFEBEE", color:"#B71C1C", padding:"2px 8px", borderRadius:10 }}>⚠ 超過 {overdueCount}件</span>}
          {undoneCount > 0 && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:400, color:"#BF360C" }}>未完了 {undoneCount}件</span>}
          {doneCount > 0 && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:400, color:"#78909C" }}>完了 {doneCount}件</span>}
        </div>
        <div style={{ display:"flex", gap:6, marginLeft:"auto", flexWrap:"wrap", alignItems:"center" }}>
          {!lockChapterId && (
            <select aria-label="単会フィルター" style={SEL} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
              <option value="all">全単会</option>
              {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
            </select>
          )}
          <select aria-label="優先度フィルター" style={SEL} value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
            <option value="all">全優先度</option>
            <option value="high">🔴 高</option>
            <option value="medium">🟡 中</option>
            <option value="low">🟢 低</option>
          </select>
          {hasFilter && (
            <button style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#667085" }} onClick={() => { setFilterCh("all"); setFilterPrio("all"); }}>
              リセット
            </button>
          )}
          <button style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setShowDone(v => !v)}>
            {showDone ? "完了済みを隠す" : "完了済みも表示"}
          </button>
          {doneCount > 0 && (
            <button style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#B71C1C" }} onClick={onDeleteDone}>
              🗑 完了済みを削除
            </button>
          )}
          <button style={{ background: groupByDate ? "#061B44" : "#F1F5F9", color: groupByDate ? "#fff" : "#667085", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600 }} onClick={() => setGroupByDate(v => !v)}>
            {groupByDate ? "▦ グループ表示" : "≡ 一覧表示"}
          </button>
          <button style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:700 }} onClick={exportCSV}>📥 CSV</button>
          <button style={{ background:"#1565C0", color:"#fff", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:700 }} onClick={exportICS} title="期限1日前の通知付きでカレンダーに出力（Googleカレンダー等にインポート）">📅 カレンダー</button>
        </div>
      </div>

      {chapterStats.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
          {chapterStats.map(({ ch, total, overdue, thisWeek }) => (
            <div key={ch.id} onClick={() => setFilterCh(ch.id)} style={{ background: filterCh === ch.id ? ch.light : "#fff", border:`2px solid ${filterCh === ch.id ? ch.color : ch.accent}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", transition:"all .15s", minWidth:110 }}>
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color: ch.color, marginBottom:2 }}>{ch.name}</div>
              <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:800, color: overdue > 0 ? "#B71C1C" : "#37474F", lineHeight:1 }}>{total}<span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:400, marginLeft:2 }}>件</span></div>
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3", marginTop:2, display:"flex", gap:6 }}>
                {overdue > 0 && <span style={{ color:"#B71C1C", fontWeight:700 }}>超過{overdue}</span>}
                {thisWeek > 0 && <span style={{ color:"#E65100", fontWeight:600 }}>今週{thisWeek}</span>}
              </div>
            </div>
          ))}
          {filterCh !== "all" && (
            <div onClick={() => setFilterCh("all")} style={{ background:"#F5F5F5", border:"2px solid #F1F5F9", borderRadius:8, padding:"6px 12px", cursor:"pointer", display:"flex", alignItems:"center", fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", fontWeight:600 }}>
              全て表示
            </div>
          )}
        </div>
      )}

      <GmailInbox today={today} showToast={showToast} onAddTaskDirect={onAddTaskDirect} onAddTaskBatchDirect={onAddTaskBatchDirect} lockChapterId={lockChapterId} />

      <div style={{ ...CARD, marginBottom:12 }}>
        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#667085", marginBottom:7 }}>＋ タスク追加</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
          <input aria-label="タスク内容" style={{ ...INP, flex:3, minWidth:160 }} placeholder="タスク内容..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
          <input aria-label="関連URL" type="url" style={{ ...INP, flex:2, minWidth:140 }} placeholder="関連URL（フォーム・Drive等）任意" value={newTask.url || ""} onChange={e => setNewTask({ ...newTask, url: e.target.value })} />
          <select aria-label="担当単会" style={SEL} value={newTask.chapterId} onChange={e => setNewTask({ ...newTask, chapterId: e.target.value })}>
            {!lockChapterId && <option value={ALL_CHAPTER.id}>{ALL_CHAPTER.name}</option>}
            {chapterOptions.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <input aria-label="期限" type="date" style={INP} value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
            <div style={{ display:"flex", gap:3 }}>
              {[["今日",0],["明日",1],["1週",7],["2週",14]].map(([label, days]) => {
                const d = new Date(today); d.setDate(d.getDate() + days);
                const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return <button key={label} type="button" onClick={() => setNewTask(t => ({ ...t, dueDate: ds }))} style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"1px 5px", borderRadius:8, border:`1px solid ${newTask.dueDate===ds?"#061B44":"#D9E1EE"}`, background: newTask.dueDate===ds?"#061B44":"#fff", color: newTask.dueDate===ds?"#fff":"#667085", cursor:"pointer", fontWeight:700 }}>{label}</button>;
              })}
            </div>
          </div>
          <select aria-label="優先度" style={SEL} value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
            <option value="high">🔴 高</option>
            <option value="medium">🟡 中</option>
            <option value="low">🟢 低</option>
          </select>
          <button style={BP} onClick={onAdd}>追加</button>
          {onAddBatch && !lockChapterId && (
            <button style={{ background:"#667085", color:"#fff", border:"none", borderRadius:6, padding:"7px 12px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }} title="全5単会に同じタスクを追加" onClick={onAddBatch}>
              ＋全単会
            </button>
          )}
        </div>
      </div>

      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["","単会","タスク内容","期限","残り","優先","操作"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {groupByDate && (() => {
                const pad = n => String(n).padStart(2,'0');
                const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                const todayStr = ds(today);
                const tom = new Date(today); tom.setDate(today.getDate()+1);
                const tomStr = ds(tom);
                const wk = new Date(today); wk.setDate(today.getDate()+7);
                const wkStr = ds(wk);
                const undoneTasks = visible.filter(t => !t.done);
                const doneTasks   = showDone ? visible.filter(t => t.done) : [];
                const groups = [
                  { label:"⚠ 期限超過", color:"#B71C1C", bg:"#FFEBEE", filter: t => t.dueDate < todayStr },
                  { label:"📅 今日・明日", color:"#E65100", bg:"#FFF8E1", filter: t => t.dueDate >= todayStr && t.dueDate <= tomStr },
                  { label:"📌 今週中", color:"#FF8F00", bg:"#FFFDE7", filter: t => t.dueDate > tomStr && t.dueDate <= wkStr },
                  { label:"🗓 来週以降", color:"#667085", bg:"#F5F5F5", filter: t => t.dueDate > wkStr },
                ];
                const undoneRows = groups.flatMap(({ label, color, bg, filter }) => {
                  const gTasks = undoneTasks.filter(filter);
                  if (gTasks.length === 0) return [];
                  return [
                    <tr key={`hdr-${label}`}><td colSpan={7} style={{ padding:"5px 10px", background: bg, fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color, borderTop:`2px solid ${color}33` }}>{label}　{gTasks.length}件</td></tr>,
                    ...gTasks.map(t => {
                      const ch = getChapter(t.chapterId);
                      const dl = Math.ceil((parseDate(t.dueDate) - today) / 86400000);
                      const p = PRIO[t.priority] || PRIO.medium;
                      const isEditing = editingId === t.id;
                      if (isEditing) {
                        return (
                          <tr key={t.id} style={{ background:"#E3F2FD" }}>
                            <td style={TD}><input type="checkbox" checked={t.done} disabled style={{ cursor:"not-allowed", opacity:.4 }} /></td>
                            <td style={TD}><select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.chapterId} onChange={e => setEditForm(f => ({ ...f, chapterId: e.target.value }))}>{!lockChapterId && <option value={ALL_CHAPTER.id}>{ALL_CHAPTER.name}</option>}{chapterOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                            <td style={{ ...TD, maxWidth:200 }}><input autoFocus style={{ ...INP, width:"100%", fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }} /></td>
                            <td style={TD}><input type="date" style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} /></td>
                            <td style={{ ...TD, minWidth:130 }}><input type="url" style={{ ...INP, width:"100%", fontSize:"clamp(12px,1.4vw,14px)" }} placeholder="関連URL（任意）" value={editForm.url || ""} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} /></td>
                            <td style={TD}><select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}><option value="high">🔴 高</option><option value="medium">🟡 中</option><option value="low">🟢 低</option></select></td>
                            <td style={TD}><div style={{ display:"flex", gap:3 }}><button style={{ ...BSM, background:"#061B44", color:"#fff" }} onClick={() => saveEdit(t.id)}>保存</button><button style={{ ...BSM, color:"#667085" }} onClick={() => setEditingId(null)}>取消</button></div></td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={t.id} className="hover-row" style={{ background: dl < 0 ? "#FFF5F5" : "white" }}>
                          <td style={TD}><input type="checkbox" aria-label={`${t.title}を完了にする`} checked={t.done} onChange={() => onToggle(t.id)} style={{ cursor:"pointer" }} /></td>
                          <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                          <td style={{ ...TD, fontWeight:600, maxWidth:200 }}>{t.title}</td>
                          <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)" }}>{t.dueDate}</td>
                          <td style={TD}><span style={{ fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", color: dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : dl <= 7 ? "#FF8F00" : "#2E7D32" }}>{dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span></td>
                          <td style={TD}><span style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700 }}>{p.label}</span></td>
                          <td style={TD}><div style={{ display:"flex", gap:3, alignItems:"center" }}>{t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ ...BSM, background:"#E3F2FD", color:"#1565C0", textDecoration:"none" }} title={t.url}>🔗</a>}<button style={{ ...BSM, color:"#1565C0" }} onClick={() => startEdit(t)}>編集</button><button style={{ ...BSM, color:"#B71C1C", padding:"2px 7px" }} onClick={() => onDelete(t.id)}>×</button></div></td>
                        </tr>
                      );
                    })
                  ];
                });
                const doneRows = doneTasks.length === 0 ? [] : [
                  <tr key="hdr-done"><td colSpan={7} style={{ padding:"5px 10px", background:"#F5F5F5", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#78909C", borderTop:"2px solid #D9E1EE" }}>✓ 完了済み　{doneTasks.length}件</td></tr>,
                  ...doneTasks.map(t => {
                    const ch = getChapter(t.chapterId);
                    const p = PRIO[t.priority] || PRIO.medium;
                    return (
                      <tr key={t.id} className="hover-row" style={{ background:"#FAFAFA", opacity:.55 }}>
                        <td style={TD}><input type="checkbox" aria-label={`${t.title}を未完了に戻す`} checked={true} onChange={() => onToggle(t.id)} style={{ cursor:"pointer" }} /></td>
                        <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                        <td style={{ ...TD, fontWeight:400, textDecoration:"line-through", color:"#98A2B3", maxWidth:200 }}>{t.title}</td>
                        <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3" }}>{t.dueDate}</td>
                        <td style={TD}><span style={{ fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3" }}>✓完了</span></td>
                        <td style={TD}><span style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700, opacity:.5 }}>{p.label}</span></td>
                        <td style={TD}><button style={{ ...BSM, color:"#B71C1C", padding:"2px 7px" }} onClick={() => onDelete(t.id)}>×</button></td>
                      </tr>
                    );
                  })
                ];
                return [...undoneRows, ...doneRows];
              })()}
              {!groupByDate && visible.map(t => {
                const ch = getChapter(t.chapterId);
                const dl = Math.ceil((parseDate(t.dueDate) - today) / 86400000);
                const p  = PRIO[t.priority] || PRIO.medium;
                const isOverdue = !t.done && dl < 0;
                const isEditing = editingId === t.id;

                if (isEditing) {
                  return (
                    <tr key={t.id} style={{ background:"#E3F2FD" }}>
                      <td style={TD}><input type="checkbox" checked={t.done} disabled style={{ cursor:"not-allowed", opacity:.4 }} /></td>
                      <td style={TD}>
                        <select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.chapterId} onChange={e => setEditForm(f => ({ ...f, chapterId: e.target.value }))}>
                          {!lockChapterId && <option value={ALL_CHAPTER.id}>{ALL_CHAPTER.name}</option>}
                          {chapterOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={{ ...TD, maxWidth:200 }}>
                        <input autoFocus style={{ ...INP, width:"100%", fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }} />
                      </td>
                      <td style={TD}>
                        <input type="date" style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                      </td>
                      <td style={{ ...TD, minWidth:130 }}>
                        <input type="url" style={{ ...INP, width:"100%", fontSize:"clamp(12px,1.4vw,14px)" }} placeholder="関連URL（任意）" value={editForm.url || ""} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} />
                      </td>
                      <td style={TD}>
                        <select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                          <option value="high">🔴 高</option>
                          <option value="medium">🟡 中</option>
                          <option value="low">🟢 低</option>
                        </select>
                      </td>
                      <td style={TD}>
                        <div style={{ display:"flex", gap:3 }}>
                          <button style={{ ...BSM, background:"#061B44", color:"#fff" }} onClick={() => saveEdit(t.id)}>保存</button>
                          <button style={{ ...BSM, color:"#667085" }} onClick={() => setEditingId(null)}>取消</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={t.id} className="hover-row" style={{ opacity: t.done ? .5 : 1, background: t.done ? "#FAFAFA" : isOverdue ? "#FFF5F5" : "white" }}>
                    <td style={TD}><input type="checkbox" aria-label={`${t.title}を完了にする`} checked={t.done} onChange={() => onToggle(t.id)} style={{ cursor:"pointer" }} /></td>
                    <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                    <td style={{ ...TD, fontWeight: t.done ? 400 : 600, textDecoration: t.done ? "line-through" : "none", maxWidth:200 }}>{t.title}</td>
                    <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)" }}>{t.dueDate}</td>
                    <td style={TD}><span style={{ fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", color: t.done ? "#98A2B3" : dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : dl <= 7 ? "#FF8F00" : "#2E7D32" }}>{t.done ? "✓完了" : dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span></td>
                    <td style={TD}><span style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700 }}>{p.label}</span></td>
                    <td style={TD}>
                      <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                        {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ ...BSM, background:"#E3F2FD", color:"#1565C0", textDecoration:"none" }} title={t.url}>🔗</a>}
                        {!t.done && <button style={{ ...BSM, color:"#1565C0" }} title="タスクを編集" aria-label={`${t.title}を編集`} onClick={() => startEdit(t)}>編集</button>}
                        {!t.done && <button style={{ ...BSM, color:"#B71C1C", padding:"2px 7px" }} title="タスクを削除" aria-label={`${t.title}を削除`} onClick={() => onDelete(t.id)}>×</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ ...TD, textAlign:"center", color:"#98A2B3", padding:22 }}>
                  {hasFilter ? "条件に一致するタスクがありません" : showDone ? "タスクなし" : "未完了タスクなし ✓"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
