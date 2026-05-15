import React, { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { getChapter, getSeminarType, toDateStr, extractStaffNotes, extractMaterialLinks, parseDate } from '../utils';
import { BP, BC, SEL, INP, OV, MOD, MH } from '../styles';
import FileViewModal from './FileViewModal';

function extractStructuredNotes(notes) {
  if (!notes) return '';
  const lines = [];
  const sm = notes.match(/【内容要約】\n[\s\S]*?(?=\n【|$)/);
  if (sm) lines.push(sm[0].trim());
  const re = /【([^】]+)】([^\n]*)/g;
  let m;
  while ((m = re.exec(notes)) !== null) {
    if (m[1] !== '内容要約') lines.push(`【${m[1]}】${m[2]}`);
  }
  return lines.join('\n');
}

const DATE_RANGES = [
  { value: "all",  label: "すべて" },
  { value: "past", label: "過去のみ" },
  { value: "7",    label: "今後7日" },
  { value: "14",   label: "今後14日" },
  { value: "30",   label: "今後30日" },
];

export default memo(function SpeakersView({ speakers, filterCh, filterSt, setFilterCh, setFilterSt, today, onEdit, onDelete, onDoc, onEmail, onFormUrl, onLine, updateSpeaker, showToast, showConfirm, onAdd, onDuplicate }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(() => { try { return localStorage.getItem('sp_dateRange') || "all"; } catch { return "all"; } });
  const setDateRangePersist = useCallback(v => { setDateRange(v); try { localStorage.setItem('sp_dateRange', v); } catch {} }, []);
  const [sortCol, setSortCol] = useState(() => { try { return localStorage.getItem('sp_sortCol') || "date"; } catch { return "date"; } });
  const [sortDir, setSortDir] = useState(() => { try { return localStorage.getItem('sp_sortDir') || "asc"; } catch { return "asc"; } });
  const [savingIds, setSavingIds] = useState(new Set());
  const [notesModal, setNotesModal] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [showActionOnly, setShowActionOnly] = useState(false);
  const [fileModal, setFileModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const notesRef = useRef("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const speakerAppearance = useMemo(() => {
    const sorted = [...speakers].sort((a, b) => new Date(a.seminarDate) - new Date(b.seminarDate));
    const counter = {};
    const result = {};
    sorted.forEach(sp => {
      if (!sp.speakerName) return;
      counter[sp.speakerName] = (counter[sp.speakerName] || 0) + 1;
      result[sp.id] = counter[sp.speakerName];
    });
    return result;
  }, [speakers]);

  const toggleSort = useCallback(col => {
    setSortCol(prev => {
      const next = prev === col ? prev : col;
      try { localStorage.setItem('sp_sortCol', next); } catch {}
      if (prev === col) {
        setSortDir(d => {
          const nd = d === "asc" ? "desc" : "asc";
          try { localStorage.setItem('sp_sortDir', nd); } catch {}
          return nd;
        });
      } else {
        setSortDir("asc");
        try { localStorage.setItem('sp_sortDir', "asc"); } catch {}
      }
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(async (id, st) => {
    setSavingIds(prev => new Set([...prev, id]));
    try {
      const ok = await updateSpeaker(id, { status: st });
      if (ok) showToast("更新しました ✓");
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [updateSpeaker, showToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pad = n => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    const cutoffStr = (dateRange !== "all" && dateRange !== "past") ? (() => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + parseInt(dateRange, 10));
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    })() : null;
    const cutoff30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    const cutoff30Str = `${cutoff30.getFullYear()}-${pad(cutoff30.getMonth()+1)}-${pad(cutoff30.getDate())}`;
    return [...speakers]
      .filter(sp =>
        (filterCh === "all" || sp.chapterId === filterCh) &&
        (filterSt === "all" || sp.status === filterSt) &&
        (!q || sp.speakerName?.toLowerCase().includes(q) || sp.speakerKana?.toLowerCase().includes(q) || sp.company?.toLowerCase().includes(q) || sp.companyRole?.toLowerCase().includes(q) || sp.speakerUnit?.toLowerCase().includes(q) || sp.role?.toLowerCase().includes(q) || sp.topic?.toLowerCase().includes(q) || sp.email?.toLowerCase().includes(q) || sp.phone?.includes(q)) &&
        (dateRange === "all" || (dateRange === "past" ? (sp.seminarDate && sp.seminarDate < todayStr) : (sp.seminarDate && sp.seminarDate >= todayStr && sp.seminarDate <= cutoffStr))) &&
        (!showActionOnly || (
          sp.status !== "cancelled" &&
          sp.seminarDate >= todayStr && sp.seminarDate <= cutoff30Str &&
          (sp.status === "pending" || !sp.topic || !sp.speakerKana || !sp.email || !sp.materialUrl)
        ))
      )
      .sort((a, b) => {
        let cmp = 0;
        if (sortCol === "date")    cmp = new Date(a.seminarDate) - new Date(b.seminarDate);
        else if (sortCol === "name")    cmp = (a.speakerName || "").localeCompare(b.speakerName || "", "ja");
        else if (sortCol === "chapter") cmp = a.chapterId.localeCompare(b.chapterId);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [speakers, filterCh, filterSt, search, dateRange, sortCol, sortDir, today, showActionOnly]);

  const exportCSV = useCallback(() => {
    const headers = ["開催日","単会","講師名","ふりがな","所属法人会名","法人会役職","勤務先","勤務先役職名","テーマ","ステータス","メール","電話","前泊","資料印刷","資料URL","資料ファイル名","お酒","栞・条","講話後メモ","スタッフメモ"];
    const rows = filtered.map(sp => {
      const ch = getChapter(sp.chapterId);
      return [sp.seminarDate, ch.name, sp.speakerName, sp.speakerKana, sp.speakerUnit, sp.role, sp.company, sp.companyRole, sp.topic, STATUS[sp.status]?.label || sp.status, sp.email, sp.phone, sp.lodging || "不要", sp.printRequired || "不要", sp.materialUrl || "", sp.materialName || "", sp.drinksAlcohol || "", sp.shioriArticle || "", sp.postNotes || "", extractStaffNotes(sp.notes)];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"})), download:`講師一覧_${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`CSVをエクスポートしました 📥（${filtered.length}件）`);
  }, [filtered, showToast]);

  const todayStr = useMemo(() => toDateStr(today), [today]);

  const pastConfirmedCount = useMemo(() =>
    filtered.filter(sp => sp.status === "confirmed" && sp.seminarDate && sp.seminarDate < todayStr).length,
    [filtered, todayStr]
  );

  const bulkComplete = useCallback(() => {
    const targets = filtered.filter(sp => sp.status === "confirmed" && sp.seminarDate && sp.seminarDate < todayStr);
    if (targets.length === 0) return;
    showConfirm(`過去の確定済み講師 ${targets.length}件をすべて「終了」にしますか？`, async () => {
      let ok = 0;
      for (const sp of targets) { if (await updateSpeaker(sp.id, { status: "completed" })) ok++; }
      if (ok > 0) showToast(`${ok}件を終了にしました ✓`);
    }, "終了にする");
  }, [filtered, todayStr, updateSpeaker, showToast, showConfirm]);

  const sortBtn = (col, label) => (
    <button onClick={() => toggleSort(col)}
      style={{ background:"none", border:"none", cursor:"pointer", color: sortCol === col ? "#1A3A6B" : "#78909C", fontWeight: sortCol === col ? 700 : 500, fontSize:"clamp(14px,2.4vw,22px)", padding:"4px 6px", display:"flex", alignItems:"center", gap:3 }}>
      {label}
      <span style={{ fontSize:"clamp(12px,2vw,18px)", opacity: sortCol === col ? 1 : 0.4 }}>{sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </button>
  );

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────── */}
      <div className="no-print" style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ fontSize:"clamp(20px,4.5vw,34px)", fontWeight:700, color:"#1A3A6B" }}>
          講師管理
          <span style={{ fontSize:"clamp(13px,2.6vw,24px)", fontWeight:400, color:"#90A4AE", marginLeft:10 }}>{filtered.length}/{speakers.length}件</span>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", flexWrap:"wrap", alignItems:"center", minWidth:0 }}>
          <input style={{ ...INP, flex:"1 1 200px", minWidth:0, maxWidth:340, fontSize:"clamp(16px,2.4vw,22px)", padding:"10px 12px" }} placeholder="🔍 名前・ふりがな・会社・テーマ" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          <select style={{ ...SEL, fontSize:"clamp(14px,2.4vw,22px)", padding:"9px 12px" }} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
            <option value="all">全単会</option>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <select style={{ ...SEL, fontSize:"clamp(14px,2.4vw,22px)", padding:"9px 12px" }} value={filterSt} onChange={e => setFilterSt(e.target.value)}>
            <option value="all">全ステータス</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button style={{ ...BP, background:"#2E7D32", fontSize:"clamp(14px,2.6vw,24px)", padding:"10px 20px" }} onClick={exportCSV}>📥 CSV</button>
          {pastConfirmedCount > 0 && (
            <button style={{ ...BP, background:"#546E7A", fontSize:"clamp(13px,2.4vw,22px)", padding:"10px 18px" }} onClick={bulkComplete} title={`過去の確定済み${pastConfirmedCount}件を一括終了`}>
              ✓ 過去{pastConfirmedCount}件を終了
            </button>
          )}
          <button style={{ ...BC, fontSize:"clamp(14px,2.6vw,24px)", padding:"10px 18px" }} onClick={() => window.print()} title="印刷">🖨</button>
          <button style={{ ...BP, fontSize:"clamp(14px,2.6vw,24px)", padding:"10px 20px" }} onClick={onAdd}>＋ 新規登録</button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────── */}
      <div className="no-print" style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:"clamp(13px,2.2vw,22px)", color:"#78909C", fontWeight:600 }}>期間：</span>
        {DATE_RANGES.map(r => (
          <button key={r.value} onClick={() => setDateRangePersist(r.value)}
            style={{ fontSize:"clamp(13px,2.2vw,22px)", padding:"6px 16px", borderRadius:14, border:`1px solid ${dateRange === r.value ? "#1A3A6B" : "#CFD8DC"}`, background: dateRange === r.value ? "#1A3A6B" : "#fff", color: dateRange === r.value ? "#fff" : "#546E7A", cursor:"pointer", fontWeight: dateRange === r.value ? 700 : 400 }}>
            {r.label}
          </button>
        ))}
        <button onClick={() => setShowActionOnly(v => !v)}
          style={{ fontSize:"clamp(13px,2.2vw,22px)", padding:"6px 16px", borderRadius:14, border:`1px solid ${showActionOnly ? "#B71C1C" : "#CFD8DC"}`, background: showActionOnly ? "#B71C1C" : "#fff", color: showActionOnly ? "#fff" : "#546E7A", cursor:"pointer", fontWeight: showActionOnly ? 700 : 400, marginLeft:6 }}>
          ⚡ 要対応のみ
        </button>
        <div style={{ display:"flex", gap:4, marginLeft:10, alignItems:"center" }}>
          <span style={{ fontSize:"clamp(13px,2.2vw,22px)", color:"#78909C" }}>並び：</span>
          {sortBtn("date","日付")}
          {sortBtn("name","名前")}
          {sortBtn("chapter","単会")}
        </div>
        {(searchInput || filterCh !== "all" || filterSt !== "all" || dateRange !== "all" || showActionOnly) && (
          <button onClick={() => { setSearchInput(""); setSearch(""); setFilterCh("all"); setFilterSt("all"); setDateRangePersist("all"); setShowActionOnly(false); }}
            style={{ fontSize:"clamp(13px,2.2vw,22px)", padding:"6px 16px", borderRadius:14, border:"1px solid #EF5350", background:"#FFEBEE", color:"#B71C1C", cursor:"pointer", fontWeight:700, marginLeft:6 }}>
            ✕ リセット
          </button>
        )}
      </div>

      {/* ── Card list ─────────────────────────────── */}
      <div className="sp-screen-main" style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {filtered.map(sp => {
          const ch = getChapter(sp.chapterId);
          const st = getSeminarType(sp.seminarType || "ms");
          const daysUntil = sp.seminarDate ? Math.ceil((parseDate(sp.seminarDate) - today) / 86400000) : null;
          const isPast   = daysUntil !== null && daysUntil < 0;
          const isToday  = daysUntil === 0;
          const isUrgent = daysUntil !== null && daysUntil > 0 && daysUntil <= 3;
          const isSavingThis = savingIds.has(sp.id);
          const docs = extractMaterialLinks(sp.notes);
          const staffMemo = extractStaffNotes(sp.notes);
          const isPhoto = sp.materialUrl && /\.(jpg|jpeg|png|webp)$/i.test(sp.materialUrl?.split("?")[0] || "");

          return (
            <div key={sp.id} style={{ background: isToday ? "#FFF5F5" : "#fff", borderRadius:12, border:`2px solid ${st.color}`, borderLeft:`8px solid ${st.color}`, boxShadow: isToday ? `0 0 0 2px #EF9A9A, 0 1px 5px rgba(0,0,0,.06)` : isUrgent ? `0 0 0 2px #FFE082, 0 1px 5px rgba(0,0,0,.06)` : "0 1px 5px rgba(0,0,0,.06)", padding:"clamp(10px,2vw,16px)", opacity: isPast ? 0.68 : 1 }}>

              <div style={{ display:"flex", gap:"clamp(10px,2vw,18px)", alignItems:"center", flexWrap:"wrap" }}>

                {/* 1. 日付ブロック */}
                <div style={{ flexShrink:0, width:"clamp(84px,11vw,116px)", textAlign:"center" }}>
                  <div style={{ fontSize:"clamp(10px,1.4vw,13px)", color:"#90A4AE" }}>{sp.seminarDate || "日付未定"}</div>
                  {sp.seminarDate && <div style={{ fontSize:"clamp(20px,3.4vw,30px)", fontWeight:800, color:"#263238", lineHeight:1.15 }}>{sp.seminarDate.slice(5)}</div>}
                  <div style={{ fontSize:"clamp(11px,1.6vw,15px)", color:"#546E7A", marginBottom:6 }}>{ch.dayName}</div>
                  <span style={{ display:"inline-block", fontSize:"clamp(11px,1.6vw,15px)", fontWeight:700, color:"#fff", background:ch.color, padding:"3px 10px", borderRadius:12 }}>{ch.name}</span>
                  <div style={{ marginTop:4 }}>
                    <span style={{ display:"inline-block", fontSize:"clamp(10px,1.4vw,13px)", fontWeight:700, color:"#fff", background:st.color, padding:"2px 8px", borderRadius:10 }}>{st.label}</span>
                  </div>
                  {daysUntil !== null && daysUntil >= 0 && daysUntil <= 14 && (
                    <div style={{ marginTop:4, fontSize:"clamp(10px,1.5vw,14px)", fontWeight:700, color: isToday ? "#B71C1C" : isUrgent ? "#E65100" : "#FF8F00" }}>{isToday ? "今日！" : `あと${daysUntil}日`}</div>
                  )}
                </div>

                {/* 2. 丸型写真 */}
                <div style={{ flexShrink:0 }}>
                  {isPhoto ? (
                    <img loading="lazy" src={sp.materialUrl} alt={sp.speakerName}
                      style={{ width:"clamp(56px,8vw,80px)", height:"clamp(56px,8vw,80px)", objectFit:"cover", borderRadius:"50%", border:`3px solid ${st.color}`, cursor:"pointer", display:"block" }}
                      onClick={() => setFileModal({ url:sp.materialUrl, name:sp.materialName, speaker:sp })}
                      onError={e => { e.currentTarget.style.display="none"; }} />
                  ) : (
                    <div style={{ width:"clamp(56px,8vw,80px)", height:"clamp(56px,8vw,80px)", background:ch.light, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(24px,4vw,36px)", color:ch.color, border:`3px solid ${ch.accent}` }}>♟</div>
                  )}
                </div>

                {/* 3. 名前・所属 */}
                <div style={{ flex:"2 1 200px", minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                    <span style={{ fontSize:"clamp(18px,3vw,26px)", fontWeight:700, color:"#1A2B3C", lineHeight:1.2 }}>{sp.speakerName || "（名前未入力）"}</span>
                    {speakerAppearance[sp.id] === 1 && <span style={{ fontSize:"clamp(11px,1.5vw,14px)", background:"#E8F5E9", color:"#2E7D32", padding:"2px 8px", borderRadius:10, fontWeight:700 }}>初回</span>}
                    {speakerAppearance[sp.id] > 1 && <span style={{ fontSize:"clamp(11px,1.5vw,14px)", background:"#E3F2FD", color:"#1565C0", padding:"2px 8px", borderRadius:10, fontWeight:700 }}>{speakerAppearance[sp.id]}回目</span>}
                  </div>
                  {sp.speakerKana && <div style={{ fontSize:"clamp(12px,1.7vw,16px)", color:"#90A4AE", marginBottom:3 }}>{sp.speakerKana}</div>}
                  {(sp.speakerUnit || sp.role) && (
                    <div style={{ fontSize:"clamp(13px,1.9vw,18px)", color:"#37474F" }}>
                      {sp.speakerUnit}{sp.role && <span style={{ color:"#7B1FA2", marginLeft:6 }}>{sp.role}</span>}
                    </div>
                  )}
                  {(sp.company || sp.companyRole) && (
                    <div style={{ fontSize:"clamp(13px,1.9vw,18px)", color:"#78909C" }}>
                      {sp.company}{sp.companyRole && <span style={{ marginLeft:6 }}>{sp.companyRole}</span>}
                    </div>
                  )}
                </div>

                {/* 4. テーマ */}
                <div style={{ flex:"1 1 150px", minWidth:0 }}>
                  <div style={{ fontSize:"clamp(11px,1.5vw,14px)", color:"#90A4AE", fontWeight:600, marginBottom:2 }}>テーマ</div>
                  <div style={{ fontSize:"clamp(14px,2vw,20px)", color:"#263238", fontWeight:700 }}>{sp.topic ? `「${sp.topic}」` : <span style={{ color:"#B0BEC5", fontWeight:400 }}>未定</span>}</div>
                </div>

                {/* 5. ステータス＋資料 */}
                <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:7, minWidth:96 }}>
                  {isSavingThis ? (
                    <span style={{ fontSize:"clamp(16px,2.5vw,24px)", color:"#78909C", animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span>
                  ) : (
                    <select style={{ ...SEL, fontSize:"clamp(12px,1.8vw,16px)", color:STATUS[sp.status]?.color ?? "#90A4AE", fontWeight:700, padding:"5px 8px", textAlign:"center" }} value={sp.status} onChange={e => handleStatusChange(sp.id, e.target.value)}>
                      {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  )}
                  {isPast && sp.status === "confirmed" && (
                    <button onClick={() => handleStatusChange(sp.id, "completed")}
                      style={{ fontSize:"clamp(10px,1.5vw,14px)", fontWeight:700, background:"#ECEFF1", color:"#546E7A", border:"1px solid #CFD8DC", borderRadius:6, padding:"3px 10px", cursor:"pointer" }}>
                      → 終了
                    </button>
                  )}
                  <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    {sp.materialUrl && (
                      <button onClick={() => setFileModal({ url:sp.materialUrl, name:sp.materialName, speaker:sp })} title="顔写真"
                        style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1, fontSize:"clamp(10px,1.4vw,13px)", color:"#1565C0", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
                        <span style={{ fontSize:"clamp(18px,2.6vw,24px)" }}>📷</span>顔写真
                      </button>
                    )}
                    {docs.map(d => (
                      <button key={d.label} onClick={() => setFileModal({ url:d.url, name:d.label, speaker:sp })} title={d.label}
                        style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1, fontSize:"clamp(10px,1.4vw,13px)", color:"#E65100", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
                        <span style={{ fontSize:"clamp(18px,2.6vw,24px)" }}>📄</span>{d.label}
                      </button>
                    ))}
                    {!sp.materialUrl && docs.length === 0 && (
                      <span style={{ fontSize:"clamp(10px,1.4vw,13px)", color:"#B0BEC5" }}>📭 未受信</span>
                    )}
                  </div>
                </div>

                {/* 6. アクション：メール / LINE */}
                <div style={{ flexShrink:0, display:"flex", flexDirection:"column", gap:6 }}>
                  <button onClick={() => onEmail(sp)}
                    style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#1565C0", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
                    ✉ メール
                  </button>
                  {sp.lineNotified ? (
                    <button onClick={async () => { const ok = await updateSpeaker(sp.id,{lineNotified:false}); if(ok)showToast("LINE未送信に戻しました"); }}
                      style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#E8F5E9", color:"#06A848", border:"1px solid #A5D6A7", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}
                      title="送信済 → 戻す">✓ LINE</button>
                  ) : (
                    <button onClick={() => onLine(sp)}
                      style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#06C755", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
                      LINE
                    </button>
                  )}
                  <button onClick={() => setExpandedId(expandedId === sp.id ? null : sp.id)}
                    style={{ fontSize:"clamp(12px,1.7vw,15px)", background:"#F5F5F5", color:"#546E7A", border:"1px solid #E0E0E0", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontWeight:700, lineHeight:1, whiteSpace:"nowrap" }}
                    title="その他の操作" aria-label="その他の操作">その他 {expandedId === sp.id ? "▲" : "▼"}</button>
                </div>

                {/* 7. 編集 / 削除 */}
                <div style={{ flexShrink:0, display:"flex", flexDirection:"column", gap:10, borderLeft:"1px solid #ECEFF1", paddingLeft:"clamp(8px,1.5vw,14px)" }}>
                  <button onClick={() => onEdit(sp)} title="編集" aria-label={`${sp.speakerName}を編集`}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#1565C0", fontSize:"clamp(11px,1.6vw,14px)", fontWeight:700, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <span style={{ fontSize:"clamp(16px,2.4vw,22px)" }}>✏</span>編集
                  </button>
                  <button onClick={() => onDelete(sp.id)} title="削除" aria-label={`${sp.speakerName}を削除`}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#B71C1C", fontSize:"clamp(11px,1.6vw,14px)", fontWeight:700, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <span style={{ fontSize:"clamp(16px,2.4vw,22px)" }}>🗑</span>削除
                  </button>
                </div>
              </div>

              {/* 補助操作（⋯で展開） */}
              {expandedId === sp.id && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginTop:12, paddingTop:12, borderTop:`1px solid ${isToday ? "#FFCDD2" : "#F0F4F8"}` }}>
                  <button onClick={() => onDoc(sp)} style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#37474F", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontWeight:600 }}>≡ 確認書</button>
                  {sp.calendarAdded ? (
                    <button onClick={async () => { const ok = await updateSpeaker(sp.id,{calendarAdded:false}); if(ok)showToast("未転記に戻しました"); }}
                      style={{ fontSize:"clamp(12px,1.8vw,16px)", color:"#2E7D32", background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:8, padding:"7px 14px", cursor:"pointer" }} title="転記済 → 戻す">✓📅 転記済</button>
                  ) : (
                    <button onClick={async () => { const ok = await updateSpeaker(sp.id,{calendarAdded:true}); if(ok)showToast("転記済にしました 📅"); }}
                      style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#F3F4F6", color:"#546E7A", border:"1px solid #D1D5DB", borderRadius:8, padding:"7px 14px", cursor:"pointer" }} title="カレンダー転記済にする">📅 カレンダー</button>
                  )}
                  <button onClick={() => { const t = extractStaffNotes(sp.notes || ""); notesRef.current = t; setNotesText(t); setNotesModal(sp); }}
                    style={{ fontSize:"clamp(12px,1.8vw,16px)", background: staffMemo ? "#F3E5F5" : "#ECEFF1", color: staffMemo ? "#7B1FA2" : "#90A4AE", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer" }}
                    title={staffMemo ? `メモ: ${staffMemo.slice(0,60)}` : "メモを追加"}>{staffMemo ? "📝 メモ有" : "📝 メモ"}</button>
                  {sp.postNotes && (
                    <button onClick={() => onEdit(sp)} style={{ fontSize:"clamp(12px,1.8vw,16px)", color:"#2E7D32", background:"#E8F5E9", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer" }} title={`講話後メモ: ${sp.postNotes}`}>✓ 後記</button>
                  )}
                  {onDuplicate && (
                    <button onClick={() => onDuplicate(sp)} style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#E8F5E9", color:"#1B5E20", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer" }}>複製</button>
                  )}
                  {(sp.phone || sp.email) && (
                    <button onClick={() => { const lines = [sp.speakerName, sp.phone && `TEL: ${sp.phone}`, sp.email && `Mail: ${sp.email}`].filter(Boolean); navigator.clipboard?.writeText(lines.join("\n")).catch(() => {}); showToast("連絡先をコピーしました 📋"); }}
                      style={{ fontSize:"clamp(12px,1.8vw,16px)", background:"#E3F2FD", color:"#1565C0", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer" }} title="連絡先をコピー">📋 連絡先</button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 20px", background:"#fff", borderRadius:12, border:"1px solid #E8ECF0" }}>
            <div style={{ color:"#90A4AE", fontSize:"clamp(16px,2.8vw,26px)", marginBottom:14 }}>
              {search || filterCh !== "all" || filterSt !== "all" || dateRange !== "all" ? "条件に一致する講師がいません" : "講師データがありません"}
            </div>
            {(searchInput || filterCh !== "all" || filterSt !== "all" || dateRange !== "all") && (
              <button style={{ background:"#ECEFF1", border:"none", borderRadius:8, padding:"10px 22px", fontSize:"clamp(15px,2.6vw,24px)", cursor:"pointer", color:"#546E7A", fontWeight:600 }}
                onClick={() => { setSearchInput(""); setSearch(""); setFilterCh("all"); setFilterSt("all"); setDateRangePersist("all"); }}>
                フィルターをリセット
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Status/chapter summary ─────────────────────────────── */}
      <div className="no-print" style={{ marginTop:14, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:"clamp(13px,2.2vw,20px)", color:"#90A4AE", fontWeight:600 }}>ステータス：</span>
        {Object.entries(STATUS).map(([k, v]) => {
          const count = speakers.filter(sp => sp.status === k).length;
          if (count === 0) return null;
          return <span key={k} style={{ fontSize:"clamp(14px,2.4vw,22px)", padding:"5px 14px", borderRadius:14, fontWeight:600, color: v.color, background: v.bg, border:`1px solid ${v.color}33` }}>{v.label} {count}件</span>;
        })}
      </div>
      <div className="no-print" style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:"clamp(13px,2.2vw,20px)", color:"#90A4AE", fontWeight:600 }}>単会別：</span>
        {CHAPTERS.map(ch => {
          const count = speakers.filter(sp => sp.chapterId === ch.id && sp.status !== "cancelled").length;
          if (count === 0) return null;
          return <span key={ch.id} style={{ fontSize:"clamp(14px,2.4vw,22px)", padding:"5px 14px", borderRadius:14, fontWeight:600, color: ch.color, background: ch.light, border:`1px solid ${ch.color}33` }}>{ch.name} {count}件</span>;
        })}
      </div>

      {/* ── Print-only table ─────────────────────────────── */}
      <div className="sp-print-only">
        <div style={{ marginBottom:10, borderBottom:"2px solid #1A3A6B", paddingBottom:8 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#1A3A6B" }}>倫理法人会 南部地区 講師一覧</div>
          <div style={{ fontSize:11, color:"#546E7A", marginTop:3 }}>
            出力日: {new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' })}
            {filterCh !== "all" && `　単会: ${CHAPTERS.find(c=>c.id===filterCh)?.name}`}
            {filterSt !== "all" && `　ステータス: ${STATUS[filterSt]?.label}`}
            {search && `　検索: ${search}`}
            　{filtered.length}件
          </div>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ background:"#ECEFF1" }}>
              {["開催日","単会","講師名","所属法人会・役職／勤務先","テーマ","ステータス","資料","前泊","メモ"].map(h => (
                <th key={h} style={{ padding:"5px 7px", textAlign:"left", borderBottom:"2px solid #90A4AE", fontWeight:700, color:"#37474F" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((sp, i) => {
              const ch = getChapter(sp.chapterId);
              return (
                <tr key={sp.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1", whiteSpace:"nowrap" }}>{sp.seminarDate}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1", fontWeight:700, color: ch.color }}>{ch.name}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1", fontWeight:600 }}>{sp.speakerName}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1", fontSize:11 }}>
                    {[sp.speakerUnit, sp.role].filter(Boolean).join("　")}
                    {(sp.company || sp.companyRole) && <div style={{ color:"#78909C" }}>{[sp.company, sp.companyRole].filter(Boolean).join("　")}</div>}
                  </td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1" }}>{sp.topic ? `「${sp.topic}」` : ""}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1" }}>{STATUS[sp.status]?.label || sp.status}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1" }}>{[sp.materialUrl && "写真", extractMaterialLinks(sp.notes).length && "資料"].filter(Boolean).join("・") || "未受領"}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1" }}>{sp.lodging || "不要"}</td>
                  <td style={{ padding:"5px 7px", borderBottom:"1px solid #ECEFF1", maxWidth:120, fontSize:10 }}>{extractStaffNotes(sp.notes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop:10, fontSize:10, color:"#90A4AE", textAlign:"right" }}>倫理法人会 南部地区合同事務局</div>
      </div>

      {/* ── Notes modal ─────────────────────────────── */}
      {notesModal && (
        <div style={OV} role="presentation" onClick={() => setNotesModal(null)}>
          <div role="dialog" aria-modal="true" aria-label="メモを編集" style={{ ...MOD, maxWidth:560 }} onClick={e => e.stopPropagation()}
            onKeyDown={async e => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                const structured = extractStructuredNotes(notesModal.notes || "");
                const merged = [structured, notesText].filter(Boolean).join('\n\n');
                const ok = await updateSpeaker(notesModal.id, { notes: merged });
                if (ok) { showToast("メモを保存しました ✓"); setNotesModal(null); }
              }
            }}>
            <div style={{ ...MH, fontSize:"clamp(18px,3vw,28px)" }}>📝 スタッフメモ — {notesModal.speakerName} 様</div>
            <textarea
              autoFocus
              rows={5}
              value={notesText}
              onChange={e => { setNotesText(e.target.value); notesRef.current = e.target.value; }}
              style={{ width:"100%", border:"1px solid #CFD8DC", borderRadius:6, padding:"10px", fontSize:"clamp(15px,2.6vw,24px)", fontFamily:"inherit", resize:"vertical", marginTop:8, boxSizing:"border-box" }}
              placeholder="自由メモ（内部のみ表示）"
            />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6, marginBottom:10 }}>
              <span style={{ fontSize:"clamp(13px,2.2vw,20px)", color:"#90A4AE" }}>{notesText.length}文字　Ctrl+Enterで保存</span>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button style={{ ...BC, fontSize:"clamp(15px,2.6vw,24px)", padding:"10px 20px" }} onClick={() => setNotesModal(null)}>キャンセル</button>
              <button style={{ ...BC, fontSize:"clamp(15px,2.6vw,24px)", padding:"10px 20px", color:"#B71C1C", borderColor:"#EF9A9A" }} onClick={async () => {
                const structured = extractStructuredNotes(notesModal.notes || "");
                const ok = await updateSpeaker(notesModal.id, { notes: structured || "" });
                if (ok) { showToast("メモを削除しました"); setNotesModal(null); }
              }}>削除</button>
              <button style={{ background:"#1A3A6B", color:"#fff", border:"none", borderRadius:6, padding:"10px 24px", fontSize:"clamp(15px,2.6vw,24px)", fontWeight:700, cursor:"pointer" }} onClick={async () => {
                const structured = extractStructuredNotes(notesModal.notes || "");
                const merged = [structured, notesText].filter(Boolean).join('\n\n');
                const ok = await updateSpeaker(notesModal.id, { notes: merged });
                if (ok) { showToast("メモを保存しました ✓"); setNotesModal(null); }
              }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {fileModal && (
        <FileViewModal
          url={fileModal.url}
          name={fileModal.name}
          speaker={fileModal.speaker}
          onClose={() => setFileModal(null)}
        />
      )}
    </div>
  );
});
