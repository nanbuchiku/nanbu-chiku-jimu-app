import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CHAPTERS, DISTRICT_ID } from './constants';
import { db, fromDB, toDB, taskFromDB, taskToDB } from './lib/supabase';
import { getChapter, formatDate, getWeekDates, realToday, buildSpeakerTasks, toDateStr } from './utils';
import { OV, MOD, MH, BC, BG, BP } from './styles';
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
import ErrorBoundary from './components/ErrorBoundary';

const HDR = {
  header:  { background:"linear-gradient(135deg,#0D1B3E 0%,#1A3A6B 100%)", color:"#fff", boxShadow:"0 2px 12px rgba(0,0,0,.3)", position:"sticky", top:0, zIndex:100 },
  hInner:  { display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"13px 22px 6px", flexWrap:"wrap", gap:8 },
  orgLabel:{ fontSize:11, letterSpacing:"0.15em", opacity:.7, marginBottom:2 },
  appTitle:{ margin:0, fontSize:18, fontWeight:700, letterSpacing:"0.04em" },
  chBadges:{ display:"flex", gap:5, flexWrap:"wrap" },
  badge:   { color:"#fff", fontSize:10, padding:"2px 9px", borderRadius:20, fontWeight:600 },
  nav:     { display:"flex", padding:"0 14px", gap:2, overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none" },
  navBtn:  { background:"transparent", border:"none", color:"rgba(255,255,255,.7)", padding:"9px 14px", cursor:"pointer", fontSize:12, fontWeight:500, borderBottom:"3px solid transparent", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", flexShrink:0 },
  navOn:   { color:"#fff", borderBottomColor:"#64B5F6" },
  navBadge:{ background:"#EF5350", color:"#fff", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:10 },
};

export default function App() {
  const [tab, setTabRaw] = useState(() => {
    try {
      const hash = window.location.hash.slice(1);
      if (["dashboard","calendar","speakers","document","sptasks","flyer","tasks","ranking"].includes(hash)) return hash;
      return localStorage.getItem('lastTab') || "dashboard";
    } catch { return "dashboard"; }
  });
  const setTab = useCallback(t => {
    setTabRaw(t);
    try { localStorage.setItem('lastTab', t); } catch {}
    try { window.location.hash = t; } catch {}
  }, []);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (["dashboard","calendar","speakers","document","sptasks","flyer","tasks","ranking"].includes(hash)) setTabRaw(hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [speakers,    setSpeakers]   = useState(() => { try { const c = localStorage.getItem('cachedSpeakers'); return c ? JSON.parse(c) : []; } catch { return []; } });
  const [tasks,       setTasks]      = useState(() => { try { const c = localStorage.getItem('cachedTasks'); return c ? JSON.parse(c) : []; } catch { return []; } });
  const [loading,     setLoading]    = useState(() => { try { return !localStorage.getItem('cachedSpeakers'); } catch { return true; } });
  const [loadError,   setLoadError]  = useState(null);
  const [lastUpdated, setLastUpdated]= useState(null);
  const [weekOffset,  setWeekOffset] = useState(0);
  const [showForm,    setShowForm]   = useState(false);
  const [editSpeaker, setEditSpeaker]= useState(null);
  const [docSpeaker,  setDocSpeaker] = useState(null);
  const [filterCh,    setFilterCh]   = useState(() => { try { return localStorage.getItem('spFilterCh') || "all"; } catch { return "all"; } });
  const [filterSt,    setFilterSt]   = useState(() => { try { return localStorage.getItem('spFilterSt') || "all"; } catch { return "all"; } });
  const [lineModal,   setLineModal]  = useState(null);
  const [emailModal,  setEmailModal] = useState(null);
  const [formUrlModal,setFormUrlModal]=useState(undefined);
  const [newTask,     setNewTask]    = useState({ title:"", chapterId:"kawaguchi", dueDate:"", priority:"medium" });
  const [toast,       setToast]      = useState(null);
  const [isSaving,    setIsSaving]   = useState(false);
  const [confirm,     setConfirm]    = useState(null);
  const [showHelp,    setShowHelp]   = useState(false);
  const [isOnline,    setIsOnline]   = useState(() => navigator.onLine);
  const [refreshing,  setRefreshing] = useState(false);

  const today     = useMemo(() => realToday(), []);
  const weekDates = useMemo(() => getWeekDates(today, weekOffset), [today, weekOffset]);

  const speakersRef = useRef(speakers);
  useEffect(() => { speakersRef.current = speakers; }, [speakers]);
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => { try { localStorage.setItem('cachedSpeakers', JSON.stringify(speakers)); } catch {} }, [speakers]);
  useEffect(() => { try { localStorage.setItem('cachedTasks', JSON.stringify(tasks)); } catch {} }, [tasks]);

  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, opts) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const t = typeof msg === "string" ? { msg } : msg;
    if (opts) Object.assign(t, opts);
    setToast(t);
    toastTimerRef.current = setTimeout(() => setToast(null), t.action ? 5000 : 3000);
  }, []);
  const showConfirm = useCallback((msg, onOk, okLabel) => setConfirm({ msg, onOk, okLabel }), []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [{ data: spData, error: spErr }, { data: tkData, error: tkErr }] = await Promise.all([
        db.from('speakers').select('*').eq('district_id', DISTRICT_ID).order('seminar_date'),
        db.from('tasks').select('*').eq('district_id', DISTRICT_ID).order('due_date'),
      ]);
      if (spErr) throw spErr;
      if (tkErr) throw tkErr;
      if (spData) { const mapped = spData.map(fromDB); setSpeakers(mapped); }
      if (tkData) { const mapped = tkData.map(taskFromDB); setTasks(mapped); }
      setLastUpdated(new Date());
      if (silent) showToast("データを更新しました ✓");
    } catch (e) {
      if (silent) showToast("⚠ データ更新に失敗しました");
      else setLoadError(e.message || "データの読み込みに失敗しました");
    } finally {
      if (!silent) setLoading(false);
      else setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const channel = db.channel('app-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'speakers', filter: `district_id=eq.${DISTRICT_ID}` }, payload => {
        if (payload.eventType === 'INSERT') {
          const sp = fromDB(payload.new);
          if (!speakersRef.current.some(s => s.id === sp.id)) {
            const ch = getChapter(sp.chapterId);
            showToast(`📬 新規講師登録：${sp.speakerName || '（名前未入力）'} 様${ch ? `（${ch.name}）` : ''}`);
            setSpeakers(prev => [...prev, sp].sort((a,b) => (a.seminarDate||"").localeCompare(b.seminarDate||"")));
          }
        } else if (payload.eventType === 'UPDATE') {
          const sp = fromDB(payload.new);
          setSpeakers(prev => prev.map(s => s.id === sp.id ? sp : s));
        } else if (payload.eventType === 'DELETE') {
          setSpeakers(prev => prev.filter(s => s.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `district_id=eq.${DISTRICT_ID}` }, payload => {
        if (payload.eventType === 'INSERT') {
          const t = taskFromDB(payload.new);
          setTasks(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t].sort((a,b) => (a.dueDate||"").localeCompare(b.dueDate||"")));
        } else if (payload.eventType === 'UPDATE') {
          const t = taskFromDB(payload.new);
          setTasks(prev => prev.map(x => x.id === t.id ? t : x));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR') showToast('⚠ リアルタイム同期エラー。ページを再読み込みしてください');
      });
    return () => { db.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    let lastRefresh = Date.now();
    const onFocus = () => {
      if (Date.now() - lastRefresh >= 5 * 60 * 1000) {
        lastRefresh = Date.now();
        loadData(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  const updateSpeaker = useCallback(async (id, patch) => {
    const sp = speakersRef.current.find(s => s.id === id);
    if (!sp) return false;
    const updated = { ...sp, ...patch };
    setSpeakers(prev => prev.map(s => s.id === id ? updated : s));
    const { error } = await db.from('speakers').update(toDB(updated)).eq('id', id);
    if (error) {
      setSpeakers(prev => prev.map(s => s.id === id ? sp : s));
      showToast("⚠ 保存に失敗しました");
      return false;
    }
    return true;
  }, [showToast]);

  const deleteSpeaker = useCallback(id => {
    showConfirm("この講師データを削除しますか？", async () => {
      const sp = speakersRef.current.find(s => s.id === id);
      const { error } = await db.from('speakers').delete().eq('id', id);
      if (error) { showToast("⚠ 削除に失敗しました"); return; }
      setSpeakers(prev => prev.filter(s => s.id !== id));
      showToast("削除しました", {
        actionLabel: "取り消し",
        action: async () => {
          const { error: re } = await db.from('speakers').insert(toDB(sp));
          if (!re) { setSpeakers(prev => [...prev, sp].sort((a,b) => (a.seminarDate||"").localeCompare(b.seminarDate||""))); showToast("削除を取り消しました ✓"); }
        }
      });
    });
  }, [showConfirm, showToast]);

  const addOrUpdateSpeaker = useCallback(async data => {
    setIsSaving(true);
    let savedSp = null;
    try {
      if (data.id) {
        const { error } = await db.from('speakers').update(toDB(data)).eq('id', data.id);
        if (error) { showToast("⚠ 保存に失敗しました"); return; }
        setSpeakers(prev => prev.map(s => s.id === data.id ? data : s));
      } else {
        const newSp = { ...data, id: `s${Date.now()}`, lineNotified: false };
        const { data: inserted, error } = await db.from('speakers').insert(toDB(newSp)).select().single();
        if (error) { showToast("⚠ 登録に失敗しました"); return; }
        savedSp = inserted ? fromDB(inserted) : newSp;
        setSpeakers(prev => [...prev, savedSp]);
      }
      setShowForm(false); setEditSpeaker(null);
      if (data.id) {
        showToast("変更を保存しました ✓");
      } else {
        showToast("新規登録しました ✓", {
          actionLabel: "フォームURLを発行",
          action: () => setFormUrlModal(savedSp),
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [showToast]);

  const openLine = useCallback(sp => {
    const ch = getChapter(sp.chapterId);
    const mapLine = ch.mapUrl ? `\n地図：${ch.mapUrl}` : "";
    const msg = `【${ch.name}単会 モーニングセミナー講師ご案内】\n\n開催日：${formatDate(sp.seminarDate)}\n会場：${ch.venue}\n住所：${ch.address}${mapLine}\n時間：${ch.time}\n\n講師：${sp.speakerName} 様\n所属：${sp.company}　${sp.role}\nテーマ：「${sp.topic}」\n\n皆様のご参加をお待ちしております。\n${ch.name}単会事務局`;
    setLineModal({ msg, speakerId: sp.id });
  }, []);

  const onViewDoc     = useCallback(sp => { setDocSpeaker(sp); setTab("document"); }, []);
  const onGoSpeakers  = useCallback((status) => { setTab("speakers"); if (status) setFilterSt(status); }, []);
  const onSetFilterCh = useCallback(v => { setFilterCh(v); try { localStorage.setItem('spFilterCh', v); } catch {} }, []);
  const onSetFilterSt = useCallback(v => { setFilterSt(v); try { localStorage.setItem('spFilterSt', v); } catch {} }, []);
  const onEditSpeaker = useCallback(sp => { setEditSpeaker(sp); setShowForm(true); }, []);
  const onAddSpeaker  = useCallback(() => { setEditSpeaker(null); setShowForm(true); }, []);

  const onToggleTask = useCallback(async id => {
    const t = tasksRef.current.find(x => x.id === id);
    if (!t) return;
    const updated = { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null };
    setTasks(prev => prev.map(x => x.id === id ? updated : x));
    const { error } = await db.from('tasks').update(taskToDB(updated)).eq('id', id);
    if (error) {
      setTasks(prev => prev.map(x => x.id === id ? t : x));
      showToast("⚠ 更新に失敗しました");
    }
  }, [showToast]);

  const onDeleteTask = useCallback(id => {
    showConfirm("このタスクを削除しますか？", async () => {
      const task = tasksRef.current.find(x => x.id === id);
      const { error } = await db.from('tasks').delete().eq('id', id);
      if (error) { showToast("⚠ 削除に失敗しました"); return; }
      setTasks(prev => prev.filter(t => t.id !== id));
      showToast("タスクを削除しました", {
        actionLabel: "取り消し",
        action: async () => {
          const { error: re } = await db.from('tasks').insert(taskToDB(task));
          if (!re) { setTasks(prev => [...prev, task]); showToast("削除を取り消しました ✓"); }
        }
      });
    });
  }, [showConfirm, showToast]);

  const onUpdateTask = useCallback(async (id, patch) => {
    const t = tasksRef.current.find(x => x.id === id);
    if (!t) return;
    const updated = { ...t, ...patch };
    setTasks(prev => prev.map(x => x.id === id ? updated : x));
    const { error } = await db.from('tasks').update(taskToDB(updated)).eq('id', id);
    if (error) {
      setTasks(prev => prev.map(x => x.id === id ? t : x));
      showToast("⚠ 更新に失敗しました");
      return;
    }
    showToast("タスクを更新しました ✓");
  }, [showToast]);

  const onDeleteDoneTasks = useCallback(() => {
    const doneTasks = tasksRef.current.filter(t => t.done);
    if (doneTasks.length === 0) return;
    showConfirm(`完了済みタスク ${doneTasks.length}件を削除しますか？`, async () => {
      const ids = doneTasks.map(t => t.id);
      const { error } = await db.from('tasks').delete().in('id', ids);
      if (error) { showToast("⚠ 削除に失敗しました"); return; }
      setTasks(prev => prev.filter(t => !t.done));
      showToast(`完了済み ${doneTasks.length}件を削除しました`, {
        actionLabel: "取り消し",
        action: async () => {
          const { error: re } = await db.from('tasks').insert(doneTasks.map(taskToDB));
          if (!re) { setTasks(prev => [...prev, ...doneTasks]); showToast("削除を取り消しました ✓"); }
        }
      });
    });
  }, [showConfirm, showToast]);

  const onAddTask = useCallback(async () => {
    if (!newTask.title) { showToast("⚠ タスク内容を入力してください"); return; }
    if (!newTask.dueDate) { showToast("⚠ 期限を入力してください"); return; }
    const t = { ...newTask, id: `t${Date.now()}`, done: false };
    const { data: inserted, error } = await db.from('tasks').insert(taskToDB(t)).select().single();
    if (error) { showToast("⚠ 追加に失敗しました"); return; }
    setTasks(prev => [...prev, inserted ? taskFromDB(inserted) : t]);
    setNewTask({ title:"", chapterId:"kawaguchi", dueDate:"", priority:"medium" });
    showToast("タスクを追加しました ✓");
  }, [newTask, showToast]);

  const onAddBatchTask = useCallback(async () => {
    if (!newTask.title) { showToast("⚠ タスク内容を入力してください"); return; }
    if (!newTask.dueDate) { showToast("⚠ 期限を入力してください"); return; }
    const batch = CHAPTERS.map((ch, i) => ({ ...newTask, id: `t${Date.now()}${i}`, chapterId: ch.id, done: false }));
    const { data: inserted, error } = await db.from('tasks').insert(batch.map(taskToDB)).select();
    if (error) { showToast("⚠ 追加に失敗しました"); return; }
    const newTasks = inserted ? inserted.map(taskFromDB) : batch;
    setTasks(prev => [...prev, ...newTasks]);
    setNewTask({ title:"", chapterId:"kawaguchi", dueDate:"", priority:"medium" });
    showToast(`全5単会にタスクを追加しました ✓`);
  }, [newTask, showToast]);

  const onDuplicateSpeaker = useCallback(sp => {
    const { id: _id, seminarDate: _date, status: _st, lineNotified: _ln, calendarAdded: _ca, speakerChecks: _sc, ...rest } = sp;
    setEditSpeaker({ ...rest, seminarDate: "", status: "pending", lineNotified: false, calendarAdded: false, speakerChecks: {} });
    setShowForm(true);
  }, []);
  const onCloseForm   = useCallback(() => { setShowForm(false); setEditSpeaker(null); }, []);
  const onCloseEmail  = useCallback(() => setEmailModal(null), []);
  const onDoneEmail   = useCallback(() => { setEmailModal(null); showToast("メール文をコピーしました 📧"); }, [showToast]);
  const onCloseFormUrl = useCallback(() => setFormUrlModal(undefined), []);

  const onAddSpeakerForDate = useCallback((seminarDate, chapterId) => {
    setEditSpeaker({ chapterId, seminarDate, requestDate: new Date().toISOString().slice(0,10) });
    setShowForm(true);
  }, []);

  const exportBackup = useCallback(() => {
    const data = { exportedAt: new Date().toISOString(), speakers: speakersRef.current, tasks: tasksRef.current };
    const json = JSON.stringify(data, null, 2);
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([json], { type: "application/json" })),
      download: `backup_${new Date().toISOString().slice(0,10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("バックアップをエクスポートしました 📤");
  }, [showToast]);

  const importBackup = useCallback(async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.speakers) || !Array.isArray(data.tasks)) throw new Error("無効なバックアップファイルです");
      const spCount = data.speakers.length, tkCount = data.tasks.length;
      showConfirm(`講師 ${spCount}件・タスク ${tkCount}件をインポートします。既存の同一IDのデータは上書きされます。続けますか？`, async () => {
        try {
          if (data.speakers.length > 0) {
            const { error } = await db.from('speakers').upsert(data.speakers.map(toDB), { onConflict: 'id' });
            if (error) throw error;
            setSpeakers(data.speakers);
          }
          if (data.tasks.length > 0) {
            const { error } = await db.from('tasks').upsert(data.tasks.map(taskToDB), { onConflict: 'id' });
            if (error) throw error;
            setTasks(data.tasks);
          }
          showToast(`インポートしました ✓ 講師${spCount}件 タスク${tkCount}件`);
        } catch (e) {
          showToast(`⚠ インポートに失敗しました: ${e.message}`);
        }
      }, "インポートする");
    } catch (e) {
      showToast(`⚠ ファイルの解析に失敗しました: ${e.message}`);
    }
  }, [showConfirm, showToast]);

  const dashboardBadge = useMemo(() => {
    const todayStr = toDateStr(today);
    const cutoff7 = new Date(today); cutoff7.setDate(today.getDate() - 7);
    const cutoff7Str = toDateStr(cutoff7);
    const cutoff30 = new Date(today); cutoff30.setDate(today.getDate() + 30);
    const cutoff30Str = toDateStr(cutoff30);
    const pending = speakers.filter(sp => sp.status === "pending" && sp.seminarDate >= todayStr && sp.requestDate && sp.requestDate <= cutoff7Str).length;
    const missing = speakers.filter(sp => sp.status === "confirmed" && sp.seminarDate && sp.seminarDate >= todayStr && sp.seminarDate <= cutoff30Str && (!sp.topic || !sp.speakerKana || !sp.email)).length;
    return pending + missing;
  }, [speakers, today]);

  const sptasksBadge = useMemo(() => {
    const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
    const toDate   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);
    const fromStr  = toDateStr(fromDate);
    const toStr    = toDateStr(toDate);
    let n = 0;
    speakers
      .filter(s => s.status !== "cancelled" && s.seminarDate && s.seminarDate >= fromStr && s.seminarDate <= toStr)
      .forEach(s => {
        const checks = s.speakerChecks || {};
        buildSpeakerTasks(s).forEach(t => { if (!checks[t.id]) n++; });
      });
    return n;
  }, [speakers, today]);

  const todaysSpeakers = useMemo(() => {
    const todayStr = toDateStr(today);
    return speakers.filter(sp => sp.seminarDate === todayStr && sp.status !== "cancelled");
  }, [speakers, today]);

  const TABS = useMemo(() => [
    { id:"dashboard", label:"ダッシュボード", icon:"⊞", badge: dashboardBadge },
    { id:"calendar",  label:"カレンダー",     icon:"▦" },
    { id:"speakers",  label:"講師管理",       icon:"♟", badge: speakers.filter(s => s.status === "pending").length },
    { id:"document",  label:"確認書作成",     icon:"≡" },
    { id:"sptasks",   label:"講師タスク",     icon:"☑", badge: sptasksBadge },
    { id:"flyer",     label:"チラシ管理",     icon:"📋" },
    { id:"tasks",     label:"タスク管理",     icon:"✓", badge: tasks.filter(t => !t.done).length },
    { id:"ranking",   label:"完了ランキング", icon:"🏆" },
  ], [speakers, tasks, dashboardBadge, sptasksBadge]);

  useEffect(() => {
    const tabLabel = TABS.find(t => t.id === tab)?.label;
    document.title = tabLabel ? `${tabLabel} | 南部地区5単会タスク管理` : "南部地区5単会タスク管理";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, TABS]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") {
        if (showHelp) { setShowHelp(false); }
        else if (confirm) { setConfirm(null); }
        else if (showForm) { setShowForm(false); setEditSpeaker(null); }
        else if (lineModal) { setLineModal(null); }
        else if (emailModal) { setEmailModal(null); }
        else if (formUrlModal !== undefined) { setFormUrlModal(undefined); }
        return;
      }
      if (e.key === "Enter" && confirm && !["INPUT","SELECT","TEXTAREA","BUTTON"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        confirm.onOk(); setConfirm(null);
        return;
      }
      const noModals = !confirm && !showForm && !lineModal && !emailModal && formUrlModal === undefined;
      const notInInput = !["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName);
      if (e.key === "n" && noModals && notInInput && tab === "speakers") {
        e.preventDefault();
        setEditSpeaker(null); setShowForm(true);
      }
      if (e.key === "e" && noModals && notInInput && tab === "document" && docSpeaker) {
        e.preventDefault();
        setEditSpeaker(docSpeaker); setShowForm(true);
      }
      if (e.key === "?" && noModals && notInInput) {
        e.preventDefault();
        setShowHelp(h => !h);
      }
      if (noModals && notInInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tabKeys = { "1":"dashboard","2":"calendar","3":"speakers","4":"document","5":"sptasks","6":"flyer","7":"tasks","8":"ranking" };
        if (tabKeys[e.key]) { e.preventDefault(); setTab(tabKeys[e.key]); }
        if (e.key === "r") { e.preventDefault(); loadData(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, showForm, showHelp, lineModal, emailModal, formUrlModal, tab]);

  if (loading) return (
    <div role="status" aria-label="読み込み中" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F0F2F5", flexDirection:"column", gap:16 }}>
      <div aria-hidden="true" style={{ width:48, height:48, border:"5px solid #E3F2FD", borderTop:"5px solid #1A3A6B", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ color:"#1A3A6B", fontSize:14, fontWeight:600 }}>データを読み込み中...</div>
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
    <div style={{ minHeight:"100vh" }}>
      <header className="no-print" style={HDR.header}>
        <div style={HDR.hInner}>
          <div>
            <div style={HDR.orgLabel}>倫理法人会　南部地区事務局</div>
            <h1 style={HDR.appTitle}>南部地区5単会タスク管理</h1>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.55)", marginTop:2, display:"flex", alignItems:"center", gap:8 }}>
              <span>{today.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' })}</span>
              {lastUpdated && <span style={{ opacity:.6 }}>最終更新 {lastUpdated.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' })}</span>}
              {refreshing && <span aria-label="更新中" style={{ display:"inline-block", animation:"spin 1s linear infinite", fontSize:12 }}>⟳</span>}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <div style={HDR.chBadges}>
              {CHAPTERS.map(ch => (
                <span key={ch.id} style={{ ...HDR.badge, background: ch.color }}>
                  {ch.short}｜{ch.dayName}
                </span>
              ))}
            </div>
            <button aria-label="キーボードショートカット一覧" title="ショートカット (?)" onClick={() => setShowHelp(h => !h)} style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.25)", borderRadius:6, color:"rgba(255,255,255,.7)", padding:"4px 9px", fontSize:11, cursor:"pointer", fontWeight:600, flexShrink:0 }}>?</button>
            <button aria-label="データをバックアップ" title="全データをJSONでエクスポート" onClick={exportBackup} style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.25)", borderRadius:6, color:"rgba(255,255,255,.8)", padding:"4px 9px", fontSize:11, cursor:"pointer", fontWeight:600, flexShrink:0 }}>📤 BK</button>
            <label aria-label="バックアップから復元" title="JSONバックアップからインポート" style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.25)", borderRadius:6, color:"rgba(255,255,255,.7)", padding:"4px 9px", fontSize:11, cursor:"pointer", fontWeight:600, flexShrink:0 }}>
              📥 復元
              <input type="file" accept=".json" style={{ display:"none" }} onChange={e => { importBackup(e.target.files[0]); e.target.value = ""; }} />
            </label>
            <button aria-label="データを更新" title="データを再読み込み" onClick={() => loadData(true)} style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", borderRadius:6, color:"#fff", padding:"4px 9px", fontSize:11, cursor:"pointer", fontWeight:600, flexShrink:0 }}>⟳ 更新</button>
          </div>
        </div>
        <nav style={HDR.nav}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              style={{ ...HDR.navBtn, ...(tab === t.id ? HDR.navOn : {}) }}>
              <span>{t.icon}</span> {t.label}
              {!!t.badge && t.badge > 0 && <span style={HDR.navBadge} aria-label={`${t.badge}件`}>{t.badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      {!isOnline && (
        <div role="status" style={{ background:"#37474F", color:"#fff", padding:"6px 22px", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
          <span>📡</span>
          <span>オフライン — キャッシュデータを表示しています。保存操作はオンライン復帰後に反映されます。</span>
        </div>
      )}

      {todaysSpeakers.length > 0 && (
        <div role="banner" style={{ background:"linear-gradient(90deg,#B71C1C,#C62828)", color:"#fff", padding:"8px 22px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:16 }}>🎤</span>
          <span>本日のモーニングセミナー：</span>
          {todaysSpeakers.map(sp => {
            const ch = getChapter(sp.chapterId);
            return <span key={sp.id} style={{ background:"rgba(255,255,255,.2)", padding:"2px 10px", borderRadius:12 }}>{ch.name}　{sp.speakerName} 様「{sp.topic}」</span>;
          })}
        </div>
      )}

      <main style={{ padding:"16px 20px", maxWidth:1200, margin:"0 auto" }}>
        <ErrorBoundary key={tab}>
          {tab === "dashboard" && <Dashboard speakers={speakers} tasks={tasks} weekDates={weekDates} today={today} onView={onViewDoc} setTab={setTab} onFormUrl={setFormUrlModal} onGoSpeakers={onGoSpeakers} onAddForDate={onAddSpeakerForDate} updateSpeaker={updateSpeaker} showToast={showToast} />}
          {tab === "calendar"  && <CalendarView speakers={speakers} weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} today={today} onSpeaker={onViewDoc} onAddForDate={onAddSpeakerForDate} />}
          {tab === "speakers"  && <SpeakersView speakers={speakers} filterCh={filterCh} filterSt={filterSt} setFilterCh={onSetFilterCh} setFilterSt={onSetFilterSt} today={today} onEdit={onEditSpeaker} onDelete={deleteSpeaker} onDoc={onViewDoc} onEmail={setEmailModal} onFormUrl={setFormUrlModal} onLine={openLine} updateSpeaker={updateSpeaker} showToast={showToast} showConfirm={showConfirm} onAdd={onAddSpeaker} onDuplicate={onDuplicateSpeaker} />}
          {tab === "document"  && <DocumentView speakers={speakers} docSpeaker={docSpeaker} setDocSpeaker={setDocSpeaker} today={today} />}
          {tab === "tasks"     && <TasksView tasks={tasks} today={today} newTask={newTask} setNewTask={setNewTask} onToggle={onToggleTask} onDelete={onDeleteTask} onAdd={onAddTask} onAddBatch={onAddBatchTask} onUpdate={onUpdateTask} onDeleteDone={onDeleteDoneTasks} showToast={showToast} />}
          {tab === "sptasks"   && <SpeakerTasksView speakers={speakers} today={today} updateSpeaker={updateSpeaker} showToast={showToast} onEmail={setEmailModal} onEdit={onEditSpeaker} />}
          {tab === "flyer"     && <FlyerView speakers={speakers} today={today} showToast={showToast} />}
          {tab === "ranking"   && <RankingView tasks={tasks} speakers={speakers} today={today} />}
        </ErrorBoundary>
      </main>

      {showForm && <SpeakerForm initial={editSpeaker} speakers={speakers} onSave={addOrUpdateSpeaker} onClose={onCloseForm} saving={isSaving} />}
      {emailModal && <EmailModal speaker={emailModal} onClose={onCloseEmail} onDone={onDoneEmail} />}
      {formUrlModal !== undefined && <FormURLModal speaker={formUrlModal} onClose={onCloseFormUrl} showToast={showToast} />}

      {lineModal && (
        <div style={OV} onClick={() => setLineModal(null)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label="LINEグループ送信プレビュー" style={{ ...MOD, maxWidth:480 }} onClick={e => e.stopPropagation()}>
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

      {confirm && (
        <div style={OV} role="presentation">
          <div role="alertdialog" aria-modal="true" aria-label="確認" style={{ background:"#fff", borderRadius:10, padding:"24px 28px", maxWidth:360, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,.18)" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#1A3A6B", marginBottom:14 }}>⚠ 確認</div>
            <div style={{ fontSize:13, color:"#37474F", marginBottom:20 }}>{confirm.msg}</div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button style={BC} onClick={() => setConfirm(null)}>キャンセル</button>
              <button style={{ ...BP, background: confirm.okLabel ? "#1A3A6B" : "#B71C1C" }} onClick={() => { confirm.onOk(); setConfirm(null); }}>{confirm.okLabel || "削除する"}</button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div style={OV} role="presentation" onClick={() => setShowHelp(false)}>
          <div role="dialog" aria-modal="true" aria-label="キーボードショートカット" style={{ ...MOD, maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div style={MH}>⌨ キーボードショートカット</div>
            <table style={{ width:"100%", borderCollapse:"collapse", marginTop:8 }}>
              <tbody>
                {[
                  ["?", "このヘルプを表示 / 非表示"],
                  ["R", "データを再読み込み"],
                  ["N（講師管理タブ）", "新規講師登録フォームを開く"],
                  ["E（確認書タブ）", "現在の講師を編集フォームで開く"],
                  ["Ctrl + Enter（フォーム内）", "講師フォームを保存"],
                  ["← →（確認書タブ）", "前後の講師に移動"],
                  ["Esc", "モーダル・ダイアログを閉じる"],
                  ["1", "ダッシュボードへ"],
                  ["2", "カレンダーへ"],
                  ["3", "講師管理へ"],
                  ["4", "確認書作成へ"],
                  ["5", "講師タスクへ"],
                  ["6", "チラシ管理へ"],
                  ["7", "タスク管理へ"],
                  ["8", "完了ランキングへ"],
                ].map(([key, desc]) => (
                  <tr key={key} style={{ borderBottom:"1px solid #F5F5F5" }}>
                    <td style={{ padding:"8px 12px", width:180 }}><kbd style={{ background:"#ECEFF1", border:"1px solid #CFD8DC", borderRadius:4, padding:"2px 8px", fontSize:12, fontFamily:"monospace", fontWeight:700, color:"#37474F" }}>{key}</kbd></td>
                    <td style={{ padding:"8px 12px", fontSize:12, color:"#546E7A" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop:14, padding:"10px 14px", background:"#E3F2FD", borderRadius:8, fontSize:11, color:"#1565C0" }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>💡 機能ヒント</div>
              <ul style={{ lineHeight:1.8, paddingLeft:16 }}>
                <li>ダッシュボードの 📝 事務局メモ で電話メモや申し送りを記録できます（自分のブラウザのみ）</li>
                <li>講師管理タブの「⚡ 要対応のみ」で30日以内の未確認・情報不足の講師を絞り込めます</li>
                <li>確認書タブ上部に「最近見た講師」ショートカットが表示されます</li>
                <li>タスク管理の「▦ グループ表示」で期限別（超過/今日/今週/来週）に整理できます</li>
                <li>変更はリアルタイムで全ユーザーに反映されます（Supabase Realtime）</li>
              </ul>
            </div>
            <button style={{ ...BC, marginTop:14, display:"block", width:"100%" }} onClick={() => setShowHelp(false)}>閉じる</button>
          </div>
        </div>
      )}

      {toast && (() => {
        const isErr = toast.type === "error" || toast.msg?.startsWith("⚠");
        const isInfo = toast.type === "info";
        const bg = isErr ? "#B71C1C" : isInfo ? "#1565C0" : "#1B5E20";
        return (
          <div role="alert" aria-live="assertive" style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", background: bg, color:"#fff", padding:"10px 18px", borderRadius:8, fontSize:12, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,.35)", zIndex:2000, display:"flex", alignItems:"center", gap:10, maxWidth:"90vw", whiteSpace:"nowrap" }}>
            <span>{toast.msg}</span>
            {toast.action && (
              <button onClick={() => { setToast(null); toast.action(); }} style={{ background:"rgba(255,255,255,.25)", border:"none", borderRadius:4, color:"#fff", padding:"3px 9px", fontSize:11, cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>{toast.actionLabel || "取り消し"}</button>
            )}
            <button onClick={() => setToast(null)} aria-label="閉じる" style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:4, color:"#fff", padding:"3px 7px", fontSize:11, cursor:"pointer", fontWeight:700, marginLeft:2 }}>✕</button>
          </div>
        );
      })()}
    </div>
  );
}
