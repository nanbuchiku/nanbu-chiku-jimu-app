import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter, buildSpeakerTasks, toDateStr } from '../utils';
import { CARD, BP, BC, SEL, INP, PILL } from '../styles';

const TASK_CATEGORY_COLOR = {
  "依頼": "#1A3A6B",
  "宿泊": "#37474F",
  "資料": "#2E7D32",
  "当日": "#BF360C",
  "講話後": "#546E7A",
};

export default memo(function SpeakerTasksView({ speakers, today, updateSpeaker, showToast, onEmail, onEdit }) {
  const [filterCh,    setFilterCh]   = useState("all");
  const [filterDone,  setFilterDone] = useState("undone");
  const [filterPast,  setFilterPast] = useState(false);
  const [expandedId,  setExpandedId] = useState(null);
  const [expandAll,   setExpandAll]  = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]     = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return speakers
      .filter(sp => sp.status !== "cancelled")
      .filter(sp => filterCh === "all" || sp.chapterId === filterCh)
      .filter(sp => !q || sp.speakerName?.toLowerCase().includes(q) || sp.company?.toLowerCase().includes(q) || sp.email?.toLowerCase().includes(q) || sp.notes?.toLowerCase().includes(q))
      .sort((a, b) => (a.seminarDate || "").localeCompare(b.seminarDate || ""));
  }, [speakers, filterCh, search]);

  const visible = useMemo(() => {
    let base = filtered;
    if (filterDone !== "all") {
      base = base.filter(sp => {
        const checks = sp.speakerChecks || {};
        const tasks = buildSpeakerTasks(sp);
        const allDone = tasks.every(t => checks[t.id]);
        return filterDone === "done" ? allDone : !allDone;
      });
    }
    if (filterPast) {
      const todayStr = toDateStr(today);
      base = base.filter(sp => {
        const isPast = sp.seminarDate && sp.seminarDate < todayStr;
        const checks = sp.speakerChecks || {};
        const tasks = buildSpeakerTasks(sp);
        const allDone = tasks.every(t => checks[t.id]);
        return isPast && !allDone;
      });
    }
    return base;
  }, [filtered, filterDone, filterPast, today]);

  const toggleTask = useCallback((sp, taskId) => {
    const checks = { ...(sp.speakerChecks || {}) };
    checks[taskId] = !checks[taskId];
    updateSpeaker(sp.id, { speakerChecks: checks });
    showToast(checks[taskId] ? "✓ 完了にしました" : "未完了に戻しました");
  }, [updateSpeaker, showToast]);

  const getProgress = sp => {
    const tasks = buildSpeakerTasks(sp);
    const checks = sp.speakerChecks || {};
    const done = tasks.filter(t => checks[t.id]).length;
    return { done, total: tasks.length, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>☑ 講師タスク管理 <span style={{ fontSize:12, fontWeight:400, color:"#90A4AE" }}>{visible.length}件</span></div>
        <input style={{ ...INP, width:140, fontSize:11 }} placeholder="🔍 名前・会社検索" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        <select style={SEL} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
          <option value="all">全単会</option>
          {CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {[["undone","未完了のみ"],["all","すべて"],["done","完了のみ"]].map(([v,l]) => (
            <button key={v} style={{ ...(filterDone===v ? BP : BC), padding:"5px 12px", fontSize:11 }} onClick={() => setFilterDone(v)}>{l}</button>
          ))}
        </div>
        <button style={{ ...(filterPast ? { ...BP, background:"#B71C1C" } : BC), padding:"5px 12px", fontSize:11 }} onClick={() => setFilterPast(v => !v)}>
          {filterPast ? "⚠ 未完了超過" : "超過のみ"}
        </button>
        <button style={{ ...BC, padding:"5px 12px", fontSize:11 }} onClick={() => setExpandAll(v => !v)}>
          {expandAll ? "▲ すべて折りたたむ" : "▼ すべて展開"}
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:14 }}>
        {visible.map(sp => {
          const ch = getChapter(sp.chapterId);
          const tasks = buildSpeakerTasks(sp);
          const checks = sp.speakerChecks || {};
          const prog = getProgress(sp);
          const allDone = prog.done === prog.total;
          const isExpanded = expandAll || expandedId === sp.id;

          const byCategory = {};
          tasks.forEach(t => {
            if (!byCategory[t.category]) byCategory[t.category] = [];
            byCategory[t.category].push(t);
          });

          return (
            <div key={sp.id} style={{ ...CARD, borderTop:`4px solid ${ch?.color || "#1A3A6B"}`, opacity: allDone ? 0.7 : 1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <span style={PILL(ch)}>{ch?.name}</span>
                  <span style={{ fontSize:10, color:"#90A4AE", marginLeft:6 }}>{sp.seminarDate}</span>
                  {(() => {
                    const d = sp.seminarDate ? Math.ceil((new Date(sp.seminarDate) - today) / 86400000) : null;
                    if (d === null) return null;
                    if (d === 0) return <span style={{ fontSize:10, background:"#FFEBEE", color:"#B71C1C", fontWeight:700, padding:"2px 6px", borderRadius:8, marginLeft:4 }}>今日！</span>;
                    if (d > 0 && d <= 7) return <span style={{ fontSize:10, background: d <= 3 ? "#FFF8E1" : "#F5F5F5", color: d <= 3 ? "#E65100" : "#78909C", fontWeight:700, padding:"2px 6px", borderRadius:8, marginLeft:4 }}>あと{d}日</span>;
                    return null;
                  })()}
                  {allDone && <span style={{ fontSize:10, background:"#E8F5E9", color:"#2E7D32", fontWeight:700, padding:"2px 7px", borderRadius:10, marginLeft:6 }}>✓ 完了</span>}
                </div>
                <button aria-label={isExpanded ? "折りたたむ" : "すべてのタスクを表示"} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#90A4AE" }} onClick={() => { if (expandAll) { setExpandAll(false); setExpandedId(null); } else setExpandedId(isExpanded ? null : sp.id); }}>
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:2, flexWrap:"wrap" }}>
                <div style={{ fontWeight:700, fontSize:18, lineHeight:1.3,
                  ...(sp.speakerName && sp.speakerName.length > 6 ? { fontSize:"clamp(14px,3vw,18px)" } : {}) }}>
                  {sp.speakerName} 様
                </div>
                {onEmail && sp.email && (
                  <button title="メール送信" style={{ background:"none", border:"1px solid #90CAF9", borderRadius:4, padding:"2px 6px", fontSize:10, cursor:"pointer", color:"#1565C0" }} onClick={() => onEmail(sp)}>📧</button>
                )}
                {onEdit && (
                  <button title="講師情報を編集" style={{ background:"none", border:"1px solid #B0BEC5", borderRadius:4, padding:"2px 6px", fontSize:10, cursor:"pointer", color:"#546E7A" }} onClick={() => onEdit(sp)}>✏ 編集</button>
                )}
              </div>
              <div style={{ fontSize:12, color:"#546E7A", marginBottom:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                {sp.speakerUnit && <span style={{ background:"#E8EAF6", color:"#3949AB", padding:"1px 7px", borderRadius:10, fontWeight:600 }}>{sp.speakerUnit}</span>}
                {sp.role && <span style={{ background:"#F3E5F5", color:"#7B1FA2", padding:"1px 7px", borderRadius:10 }}>{sp.role}</span>}
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#78909C", marginBottom:3 }}>
                  <span>{prog.done} / {prog.total} 完了</span>
                  <span style={{ fontWeight:700, color: allDone ? "#2E7D32" : "#1A3A6B" }}>{prog.pct}%</span>
                </div>
                <div style={{ background:"#E0E0E0", borderRadius:4, height:6 }}>
                  <div style={{ width:`${prog.pct}%`, background: allDone ? "#2E7D32" : "#1A3A6B", borderRadius:4, height:6, transition:"width .3s" }} />
                </div>
              </div>

              {Object.entries(byCategory).map(([cat, catTasks]) => {
                const visibleTasks = isExpanded ? catTasks : catTasks.filter(t => !checks[t.id]);
                if (visibleTasks.length === 0) return null;
                const catAllDone = catTasks.every(t => checks[t.id]);
                const catColor = TASK_CATEGORY_COLOR[cat] || "#546E7A";
                return (
                  <div key={cat} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: catColor, letterSpacing:"0.05em" }}>▸ {cat}</div>
                      {!catAllDone && (
                        <button style={{ fontSize:8, background: catColor+"18", color: catColor, border:`1px solid ${catColor}44`, borderRadius:8, padding:"1px 6px", cursor:"pointer", fontWeight:700 }}
                          onClick={() => {
                            const newChecks = { ...checks };
                            catTasks.forEach(t => { newChecks[t.id] = true; });
                            updateSpeaker(sp.id, { speakerChecks: newChecks });
                            showToast(`${cat}を完了 ✓`);
                          }}>
                          {cat}完了
                        </button>
                      )}
                    </div>
                    {visibleTasks.map(t => (
                      <label key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 6px", borderRadius:5, cursor:"pointer", background: checks[t.id] ? "#F1F8E9" : "#FAFAFA", marginBottom:3, border:`1px solid ${checks[t.id] ? "#C5E1A5" : "#EEEEEE"}` }}>
                        <input type="checkbox" checked={!!checks[t.id]} onChange={() => toggleTask(sp, t.id)} style={{ width:15, height:15, cursor:"pointer", accentColor: TASK_CATEGORY_COLOR[cat] }} />
                        <span style={{ fontSize:12, color: checks[t.id] ? "#78909C" : "#263238", textDecoration: checks[t.id] ? "line-through" : "none" }}>{t.label}</span>
                      </label>
                    ))}
                  </div>
                );
              })}

              {!isExpanded && prog.done > 0 && (
                <div style={{ fontSize:11, color:"#90A4AE", textAlign:"center", marginTop:4 }}>
                  ✓ 完了済み {prog.done}件を非表示 <span style={{ cursor:"pointer", color:"#1565C0" }} onClick={() => setExpandedId(sp.id)}>すべて見る</span>
                </div>
              )}
              {!allDone && (
                <button style={{ marginTop:8, width:"100%", background:"#F1F8E9", border:"1px solid #C5E1A5", borderRadius:6, color:"#2E7D32", fontSize:11, fontWeight:700, cursor:"pointer", padding:"6px" }}
                  onClick={() => {
                    const allChecks = {};
                    tasks.forEach(t => { allChecks[t.id] = true; });
                    updateSpeaker(sp.id, { speakerChecks: allChecks });
                    showToast(`${sp.speakerName} 様のタスクをすべて完了にしました ✓`);
                  }}>
                  ✓ すべて完了にする
                </button>
              )}

              {sp.notes && (
                <div style={{ marginTop:6, padding:"5px 8px", background:"#F3E5F5", borderRadius:5, borderLeft:"3px solid #CE93D8", fontSize:10, color:"#4A148C", whiteSpace:"pre-wrap" }}>
                  <span style={{ fontWeight:700 }}>📝 メモ：</span>{sp.notes}
                </div>
              )}
              {(sp.postNotes || sp.drinksAlcohol || sp.shioriArticle) && (
                <div style={{ marginTop:6, padding:"8px 10px", background:"#F8F9FA", borderRadius:6, borderLeft:"3px solid #78909C" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#546E7A", marginBottom:4 }}>📝 講話後メモ</div>
                  {sp.drinksAlcohol && <div style={{ fontSize:11, color:"#546E7A" }}>お酒：{sp.drinksAlcohol}</div>}
                  {sp.shioriArticle && <div style={{ fontSize:11, color:"#546E7A" }}>栞：{sp.shioriArticle}</div>}
                  {sp.postNotes && <div style={{ fontSize:11, color:"#263238", marginTop:4, whiteSpace:"pre-wrap" }}>{sp.postNotes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div style={{ ...CARD, textAlign:"center", color:"#90A4AE", padding:40 }}>
          {filtered.length === 0 ? "講師データがありません" : "該当する講師タスクがありません"}
        </div>
      )}
    </div>
  );
});
