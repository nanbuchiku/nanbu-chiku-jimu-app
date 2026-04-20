import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter, parseDate } from '../utils';
import { CARD, BP, BSM, SEL, INP, TBL, TH, TD, PILL } from '../styles';

const PRIO = { high:{ label:"高", bg:"#FFEBEE", color:"#C62828" }, medium:{ label:"中", bg:"#FFF8E1", color:"#F57F17" }, low:{ label:"低", bg:"#E8F5E9", color:"#2E7D32" } };

export default memo(function TasksView({ tasks, today, newTask, setNewTask, onToggle, onDelete, onAdd, onAddBatch, onUpdate, onDeleteDone, showToast }) {
  const [showDone,    setShowDone]    = useState(false);
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
    setEditForm({ title: t.title, dueDate: t.dueDate, priority: t.priority, chapterId: t.chapterId });
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
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          タスク管理
          {overdueCount > 0 && <span style={{ fontSize:11, fontWeight:700, background:"#FFEBEE", color:"#B71C1C", padding:"2px 8px", borderRadius:10 }}>⚠ 超過 {overdueCount}件</span>}
          {undoneCount > 0 && <span style={{ fontSize:11, fontWeight:400, color:"#BF360C" }}>未完了 {undoneCount}件</span>}
          {doneCount > 0 && <span style={{ fontSize:11, fontWeight:400, color:"#78909C" }}>完了 {doneCount}件</span>}
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
            <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:600, color:"#546E7A" }} onClick={() => { setFilterCh("all"); setFilterPrio("all"); }}>
              リセット
            </button>
          )}
          <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setShowDone(v => !v)}>
            {showDone ? "完了を隠す" : "完了済も表示"}
          </button>
          {doneCount > 0 && (
            <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:600, color:"#B71C1C" }} onClick={onDeleteDone}>
              🗑 完了済みを削除
            </button>
          )}
          <button style={{ background: groupByDate ? "#1A3A6B" : "#ECEFF1", color: groupByDate ? "#fff" : "#546E7A", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:600 }} onClick={() => setGroupByDate(v => !v)}>
            {groupByDate ? "▦ グループ表示" : "≡ 一覧表示"}
          </button>
          <button style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:700 }} onClick={exportCSV}>📥 CSV</button>
        </div>
      </div>

      {chapterStats.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
          {chapterStats.map(({ ch, total, overdue, thisWeek }) => (
            <div key={ch.id} onClick={() => setFilterCh(ch.id)} style={{ background: filterCh === ch.id ? ch.light : "#fff", border:`2px solid ${filterCh === ch.id ? ch.color : ch.accent}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", transition:"all .15s", minWidth:110 }}>
              <div style={{ fontSize:10, fontWeight:700, color: ch.color, marginBottom:2 }}>{ch.name}</div>
              <div style={{ fontSize:18, fontWeight:800, color: overdue > 0 ? "#B71C1C" : "#37474F", lineHeight:1 }}>{total}<span style={{ fontSize:9, fontWeight:400, marginLeft:2 }}>件</span></div>
              <div style={{ fontSize:9, color:"#90A4AE", marginTop:2, display:"flex", gap:6 }}>
                {overdue > 0 && <span style={{ color:"#B71C1C", fontWeight:700 }}>超過{overdue}</span>}
                {thisWeek > 0 && <span style={{ color:"#E65100", fontWeight:600 }}>今週{thisWeek}</span>}
              </div>
            </div>
          ))}
          {filterCh !== "all" && (
            <div onClick={() => setFilterCh("all")} style={{ background:"#F5F5F5", border:"2px solid #ECEFF1", borderRadius:8, padding:"6px 12px", cursor:"pointer", display:"flex", alignItems:"center", fontSize:11, color:"#78909C", fontWeight:600 }}>
              全て表示
            </div>
          )}
        </div>
      )}

      <div style={{ ...CARD, marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#546E7A", marginBottom:7 }}>＋ タスク追加</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
          <input aria-label="タスク内容" style={{ ...INP, flex:3, minWidth:160 }} placeholder="タスク内容..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === "Enter" && onAdd()} />
          <select aria-label="担当単会" style={SEL} value={newTask.chapterId} onChange={e => setNewTask({ ...newTask, chapterId: e.target.value })}>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <input aria-label="期限" type="date" style={INP} value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
            <div style={{ display:"flex", gap:3 }}>
              {[["今日",0],["明日",1],["1週",7],["2週",14]].map(([label, days]) => {
                const d = new Date(today); d.setDate(d.getDate() + days);
                const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return <button key={label} type="button" onClick={() => setNewTask(t => ({ ...t, dueDate: ds }))} style={{ fontSize:9, padding:"1px 5px", borderRadius:8, border:`1px solid ${newTask.dueDate===ds?"#1A3A6B":"#CFD8DC"}`, background: newTask.dueDate===ds?"#1A3A6B":"#fff", color: newTask.dueDate===ds?"#fff":"#546E7A", cursor:"pointer", fontWeight:700 }}>{label}</button>;
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
            <button style={{ background:"#546E7A", color:"#fff", border:"none", borderRadius:6, padding:"7px 12px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }} title="全5単会に同じタスクを追加" onClick={onAddBatch}>
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
              {groupByDate && !showDone && (() => {
                const pad = n => String(n).padStart(2,'0');
                const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                const todayStr = ds(today);
                const tom = new Date(today); tom.setDate(today.getDate()+1);
                const tomStr = ds(tom);
                const wk = new Date(today); wk.setDate(today.getDate()+7);
                const wkStr = ds(wk);
                const groups = [
                  { label:"⚠ 期限超過", color:"#B71C1C", bg:"#FFEBEE", filter: t => t.dueDate < todayStr },
                  { label:"📅 今日・明日", color:"#E65100", bg:"#FFF8E1", filter: t => t.dueDate >= todayStr && t.dueDate <= tomStr },
                  { label:"📌 今週中", color:"#FF8F00", bg:"#FFFDE7", filter: t => t.dueDate > tomStr && t.dueDate <= wkStr },
                  { label:"🗓 来週以降", color:"#546E7A", bg:"#F5F5F5", filter: t => t.dueDate > wkStr },
                ];
                return groups.flatMap(({ label, color, bg, filter }) => {
                  const gTasks = visible.filter(filter);
                  if (gTasks.length === 0) return [];
                  return [
                    <tr key={`hdr-${label}`}><td colSpan={7} style={{ padding:"5px 10px", background: bg, fontSize:11, fontWeight:700, color, borderTop:`2px solid ${color}33` }}>{label}　{gTasks.length}件</td></tr>,
                    ...gTasks.map(t => {
                      const ch = getChapter(t.chapterId);
                      const dl = Math.ceil((parseDate(t.dueDate) - today) / 86400000);
                      const p = PRIO[t.priority] || PRIO.medium;
                      const isEditing = editingId === t.id;
                      if (isEditing) {
                        return (
                          <tr key={t.id} style={{ background:"#E3F2FD" }}>
                            <td style={TD}><input type="checkbox" checked={t.done} disabled style={{ cursor:"not-allowed", opacity:.4 }} /></td>
                            <td style={TD}><select style={{ ...SEL, fontSize:11 }} value={editForm.chapterId} onChange={e => setEditForm(f => ({ ...f, chapterId: e.target.value }))}>{CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                            <td style={{ ...TD, maxWidth:200 }}><input autoFocus style={{ ...INP, width:"100%", fontSize:12 }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }} /></td>
                            <td style={TD}><input type="date" style={{ ...INP, fontSize:11 }} value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} /></td>
                            <td style={TD} />
                            <td style={TD}><select style={{ ...SEL, fontSize:11 }} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}><option value="high">🔴 高</option><option value="medium">🟡 中</option><option value="low">🟢 低</option></select></td>
                            <td style={TD}><div style={{ display:"flex", gap:3 }}><button style={{ ...BSM, background:"#1A3A6B", color:"#fff" }} onClick={() => saveEdit(t.id)}>保存</button><button style={{ ...BSM, color:"#546E7A" }} onClick={() => setEditingId(null)}>取消</button></div></td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={t.id} className="hover-row" style={{ background: dl < 0 ? "#FFF5F5" : "white" }}>
                          <td style={TD}><input type="checkbox" aria-label={`${t.title}を完了にする`} checked={t.done} onChange={() => onToggle(t.id)} style={{ cursor:"pointer" }} /></td>
                          <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                          <td style={{ ...TD, fontWeight:600, maxWidth:200 }}>{t.title}</td>
                          <td style={{ ...TD, fontSize:11 }}>{t.dueDate}</td>
                          <td style={TD}><span style={{ fontWeight:700, fontSize:11, color: dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : dl <= 7 ? "#FF8F00" : "#2E7D32" }}>{dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span></td>
                          <td style={TD}><span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700 }}>{p.label}</span></td>
                          <td style={TD}><div style={{ display:"flex", gap:3 }}><button style={{ ...BSM, color:"#1565C0" }} onClick={() => startEdit(t)}>編集</button><button style={{ ...BSM, color:"#B71C1C", padding:"2px 7px" }} onClick={() => onDelete(t.id)}>×</button></div></td>
                        </tr>
                      );
                    })
                  ];
                });
              })()}
              {(!groupByDate || showDone) && visible.map(t => {
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
                        <select style={{ ...SEL, fontSize:11 }} value={editForm.chapterId} onChange={e => setEditForm(f => ({ ...f, chapterId: e.target.value }))}>
                          {CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={{ ...TD, maxWidth:200 }}>
                        <input autoFocus style={{ ...INP, width:"100%", fontSize:12 }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }} />
                      </td>
                      <td style={TD}>
                        <input type="date" style={{ ...INP, fontSize:11 }} value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                      </td>
                      <td style={TD} />
                      <td style={TD}>
                        <select style={{ ...SEL, fontSize:11 }} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
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
                    <td style={{ ...TD, fontSize:11 }}>{t.dueDate}</td>
                    <td style={TD}><span style={{ fontWeight:700, fontSize:11, color: t.done ? "#90A4AE" : dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : dl <= 7 ? "#FF8F00" : "#2E7D32" }}>{t.done ? "✓完了" : dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span></td>
                    <td style={TD}><span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700 }}>{p.label}</span></td>
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
