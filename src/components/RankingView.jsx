import React, { useState, useMemo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter } from '../utils';
import { CARD, TBL, TH, TD, SEL, PILL } from '../styles';

export default function RankingView({ tasks, today }) {
  const months = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      arr.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: `${d.getFullYear()}年${d.getMonth()+1}月` });
    }
    return arr;
  }, [today.getFullYear(), today.getMonth()]);
  const [selMonth, setSelMonth] = useState(() => months[0].value);

  const ranking = CHAPTERS.map(ch => {
    const done = tasks.filter(t =>
      t.done && t.completedAt && t.chapterId === ch.id &&
      t.completedAt.startsWith(selMonth)
    );
    if (done.length === 0) return { ch, count:0, avgDays:null };
    const scores = done.map(t => Math.ceil((new Date(t.dueDate) - new Date(t.completedAt)) / 86400000));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { ch, count: done.length, avgDays: avg };
  }).sort((a, b) => {
    if (a.avgDays === null && b.avgDays === null) return 0;
    if (a.avgDays === null) return 1;
    if (b.avgDays === null) return -1;
    return b.avgDays - a.avgDays;
  });

  const MEDALS = ["🥇","🥈","🥉","4位","5位"];
  const maxAbs = Math.max(...ranking.filter(r => r.avgDays !== null).map(r => Math.abs(r.avgDays)), 1);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>🏆 タスク完了ランキング</div>
        <select style={{ ...SEL, marginLeft:"auto" }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div style={{ display:"grid", gap:10, marginBottom:16 }}>
        {ranking.map((r, i) => {
          const isTop   = i === 0 && r.avgDays !== null;
          const noData  = r.avgDays === null;
          const isEarly = r.avgDays !== null && r.avgDays >= 0;
          const barW    = noData ? 0 : Math.round(Math.abs(r.avgDays) / maxAbs * 100);
          return (
            <div key={r.ch.id} style={{ ...CARD, marginBottom:0, border: isTop ? `2px solid ${r.ch.color}` : "2px solid transparent", position:"relative", overflow:"hidden" }}>
              {isTop && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: r.ch.color }} />}
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <div style={{ fontSize: i < 3 ? 28 : 18, minWidth:40, textAlign:"center", lineHeight:1 }}>{noData ? "－" : MEDALS[i]}</div>
                <div style={{ minWidth:90 }}>
                  <div style={{ fontWeight:800, fontSize:13, color: r.ch.color }}>{r.ch.name}</div>
                  <div style={{ fontSize:10, color:"#90A4AE" }}>{r.ch.dayName}</div>
                </div>
                <div style={{ flex:1, minWidth:160 }}>
                  {noData ? (
                    <div style={{ fontSize:11, color:"#B0BEC5" }}>完了タスクなし</div>
                  ) : (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:20, fontWeight:800, color: isEarly ? "#1B5E20" : "#B71C1C" }}>{isEarly ? "+" : ""}{r.avgDays.toFixed(1)}</span>
                        <span style={{ fontSize:11, color:"#78909C" }}>日（平均）</span>
                        <span style={{ fontSize:11, color:"#546E7A", marginLeft:4 }}>{isEarly ? "⬆ 期限より早い" : "⬇ 期限より遅い"}</span>
                      </div>
                      <div style={{ background:"#ECEFF1", borderRadius:4, height:10, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:4, width:`${barW}%`, background: isEarly ? `linear-gradient(90deg, ${r.ch.color}, ${r.ch.accent})` : "linear-gradient(90deg, #EF5350, #FFCDD2)", transition:"width .4s" }} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"center", minWidth:60 }}>
                  <div style={{ fontSize:22, fontWeight:800, color: r.ch.color }}>{r.count}</div>
                  <div style={{ fontSize:10, color:"#90A4AE" }}>件完了</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>完了タスク詳細（{months.find(m => m.value === selMonth)?.label}）</div>
      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["単会","タスク内容","期限","完了日時","早/遅"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {tasks
                .filter(t => t.done && t.completedAt && t.completedAt.startsWith(selMonth))
                .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                .map(t => {
                  const ch   = getChapter(t.chapterId);
                  const days = Math.ceil((new Date(t.dueDate) - new Date(t.completedAt)) / 86400000);
                  const comp = new Date(t.completedAt);
                  const compStr = `${comp.getMonth()+1}/${comp.getDate()} ${String(comp.getHours()).padStart(2,"0")}:${String(comp.getMinutes()).padStart(2,"0")}`;
                  return (
                    <tr key={t.id} className="hover-row">
                      <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                      <td style={{ ...TD, maxWidth:200 }}>{t.title}</td>
                      <td style={{ ...TD, fontSize:11 }}>{t.dueDate}</td>
                      <td style={{ ...TD, fontSize:11 }}>{compStr}</td>
                      <td style={TD}><span style={{ fontWeight:700, fontSize:12, color: days >= 0 ? "#1B5E20" : "#B71C1C" }}>{days >= 0 ? `+${days}日早` : `${Math.abs(days)}日遅`}</span></td>
                    </tr>
                  );
                })}
              {tasks.filter(t => t.done && t.completedAt && t.completedAt.startsWith(selMonth)).length === 0 && (
                <tr><td colSpan={5} style={{ ...TD, textAlign:"center", color:"#90A4AE", padding:22 }}>この月の完了タスクなし</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ padding:"8px 12px", background:"#E3F2FD", borderRadius:6, fontSize:11, color:"#1565C0" }}>
        💡 タスク管理タブでチェックを入れると自動でタイムスタンプが記録され、ランキングに反映されます
      </div>
    </div>
  );
}
