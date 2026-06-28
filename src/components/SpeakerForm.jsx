import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { CHAPTERS, STATUS, SEMINAR_TYPES } from '../constants';
import { getChapter, getSeminarType, toDateStr, extractMaterialLinks, buildSpeakerStoragePath, extractStaffNotes } from '../utils';
import { OV, MOD, MH, BP, BC, INP } from '../styles';
import { db } from '../lib/supabase';

const BLANK = { chapterId:"kawaguchi", speakerName:"", speakerKana:"", speakerUnit:"", company:"", role:"", companyRole:"", seminarDate:"", topic:"", status:"pending", phone:"", email:"", requestDate:"", notes:"", venue:"", seminarType:"ms", lodging:"不要", printRequired:"不要", materialUrl:"", materialName:"" };

const DRAFT_KEY = 'speakerFormDraft';

export default memo(function SpeakerForm({ initial, speakers, onSave, onClose, saving }) {
  const isNew = !initial?.id;
  const normalizeLodging = v => (!v || v === "不要" || v === "なし") ? "不要" : v === "要" ? "あり（前泊）" : v;
  const normalizePrint = v => (!v || v === "不要" || v?.startsWith("不要")) ? "不要" : (v === "あり" || v?.startsWith("要")) ? "あり" : "不要";
  const normalizeInitial = obj => obj ? { ...obj, lodging: normalizeLodging(obj.lodging), printRequired: normalizePrint(obj.printRequired) } : obj;
  const [form, setForm] = useState(() => {
    if (!isNew) return normalizeInitial(initial);
    const savedChapter = (() => { try { return localStorage.getItem('form_lastChapter') || "kawaguchi"; } catch { return "kawaguchi"; } })();
    const base = { ...BLANK, chapterId: savedChapter, requestDate: new Date().toISOString().slice(0,10) };
    if (initial) return { ...base, ...normalizeInitial(initial) };
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) return JSON.parse(draft);
    } catch {}
    return base;
  });
  const [err, setErr] = useState("");
  // 備考（確認書⑦に反映される自由記述）。内容要約や資料等のタグは保持したまま編集する
  const [staffNotes, setStaffNotes] = useState(() => extractStaffNotes(form.notes));
  const onChangeStaffNotes = (val) => {
    setErr("");
    setStaffNotes(val);
    setForm(f => {
      const n = String(f.notes || '').replace(/\\n/g, '\n');
      const tagged = [];
      const summaryMatch = n.match(/【内容要約】\n[\s\S]*?(?=\n【|$)/);
      if (summaryMatch) tagged.push(summaryMatch[0].trim());
      (n.match(/【[^】]+】[^\n]*/g) || []).forEach(t => { if (!t.startsWith('【内容要約】')) tagged.push(t); });
      const newNotes = [val.trim(), tagged.join('\n')].filter(Boolean).join('\n\n');
      return { ...f, notes: newNotes };
    });
  };
  const [hasDraft] = useState(() => {
    if (!isNew || initial) return false;
    try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; }
  });

  useEffect(() => {
    if (!isNew) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
  }, [form, isNew]);

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

  const [zipLoading, setZipLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docUploading1, setDocUploading1] = useState(false);
  const [docUploading2, setDocUploading2] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const fileInputRef  = useRef(null);
  const docInput1Ref  = useRef(null);
  const docInput2Ref  = useRef(null);

  const set = (k, v) => {
    setErr("");
    if (k === 'chapterId') { try { localStorage.setItem('form_lastChapter', v); } catch {} }
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'seminarType' || k === 'chapterId') {
        const newSt = getSeminarType(k === 'seminarType' ? v : f.seminarType);
        const newCh = getChapter(k === 'chapterId' ? v : f.chapterId);
        if (newSt?.venueFixed && newCh) next.venue = newCh.venue;
      }
      return next;
    });
  };

  // Supabase Storage パスに使えるASCII文字列に変換（日本語・記号を除去）
  const toAsciiPath = (name) =>
    (name || 'speaker')
      .replace(/[^\x00-\x7F]/g, '')   // 日本語・全角文字を削除
      .replace(/[^a-zA-Z0-9_-]/g, '_') // 記号をアンダースコアに
      .replace(/^_+|_+$/g, '')          // 前後のアンダースコアを除去
      || `spk${Date.now()}`;            // 全部消えた場合のフォールバック

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadErr('');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const safeName = toAsciiPath(form.speakerName);
      // form.html と統一: `単会ID/YYYYMMDD/講師名(ローマ字)/photo.ext`
      const path = buildSpeakerStoragePath(form.chapterId, form.seminarDate, form.speakerKana, form.speakerName, 'photo', ext);
      const { error } = await db.storage.from('speaker-files').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data: { publicUrl } } = db.storage.from('speaker-files').getPublicUrl(path);
      // キャッシュバスター付きでURLを保存（同じパスでも画像差し替え時に反映されるため）
      set('materialUrl', `${publicUrl}?t=${Date.now()}`);
      if (!form.materialName) set('materialName', `${safeName}_顔写真.${ext}`);
    } catch (err) {
      setUploadErr(`アップロード失敗: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  // notes の中の【資料0N】URLを挿入・上書きするヘルパー
  const upsertDocInNotes = (notes, label, url) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`【${escaped}】\\s*https?://\\S+`);
    if (pattern.test(notes || '')) return (notes || '').replace(pattern, `【${label}】${url}`);
    const sep = (notes && !notes.endsWith('\n')) ? '\n\n' : '\n';
    return (notes || '') + sep + `【${label}】${url}`;
  };

  const handleDocUpload = async (e, docNum, setLoading, inputRef) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setUploadErr('');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      // form.html と統一: `単会ID/YYYYMMDD/講師名(ローマ字)/doc{N}.ext`
      const typeKey = `doc${docNum}`;
      const path = buildSpeakerStoragePath(form.chapterId, form.seminarDate, form.speakerKana, form.speakerName, typeKey, ext);
      const { error } = await db.storage.from('speaker-files').upload(path, file, {
        upsert: true, contentType: file.type,
      });
      if (error) throw error;
      const { data: { publicUrl } } = db.storage.from('speaker-files').getPublicUrl(path);
      const label = `資料0${docNum}`;
      // キャッシュバスター付きでnotesへ保存
      set('notes', upsertDocInNotes(form.notes, label, `${publicUrl}?t=${Date.now()}`));
    } catch (err) {
      setUploadErr(`資料アップロード失敗: ${err.message}`);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const currentDocs = useMemo(() => extractMaterialLinks(form.notes || ''), [form.notes]);

  // Supabase Storage の公開URLからファイルを削除（パスが取れない/既に無い場合は無視）
  const deleteStorageFile = async (url) => {
    if (!url) return;
    const m = url.match(/\/speaker-files\/([^?]+)/);
    if (!m) return;
    try { await db.storage.from('speaker-files').remove([decodeURIComponent(m[1])]); } catch {}
  };

  // 顔写真を削除（ストレージ＋フォーム）
  const handlePhotoDelete = async () => {
    if (!form.materialUrl) return;
    if (!window.confirm('アップロード済みの顔写真を削除します。よろしいですか？')) return;
    setUploading(true);
    setUploadErr('');
    await deleteStorageFile(form.materialUrl);
    setForm(f => ({ ...f, materialUrl: '', materialName: '' }));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 講話資料（資料01/02）を削除（ストレージ＋notes内の【資料0N】行）
  const handleDocDelete = async (docNum) => {
    const label = `資料0${docNum}`;
    const doc = currentDocs.find(d => d.label === label);
    if (!doc) return;
    if (!window.confirm(`アップロード済みの${label}を削除します。よろしいですか？`)) return;
    const setLoading = docNum === 1 ? setDocUploading1 : setDocUploading2;
    setLoading(true);
    setUploadErr('');
    await deleteStorageFile(doc.url);
    setForm(f => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const n = String(f.notes || '')
        .replace(new RegExp(`【${escaped}】\\s*https?://\\S+\\n?`), '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return { ...f, notes: n };
    });
    setLoading(false);
  };

  const detailFromNotes = useMemo(() => {
    const notes = String(form.notes || '').replace(/\\n/g, '\n');
    const result = {};
    const summaryMatch = notes.match(/【内容要約】\n([\s\S]*?)(?=\n【|$)/);
    if (summaryMatch) result.summary = summaryMatch[1].trim();
    const tagLine = /【([^】]+)】([^\n【]*)/g;
    let m;
    while ((m = tagLine.exec(notes)) !== null) {
      if (m[1] !== '内容要約') result[m[1]] = m[2].trim();
    }
    result.prepareArr = result['単会で準備']
      ? result['単会で準備'].split('・').map(s => s.trim()).filter(Boolean)
      : [];
    return result;
  }, [form.notes]);

  const setDetailField = (tag, value) => {
    setErr("");
    setForm(f => {
      const n = String(f.notes || '').replace(/\\n/g, '\n');
      let newNotes;
      if (tag === '内容要約') {
        const cleared = n.replace(/【内容要約】\n[\s\S]*?(?=\n【|$)/g, '').replace(/\n{3,}/g, '\n\n').trim();
        newNotes = value ? (cleared ? cleared + '\n\n' : '') + `【内容要約】\n${value}` : cleared;
      } else if (Array.isArray(value)) {
        const tagVal = value.filter(Boolean).join('・');
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cleared = n.replace(new RegExp(`【${escaped}】[^\n]*`), '').replace(/\n{3,}/g, '\n\n').trim();
        newNotes = tagVal ? (cleared ? cleared + '\n' : '') + `【${tag}】${tagVal}` : cleared;
      } else {
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cleared = n.replace(new RegExp(`【${escaped}】[^\n]*`), '').replace(/\n{3,}/g, '\n\n').trim();
        newNotes = value ? (cleared ? cleared + '\n' : '') + `【${tag}】${value}` : cleared;
      }
      return { ...f, notes: newNotes };
    });
  };

  // 郵便番号 → 住所 自動入力（zipcloud 無料API・キー不要）
  const lookupAddress = async () => {
    const zip = String(detailFromNotes['領収証郵便番号'] || '').replace(/[^0-9]/g, '');
    if (zip.length !== 7) { setErr('郵便番号は7桁で入力してください（例: 3330801）'); return; }
    setErr('');
    setZipLoading(true);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.status !== 200 || !data.results || !data.results.length) {
        setErr('該当する住所が見つかりませんでした'); return;
      }
      const r = data.results[0];
      setDetailField('領収証住所', `${r.address1}${r.address2}${r.address3}`);
    } catch {
      setErr('住所の取得に失敗しました（通信エラー）');
    } finally {
      setZipLoading(false);
    }
  };

  const ch = getChapter(form.chapterId);
  const st = getSeminarType(form.seminarType || "ms");

  const duplicate = useMemo(() => {
    if (!form.chapterId || !form.seminarDate || !speakers) return null;
    return speakers.find(sp =>
      sp.chapterId === form.chapterId &&
      sp.seminarDate === form.seminarDate &&
      sp.id !== form.id &&
      sp.status !== "cancelled"
    ) || null;
  }, [form.chapterId, form.seminarDate, form.id, speakers]);

  const pastTalks = useMemo(() => {
    const name = form.speakerName?.trim();
    if (!name || !speakers) return [];
    return speakers
      .filter(sp => sp.speakerName === name && sp.id !== form.id)
      .sort((a, b) => new Date(b.seminarDate) - new Date(a.seminarDate));
  }, [form.speakerName, form.id, speakers]);

  const latestPast = pastTalks[0];
  const canAutofill = isNew && latestPast && (!form.company || !form.speakerKana);

  const suggestDates = useMemo(() => {
    const chapter = getChapter(form.chapterId);
    if (!chapter || chapter.day < 0) return [];
    const now = new Date();
    const todayDay = now.getDay();
    const baseOffset = (chapter.day - todayDay + 7) % 7 || 7;
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + baseOffset + i * 7);
      return toDateStr(d);
    });
  }, [form.chapterId]);

  const shioriConflict = useMemo(() => {
    if (!form.shioriArticle || !speakers) return null;
    return speakers.filter(sp =>
      sp.id !== form.id &&
      sp.shioriArticle === form.shioriArticle &&
      sp.status !== "cancelled"
    ).sort((a, b) => new Date(b.seminarDate) - new Date(a.seminarDate)).slice(0, 3);
  }, [form.shioriArticle, form.id, speakers]);

  const isPastDate = useMemo(() => {
    if (!form.seminarDate || initial?.id) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return form.seminarDate < todayStr;
  }, [form.seminarDate, initial?.id]);

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={initial ? "講師情報を編集" : "新規講師登録"} style={{ ...MOD, maxWidth:560 }} onClick={e => e.stopPropagation()} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !saving) { e.preventDefault(); if (!form.speakerName) return setErr("講師名は必須です"); if (!form.seminarDate) return setErr("開催日は必須です"); if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr("メールアドレスの形式が正しくありません"); clearDraft(); onSave(form); } }}>
        <div style={{ ...MH, borderBottomColor: st.color }}>
          {initial?.id ? `📝 ${initial.speakerName} を編集` : "新規講師登録"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
          {[
            { l:"種別 *",      k:"seminarType", t:"stype" },
            { l:"単会",        k:"chapterId",   t:"select", o: CHAPTERS.map(c => ({ v:c.id, l:c.name })) },
            { l: form.seminarType === "kiso" ? "基礎講座日 *" : "開催日 *", k:"seminarDate", t:"date" },
            { l:"講師名 *",    k:"speakerName", t:"text",  p:"山田 太郎" },
            { l:"ふりがな",    k:"speakerKana", t:"text",  p:"やまだ たろう" },
            { l:"所属法人会名",    k:"speakerUnit",  t:"text",  p:"川口倫理法人会" },
            { l:"法人会役職",      k:"role",         t:"text",  p:"会長・専任幹事など" },
            { l:"勤務先",          k:"company",      t:"text",  p:"株式会社○○" },
            { l:"勤務先役職名",    k:"companyRole",  t:"text",  p:"代表取締役" },
            { l:"メール *",    k:"email",       t:"email", p:"email@example.com" },
            { l:"電話",        k:"phone",       t:"text",  p:"090-0000-0000" },
            { l:"ステータス",  k:"status",      t:"select", o: Object.entries(STATUS).map(([k, v]) => ({ v:k, l:v.label })) },
            { l:"依頼日",      k:"requestDate", t:"date" },
          ].map(({ l, k, t, p, o }) => (
            <div key={k}>
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>{l}</div>
              {t === "select" ? (
                <select disabled={saving} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} value={form[k] || ""} onChange={e => set(k, e.target.value)}>
                  {o.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
              ) : t === "stype" ? (() => {
                const KNOWN = SEMINAR_TYPES.filter(x => x.id !== "other");
                const isCustom = !!form.seminarType && !KNOWN.some(x => x.id === form.seminarType);
                return (
                  <>
                    <select disabled={saving} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }}
                      value={isCustom ? "other" : (form.seminarType || "")}
                      onChange={e => set("seminarType", e.target.value)}>
                      {KNOWN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      <option value="other">自主企画（自由入力）</option>
                    </select>
                    {isCustom && (
                      <input disabled={saving} type="text" style={{ ...INP, width:"100%", marginTop:5, opacity: saving ? .6 : 1 }}
                        placeholder="セミナー名を入力（例：新春特別講演会）"
                        value={form.seminarType === "other" ? "" : form.seminarType}
                        onChange={e => set("seminarType", e.target.value || "other")} />
                    )}
                  </>
                );
              })() : (
                <input disabled={saving} autoFocus={k === "speakerName"} type={t} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} placeholder={p} value={form[k] || ""} onChange={e => set(k, e.target.value)} />
              )}
              {k === "seminarType" && form.seminarType === "kiso" && (
                <div style={{ marginTop:5, background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:6, padding:"5px 10px", fontSize:"clamp(12px,1.4vw,14px)", color:"#2E7D32", fontWeight:600 }}>
                  ⓘ 基礎講座の講師依頼は、「基礎講座」を選ぶとMS分も同時に作成されます。
                </div>
              )}
              {k === "seminarDate" && form.seminarType === "kiso" && form.seminarDate && (() => {
                const d = new Date(form.seminarDate + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                const msStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const dow = ["日","月","火","水","木","金","土"][d.getDay()];
                return (
                  <div style={{ marginTop:5, background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, padding:"4px 10px", fontSize:"clamp(12px,1.4vw,14px)", color:"#1565C0", fontWeight:600 }}>
                    MS日（翌日）：{msStr}（{dow}）
                  </div>
                );
              })()}
              {k === "seminarDate" && !form.seminarDate && suggestDates.length > 0 && (
                <div style={{ marginTop:5, display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3", fontWeight:600 }}>次回：</span>
                  {suggestDates.map(d => (
                    <button key={d} type="button" style={{ fontSize:"clamp(12px,1.4vw,14px)", background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:10, padding:"2px 8px", color:"#1565C0", cursor:"pointer", fontWeight:700 }} onClick={() => set("seminarDate", d)}>{d}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>前泊・宿泊</div>
            <select disabled={saving} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} value={form.lodging || "不要"} onChange={e => set("lodging", e.target.value)}>
              <option value="不要">不要</option>
              <option value="あり（前泊）">あり（前泊）</option>
              <option value="あり（当日のみ）">あり（当日のみ）</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>資料印刷</div>
            <select disabled={saving} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} value={form.printRequired || "不要"} onChange={e => set("printRequired", e.target.value)}>
              <option value="不要">不要（持参 or なし）</option>
              <option value="あり">あり（単会で印刷）</option>
            </select>
          </div>

          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>
              開催場所
              {st.venueFixed && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3", marginLeft:6 }}>※ 単会マスターから自動取得</span>}
            </div>
            {st.venueFixed ? (
              <div style={{ ...INP, background:"#F5F5F5", color:"#98A2B3", cursor:"not-allowed", display:"flex", alignItems:"center" }}>
                {ch.venue}
              </div>
            ) : (
              <input disabled={saving} type="text" style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} placeholder="会場名を入力" value={form.venue || ""} onChange={e => set("venue", e.target.value)} />
            )}
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>テーマ</div>
            <input disabled={saving} type="text" style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} placeholder="セミナーテーマ" value={form.topic || ""} onChange={e => set("topic", e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>顔写真・資料URL（URLを貼るか、ファイルをアップロード）</div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input disabled={saving || uploading} type="url" style={{ ...INP, flex:1, opacity:(saving||uploading) ? .6 : 1 }}
                placeholder="https://... またはアップロードボタンを使用" value={form.materialUrl || ""} onChange={e => set("materialUrl", e.target.value)} />
              <label style={{ display:"inline-flex", alignItems:"center", gap:5, background: uploading ? "#98A2B3" : "#1565C0", color:"#fff", borderRadius:6, padding:"8px 14px", cursor: uploading ? "not-allowed" : "pointer", fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", whiteSpace:"nowrap", flexShrink:0, userSelect:"none" }}>
                {uploading ? "⏳ 送信中…" : "📤 アップロード"}
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={handleFileUpload} disabled={uploading || saving} />
              </label>
              {form.materialUrl && (
                <button type="button" disabled={uploading || saving} onClick={handlePhotoDelete}
                  title="アップロード済みの写真・資料を削除"
                  style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#fff", color:"#B71C1C", border:"1px solid #EF9A9A", borderRadius:6, padding:"8px 12px", cursor:(uploading||saving)?"not-allowed":"pointer", fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", whiteSpace:"nowrap", flexShrink:0, opacity:(uploading||saving)?.6:1 }}>
                  🗑 削除
                </button>
              )}
            </div>
            {form.materialUrl && /\.(jpg|jpeg|png|webp)$/i.test(form.materialUrl?.split('?')[0] || '') && (
              <img src={form.materialUrl} alt="プレビュー"
                style={{ marginTop:8, width:80, height:80, objectFit:"cover", borderRadius:"50%", border:"3px solid #90CAF9", display:"block" }} />
            )}
            {uploadErr && <div style={{ marginTop:5, fontSize:"clamp(12px,1.4vw,14px)", color:"#B71C1C" }}>⚠ {uploadErr}</div>}
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>資料ファイル名・メモ</div>
            <input disabled={saving} type="text" style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} placeholder="例：山田太郎_顔写真.jpg　資料あり" value={form.materialName || ""} onChange={e => set("materialName", e.target.value)} />
          </div>

          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:6, fontWeight:600 }}>📄 講話資料アップロード（PDF・画像 最大2件）</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {/* 資料1 */}
              <div style={{ flex:"1 1 200px" }}>
                <label style={{ display:"inline-flex", alignItems:"center", gap:5, background: docUploading1 ? "#98A2B3" : "#E65100", color:"#fff", borderRadius:6, padding:"8px 14px", cursor: docUploading1 ? "not-allowed" : "pointer", fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", whiteSpace:"nowrap", userSelect:"none" }}>
                  {docUploading1 ? "⏳ 送信中…" : "📄 資料①をアップロード"}
                  <input ref={docInput1Ref} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e => handleDocUpload(e, 1, setDocUploading1, docInput1Ref)} disabled={docUploading1 || saving} />
                </label>
                {currentDocs.find(d => d.label === '資料01') && (
                  <div style={{ marginTop:5, display:"flex", alignItems:"center", gap:6, fontSize:"clamp(12px,1.4vw,14px)" }}>
                    <span style={{ color:"#2E7D32", fontWeight:700 }}>✅ 資料①アップロード済</span>
                    <a href={currentDocs.find(d => d.label === '資料01').url} target="_blank" rel="noopener noreferrer" style={{ color:"#1565C0", textDecoration:"underline" }}>確認</a>
                    <button type="button" disabled={docUploading1 || saving} onClick={() => handleDocDelete(1)} style={{ background:"none", border:"none", color:"#B71C1C", textDecoration:"underline", cursor:(docUploading1||saving)?"not-allowed":"pointer", fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", padding:0 }}>🗑 削除</button>
                  </div>
                )}
              </div>
              {/* 資料2 */}
              <div style={{ flex:"1 1 200px" }}>
                <label style={{ display:"inline-flex", alignItems:"center", gap:5, background: docUploading2 ? "#98A2B3" : "#4E342E", color:"#fff", borderRadius:6, padding:"8px 14px", cursor: docUploading2 ? "not-allowed" : "pointer", fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", whiteSpace:"nowrap", userSelect:"none" }}>
                  {docUploading2 ? "⏳ 送信中…" : "📄 資料②をアップロード"}
                  <input ref={docInput2Ref} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e => handleDocUpload(e, 2, setDocUploading2, docInput2Ref)} disabled={docUploading2 || saving} />
                </label>
                {currentDocs.find(d => d.label === '資料02') && (
                  <div style={{ marginTop:5, display:"flex", alignItems:"center", gap:6, fontSize:"clamp(12px,1.4vw,14px)" }}>
                    <span style={{ color:"#2E7D32", fontWeight:700 }}>✅ 資料②アップロード済</span>
                    <a href={currentDocs.find(d => d.label === '資料02').url} target="_blank" rel="noopener noreferrer" style={{ color:"#1565C0", textDecoration:"underline" }}>確認</a>
                    <button type="button" disabled={docUploading2 || saving} onClick={() => handleDocDelete(2)} style={{ background:"none", border:"none", color:"#B71C1C", textDecoration:"underline", cursor:(docUploading2||saving)?"not-allowed":"pointer", fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", padding:0 }}>🗑 削除</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* 詳細入力（FAX返信用）折りたたみセクション */}
          <div style={{ gridColumn:"1/-1" }}>
            <button
              type="button"
              disabled={saving}
              style={{ width:"100%", background: showDetail ? "#061B44" : "#F1F5F9", color: showDetail ? "#fff" : "#667085", border:"none", borderRadius:8, padding:"10px 16px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor: saving ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"space-between", opacity: saving ? .6 : 1 }}
              onClick={() => setShowDetail(v => !v)}
            >
              <span>📋 詳細入力（FAX返信用）</span>
              <span>{showDetail ? "▲ 閉じる" : "▼ 開く"}</span>
            </button>

            {showDetail && (
              <div style={{ border:"1px solid #90CAF9", borderRadius:8, padding:14, marginTop:8, background:"#F8FBFF", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>

                {/* ③ 内容要約 */}
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>③ 内容要約（300字以内）</div>
                  <textarea
                    disabled={saving}
                    maxLength={300}
                    style={{ ...INP, width:"100%", minHeight:80, resize:"vertical", opacity: saving ? .6 : 1 }}
                    placeholder="講話内容の要約をご記入ください（300字以内）"
                    value={detailFromNotes.summary || ""}
                    onChange={e => setDetailField('内容要約', e.target.value)}
                  />
                  <div style={{ fontSize:"clamp(11px,1.2vw,12px)", color:(detailFromNotes.summary||"").length >= 300 ? "#E53935" : "#98A2B3", textAlign:"right" }}>
                    {(detailFromNotes.summary||"").length} / 300文字
                  </div>
                </div>

                {/* ④ 交通手段 */}
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>④ 交通手段</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {["お車","電車","その他"].map(v => {
                      const sel = detailFromNotes['交通手段'] === v;
                      return (
                        <label key={v} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background: sel ? "#E8EDF7" : "#F5F7FA", border:`1.5px solid ${sel ? "#061B44" : "#D0D7E2"}`, borderRadius:7, padding:"7px 14px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight: sel ? 700 : 400 }}>
                          <input type="radio" name="detail-transport" value={v} checked={sel} onChange={() => setDetailField('交通手段', v)} style={{ accentColor:"#061B44" }} disabled={saving} />
                          {v}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ④ 単会で準備 */}
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>④ 単会で準備（複数選択可）</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {["プロジェクタ","パソコン","ホワイトボード","その他","無し"].map(v => {
                      const checked = detailFromNotes.prepareArr.includes(v);
                      return (
                        <label key={v} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background: checked ? "#E8EDF7" : "#F5F7FA", border:`1.5px solid ${checked ? "#061B44" : "#D0D7E2"}`, borderRadius:7, padding:"7px 14px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight: checked ? 700 : 400 }}>
                          <input type="checkbox" checked={checked} disabled={saving} onChange={() => {
                            const cur = detailFromNotes.prepareArr;
                            const next = checked ? cur.filter(x => x !== v) : [...cur, v];
                            setDetailField('単会で準備', next);
                          }} style={{ accentColor:"#061B44" }} />
                          {v}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ⑤ 前泊=要のときのみ表示 */}
                {form.lodging && form.lodging !== "不要" && form.lodging !== "なし" && (
                  <>
                    <div>
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>⑤ 禁煙ルーム</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {["禁煙","喫煙","どちらでも"].map(v => {
                          const sel = detailFromNotes['禁煙ルーム'] === v;
                          return (
                            <label key={v} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", background: sel ? "#E8EDF7" : "#F5F7FA", border:`1.5px solid ${sel ? "#061B44" : "#D0D7E2"}`, borderRadius:7, padding:"6px 12px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight: sel ? 700 : 400 }}>
                              <input type="radio" name="detail-room" value={v} checked={sel} disabled={saving} onChange={() => setDetailField('禁煙ルーム', v)} style={{ accentColor:"#061B44" }} />
                              {v}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>⑤ お迎え</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {["要","不要"].map(v => {
                          const sel = detailFromNotes['お迎え'] === v;
                          return (
                            <label key={v} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", background: sel ? "#E8EDF7" : "#F5F7FA", border:`1.5px solid ${sel ? "#061B44" : "#D0D7E2"}`, borderRadius:7, padding:"6px 14px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight: sel ? 700 : 400 }}>
                              <input type="radio" name="detail-pickup" value={v} checked={sel} disabled={saving} onChange={() => setDetailField('お迎え', v)} style={{ accentColor:"#061B44" }} />
                              {v}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* ⑤ 領収証宛名 */}
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>⑤ 領収証宛名</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {["個人宛","会社宛"].map(v => {
                      const sel = detailFromNotes['領収証宛名'] === v;
                      return (
                        <label key={v} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background: sel ? "#E8EDF7" : "#F5F7FA", border:`1.5px solid ${sel ? "#061B44" : "#D0D7E2"}`, borderRadius:7, padding:"7px 18px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight: sel ? 700 : 400 }}>
                          <input type="radio" name="detail-receipt" value={v} checked={sel} disabled={saving} onChange={() => setDetailField('領収証宛名', v)} style={{ accentColor:"#061B44" }} />
                          {v}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ⑤ 領収証郵便番号 + 住所 */}
                <div>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>⑤ 領収証郵便番号</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <input disabled={saving} type="text" maxLength={8} style={{ ...INP, flex:1, opacity: saving ? .6 : 1 }} placeholder="333-0801" value={detailFromNotes['領収証郵便番号'] || ""} onChange={e => setDetailField('領収証郵便番号', e.target.value)} />
                    <button type="button" disabled={saving || zipLoading} onClick={lookupAddress}
                      title="郵便番号から住所を自動入力"
                      style={{ flexShrink:0, background: zipLoading ? "#90A4AE" : "#061B44", color:"#fff", border:"none", borderRadius:6, padding:"0 12px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, cursor:(saving||zipLoading)?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
                      {zipLoading ? "⏳" : "住所入力"}
                    </button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>⑤ 領収証住所</div>
                  <input disabled={saving} type="text" style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} placeholder="埼玉県○○市○○1-2-3" value={detailFromNotes['領収証住所'] || ""} onChange={e => setDetailField('領収証住所', e.target.value)} />
                </div>

                {/* ⑥ 顔写真の使用範囲 */}
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:4, fontWeight:600 }}>⑥ 顔写真の使用範囲</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {["全媒体承諾","公式HPのみ","Facebookのみ","要相談"].map(v => {
                      const sel = detailFromNotes['顔写真の使用範囲'] === v;
                      return (
                        <label key={v} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background: sel ? "#E8EDF7" : "#F5F7FA", border:`1.5px solid ${sel ? "#061B44" : "#D0D7E2"}`, borderRadius:7, padding:"7px 14px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight: sel ? 700 : 400 }}>
                          <input type="radio" name="detail-photouse" value={v} checked={sel} disabled={saving} onChange={() => setDetailField('顔写真の使用範囲', v)} style={{ accentColor:"#061B44" }} />
                          {v}
                        </label>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>備考・特記事項 <span style={{ color:"#1565C0", fontWeight:700 }}>（確認書の⑦に反映されます）</span></div>
            <textarea disabled={saving} style={{ ...INP, width:"100%", minHeight:54, resize:"vertical", opacity: saving ? .6 : 1 }} placeholder="ここに書いた内容が講師依頼確認書の「備考・特記事項」欄に表示されます" value={staffNotes} onChange={e => onChangeStaffNotes(e.target.value)} />
          </div>

          <div style={{ gridColumn:"1/-1", borderTop:"2px dashed #E0E0E0", paddingTop:12, marginTop:4 }}>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#667085", marginBottom:8 }}>📝 講話後メモ（終了後に記入）</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>お酒を飲むか</div>
                <select disabled={saving} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} value={form.drinksAlcohol || ""} onChange={e => set("drinksAlcohol", e.target.value)}>
                  <option value="">未確認</option>
                  <option value="飲む">飲む</option>
                  <option value="飲まない">飲まない</option>
                  <option value="少量なら">少量なら</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>栞・第何条</div>
                <select disabled={saving} style={{ ...INP, width:"100%", opacity: saving ? .6 : 1 }} value={form.shioriArticle || ""} onChange={e => set("shioriArticle", e.target.value)}>
                  <option value="">未記入</option>
                  {Array.from({length:17},(_,i)=>`第${i+1}条`).map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>講話内容・特記事項・次回への申し送り</div>
                <textarea disabled={saving} style={{ ...INP, width:"100%", minHeight:80, resize:"vertical", opacity: saving ? .6 : 1 }} placeholder="講話の内容、参加者の反応、次回依頼時の注意点など自由に記入" value={form.postNotes || ""} onChange={e => set("postNotes", e.target.value)} />
              </div>
              {shioriConflict && shioriConflict.length > 0 && (
                <div style={{ gridColumn:"1/-1", padding:"6px 10px", background:"#FFF8E1", border:"1px solid #FFE082", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#E65100" }}>
                  <span style={{ fontWeight:700 }}>⚠ この条は他の講師も使用済み：</span>
                  {shioriConflict.map(sp => { const c = getChapter(sp.chapterId); return <span key={sp.id} style={{ marginLeft:6 }}>{sp.seminarDate} {c.name} {sp.speakerName}</span>; })}
                </div>
              )}
            </div>
          </div>
        </div>
        {pastTalks.length > 0 && (
          <div style={{ marginTop:10, padding:"8px 12px", background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#1565C0" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5, flexWrap:"wrap", gap:6 }}>
              <div style={{ fontWeight:700 }}>📚 この講師の過去講話（{pastTalks.length}件）</div>
              {canAutofill && (
                <button style={{ fontSize:"clamp(12px,1.4vw,14px)", background:"#1565C0", color:"#fff", border:"none", borderRadius:8, padding:"2px 10px", cursor:"pointer", fontWeight:700 }}
                  onClick={() => setForm(f => ({
                    ...f,
                    speakerKana:  f.speakerKana  || latestPast.speakerKana  || "",
                    speakerUnit:  f.speakerUnit  || latestPast.speakerUnit  || "",
                    company:      f.company      || latestPast.company      || "",
                    role:         f.role         || latestPast.role         || "",
                    companyRole:  f.companyRole  || latestPast.companyRole  || "",
                    email:        f.email        || latestPast.email        || "",
                    phone:        f.phone        || latestPast.phone        || "",
                  }))}>
                  前回情報を自動入力
                </button>
              )}
            </div>
            {pastTalks.slice(0, 3).map(sp => {
              const ch = getChapter(sp.chapterId);
              return (
                <div key={sp.id} style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", marginBottom:2 }}>
                  {sp.seminarDate} ｜ {ch.name} ｜「{sp.topic}」
                </div>
              );
            })}
            {pastTalks.length > 3 && <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3" }}>…他{pastTalks.length - 3}件</div>}
          </div>
        )}
        {duplicate && (
          <div style={{ marginTop:10, padding:"8px 12px", background:"#FFF8E1", border:"1px solid #FFE082", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#E65100", fontWeight:600 }}>
            ⚠ 同じ単会・開催日の講師が既に登録されています（{duplicate.speakerName}）。続けて登録することもできます。
          </div>
        )}
        {hasDraft && isNew && !initial && (
          <div style={{ marginTop:8, padding:"6px 12px", background:"#FFF8E1", border:"1px solid #FFE082", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#E65100", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>📝 前回の入力内容を復元しました</span>
            <button style={{ background:"none", border:"none", fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3", cursor:"pointer", textDecoration:"underline" }} onClick={() => { clearDraft(); setForm({ ...BLANK, chapterId: form.chapterId, requestDate: form.requestDate }); }}>クリア</button>
          </div>
        )}
        {isPastDate && (
          <div style={{ marginTop:8, padding:"6px 12px", background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#1565C0" }}>
            ℹ 過去の日付が入力されています。終了済み講師を記録する場合はそのまま登録できます。
          </div>
        )}
        {err && <div style={{ marginTop:10, padding:"8px 12px", background:"#FFEBEE", border:"1px solid #FFCDD2", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#B71C1C", fontWeight:600 }}>⚠ {err}</div>}
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button style={{ ...BP, opacity: saving ? .6 : 1 }} disabled={saving} onClick={() => {
            if (!form.speakerName) return setErr("講師名は必須です");
            if (!form.seminarDate) return setErr("開催日は必須です");
            if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr("メールアドレスの形式が正しくありません");
            clearDraft();
            onSave(form);
          }}>
            {saving ? "⏳ 保存中..." : initial ? "💾 変更を保存" : "✓ 登録する"}
          </button>
          <button style={BC} disabled={saving} onClick={() => { clearDraft(); onClose(); }}>キャンセル</button>
        </div>
      </div>
    </div>
  );
});
