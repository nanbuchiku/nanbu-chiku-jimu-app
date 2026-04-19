import React from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { isSameDay } from '../utils';

export default function CalendarView({ speakers, weekDates, weekOffset, setWeekOffset, today, onSpeaker }) {
  const a = weekDates[1], b = weekDates[5];
  const label = `${a.getFullYear()}年${a.getMonth()+1}月${a.getDate()}日 〜 ${b.getMonth()+1}月${b.getDate()}日`;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>週間カレンダー</div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
          <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o - 1)}>‹ 前週</button>
          <span style={{ fontSize:12, color:"#37474F", minWidth:210, textAlign:"center" }}>{label}</span>
          <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o + 1)}>次週 ›</button>
          <button style={{ background:"#1A3A6B", color:"#fff", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600 }} onClick={() => setWeekOffset(0)}>今週</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"96px repeat(7,1fr)", gap:1, background:"#CFD8DC", borderRadius:8, overflow:"hidden" }}>
        <div style={{ background:"#fff", padding:"6px 3px", textAlign:"center", fontSize:11, fontWeight:700 }}></div>
        {weekDates.map((d, i) => {
          const isT = isSameDay(d, today);
          return (
            <div key={i} style={{ background: isT ? "#1A3A6B" : "#fff", color: isT ? "#fff" : "#37474F", padding:"6px 3px", textAlign:"center", fontSize:11, fontWeight:700 }}>
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
              const sp = isChDay ? speakers.find(x => x.chapterId === ch.id && isSameDay(new Date(x.seminarDate), d)) : null;
              return (
                <div key={i} style={{ background: isChDay ? ch.light : "#fff", padding:4, minHeight:76, border:`1px solid ${isChDay ? ch.accent : "transparent"}` }}>
                  {isChDay && (sp ? (
                    <div style={{ cursor:"pointer", padding:"3px 4px", borderRadius:4 }} onClick={() => onSpeaker(sp)}>
                      <div style={{ fontSize:10, fontWeight:700, color: ch.color }}>{sp.speakerName}</div>
                      <div style={{ fontSize:9, color:"#546E7A", marginTop:1 }}>「{sp.topic}」</div>
                      <span style={{ fontSize:8, padding:"2px 6px", borderRadius:12, fontWeight:600, color: STATUS[sp.status].color, background: STATUS[sp.status].bg }}>{STATUS[sp.status].label}</span>
                    </div>
                  ) : (
                    <div style={{ textAlign:"center", paddingTop:16 }}>
                      <div style={{ fontSize:9, color: ch.accent }}>MS開催</div>
                      <div style={{ fontSize:8, color:"#B0BEC5" }}>講師未定</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop:10, padding:"7px 12px", background:"#F5F5F5", borderRadius:6, fontSize:11, color:"#78909C" }}>
        💡 セルをクリックで確認書を表示　｜　MS = モーニングセミナー（毎週午前6時〜7時）
      </div>
    </div>
  );
}
