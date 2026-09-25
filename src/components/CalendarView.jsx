import React, { useMemo, useState, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { isSameDay, toDateStr, getSevenSetProgress, buildSpeakerTasks, isTaskDone, isPlaceholderSpeaker, hasNextDayMs, getSeminarType } from '../utils';
import { BP, BC } from '../styles';

const DAY_NAMES = ["日","月","火","水","木","金","土"];

// カレンダーセルのホバーで表示する、講師のタスク進捗ツールチップ
function SpeakerHoverCard({ sp, rect }) {
  if (!sp || !rect) return null;
  if (isPlaceholderSpeaker(sp)) {
    const top = rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - 200);
    return (
      <div style={{
        position:"fixed", top, left, zIndex:1000, width:180, background:"#fff",
        border:"1px solid #D9E1EE", borderRadius:10, boxShadow:"0 6px 20px rgba(0,0,0,.15)",
        padding:"10px 12px", pointerEvents:"none", fontSize:"clamp(11px,1.3vw,13px)",
      }}>
        <div style={{ fontWeight:800, color:"#78909C" }}>🚫 休会</div>
        <div style={{ color:"#98A2B3", marginTop:2 }}>単会自体が開催されません</div>
      </div>
    );
  }
  const seven = getSevenSetProgress(sp);
  const tasks = buildSpeakerTasks(sp);
  const taskDone = tasks.filter(t => isTaskDone(sp.speakerChecks, t.id)).length;
  const CARD_HEIGHT = 230; // 概算の高さ。画面下に収まらない場合はセルの上側に表示する
  const fitsBelow = rect.bottom + 6 + CARD_HEIGHT <= window.innerHeight;
  const top = fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - CARD_HEIGHT - 6);
  const left = Math.min(rect.left, window.innerWidth - 260);
  return (
    <div style={{
      position:"fixed", top, left, zIndex:1000, width:240, background:"#fff",
      border:"1px solid #D9E1EE", borderRadius:10, boxShadow:"0 6px 20px rgba(0,0,0,.15)",
      padding:"10px 12px", pointerEvents:"none", fontSize:"clamp(11px,1.3vw,13px)",
    }}>
      <div style={{ fontWeight:800, color:"#061B44", marginBottom:2 }}>{sp.speakerName || "（名前未入力）"}</div>
      {sp.topic && <div style={{ color:"#667085", marginBottom:6 }}>「{sp.topic}」</div>}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
        <span style={{ fontWeight:700, color:"#37474F" }}>7点セット</span>
        <span style={{ fontWeight:800, color: seven.done === seven.total ? "#2E7D32" : "#E65100" }}>{seven.done}/{seven.total}</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1px 8px", marginBottom:8 }}>
        {seven.items.map(it => (
          <div key={it.key} style={{ color: it.done ? "#2E7D32" : "#B0BEC5", whiteSpace:"nowrap" }}>
            {it.done ? "✓" : "・"} {it.label}
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:6, borderTop:"1px dashed #E0E0E0" }}>
        <span style={{ fontWeight:700, color:"#37474F" }}>全体タスク</span>
        <span style={{ fontWeight:800, color: taskDone === tasks.length ? "#2E7D32" : "#1565C0" }}>{taskDone}/{tasks.length}</span>
      </div>
    </div>
  );
}

export default memo(function CalendarView({ speakers, weekDates, weekOffset, setWeekOffset, today, onSpeaker, onAddForDate, scopeChapter }) {
  const [viewMode, setViewMode] = useState("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [hover, setHover] = useState(null); // { sp, rect }
  // 単会担当者は自分の単会のみ新規登録できる。事務局(scopeChapterなし)は全単会OK
  const canAddFor = chId => !!onAddForDate && (!scopeChapter || chId === scopeChapter);
  const showHover = (sp) => e => setHover({ sp, rect: e.currentTarget.getBoundingClientRect() });
  const hideHover = () => setHover(null);

  // ── Week view data ──────────────────────────────
  const weekLabel = useMemo(() => {
    const a = weekDates[1], b = weekDates[5];
    return `${a.getFullYear()}年${a.getMonth()+1}月${a.getDate()}日 〜 ${b.getMonth()+1}月${b.getDate()}日`;
  }, [weekDates]);

  // 同じ単会・同じ日に講師が複数人いる場合（ハーフ講話・スピーチリレー等）があるため、
  // 1件のsp ではなく配列で保持する（以前はMap.setで後勝ちになり、他の講師が消えて見えるバグがあった）
  const speakerByKey = useMemo(() => {
    const map = new Map();
    const push = (key, sp) => { if (!map.has(key)) map.set(key, []); map.get(key).push(sp); };
    speakers.forEach(sp => {
      if (!sp.seminarDate) return;
      push(`${sp.chapterId}|${sp.seminarDate}`, sp);
      // 前夜開催タイプ（kiso/tsudoi）は、翌朝MS分としても同じ講師が登場する
      if (hasNextDayMs(sp.seminarType)) {
        const d = new Date(sp.seminarDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        const msStr = toDateStr(d);
        push(`${sp.chapterId}|${msStr}`, { ...sp, _msDay: true });
      }
    });
    return map;
  }, [speakers]);

  // kiso・tsudoiの前夜イベント（定例日以外の曜日に開催されるためのバッジ表示用）
  const kisoByChDate = useMemo(() => {
    const map = new Map();
    speakers.forEach(sp => {
      if (hasNextDayMs(sp.seminarType) && sp.seminarDate) {
        const key = `${sp.chapterId}|${sp.seminarDate}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(sp);
      }
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
          <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:700, color:"#061B44" }}>月間カレンダー</div>
          <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
            <button aria-label="前月" style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setMonthOffset(o => o - 1)}>‹ 前月</button>
            <span style={{ fontSize:"clamp(13px,1.8vw,16px)", fontWeight:700, color:"#061B44", minWidth:120, textAlign:"center" }}>{monthLabel}</span>
            <button aria-label="次月" style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setMonthOffset(o => o + 1)}>次月 ›</button>
            <button aria-label="今月に戻る" style={BP} onClick={() => setMonthOffset(0)}>今月</button>
            <button style={BC} onClick={() => setViewMode("week")}>週表示に切替</button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, background:"#D9E1EE", borderRadius:"8px 8px 0 0", overflow:"hidden", marginBottom:1 }}>
          {DAY_NAMES.map((d, i) => (
            <div key={d} style={{ background: i===0?"#FFF3E0":i===6?"#E3F2FD":"#F1F5F9", textAlign:"center", padding:"5px 2px", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color: i===0?"#E65100":i===6?"#1565C0":"#667085" }}>{d}</div>
          ))}
        </div>

        {/* Month grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, background:"#D9E1EE", borderRadius:"0 0 8px 8px", overflow:"hidden" }}>
          {monthDays.map((d, idx) => {
            if (!d) return <div key={`blank-${idx}`} style={{ background:"#F5F5F5", minHeight:90 }} />;
            const dStr = toDateStr(d);
            const isT = isSameDay(d, today);
            const dow = d.getDay();
            const ch = chapterByDay[dow];
            const spList = ch ? (speakerByKey.get(`${ch.id}|${dStr}`) || []) : [];
            const sp = spList[0] || null;
            const isSun = dow === 0, isSat = dow === 6;
            const jumpToWeek = () => {
              const todayMon = new Date(today); todayMon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
              const dMon = new Date(d); dMon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
              setWeekOffset(Math.round((dMon - todayMon) / (7 * 86400000)));
              setViewMode("week");
            };
            return (
              <div key={dStr} onClick={jumpToWeek} style={{ background: isT ? "#EDE7F6" : "#fff", minHeight:112, padding:"4px 5px", borderTop: isT ? "2px solid #7E57C2" : "none", position:"relative", cursor:"pointer", boxSizing:"border-box" }}
                title="クリックで週表示へ">
                <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color: isT ? "#7E57C2" : isSun ? "#E65100" : isSat ? "#1565C0" : "#37474F", marginBottom:3, whiteSpace:"nowrap" }}>
                  {d.getDate()}
                  {isT && <span style={{ fontSize:"clamp(12px,1.4vw,14px)", background:"#7E57C2", color:"#fff", borderRadius:6, padding:"1px 4px", marginLeft:4, fontWeight:700, verticalAlign:"middle" }}>今日</span>}
                </div>
                {ch && (() => {
                  const addable = canAddFor(ch.id);
                  const isKyukai = sp && isPlaceholderSpeaker(sp);
                  return (
                  <div
                    style={{ background: sp ? (isKyukai ? "#ECEFF1" : ch.light) : "#FAFAFA", border:`1px solid ${sp ? (isKyukai ? "#CFD8DC" : ch.accent) : "#F1F5F9"}`, borderRadius:5, padding:"3px 5px", cursor: (sp || addable) ? "pointer" : "default", transition:"box-shadow .1s" }}
                    onClick={e => { e.stopPropagation(); if (sp) onSpeaker(sp); else if (addable) onAddForDate(dStr, ch.id); }}
                    onMouseEnter={sp ? showHover(sp) : undefined}
                    onMouseLeave={sp ? hideHover : undefined}
                    title={sp ? undefined : (addable ? `${ch.name} — クリックして講師を登録` : `${ch.name}（他単会）`)}
                  >
                    <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color: isKyukai ? "#78909C" : ch.color, marginBottom:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ch.name}</div>
                    {sp ? (
                      isKyukai ? (
                        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#78909C" }}>🚫 休会</div>
                      ) : (
                      <>
                        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:600, color:"#263238", lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{sp.speakerName}</div>
                        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#667085", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>「{sp.topic}」</div>
                        <span style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"1px 4px", borderRadius:8, fontWeight:600, color: STATUS[sp.status]?.color ?? "#98A2B3", background: STATUS[sp.status]?.bg ?? "#F1F5F9", display:"inline-block", whiteSpace:"nowrap" }}>{STATUS[sp.status]?.label ?? sp.status}</span>
                        {spList.length > 1 && (
                          <span title={spList.slice(1).map(s => s.speakerName).join('、')} style={{ fontSize:"clamp(11px,1.3vw,13px)", padding:"1px 4px", borderRadius:8, fontWeight:700, color:"#fff", background:"#78909C", display:"inline-block", whiteSpace:"nowrap", marginLeft:3 }}>+{spList.length - 1}件</span>
                        )}
                      </>
                      )
                    ) : (
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#B0BEC5", whiteSpace:"nowrap" }}>
                        未定{addable ? <span style={{ color: ch.color, marginLeft:3 }}>＋</span> : ""}
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
          {CHAPTERS.map(ch => {
            const count = speakers.filter(sp => {
              if (sp.chapterId !== ch.id || !sp.seminarDate) return false;
              const [y, m] = sp.seminarDate.split('-').map(Number);
              return y === baseMonth.getFullYear() && m === baseMonth.getMonth()+1;
            }).length;
            return (
              <span key={ch.id} style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"2px 9px", borderRadius:12, fontWeight:600, color: ch.color, background: ch.light, border:`1px solid ${ch.accent}` }}>
                {ch.name} {count > 0 ? `${count}件` : "未登録"}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop:8, padding:"7px 12px", background:"#F5F5F5", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C" }}>
          💡 日付セルをクリック → 週表示へ移動　｜　MS日程セルをクリック → 確認書を表示 / 未登録セルをクリック → 新規登録　｜　マウスを乗せるとタスク進捗が見られます
        </div>
        <SpeakerHoverCard sp={hover?.sp} rect={hover?.rect} />
      </div>
    );
  }

  // ── Week view ──────────────────────────────────
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:700, color:"#061B44" }}>週間カレンダー</div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
          <button aria-label="前週" style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o - 1)}>‹ 前週</button>
          <span aria-live="polite" style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#37474F", minWidth:210, textAlign:"center" }}>{weekLabel}</span>
          <button aria-label="次週" style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 11px", fontSize:"clamp(12px,1.4vw,14px)", cursor:"pointer", fontWeight:600, color:"#37474F" }} onClick={() => setWeekOffset(o => o + 1)}>次週 ›</button>
          <button aria-label="今週に戻る" style={BP} onClick={() => setWeekOffset(0)}>今週</button>
          <button style={BC} onClick={() => setViewMode("month")}>月表示に切替</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"96px repeat(7,1fr)", gap:1, background:"#D9E1EE", borderRadius:8, overflow:"hidden" }}>
        <div style={{ background:"#fff", padding:"6px 3px", textAlign:"center", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700 }}></div>
        {weekDates.map((d, i) => {
          const isT = isSameDay(d, today);
          const showMonth = d.getDate() === 1 || i === 0;
          return (
            <div key={i} style={{ background: isT ? "#061B44" : "#fff", color: isT ? "#fff" : "#37474F", padding:"6px 3px", textAlign:"center", fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700 }}>
              {showMonth && <div style={{ fontSize:"clamp(12px,1.4vw,14px)", opacity:.6, letterSpacing:"0.05em" }}>{d.getMonth()+1}月</div>}
              <div style={{ fontSize:"clamp(12px,1.4vw,14px)", opacity:.7 }}>{DAY_NAMES[d.getDay()]}曜</div>
              <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:700 }}>{d.getDate()}</div>
            </div>
          );
        })}
        {CHAPTERS.map(ch => (
          <React.Fragment key={ch.id}>
            <div style={{ background:"#FAFAFA", padding:"6px 8px", display:"flex", flexDirection:"column", justifyContent:"center", gap:1, borderLeft:`3px solid ${ch.color}` }}>
              <span style={{ color: ch.color, fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)" }}>{ch.name}</span>
              <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3" }}>{ch.dayName}</span>
              <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#B0BEC5" }}>{ch.time}</span>
            </div>
            {weekDates.map((d, i) => {
              const isChDay = d.getDay() === ch.day;
              const dKey = toDateStr(d);
              const spList = isChDay ? (speakerByKey.get(`${ch.id}|${dKey}`) || []) : [];
              const kisoList = !isChDay ? (kisoByChDate.get(`${ch.id}|${dKey}`) || []) : [];
              return (
                <div key={i} style={{ background: isChDay ? ch.light : "#fff", padding:4, minHeight:76, border:`1px solid ${isChDay ? ch.accent : "transparent"}` }}>
                  {isChDay && (spList.length > 0 ? spList.map((sp, spIdx) => (
                    <div key={sp.id || spIdx} style={{ cursor:"pointer", padding:"3px 4px", borderRadius:4, marginTop: spIdx > 0 ? 4 : 0, borderTop: spIdx > 0 ? `1px dashed ${ch.accent}` : "none" }} onClick={() => onSpeaker(sp)} onMouseEnter={showHover(sp)} onMouseLeave={hideHover}>
                      {isPlaceholderSpeaker(sp) ? (
                        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#78909C", textAlign:"center", padding:"6px 0" }}>🚫 休会</div>
                      ) : (
                      <>
                      {sp._msDay && <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#061B44", fontWeight:700, marginBottom:1 }}>MS（{sp.seminarType === 'kiso' ? '基礎講座' : getSeminarType(sp.seminarType).label}翌日）</div>}
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color: ch.color }}>{sp.speakerName}</div>
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#667085", marginTop:1 }}>「{sp.topic}」</div>
                      <span style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"2px 6px", borderRadius:12, fontWeight:600, color: STATUS[sp.status]?.color ?? "#98A2B3", background: STATUS[sp.status]?.bg ?? "#F1F5F9" }}>{STATUS[sp.status]?.label ?? sp.status}</span>
                      </>
                      )}
                    </div>
                  )) : (() => {
                    const addable = canAddFor(ch.id);
                    return (
                    <div style={{ textAlign:"center", paddingTop:10, cursor: addable ? "pointer" : "default" }}
                      title={addable ? "クリックで講師を登録" : `${ch.name}（他単会）`}
                      onClick={() => { if (addable) onAddForDate(dKey, ch.id); }}>
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color: ch.accent }}>MS開催</div>
                      <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#B0BEC5" }}>講師未定</div>
                      {addable && <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color: ch.color, marginTop:2, fontWeight:600 }}>＋ 登録</div>}
                    </div>
                    );
                  })())}
                  {kisoList.map((kisoSp, kIdx) => {
                    const isKyukai = isPlaceholderSpeaker(kisoSp);
                    return (
                    <div key={kisoSp.id || kIdx} style={{ marginTop:4, background: isKyukai ? "#ECEFF1" : "#E8F5E9", border:`1px solid ${isKyukai ? "#CFD8DC" : "#A5D6A7"}`, borderRadius:4, padding:"2px 4px", cursor:"pointer" }}
                      onClick={() => onSpeaker(kisoSp)} onMouseEnter={showHover(kisoSp)} onMouseLeave={hideHover}>
                      {isKyukai ? (
                        <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", fontWeight:700 }}>🚫 休会</div>
                      ) : (
                        <>
                          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#2E7D32", fontWeight:700 }}>{kisoSp.seminarType === 'kiso' ? '基礎講座' : getSeminarType(kisoSp.seminarType).label}</div>
                          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#1B5E20", fontWeight:600 }}>{kisoSp.speakerName}</div>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop:10, padding:"7px 12px", background:"#F5F5F5", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C" }}>
        💡 登録済みセルをクリック → 確認書を表示　｜　未登録セルをクリック → 講師を新規登録　｜　MS = モーニングセミナー（毎週午前6時〜7時）｜　マウスを乗せるとタスク進捗が見られます
      </div>
      <SpeakerHoverCard sp={hover?.sp} rect={hover?.rect} />
    </div>
  );
});
