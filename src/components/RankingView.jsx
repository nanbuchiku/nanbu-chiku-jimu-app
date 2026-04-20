import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter } from '../utils';
import { CARD, TBL, TH, TD, SEL, PILL, BC } from '../styles';

const MEDALS = ["🥇","🥈","🥉","4位","5位"];

export default memo(function RankingView({ tasks, speakers = [], today }) {
  const months = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      arr.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: `${d.getFullYear()}年${d.getMonth()+1}月` });
    }
    return arr;
  }, [today]);
  const [selMonth, setSelMonth] = useState(() => months[0].value);

  const ranking = useMemo(() => CHAPTERS.map(ch => {
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
  }), [tasks, selMonth]);

  const maxAbs = useMemo(() => Math.max(...ranking.filter(r => r.avgDays !== null).map(r => Math.abs(r.avgDays)), 1), [ranking]);

  const exportCSV = useCallback(() => {
    const headers = ["単会","タスク内容","期限","完了日時","早/遅（日）"];
    const rows = tasks
      .filter(t => t.done && t.completedAt && t.completedAt.startsWith(selMonth))
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .map(t => {
        const ch = getChapter(t.chapterId);
        const days = Math.ceil((new Date(t.dueDate) - new Date(t.completedAt)) / 86400000);
        return [ch.name, t.title, t.dueDate, t.completedAt?.slice(0,16).replace("T"," "), days >= 0 ? `+${days}` : `${days}`];
      });
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8;" })),
      download: `完了ランキング_${selMonth}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [tasks, selMonth]);

  const allTimeStats = useMemo(() => CHAPTERS.map(ch => {
    const done = tasks.filter(t => t.done && t.completedAt && t.chapterId === ch.id);
    if (done.length === 0) return { ch, count: 0, avgDays: null };
    const scores = done.map(t => Math.ceil((new Date(t.dueDate) - new Date(t.completedAt)) / 86400000));
    return { ch, count: done.length, avgDays: scores.reduce((a, b) => a + b, 0) / scores.length };
  }).sort((a, b) => (b.count || 0) - (a.count || 0)), [tasks]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>🏆 タスク完了ランキング</div>
        <select style={{ ...SEL, marginLeft:"auto" }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button style={{ ...BC, fontSize:11 }} onClick={exportCSV}>📥 CSV</button>
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
      {allTimeStats.some(s => s.count > 0) && (
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>累計タスク完了数（全期間）</div>
          <div style={CARD}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {allTimeStats.filter(s => s.count > 0).map(s => (
                <div key={s.ch.id} style={{ display:"flex", alignItems:"center", gap:6, background:"#FAFAFA", border:`1px solid ${s.ch.accent}`, borderRadius:8, padding:"7px 12px", minWidth:130 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#fff", background: s.ch.color, padding:"1px 7px", borderRadius:10 }}>{s.ch.short}</span>
                  <div>
                    <div style={{ fontSize:20, fontWeight:800, color: s.ch.color, lineHeight:1 }}>{s.count}<span style={{ fontSize:10, fontWeight:400, marginLeft:2 }}>件</span></div>
                    {s.avgDays !== null && <div style={{ fontSize:10, color: s.avgDays >= 0 ? "#2E7D32" : "#B71C1C" }}>{s.avgDays >= 0 ? `+${s.avgDays.toFixed(1)}日` : `${s.avgDays.toFixed(1)}日`}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ padding:"8px 12px", background:"#E3F2FD", borderRadius:6, fontSize:11, color:"#1565C0", marginBottom:12 }}>
        💡 タスク管理タブでチェックを入れると自動でタイムスタンプが記録され、ランキングに反映されます
      </div>

      {speakers.some(s => s.shioriArticle) && (() => {
        const counts = {};
        speakers.forEach(s => { if (s.shioriArticle) counts[s.shioriArticle] = (counts[s.shioriArticle] || 0) + 1; });
        const arts = Array.from({length:17},(_,i)=>`第${i+1}条`).map(art => ({ art, count: counts[art] || 0 }));
        const maxCount = Math.max(...arts.map(a => a.count), 1);
        return (
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>📖 栞・条の使用回数（全期間）</div>
            <div style={{ ...CARD, padding:"12px 14px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:6 }}>
                {arts.map(({ art, count }) => (
                  <div key={art} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 0" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:"#37474F", minWidth:52 }}>{art}</span>
                    <div style={{ flex:1, background:"#ECEFF1", borderRadius:3, height:8, overflow:"hidden" }}>
                      <div style={{ height:8, borderRadius:3, width:`${(count/maxCount)*100}%`, background: count === 0 ? "transparent" : count >= 3 ? "#FF8F00" : "#1A3A6B", transition:"width .3s" }} />
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, minWidth:20, textAlign:"right", color: count === 0 ? "#B0BEC5" : count >= 3 ? "#E65100" : "#546E7A" }}>{count}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:10, color:"#90A4AE", display:"flex", gap:12 }}>
                <span><span style={{ color:"#B0BEC5", fontWeight:700 }}>0</span> 未使用</span>
                <span><span style={{ color:"#1A3A6B", fontWeight:700 }}>1-2</span> 使用済</span>
                <span><span style={{ color:"#E65100", fontWeight:700 }}>3+</span> 要注意（多用）</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});
