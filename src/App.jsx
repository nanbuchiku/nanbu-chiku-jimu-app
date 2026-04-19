import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CHAPTERS, DISTRICT_ID } from './constants';
import { db, fromDB, toDB, taskFromDB, taskToDB } from './lib/supabase';
import { getChapter, formatDate, getWeekDates, realToday, buildSpeakerTasks } from './utils';
import { OV, MOD, MH, BC, BG } from './styles';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import SpeakersView from './components/SpeakersView';
import FormURLModal from './components/FormURLModal';
import EmailModal from './components/EmailModal';
import DocumentView from './components/DocumentView';
import TasksView from './components/TasksView';
import RankingView from './components/RankingView';
import SpeakerTasksView from './components/SpeakerTasksView';
import FlyerView from './components/FlyerView';
import SpeakerForm from './components/SpeakerForm';

const HDR = {
  header:  { background:"linear-gradient(135deg,#0D1B3E 0%,#1A3A6B 100%)", color:"#fff", boxShadow:"0 2px 12px rgba(0,0,0,.3)", position:"sticky", top:0, zIndex:100 },
  hInner:  { display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"13px 22px 6px", flexWrap:"wrap", gap:8 },
  orgLabel:{ fontSize:11, letterSpacing:"0.15em", opacity:.7, marginBottom:2 },
  appTitle:{ margin:0, fontSize:18, fontWeight:700, letterSpacing:"0.04em" },
  chBadges:{ display:"flex", gap:5, flexWrap:"wrap" },
  badge:   { color:"#fff", fontSize:10, padding:"2px 9px", borderRadius:20, fontWeight:600 },
  nav:     { display:"flex", padding:"0 14px", gap:2, overflowX:"auto" },
  navBtn:  { background:"transparent", border:"none", color:"rgba(255,255,255,.7)", padding:"9px 14px", cursor:"pointer", fontSize:12, fontWeight:500, borderBottom:"3px solid transparent", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", flexShrink:0 },
  navOn:   { color:"#fff", borderBottomColor:"#64B5F6" },
  navBadge:{ background:"#EF5350", color:"#fff", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:10 },
};

export default function App() {
  const [tab,         setTab]        = useState("dashboard");
  const [speakers,    setSpeakers]   = useState([]);
  const [tasks,       setTasks]      = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [loadError,   setLoadError]  = useState(null);
  const [weekOffset,  setWeekOffset] = useState(0);
  const [showForm,    setShowForm]   = useState(false);
  const [editSpeaker, setEditSpeaker]= useState(null);
  const [docSpeaker,  setDocSpeaker] = useState(null);
  const [filterCh,    setFilterCh]   = useState("all");
  const [filterSt,    setFilterSt]   = useState("all");
  const [lineModal,   setLineModal]  = useState(null);
  const [emailModal,  setEmailModal] = useState(null);
  const [formUrlModal,setFormUrlModal]=useState(undefined);
  const [newTask,     setNewTask]    = useState({ title:"", chapterId:"kawaguchi", dueDate:"", priority:"medium" });
  const [toast,       setToast]      = useState(null);
  const [isSaving,    setIsSaving]   = useState(false);

  const today     = useMemo(() => realToday(), []);
  const weekDates = useMemo(() => getWeekDates(today, weekOffset), [today, weekOffset]);

  const showToast = useCallback(msg => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: spData, error: spErr }, { data: tkData, error: tkErr }] = await Promise.all([
          db.from('speakers').select('*').eq('district_id', DISTRICT_ID).order('seminar_date'),
          db.from('tasks').select('*').eq('district_id', DISTRICT_ID).order('due_date'),
        ]);
        if (spErr) throw spErr;
        if (tkErr) throw tkErr;
        if (spData) setSpeakers(spData.map(fromDB));
        if (tkData) setTasks(tkData.map(taskFromDB));
      } catch (e) {
        setLoadError(e.message || "データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateSpeaker = useCallback(async (id, patch) => {
    const sp = speakers.find(s => s.id === id);
    if (!sp) return;
    const updated = { ...sp, ...patch };
    const { error } = await db.from('speakers').update(toDB(updated)).eq('id', id);
    if (error) { showToast("⚠ 保存に失敗しました"); return; }
    setSpeakers(prev => prev.map(s => s.id === id ? updated : s));
  }, [speakers, showToast]);

  const deleteSpeaker = useCallback(async id => {
    if (!confirm("削除しますか？")) return;
    const { error } = await db.from('speakers').delete().eq('id', id);
    if (error) { showToast("⚠ 削除に失敗しました"); return; }
    setSpeakers(prev => prev.filter(s => s.id !== id));
    showToast("削除しました");
  }, [showToast]);

  const addOrUpdateSpeaker = useCallback(async data => {
    setIsSaving(true);
    try {
      if (data.id) {
        const { error } = await db.from('speakers').update(toDB(data)).eq('id', data.id);
        if (error) { showToast("⚠ 保存に失敗しました"); return; }
        setSpeakers(prev => prev.map(s => s.id === data.id ? data : s));
      } else {
        const newSp = { ...data, id: `s${Date.now()}`, lineNotified: false };
        const { error } = await db.from('speakers').insert(toDB(newSp));
        if (error) { showToast("⚠ 登録に失敗しました"); return; }
        setSpeakers(prev => [...prev, newSp]);
      }
      setShowForm(false); setEditSpeaker(null);
      showToast(data.id ? "変更を保存しました ✓" : "新規登録しました ✓");
    } finally {
      setIsSaving(false);
    }
  }, [showToast]);

  const openLine = useCallback(sp => {
    const ch = getChapter(sp.chapterId);
    const msg = `【${ch.name}単会 モーニングセミナー講師ご案内】\n\n開催日：${formatDate(sp.seminarDate)}\n会場：${ch.venue}\n時間：${ch.time}\n\n講師：${sp.speakerName} 様\n所属：${sp.company}　${sp.role}\nテーマ：「${sp.topic}」\n\n皆様のご参加をお待ちしております。\n${ch.name}単会事務局`;
    setLineModal({ msg, speakerId: sp.id });
  }, []);

  const onViewDoc     = useCallback(sp => { setDocSpeaker(sp); setTab("document"); }, []);
  const onGoSpeakers  = useCallback((status) => { setTab("speakers"); if (status) setFilterSt(status); }, []);
  const onEditSpeaker = useCallback(sp => { setEditSpeaker(sp); setShowForm(true); }, []);
  const onAddSpeaker  = useCallback(() => { setEditSpeaker(null); setShowForm(true); }, []);
  const onStatusChange= useCallback((id, st) => { updateSpeaker(id, { status: st }); showToast("更新しました ✓"); }, [updateSpeaker, showToast]);

  const onToggleTask = useCallback(async id => {
    const t = tasks.find(x => x.id === id);
    const updated = { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null };
    const { error } = await db.from('tasks').update(taskToDB(updated)).eq('id', id);
    if (error) { showToast("⚠ 更新に失敗しました"); return; }
    setTasks(prev => prev.map(x => x.id === id ? updated : x));
  }, [tasks, showToast]);

  const onDeleteTask = useCallback(async id => {
    if (!confirm("このタスクを削除しますか？")) return;
    const { error } = await db.from('tasks').delete().eq('id', id);
    if (error) { showToast("⚠ 削除に失敗しました"); return; }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [showToast]);

  const onAddTask = useCallback(async () => {
    if (!newTask.title) { showToast("⚠ タスク内容を入力してください"); return; }
    if (!newTask.dueDate) { showToast("⚠ 期限を入力してください"); return; }
    const t = { ...newTask, id: `t${Date.now()}`, done: false };
    const { error } = await db.from('tasks').insert(taskToDB(t));
    if (error) { showToast("⚠ 追加に失敗しました"); return; }
    setTasks(prev => [...prev, t]);
    setNewTask({ title:"", chapterId:"kawaguchi", dueDate:"", priority:"medium" });
    showToast("タスクを追加しました ✓");
  }, [newTask, showToast]);

  const onCloseForm   = useCallback(() => { setShowForm(false); setEditSpeaker(null); }, []);
  const onCloseEmail  = useCallback(() => setEmailModal(null), []);
  const onDoneEmail   = useCallback(() => { setEmailModal(null); showToast("メール文をコピーしました 📧"); }, [showToast]);
  const onCloseFormUrl = useCallback(() => setFormUrlModal(undefined), []);

  const sptasksBadge = useMemo(() => {
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + 90);
    let n = 0;
    speakers
      .filter(s => s.status !== "cancelled" && s.seminarDate && new Date(s.seminarDate) <= cutoff)
      .forEach(s => {
        const checks = s.speakerChecks || {};
        buildSpeakerTasks(s).forEach(t => { if (!checks[t.id]) n++; });
      });
    return n;
  }, [speakers, today]);

  const TABS = useMemo(() => [
    { id:"dashboard", label:"ダッシュボード", icon:"⊞" },
    { id:"calendar",  label:"カレンダー",     icon:"▦" },
    { id:"speakers",  label:"講師管理",       icon:"♟", badge: speakers.filter(s => s.status === "pending").length },
    { id:"document",  label:"確認書作成",     icon:"≡" },
    { id:"sptasks",   label:"講師タスク",     icon:"☑", badge: sptasksBadge },
    { id:"flyer",     label:"チラシ管理",     icon:"📋" },
    { id:"tasks",     label:"タスク管理",     icon:"✓", badge: tasks.filter(t => !t.done).length },
    { id:"ranking",   label:"完了ランキング", icon:"🏆" },
  ], [speakers, tasks, sptasksBadge]);

  useEffect(() => {
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (showForm) { setShowForm(false); setEditSpeaker(null); }
      else if (lineModal) { setLineModal(null); }
      else if (emailModal) { setEmailModal(null); }
      else if (formUrlModal !== undefined) { setFormUrlModal(undefined); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm, lineModal, emailModal, formUrlModal]);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F0F2F5", flexDirection:"column", gap:16 }}>
      <div style={{ width:48, height:48, border:"5px solid #E3F2FD", borderTop:"5px solid #1A3A6B", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ color:"#1A3A6B", fontSize:14, fontWeight:600 }}>データを読み込み中...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (loadError) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F0F2F5", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ color:"#B71C1C", fontSize:15, fontWeight:700 }}>データの読み込みに失敗しました</div>
      <div style={{ color:"#78909C", fontSize:12 }}>{loadError}</div>
      <button style={{ background:"#1A3A6B", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:14, cursor:"pointer", fontWeight:600 }} onClick={() => window.location.reload()}>再読み込み</button>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Hiragino Kaku Gothic ProN','Meiryo',sans-serif", background:"#F0F2F5", minHeight:"100vh", color:"#263238" }}>
      <header style={HDR.header}>
        <div style={HDR.hInner}>
          <div>
            <div style={HDR.orgLabel}>倫理法人会　南部地区事務局</div>
            <h1 style={HDR.appTitle}>南部地区5単会タスク管理</h1>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.55)", marginTop:2 }}>{today.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' })}</div>
          </div>
          <div style={HDR.chBadges}>
            {CHAPTERS.map(ch => (
              <span key={ch.id} style={{ ...HDR.badge, background: ch.color }}>
                {ch.short}｜{ch.dayName}
              </span>
            ))}
          </div>
        </div>
        <nav style={HDR.nav}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...HDR.navBtn, ...(tab === t.id ? HDR.navOn : {}) }}>
              <span>{t.icon}</span> {t.label}
              {!!t.badge && t.badge > 0 && <span style={HDR.navBadge}>{t.badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ padding:"16px 20px", maxWidth:1200, margin:"0 auto" }}>
        {tab === "dashboard" && <Dashboard speakers={speakers} tasks={tasks} weekDates={weekDates} today={today} onView={onViewDoc} setTab={setTab} onFormUrl={setFormUrlModal} onGoSpeakers={onGoSpeakers} />}
        {tab === "calendar"  && <CalendarView speakers={speakers} weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} today={today} onSpeaker={onViewDoc} />}
        {tab === "speakers"  && <SpeakersView speakers={speakers} filterCh={filterCh} filterSt={filterSt} setFilterCh={setFilterCh} setFilterSt={setFilterSt} today={today} onEdit={onEditSpeaker} onDelete={deleteSpeaker} onStatusChange={onStatusChange} onDoc={onViewDoc} onEmail={setEmailModal} onFormUrl={setFormUrlModal} onLine={openLine} updateSpeaker={updateSpeaker} showToast={showToast} onAdd={onAddSpeaker} />}
        {tab === "document"  && <DocumentView speakers={speakers} docSpeaker={docSpeaker} setDocSpeaker={setDocSpeaker} today={today} />}
        {tab === "tasks"     && <TasksView tasks={tasks} today={today} newTask={newTask} setNewTask={setNewTask} onToggle={onToggleTask} onDelete={onDeleteTask} onAdd={onAddTask} />}
        {tab === "sptasks"   && <SpeakerTasksView speakers={speakers} today={today} updateSpeaker={updateSpeaker} showToast={showToast} />}
        {tab === "flyer"     && <FlyerView speakers={speakers} today={today} updateSpeaker={updateSpeaker} showToast={showToast} />}
        {tab === "ranking"   && <RankingView tasks={tasks} today={today} />}
      </main>

      {showForm && <SpeakerForm initial={editSpeaker} onSave={addOrUpdateSpeaker} onClose={onCloseForm} saving={isSaving} />}
      {emailModal && <EmailModal speaker={emailModal} onClose={onCloseEmail} onDone={onDoneEmail} />}
      {formUrlModal !== undefined && <FormURLModal speaker={formUrlModal} onClose={onCloseFormUrl} showToast={showToast} />}

      {lineModal && (
        <div style={OV} onClick={() => setLineModal(null)}>
          <div style={{ ...MOD, maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={MH}><span style={{ color:"#06C755", fontSize:20 }}>●</span> LINEグループ送信プレビュー</div>
            <pre style={{ background:"#E8F5E9", borderRadius:8, padding:12, fontSize:12, lineHeight:1.8, whiteSpace:"pre-wrap", border:"1px solid #A5D6A7", marginTop:10, maxHeight:260, overflowY:"auto" }}>{lineModal.msg}</pre>
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button style={BG} onClick={() => {
                navigator.clipboard?.writeText(lineModal.msg).catch(() => {});
                updateSpeaker(lineModal.speakerId, { lineNotified: true });
                setLineModal(null);
                showToast("コピーしました！LINEに貼り付けてください");
              }}>📋 コピーしてLINEへ</button>
              <button style={BC} onClick={() => setLineModal(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div role="alert" aria-live="assertive" style={{ position:"fixed", bottom:20, right:20, background: toast.startsWith("⚠") ? "#B71C1C" : "#1B5E20", color:"#fff", padding:"10px 18px", borderRadius:8, fontSize:12, fontWeight:600, boxShadow:"0 4px 12px rgba(0,0,0,.3)", zIndex:2000 }}>{toast}</div>}
    </div>
  );
}
