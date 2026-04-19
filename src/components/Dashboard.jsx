import React, { useMemo, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { getChapter, toDateStr } from '../utils';
import { CARD, BSM, PILL } from '../styles';

export default memo(function Dashboard({ speakers, tasks, weekDates, today, onView, setTab, onFormUrl, onGoSpeakers, onAddForDate }) {
  const thisWeek = useMemo(() => {
    const weekStrs = new Set(weekDates.map(toDateStr));
    return speakers.filter(sp => sp.seminarDate && weekStrs.has(sp.seminarDate));
  }, [speakers, weekDates]);

  const nextWeek = useMemo(() => {
    const nextStrs = new Set(weekDates.map(d => {
      const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      return toDateStr(nd);
    }));
    return speakers.filter(sp => sp.seminarDate && nextStrs.has(sp.seminarDate));
  }, [speakers, weekDates]);
  const todayStr = useMemo(() => toDateStr(today), [today]);
  const topTasks = useMemo(
    () => tasks.filter(t => !t.done).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5),
    [tasks]
  );
  const overdueTasks = useMemo(
    () => tasks.filter(t => !t.done && t.dueDate && t.dueDate < todayStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [tasks, todayStr]
  );
  const overdueCount = overdueTasks.length;

  const materialPending = useMemo(() => {
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    const cutoffStr = toDateStr(cutoff);
    const todayStr = toDateStr(today);
    return speakers.filter(sp =>
      sp.status !== "cancelled" &&
      sp.seminarDate &&
      sp.seminarDate >= todayStr &&
      sp.seminarDate <= cutoffStr &&
      !sp.materialUrl
    ).sort((a, b) => a.seminarDate.localeCompare(b.seminarDate));
  }, [speakers, today]);

  const unassignedMS = useMemo(() => {
    const assigned = new Set(speakers.filter(sp => sp.seminarType === "ms" || !sp.seminarType).map(sp => `${sp.chapterId}|${sp.seminarDate}`));
    const result = [];
    CHAPTERS.forEach(ch => {
      const d = new Date(today);
      const daysToFirst = (ch.day - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysToFirst);
      for (let i = 0; i < 8; i++) {
        const key = `${ch.id}|${toDateStr(d)}`;
        if (!assigned.has(key)) result.push({ ch, dateStr: toDateStr(d), date: new Date(d) });
        d.setDate(d.getDate() + 7);
      }
    });
    return result.sort((a, b) => a.date - b.date).slice(0, 10);
  }, [speakers, today]);

  const upcoming14 = useMemo(() => {
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    const endStr = toDateStr(endDate);
    return speakers
      .filter(sp => sp.seminarDate && sp.seminarDate >= todayStr && sp.seminarDate <= endStr && sp.status !== "cancelled")
      .sort((a, b) => a.seminarDate.localeCompare(b.seminarDate));
  }, [speakers, today, todayStr]);

  const stats = useMemo(() => [
    { label:"今週の開催",  val: thisWeek.length,                                      sub:"/5単会", color:"#1A3A6B", action: () => setTab("calendar") },
    { label:"依頼確定済",  val: speakers.filter(x => x.status === "confirmed").length, sub:"件",    color:"#1B5E20", action: () => onGoSpeakers("confirmed") },
    { label:"確認待ち",    val: speakers.filter(x => x.status === "pending").length,   sub:"件",    color:"#BF360C", action: () => onGoSpeakers("pending") },
    { label:"未完了タスク",val: tasks.filter(t => !t.done).length,                    sub:"件",    color:"#546E7A", action: () => setTab("tasks") },
    ...(overdueCount > 0 ? [{ label:"期限超過",    val: overdueCount,                 sub:"件 ⚠",  color:"#B71C1C", action: () => setTab("tasks") }] : []),
  ], [thisWeek, speakers, tasks, overdueCount, setTab, onGoSpeakers]);

  return (
    <div>
      <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B", marginBottom:13 }}>ダッシュボード</div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10, marginBottom:14 }}>
        {stats.map((it, i) => (
          <div key={i} onClick={it.action} style={{ ...CARD, borderTop:`4px solid ${it.color}`, marginBottom:0, cursor:"pointer", transition:"box-shadow .15s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.14)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.08)"}>
            <div style={{ fontSize:28, fontWeight:800, lineHeight:1, color: it.color }}>{it.val}<span style={{ fontSize:11, fontWeight:400, marginLeft:3 }}>{it.sub}</span></div>
            <div style={{ fontSize:11, color:"#78909C", marginTop:3 }}>{it.label}</div>
            <div style={{ fontSize:10, color: it.color, marginTop:4, fontWeight:600, opacity:.7 }}>クリックで詳細 →</div>
          </div>
        ))}
      </div>

      {overdueTasks.length > 0 && (
        <div style={{ ...CARD, marginBottom:12, borderLeft:"5px solid #B71C1C", padding:"10px 14px", background:"#FFEBEE" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, flexWrap:"wrap", gap:6 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#B71C1C" }}>⚠ 期限超過タスク　{overdueTasks.length}件</div>
            <button onClick={() => setTab("tasks")} style={{ fontSize:10, background:"#B71C1C", color:"#fff", border:"none", borderRadius:10, padding:"2px 10px", cursor:"pointer", fontWeight:700 }}>タスク管理へ →</button>
          </div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {overdueTasks.slice(0, 6).map(t => {
              const ch = getChapter(t.chapterId);
              const overDays = Math.ceil((today - new Date(t.dueDate)) / 86400000);
              return (
                <span key={t.id} style={{ fontSize:11, background:"#FFCDD2", border:"1px solid #EF9A9A", borderRadius:6, padding:"3px 9px", color:"#B71C1C", display:"flex", gap:5, alignItems:"center" }}>
                  <span style={{ fontSize:9, fontWeight:700, background: ch.color, color:"#fff", padding:"1px 4px", borderRadius:8 }}>{ch.short || ch.name}</span>
                  <span style={{ fontWeight:600 }}>{t.title}</span>
                  <span style={{ fontSize:9, opacity:.8 }}>({overDays}日超過)</span>
                </span>
              );
            })}
            {overdueTasks.length > 6 && <span style={{ fontSize:11, color:"#B71C1C", fontWeight:600 }}>…他{overdueTasks.length - 6}件</span>}
          </div>
        </div>
      )}

      {materialPending.length > 0 && (
        <div style={{ ...CARD, marginBottom:12, borderLeft:"5px solid #E65100", padding:"10px 14px", background:"#FFF8E1" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#E65100", marginBottom:6 }}>
            📭 顔写真・資料未受領（14日以内の開催）　{materialPending.length}件
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {materialPending.map(sp => {
              const ch = getChapter(sp.chapterId);
              return (
                <span key={sp.id} style={{ fontSize:11, background:"#FFF3CD", border:"1px solid #FFE082", borderRadius:6, padding:"3px 9px", color:"#E65100", fontWeight:600 }}>
                  {sp.seminarDate} {ch.name} {sp.speakerName}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12, marginBottom:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>
            今週のモーニングセミナー
            {weekDates.length >= 6 && <span style={{ fontSize:11, fontWeight:400, color:"#90A4AE", marginLeft:6 }}>{weekDates[1].getMonth()+1}/{weekDates[1].getDate()} 〜 {weekDates[5].getMonth()+1}/{weekDates[5].getDate()}</span>}
          </div>
          <div style={CARD}>
            {CHAPTERS.map(ch => {
              const sp = thisWeek.find(x => x.chapterId === ch.id);
              const isToday = sp && sp.seminarDate === toDateStr(today);
              return (
                <div key={ch.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid #F5F5F5", background: isToday ? "#FFEBEE" : "transparent", borderRadius: isToday ? 4 : 0, paddingLeft: isToday ? 4 : 0 }}>
                  <div style={{ color:"#fff", fontSize:10, padding:"2px 7px", borderRadius:12, fontWeight:700, background: ch.color, minWidth:26, textAlign:"center" }}>{ch.dayName.replace("曜日","")}</div>
                  <div style={{ fontWeight:700, fontSize:12, minWidth:70, color: ch.color }}>{ch.name}</div>
                  {sp ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", flex:1 }}>
                      {isToday && <span style={{ fontSize:9, background:"#B71C1C", color:"#fff", padding:"1px 5px", borderRadius:8, fontWeight:700 }}>今日！</span>}
                      <span style={{ fontSize:12, fontWeight:600 }}>{sp.speakerName}</span>
                      <span style={{ fontSize:11, color:"#546E7A", background:"#ECEFF1", padding:"2px 7px", borderRadius:12 }}>「{sp.topic}」</span>
                      <span style={{ fontSize:11, padding:"2px 7px", borderRadius:12, fontWeight:600, color: STATUS[sp.status].color, background: STATUS[sp.status].bg }}>{STATUS[sp.status].label}</span>
                      <button style={BSM} onClick={() => onView(sp)}>確認書</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:6, flex:1 }}>
                      <span style={{ color:"#9E9E9E", fontSize:11 }}>── 講師未設定</span>
                      {onAddForDate && (() => {
                        const wd = weekDates.find(d => d.getDay() === ch.day);
                        return wd ? (
                          <button onClick={() => onAddForDate(toDateStr(wd), ch.id)} style={{ fontSize:10, padding:"2px 8px", borderRadius:10, border:"1px solid #90CAF9", background:"#E3F2FD", color:"#1565C0", cursor:"pointer", fontWeight:700, lineHeight:1.4 }}>＋ 登録</button>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {nextWeek.length > 0 && (
            <div style={{ marginTop:10, padding:"8px 12px", background:"#F5F6FA", border:"1px solid #D0D7E2", borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#78909C", marginBottom:5 }}>来週の講師</div>
              {nextWeek.map(sp => {
                const ch = getChapter(sp.chapterId);
                return (
                  <div key={sp.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:"#fff", background: ch.color, padding:"1px 5px", borderRadius:8 }}>{ch.short}</span>
                    <span style={{ fontSize:11, fontWeight:600 }}>{sp.speakerName}</span>
                    <span style={{ fontSize:10, color:"#78909C" }}>「{sp.topic}」</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>優先タスク（期限近い順）</div>
          <div style={CARD}>
            {topTasks.map(t => {
              const ch = getChapter(t.chapterId);
              const dl = Math.ceil((new Date(t.dueDate) - today) / 86400000);
              return (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid #F5F5F5" }}>
                  <span style={PILL(ch)}>{ch.name}</span>
                  <span style={{ flex:1, fontSize:12 }}>{t.title}</span>
                  <span style={{ fontSize:11, fontWeight:700, color: dl < 0 ? "#B71C1C" : dl === 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : "#546E7A" }}>{dl < 0 ? `${Math.abs(dl)}日超過` : dl === 0 ? "今日！" : `${dl}日`}</span>
                </div>
              );
            })}
            {topTasks.length === 0 && <div style={{ color:"#90A4AE", fontSize:12, textAlign:"center", padding:12 }}>タスクなし ✓</div>}
            <button style={{ background:"transparent", border:"none", color:"#1565C0", fontSize:12, cursor:"pointer", padding:"7px 0 0", fontWeight:600, display:"block" }} onClick={() => setTab("tasks")}>全タスクを見る →</button>
          </div>

          <div style={{ marginTop:12, background:"linear-gradient(135deg,#EDE7F6,#F3E5F5)", border:"2px solid #7E57C2", borderRadius:10, padding:"14px 16px", cursor:"pointer" }} onClick={() => onFormUrl(null)}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ background:"#7E57C2", color:"#fff", borderRadius:"50%", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📝</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:"#4527A0" }}>講師依頼フォームを作成</div>
                <div style={{ fontSize:11, color:"#7E57C2", marginTop:2 }}>情報を入力してURLを発行 → 講師へ送付</div>
              </div>
              <div style={{ marginLeft:"auto", fontSize:18, color:"#7E57C2" }}>›</div>
            </div>
          </div>
        </div>
      </div>

      {upcoming14.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>
            今後14日の開催予定
            <span style={{ fontSize:11, fontWeight:400, color:"#90A4AE", marginLeft:8 }}>{upcoming14.length}件</span>
          </div>
          <div style={{ ...CARD, marginBottom:0, padding:"8px 12px" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {upcoming14.map(sp => {
                const ch = getChapter(sp.chapterId);
                const dl = Math.ceil((new Date(sp.seminarDate) - today) / 86400000);
                const isToday = dl === 0;
                const isUrgent = dl <= 3;
                return (
                  <div key={sp.id} onClick={() => onView(sp)} style={{ display:"flex", alignItems:"center", gap:6, background: isToday ? "#FFEBEE" : isUrgent ? "#FFF8E1" : "#FAFAFA", border:`1px solid ${isToday ? "#EF9A9A" : isUrgent ? "#FFE082" : ch.accent}`, borderRadius:8, padding:"6px 11px", cursor:"pointer", transition:"box-shadow .1s" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.1)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow="none"}
                  >
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"#fff", background: ch.color, padding:"1px 5px", borderRadius:8 }}>{ch.short}</div>
                      <div style={{ fontSize:11, fontWeight:700, color: isToday ? "#B71C1C" : isUrgent ? "#E65100" : "#546E7A", marginTop:2 }}>{isToday ? "今日" : `${dl}日後`}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#263238" }}>{sp.speakerName}</div>
                      <div style={{ fontSize:9, color:"#78909C" }}>{sp.seminarDate}｜{STATUS[sp.status]?.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button style={{ background:"transparent", border:"none", color:"#1565C0", fontSize:12, cursor:"pointer", padding:"6px 0 0", fontWeight:600, display:"block" }} onClick={() => setTab("calendar")}>カレンダーで確認 →</button>
          </div>
        </div>
      )}

      {unassignedMS.length > 0 && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>
            未設定のモーニングセミナー日程
            <span style={{ fontSize:11, fontWeight:400, color:"#90A4AE", marginLeft:8 }}>{unassignedMS.length}件（今後8週）</span>
          </div>
          <div style={{ ...CARD, marginBottom:0 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {unassignedMS.map(({ ch, dateStr, date }) => {
                const dl = Math.ceil((date - today) / 86400000);
                return (
                  <div key={`${ch.id}|${dateStr}`} style={{ display:"flex", alignItems:"center", gap:6, background:"#FAFAFA", border:"1px solid #ECEFF1", borderRadius:6, padding:"5px 10px", cursor:"pointer" }} title="クリックで講師を新規登録" onClick={() => onAddForDate ? onAddForDate(dateStr, ch.id) : setTab("speakers")}>
                    <span style={{ fontSize:10, fontWeight:700, color:"#fff", background: ch.color, padding:"1px 6px", borderRadius:10 }}>{ch.short}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:"#37474F" }}>{dateStr}</span>
                    <span style={{ fontSize:10, color: dl <= 14 ? "#E65100" : "#90A4AE" }}>あと{dl}日</span>
                  </div>
                );
              })}
            </div>
            <button style={{ background:"transparent", border:"none", color:"#1565C0", fontSize:12, cursor:"pointer", padding:"7px 0 0", fontWeight:600, display:"block" }} onClick={() => setTab("speakers")}>講師管理で登録 →</button>
          </div>
        </div>
      )}
    </div>
  );
});
