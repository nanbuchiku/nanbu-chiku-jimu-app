import React, { useMemo, useState, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { isSameDay, toDateStr } from '../utils';
import { BP, BC } from '../styles';

const DAY_NAMES = ["日","月","火","水","木","金","土"];

export default memo(function CalendarView({ speakers, weekDates, weekOffset, setWeekOffset, today, onSpeaker, onAddForDate }) {
  const [viewMode, setViewMode] = useState("week");
  const [monthOffset, setMonthOffset] = useState(0);

  // ── Week view data ──────────────────────────────
  const weekLabel = useMemo(() => {
    const a = weekDates[1], b = weekDates[5];
    return `${a.getFullYear()}年${a.getMonth()+1}月${a.getDate()}日 〜 ${b.getMonth()+1}月${b.getDate()}日`;
  }, [weekDates]);

  const speakerByKey = useMemo(() => {
    const map = new Map();
    speakers.forEach(sp => {
      if (sp.seminarDate) map.set(`${sp.chapterId}|${sp.seminarDate}`, sp);
    });
    return map;
  }, [speakers]);

  // ── Month view data ─────────────────────────────
  const baseMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1), [today, monthOffset]);

  const monthLabel = useMemo(() => `${baseMonth.getFullYear()}年${baseMonth.getMonth()+1}月`, [baseMonth]);

  const monthDays = useMemo(() => {
    const year = baseMonth.getFullYear();
    const month = baseMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstDay.getDay();
    const days = [];
    for (let i = 0; i < leadingBlanks; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [baseMonth]);

  // Chapter lookup by day-of-week
  const chapterByDay = useMemo(() => {
    const m = {};
    CHAPTERS.forEach(ch => { m[ch.day] = ch; });
    return m;
  }, []);

  if (viewMode === "month") {
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
          <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>月間カレンダー</div>
          <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
            <button aria-label="前月" style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setMonthOffset(o => o - 1)}>‹ 前月</button>
            <span style={{ fontSize:13, fontWeight:700, color:"#1A3A6B", minWidth:120, textAlign:"center" }}>{monthLabel}</span>
            <button aria-label="次月" style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setMonthOffset(o => o + 1)}>次月 ›</button>
            <button aria-label="今月に戻る" style={BP} onClick={() => setMonthOffset(0)}>今月</button>
            <button style={BC} onClick={() => setViewMode("week")}>週表示に切替</button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, background:"#CFD8DC", borderRadius:"8px 8px 0 0", overflow:"hidden", marginBottom:1 }}>
          {DAY_NAMES.map((d, i) => (
            <div key={d} style={{ background: i===0?"#FFF3E0":i===6?"#E3F2FD":"#ECEFF1", textAlign:"center", padding:"5px 2px", fontSize:11, fontWeight:700, color: i===0?"#E65100":i===6?"#1565C0":"#546E7A" }}>{d}</div>
          ))}
        </div>

        {/* Month grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, background:"#CFD8DC", borderRadius:"0 0 8px 8px", overflow:"hidden" }}>
          {monthDays.map((d, idx) => {
            if (!d) return <div key={`blank-${idx}`} style={{ background:"#F5F5F5", minHeight:90 }} />;
            const dStr = toDateStr(d);
            const isT = isSameDay(d, today);
            const dow = d.getDay();
            const ch = chapterByDay[dow];
            const sp = ch ? speakerByKey.get(`${ch.id}|${dStr}`) : null;
            const isSun = dow === 0, isSat = dow === 6;
            const jumpToWeek = () => {
              const todayMon = new Date(today); todayMon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
              const dMon = new Date(d); dMon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
              setWeekOffset(Math.round((dMon - todayMon) / (7 * 86400000)));
              setViewMode("week");
            };
            return (
              <div key={dStr} onClick={jumpToWeek} style={{ background: isT ? "#EDE7F6" : "#fff", minHeight:90, padding:"4px 5px", borderTop: isT ? "2px solid #7E57C2" : "none", position:"relative", cursor:"pointer" }}
                title="クリックで週表示へ">
                <div style={{ fontSize:12, fontWeight:700, color: isT ? "#7E57C2" : isSun ? "#E65100" : isSat ? "#1565C0" : "#37474F", marginBottom:3 }}>
                  {d.getDate()}
                  {isT && <span style={{ fontSize:8, background:"#7E57C2", color:"#fff", borderRadius:6, padding:"1px 4px", marginLeft:4, fontWeight:700, verticalAlign:"middle" }}>今日</span>}
                </div>
                {ch && (
                  <div
                    style={{ background: sp ? ch.light : "#FAFAFA", border:`1px solid ${sp ? ch.accent : "#ECEFF1"}`, borderRadius:5, padding:"3px 5px", cursor: "pointer", transition:"box-shadow .1s" }}
                    onClick={e => { e.stopPropagation(); sp ? onSpeaker(sp) : (onAddForDate && onAddForDate(dStr, ch.id)); }}
                    title={sp ? `${sp.speakerName}「${sp.topic}」` : `${ch.name} — クリックして講師を登録`}
                  >
                    <div style={{ fontSize:9, fontWeight:700, color: ch.color, marginBottom:1 }}>{ch.name}</div>
                    {sp ? (
                      <>
                        <div style={{ fontSize:10, fontWeight:600, color:"#263238", lineHeight:1.3 }}>{sp.speakerName}</div>
                        <div style={{ fontSize:8, color:"#546E7A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>「{sp.topic}」</div>
                        <span style={{ fontSize:7, padding:"1px 4px", borderRadius:8, fontWeight:600, color: STATUS[sp.status].color, background: STATUS[sp.status].bg }}>{STATUS[sp.status].label}</span>
                      </>
                    ) : (
                      <div style={{ fontSize:9, color:"#B0BEC5" }}>
                        未定{onAddForDate ? <span style={{ color: ch.color, marginLeft:3 }}>＋</span> : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
          {CHAPTERS.map(ch => {
            const count = speakers.filter(sp => {
              if (!sp.seminarDate) return false;
              const [y, m] = sp.seminarDate.split('-').map(Number);
              return y === baseMonth.getFullYear() && m === baseMonth.getMonth()+1;
            }).length;
            return (
              <span key={ch.id} style={{ fontSize:11, padding:"2px 9px", borderRadius:12, fontWeight:600, color: ch.color, background: ch.light, border:`1px solid ${ch.accent}` }}>
                {ch.name} {count > 0 ? `${count}件` : "未登録"}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop:8, padding:"7px 12px", background:"#F5F5F5", borderRadius:6, fontSize:11, color:"#78909C" }}>
          💡 日付セルをクリック → 週表示へ移動　｜　MS日程セルをクリック → 確認書を表示 / 未登録セルをクリック → 新規登録
        </div>
      </div>
    );
  }

  // ── Week view ──────────────────────────────────
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>週間カレンダー</div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
          <button aria-label="前週" style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o - 1)}>‹ 前週</button>
          <span aria-live="polite" style={{ fontSize:12, color:"#37474F", minWidth:210, textAlign:"center" }}>{weekLabel}</span>
          <button aria-label="次週" style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o + 1)}>次週 ›</button>
          <button aria-label="今週に戻る" style={BP} onClick={() => setWeekOffset(0)}>今週</button>
          <button style={BC} onClick={() => setViewMode("month")}>月表示に切替</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"96px repeat(7,1fr)", gap:1, background:"#CFD8DC", borderRadius:8, overflow:"hidden" }}>
        <div style={{ background:"#fff", padding:"6px 3px", textAlign:"center", fontSize:11, fontWeight:700 }}></div>
        {weekDates.map((d, i) => {
          const isT = isSameDay(d, today);
          const showMonth = d.getDate() === 1 || i === 0;
          return (
            <div key={i} style={{ background: isT ? "#1A3A6B" : "#fff", color: isT ? "#fff" : "#37474F", padding:"6px 3px", textAlign:"center", fontSize:11, fontWeight:700 }}>
              {showMonth && <div style={{ fontSize:8, opacity:.6, letterSpacing:"0.05em" }}>{d.getMonth()+1}月</div>}
              <div style={{ fontSize:9, opacity:.7 }}>{DAY_NAMES[d.getDay()]}曜</div>
              <div style={{ fontSize:16, fontWeight:700 }}>{d.getDate()}</div>
            </div>
          );
        })}
        {CHAPTERS.map(ch => (
          <React.Fragment key={ch.id}>
            <div style={{ background:"#FAFAFA", padding:"6px 8px", display:"flex", flexDirection:"column", justifyContent:"center", gap:1, borderLeft:`3px solid ${ch.color}` }}>
              <span style={{ color: ch.color, fontWeight:700, fontSize:11 }}>{ch.name}</span>
              <span style={{ fontSize:9, color:"#90A4AE" }}>{ch.dayName}</span>
            </div>
            {weekDates.map((d, i) => {
              const isChDay = d.getDay() === ch.day;
              const dKey = toDateStr(d);
              const sp = isChDay ? (speakerByKey.get(`${ch.id}|${dKey}`) || null) : null;
              return (
                <div key={i} style={{ background: isChDay ? ch.light : "#fff", padding:4, minHeight:76, border:`1px solid ${isChDay ? ch.accent : "transparent"}` }}>
                  {isChDay && (sp ? (
                    <div style={{ cursor:"pointer", padding:"3px 4px", borderRadius:4 }} onClick={() => onSpeaker(sp)}>
                      <div style={{ fontSize:10, fontWeight:700, color: ch.color }}>{sp.speakerName}</div>
                      <div style={{ fontSize:9, color:"#546E7A", marginTop:1 }}>「{sp.topic}」</div>
                      <span style={{ fontSize:8, padding:"2px 6px", borderRadius:12, fontWeight:600, color: STATUS[sp.status].color, background: STATUS[sp.status].bg }}>{STATUS[sp.status].label}</span>
                    </div>
                  ) : (
                    <div style={{ textAlign:"center", paddingTop:10, cursor: onAddForDate ? "pointer" : "default" }}
                      title={onAddForDate ? "クリックで講師を登録" : undefined}
                      onClick={() => onAddForDate?.(dKey, ch.id)}>
                      <div style={{ fontSize:9, color: ch.accent }}>MS開催</div>
                      <div style={{ fontSize:8, color:"#B0BEC5" }}>講師未定</div>
                      {onAddForDate && <div style={{ fontSize:8, color: ch.color, marginTop:2, fontWeight:600 }}>＋ 登録</div>}
                    </div>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop:10, padding:"7px 12px", background:"#F5F5F5", borderRadius:6, fontSize:11, color:"#78909C" }}>
        💡 登録済みセルをクリック → 確認書を表示　｜　未登録セルをクリック → 講師を新規登録　｜　MS = モーニングセミナー（毎週午前6時〜7時）
      </div>
    </div>
  );
});
