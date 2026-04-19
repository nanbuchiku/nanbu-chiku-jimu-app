import React, { useMemo, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { isSameDay } from '../utils';

export default memo(function CalendarView({ speakers, weekDates, weekOffset, setWeekOffset, today, onSpeaker, onAddForDate }) {
  const label = useMemo(() => {
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

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>週間カレンダー</div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
          <button aria-label="前週" style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o - 1)}>‹ 前週</button>
          <span aria-live="polite" style={{ fontSize:12, color:"#37474F", minWidth:210, textAlign:"center" }}>{label}</span>
          <button aria-label="次週" style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o + 1)}>次週 ›</button>
          <button aria-label="今週に戻る" style={{ background:"#1A3A6B", color:"#fff", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600 }} onClick={() => setWeekOffset(0)}>今週</button>
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
              <div style={{ fontSize:9, opacity:.7 }}>{"日月火水木金土"[d.getDay()]}曜</div>
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
              const dKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
