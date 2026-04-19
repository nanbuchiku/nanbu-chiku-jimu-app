import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter } from '../utils';
import { CARD, BP, BSM, SEL, INP, TBL, TH, TD, PILL } from '../styles';

const PRIO = { high:{ label:"高", bg:"#FFEBEE", color:"#C62828" }, medium:{ label:"中", bg:"#FFF8E1", color:"#F57F17" }, low:{ label:"低", bg:"#E8F5E9", color:"#2E7D32" } };

export default memo(function TasksView({ tasks, today, newTask, setNewTask, onToggle, onDelete, onAdd, showToast }) {
  const [showDone, setShowDone] = useState(false);

  const visible = useMemo(
    () => tasks.filter(t => showDone || !t.done).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [tasks, showDone]
  );
  const undoneCount = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);

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

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>
          タスク管理
          {undoneCount > 0 && <span style={{ fontSize:12, fontWeight:400, color:"#BF360C", marginLeft:8 }}>未完了 {undoneCount}件</span>}
        </div>
        <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
          <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setShowDone(v => !v)}>
            {showDone ? "完了を隠す" : "完了済も表示"}
          </button>
          <button style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:6, padding:"5px 11px", fontSize:11, cursor:"pointer", fontWeight:700 }} onClick={exportCSV}>📥 CSV</button>
        </div>
      </div>

      <div style={{ ...CARD, marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#546E7A", marginBottom:7 }}>＋ タスク追加</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
          <input aria-label="タスク内容" style={{ ...INP, flex:3, minWidth:160 }} placeholder="タスク内容..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === "Enter" && onAdd()} />
          <select aria-label="担当単会" style={SEL} value={newTask.chapterId} onChange={e => setNewTask({ ...newTask, chapterId: e.target.value })}>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <input aria-label="期限" type="date" style={INP} value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
          <select aria-label="優先度" style={SEL} value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
            <option value="high">🔴 高</option>
            <option value="medium">🟡 中</option>
            <option value="low">🟢 低</option>
          </select>
          <button style={BP} onClick={onAdd}>追加</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["","単会","タスク内容","期限","残り","優先","操作"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map(t => {
                const ch = getChapter(t.chapterId);
                const dl = Math.ceil((new Date(t.dueDate) - today) / 86400000);
                const p  = PRIO[t.priority] || PRIO.medium;
                const isOverdue = !t.done && dl < 0;
                return (
                  <tr key={t.id} className="hover-row" style={{ opacity: t.done ? .5 : 1, background: t.done ? "#FAFAFA" : isOverdue ? "#FFF5F5" : "white" }}>
                    <td style={TD}><input type="checkbox" aria-label={`${t.title}を完了にする`} checked={t.done} onChange={() => onToggle(t.id)} style={{ cursor:"pointer" }} /></td>
                    <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                    <td style={{ ...TD, fontWeight: t.done ? 400 : 600, textDecoration: t.done ? "line-through" : "none", maxWidth:200 }}>{t.title}</td>
                    <td style={{ ...TD, fontSize:11 }}>{t.dueDate}</td>
                    <td style={TD}><span style={{ fontWeight:700, fontSize:11, color: t.done ? "#90A4AE" : dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : dl <= 7 ? "#FF8F00" : "#2E7D32" }}>{t.done ? "✓完了" : dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span></td>
                    <td style={TD}><span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background: p.bg, color: p.color, fontWeight:700 }}>{p.label}</span></td>
                    <td style={TD}>{!t.done && <button style={{ ...BSM, color:"#B71C1C", padding:"2px 7px" }} title="タスクを削除" aria-label={`${t.title}を削除`} onClick={() => onDelete(t.id)}>×</button>}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign:"center", color:"#90A4AE", padding:22 }}>{showDone ? "タスクなし" : "未完了タスクなし ✓"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
