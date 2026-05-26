import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter, parseDate } from '../utils';
import { CARD, BP, BSM, SEL, INP, TBL, TH, TD, PILL } from '../styles';

const PRIO = { high:{ label:"高", bg:"#FFEBEE", color:"#C62828" }, medium:{ label:"中", bg:"#FFF8E1", color:"#F57F17" }, low:{ label:"低", bg:"#E8F5E9", color:"#2E7D32" } };

// ─── Gmail OAuth2 定数 ───────────────────────────────────────────
const GMAIL_CLIENT_ID = '181247594167-n0fb727pkc3v0hsch52vmedoed4jt43r.apps.googleusercontent.com';
const GMAIL_REDIRECT_URI = 'https://nanbuchiku.github.io/nanbu-chiku-jimu-app/';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const COMMITTEES = [
  '広報委員','キャリアアップ委員','イメージ向上委員',
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

// ─── GmailInbox コンポーネント ─────────────────────────────────
function GmailInbox() {
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

  const fetchEmails = async (kw = keyword, cm = committee, tk = token) => {
    if (!tk) return;
    setLoading(true);
    setError('');
    try {
      const q = [cm, kw.trim()].filter(Boolean).join(' ');
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25${q ? `&q=${encodeURIComponent(q)}` : ''}`;
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
        const hasDeadline = /締切|〆切|期限|締め切り|提出|返信|回答|お願い/.test(subject + snippet);
        return {
          id:          msg.id,
          subject:     subject || '（件名なし）',
          from:        getH(headers, 'From'),
          date:        getH(headers, 'Date'),
          snippet,
          hasDeadline,
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
            .replace(/\n{3,}/g, '\n\n')
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
        <span style={{ fontSize:"clamp(13px,1.8vw,16px)", fontWeight:700, color:"#1A3A6B" }}>
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
                style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"4px 10px",
                  fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#546E7A" }}>
                ログアウト
              </button>
            : <button onClick={login}
                style={{ background:"#1565C0", color:"#fff", border:"none", borderRadius:6, padding:"5px 12px",
                  fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:700 }}>
                🔑 Gmailでログイン
              </button>
          }
          <button onClick={() => setOpen(v => !v)}
            style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"4px 10px",
              fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }}>
            {open ? "▲ 閉じる" : "▼ 開く"}
          </button>
        </div>
      </div>

      {open && (
        !token ? (
          <div style={{ color:"#90A4AE", fontSize:"clamp(12px,1.4vw,14px)", padding:"18px 0", textAlign:"center" }}>
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
                    background: committee === c ? "#1A3A6B" : "#ECEFF1",
                    color:      committee === c ? "#fff"    : "#546E7A" }}>
                  {c}
                </button>
              ))}
              {committee && (
                <button onClick={() => { setCommittee(''); fetchEmails(keyword, ''); }}
                  style={{ padding:"3px 9px", fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700,
                    borderRadius:14, border:"1px solid #CFD8DC", cursor:"pointer",
                    background:"#fff", color:"#B71C1C" }}>
                  ✕ 解除
                </button>
              )}
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
                  style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"6px 12px",
                    fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", color:"#546E7A", fontWeight:600 }}>
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
              <div style={{ color:"#90A4AE", fontSize:"clamp(12px,1.4vw,14px)", padding:"14px 0", textAlign:"center" }}>
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
                          border:"1px solid " + (em.hasDeadline ? "#FFCDD2" : "#E0E0E0") }}>
                        <div style={{ flexShrink:0, marginTop:1 }}>
                          {em.hasDeadline
                            ? <span style={{ background:"#FFEBEE", color:"#C62828", fontSize:"clamp(11px,1.3vw,12px)",
                                fontWeight:700, padding:"2px 5px", borderRadius:4 }}>締切</span>
                            : <span style={{ background:"#F5F5F5", color:"#9E9E9E", fontSize:"clamp(11px,1.3vw,12px)",
                                fontWeight:600, padding:"2px 5px", borderRadius:4 }}>参考</span>
                          }
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:600, color:"#1A237E",
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {em.subject}
                          </div>
                          <div style={{ fontSize:"clamp(11px,1.3vw,12px)", color:"#78909C", marginTop:2,
                            display:"flex", gap:8, flexWrap:"wrap" }}>
                            <span>{fmtDate(em.date)}</span>
                            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>
                              {em.from}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize:"clamp(11px,1.3vw,12px)", color:"#90A4AE", flexShrink:0, alignSelf:"center" }}>
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </div>

                      {/* 展開：本文 + 添付 */}
                      {isOpen && (
                        <div style={{ margin:"0 4px 6px", padding:"10px 12px", background:"#FAFAFA",
                          borderRadius:"0 0 6px 6px", border:"1px solid #E0E0E0", borderTop:"none" }}>
                          {detLoading && !det ? (
                            <div style={{ color:"#90A4AE", fontSize:"clamp(12px,1.4vw,14px)" }}>読み込み中...</div>
                          ) : det ? (
                            <>
                              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", lineHeight:1.7,
                                whiteSpace:"pre-wrap", maxHeight:260, overflowY:"auto", marginBottom: det.attachments.length > 0 ? 8 : 0 }}>
                                {det.body}
                              </div>
                              {det.attachments.length > 0 && (
                                <div style={{ borderTop:"1px solid #E0E0E0", paddingTop:6 }}>
                                  <div style={{ fontSize:"clamp(11px,1.3vw,12px)", fontWeight:700, color:"#546E7A", marginBottom:4 }}>
                                    📎 添付ファイル
                                  </div>
                                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                    {det.attachments.map((att, i) => (
                                      <button key={i}
                                        onClick={() => downloadAttachment(em.id, att.attachmentId, att.filename, att.mimeType)}
                                        style={{ fontSize:"clamp(11px,1.3vw,12px)", padding:"3px 10px",
                                          borderRadius:5, border:"1px solid #90CAF9", background:"#E3F2FD",
                                          color:"#1565C0", cursor:"pointer", fontWeight:600 }}>
                                        ⬇ {att.filename}
                                        {att.size > 0 ? ` (${(att.size/1024).toFixed(0)}KB)` : ''}
                                      </button>
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

export default memo(function TasksView({ tasks, emails = [], today, newTask, setNewTask, onToggle, onDelete, onAdd, onAddBatch, onUpdate, onDeleteDone, showToast }) {
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
    return CHAPTERS.map(ch => {
      const chTasks = tasks.filter(t => t.chapterId === ch.id && !t.done);
      const overdue = chTasks.filter(t => t.dueDate && t.dueDate < todayStr).length;
      const thisWeek = chTasks.filter(t => { if (!t.dueDate) return false; const dl = Math.ceil((parseDate(t.dueDate) - today) / 86400000); return dl >= 0 && dl <= 7; }).length;
      return { ch, total: chTasks.length, overdue, thisWeek };
    }).filter(s => s.total > 0);
  }, [tasks, today]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:700, color:"#1A3A6B", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          タスク管理
          {overdueCount > 0 && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, background:"#FFEBEE", color:"#B71C1C", padding:"2px 8px", borderRadius:10 }}>⚠ 超過 {overdueCount}件</span>}
          {undoneCount > 0 && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:400, color:"#BF360C" }}>未完了 {undoneCount}件</span>}
          {doneCount > 0 && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:400, color:"#78909C" }}>完了 {doneCount}件</span>}
        </div>
        <div style={{ display:"flex", gap:6, marginLeft:"auto", flexWrap:"wrap", alignItems:"center" }}>
          <select aria-label="単会フィルター" style={SEL} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
            <option value="all">全単会</option>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <select aria-label="優先度フィルター" style={SEL} value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
            <option value="all">全優先度</option>
            <option value="high">🔴 高</option>
            <option value="medium">🟡 中</option>
            <option value="low">🟢 低</option>
          </select>
          {hasFilter && (
            <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#546E7A" }} onClick={() => { setFilterCh("all"); setFilterPrio("all"); }}>
              リセット
            </button>
          )}
          <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setShowDone(v => !v)}>
            {showDone ? "完了済みを隠す" : "完了済みも表示"}
          </button>
          {doneCount > 0 && (
            <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#B71C1C" }} onClick={onDeleteDone}>
              🗑 完了済みを削除
            </button>
          )}
          <button style={{ background: groupByDate ? "#1A3A6B" : "#ECEFF1", color: groupByDate ? "#fff" : "#546E7A", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600 }} onClick={() => setGroupByDate(v => !v)}>
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
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#90A4AE", marginTop:2, display:"flex", gap:6 }}>
                {overdue > 0 && <span style={{ color:"#B71C1C", fontWeight:700 }}>超過{overdue}</span>}
                {thisWeek > 0 && <span style={{ color:"#E65100", fontWeight:600 }}>今週{thisWeek}</span>}
              </div>
            </div>
          ))}
          {filterCh !== "all" && (
            <div onClick={() => setFilterCh("all")} style={{ background:"#F5F5F5", border:"2px solid #ECEFF1", borderRadius:8, padding:"6px 12px", cursor:"pointer", display:"flex", alignItems:"center", fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", fontWeight:600 }}>
              全て表示
            </div>
          )}
        </div>
      )}

      <GmailInbox />

      <div style={{ ...CARD, marginBottom:12 }}>
        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#546E7A", marginBottom:7 }}>＋ タスク追加</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
          <input aria-label="タスク内容" style={{ ...INP, flex:3, minWidth:160 }} placeholder="タスク内容..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === "Enter" && onAdd()} />
          <input aria-label="関連URL" type="url" style={{ ...INP, flex:2, minWidth:140 }} placeholder="関連URL（フォーム・Drive等）任意" value={newTask.url || ""} onChange={e => setNewTask({ ...newTask, url: e.target.value })} />
          <select aria-label="担当単会" style={SEL} value={newTask.chapterId} onChange={e => setNewTask({ ...newTask, chapterId: e.target.value })}>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <input aria-label="期限" type="date" style={INP} value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
            <div style={{ display:"flex", gap:3 }}>
              {[["今日",0],["明日",1],["1週",7],["2週",14]].map(([label, days]) => {
                const d = new Date(today); d.setDate(d.getDate() + days);
                const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return <button key={label} type="button" onClick={() => setNewTask(t => ({ ...t, dueDate: ds }))} style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"1px 5px", borderRadius:8, border:`1px solid ${newTask.dueDate===ds?"#1A3A6B":"#CFD8DC"}`, background: newTask.dueDate===ds?"#1A3A6B":"#fff", color: newTask.dueDate===ds?"#fff":"#546E7A", cursor:"pointer", fontWeight:700 }}>{label}</button>;
              })}
            </div>
          </div>
          <select aria-label="優先度" style={SEL} value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
            <option value="high">🔴 高</option>
            <option value="medium">🟡 中</option>
            <option value="low">🟢 低</option>
          </select>
          <button style={BP} onClick={onAdd}>追加</button>
          {onAddBatch && (
            <button style={{ background:"#546E7A", color:"#fff", border:"none", borderRadius:6, padding:"7px 12px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }} title="全5単会に同じタスクを追加" onClick={onAddBatch}>
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
                  { label:"🗓 来週以降", color:"#546E7A", bg:"#F5F5F5", filter: t => t.dueDate > wkStr },
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
                            <td style={TD}><select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.chapterId} onChange={e => setEditForm(f => ({ ...f, chapterId: e.target.value }))}>{CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                            <td style={{ ...TD, maxWidth:200 }}><input autoFocus style={{ ...INP, width:"100%", fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }} /></td>
                            <td style={TD}><input type="date" style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} /></td>
                            <td style={TD} />
                            <td style={TD}><select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}><option value="high">🔴 高</option><option value="medium">🟡 中</option><option value="low">🟢 低</option></select></td>
                            <td style={TD}><div style={{ display:"flex", gap:3 }}><button style={{ ...BSM, background:"#1A3A6B", color:"#fff" }} onClick={() => saveEdit(t.id)}>保存</button><button style={{ ...BSM, color:"#546E7A" }} onClick={() => setEditingId(null)}>取消</button></div></td>
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
                  <tr key="hdr-done"><td colSpan={7} style={{ padding:"5px 10px", background:"#F5F5F5", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#78909C", borderTop:"2px solid #CFD8DC" }}>✓ 完了済み　{doneTasks.length}件</td></tr>,
                  ...doneTasks.map(t => {
                    const ch = getChapter(t.chapterId);
                    const p = PRIO[t.priority] || PRIO.medium;
                    return (
                      <tr key={t.id} className="hover-row" style={{ background:"#FAFAFA", opacity:.55 }}>
                        <td style={TD}><input type="checkbox" aria-label={`${t.title}を未完了に戻す`} checked={true} onChange={() => onToggle(t.id)} style={{ cursor:"pointer" }} /></td>
                        <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                        <td style={{ ...TD, fontWeight:400, textDecoration:"line-through", color:"#90A4AE", maxWidth:200 }}>{t.title}</td>
                        <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)", color:"#90A4AE" }}>{t.dueDate}</td>
                        <td style={TD}><span style={{ fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", color:"#90A4AE" }}>✓完了</span></td>
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
                          {CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={{ ...TD, maxWidth:200 }}>
                        <input autoFocus style={{ ...INP, width:"100%", fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }} />
                      </td>
                      <td style={TD}>
                        <input type="date" style={{ ...INP, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                      </td>
                      <td style={TD} />
                      <td style={TD}>
                        <select style={{ ...SEL, fontSize:"clamp(12px,1.4vw,14px)" }} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                          <option value="high">🔴 高</option>
                          <option value="medium">🟡 中</option>
                          <option value="low">🟢 低</option>
                        </select>
                      </td>
                      <td style={TD}>
                        <div style={{ display:"flex", gap:3 }}>
                          <button style={{ ...BSM, background:"#1A3A6B", color:"#fff" }} onClick={() => saveEdit(t.id)}>保存</button>
                          <button style={{ ...BSM, color:"#546E7A" }} onClick={() => setEditingId(null)}>取消</button>
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
                    <td style={TD}><span style={{ fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", color: t.done ? "#90A4AE" : dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : dl <= 7 ? "#FF8F00" : "#2E7D32" }}>{t.done ? "✓完了" : dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span></td>
                    <td style={TD}><span style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700 }}>{p.label}</span></td>
                    <td style={TD}>
                      <div style={{ display:"flex", gap:3 }}>
                        {!t.done && <button style={{ ...BSM, color:"#1565C0" }} title="タスクを編集" aria-label={`${t.title}を編集`} onClick={() => startEdit(t)}>編集</button>}
                        {!t.done && <button style={{ ...BSM, color:"#B71C1C", padding:"2px 7px" }} title="タスクを削除" aria-label={`${t.title}を削除`} onClick={() => onDelete(t.id)}>×</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ ...TD, textAlign:"center", color:"#90A4AE", padding:22 }}>
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
