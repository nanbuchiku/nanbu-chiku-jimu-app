import React, { useMemo, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { getChapter, isSameDay } from '../utils';
import { CARD, BSM, PILL } from '../styles';

export default memo(function Dashboard({ speakers, tasks, weekDates, today, onView, setTab, onFormUrl, onGoSpeakers }) {
  const thisWeek = useMemo(
    () => speakers.filter(sp => weekDates.some(wd => isSameDay(wd, new Date(sp.seminarDate)))),
    [speakers, weekDates]
  );
  const topTasks = useMemo(
    () => tasks.filter(t => !t.done).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5),
    [tasks]
  );
  const stats = useMemo(() => [
    { label:"今週の開催",  val: thisWeek.length,                                      sub:"/5単会", color:"#1A3A6B", action: () => setTab("calendar") },
    { label:"依頼確定済",  val: speakers.filter(x => x.status === "confirmed").length, sub:"件",    color:"#1B5E20", action: () => onGoSpeakers("confirmed") },
    { label:"確認待ち",    val: speakers.filter(x => x.status === "pending").length,   sub:"件",    color:"#BF360C", action: () => onGoSpeakers("pending") },
    { label:"未完了タスク",val: tasks.filter(t => !t.done).length,                    sub:"件",    color:"#546E7A", action: () => setTab("tasks") },
  ], [thisWeek, speakers, tasks, setTab, onGoSpeakers]);

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

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12, marginBottom:12 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#37474F", marginBottom:7 }}>今週のモーニングセミナー</div>
          <div style={CARD}>
            {CHAPTERS.map(ch => {
              const sp = thisWeek.find(x => x.chapterId === ch.id);
              return (
                <div key={ch.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid #F5F5F5" }}>
                  <div style={{ color:"#fff", fontSize:10, padding:"2px 7px", borderRadius:12, fontWeight:700, background: ch.color, minWidth:26, textAlign:"center" }}>{ch.dayName.replace("曜日","")}</div>
                  <div style={{ fontWeight:700, fontSize:12, minWidth:70, color: ch.color }}>{ch.name}</div>
                  {sp ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", flex:1 }}>
                      <span style={{ fontSize:12, fontWeight:600 }}>{sp.speakerName}</span>
                      <span style={{ fontSize:11, color:"#546E7A", background:"#ECEFF1", padding:"2px 7px", borderRadius:12 }}>「{sp.topic}」</span>
                      <span style={{ fontSize:11, padding:"2px 7px", borderRadius:12, fontWeight:600, color: STATUS[sp.status].color, background: STATUS[sp.status].bg }}>{STATUS[sp.status].label}</span>
                      <button style={BSM} onClick={() => onView(sp)}>確認書</button>
                    </div>
                  ) : <span style={{ color:"#9E9E9E", fontSize:11 }}>── 講師未設定</span>}
                </div>
              );
            })}
          </div>
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
                  <span style={{ fontSize:11, fontWeight:700, color: dl < 0 ? "#B71C1C" : dl <= 3 ? "#E65100" : "#546E7A" }}>{dl < 0 ? "超過" : `${dl}日`}</span>
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
    </div>
  );
});
