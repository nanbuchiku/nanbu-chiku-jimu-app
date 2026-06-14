import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS } from '../constants';
import { getChapter, formatDate, toDateStr, parseDate } from '../utils';
import { BP, BC, SEL, INP, CARD } from '../styles';

const CONTACT_TYPES = [
  { type: "reminder", label: "🔔 リマインド", desc: "前日〜当日", bg: "#E65100", light: "#FFF3E0", border: "#FFB74D" },
  { type: "material", label: "📎 資料催促",   desc: "資料・写真が未着", bg: "#C62828", light: "#FFEBEE", border: "#EF9A9A" },
  { type: "promo",    label: "📣 宣伝案内",   desc: "メンバーへ宣伝", bg: "#1565C0", light: "#E3F2FD", border: "#90CAF9" },
  { type: "thanks",   label: "🙏 お礼",       desc: "講話終了後",     bg: "#6A1B9A", light: "#F3E5F5", border: "#CE93D8" },
];

function getContactType(sp, today) {
  if (!sp.seminarDate) return { type: "promo", label: "📣 宣伝案内", bg: "#1565C0" };
  const d = new Date(sp.seminarDate);
  const t = new Date(today);
  const diff = Math.round((d - t) / 86400000);
  if (diff < 0)  return { type: "thanks",   label: "🙏 お礼",       bg: "#6A1B9A" };
  if (diff <= 1) return { type: "reminder",  label: "🔔 リマインド", bg: "#E65100" };
  const hasMaterial = sp.materialUrl || sp.materialName;
  const hasPhoto = sp.speakerChecks?.photo;
  if (!hasMaterial && !hasPhoto && diff <= 21) return { type: "material", label: "📎 資料催促", bg: "#C62828" };
  return { type: "promo", label: "📣 宣伝案内", bg: "#1565C0" };
}

export default memo(function SpeakerContactView({ speakers, today, onEmail, onLine, updateSpeaker, showToast }) {
  const [filterCh, setFilterCh] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showDone, setShowDone] = useState(false);

  const items = useMemo(() => {
    const todayStr = toDateStr(today);
    return speakers
      .filter(sp => sp.status !== "cancelled")
      .filter(sp => filterCh === "all" || sp.chapterId === filterCh)
      .map(sp => {
        const ct = getContactType(sp, today);
        const diff = sp.seminarDate ? Math.round((parseDate(sp.seminarDate) - today) / 86400000) : null;
        const contacted = sp.speakerChecks?.['contact_' + ct.type];
        return { sp, ct, diff, contacted };
      })
      .filter(item => filterType === "all" || item.ct.type === filterType)
      .filter(item => showDone || !item.contacted)
      .sort((a, b) => {
        const order = { reminder: 0, material: 1, thanks: 2, promo: 3 };
        const oa = order[a.ct.type] ?? 9;
        const ob = order[b.ct.type] ?? 9;
        if (oa !== ob) return oa - ob;
        if (a.contacted !== b.contacted) return a.contacted ? 1 : -1;
        return (a.sp.seminarDate || "").localeCompare(b.sp.seminarDate || "");
      });
  }, [speakers, today, filterCh, filterType, showDone]);

  const stats = useMemo(() => {
    const counts = { reminder: 0, material: 0, promo: 0, thanks: 0 };
    const done   = { reminder: 0, material: 0, promo: 0, thanks: 0 };
    speakers.filter(sp => sp.status !== "cancelled").forEach(sp => {
      const ct = getContactType(sp, today);
      counts[ct.type]++;
      if (sp.speakerChecks?.['contact_' + ct.type]) done[ct.type]++;
    });
    return { counts, done };
  }, [speakers, today]);

  const toggleContacted = useCallback(async (sp, type) => {
    const checks = { ...(sp.speakerChecks || {}) };
    const key = 'contact_' + type;
    checks[key] = !checks[key];
    const ok = await updateSpeaker(sp.id, { speakerChecks: checks });
    if (ok) showToast(checks[key] ? "✓ 連絡済みにしました" : "未連絡に戻しました");
  }, [updateSpeaker, showToast]);

  const pendingCount = items.filter(i => !i.contacted).length;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:"clamp(20px,4.5vw,34px)", fontWeight:700, color:"#061B44" }}>
            📨 講師連絡タスク
            {pendingCount > 0 && <span style={{ fontSize:"clamp(14px,2.6vw,22px)", fontWeight:700, color:"#C62828", marginLeft:10 }}>{pendingCount}件未対応</span>}
          </div>
          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginTop:2 }}>講師への連絡（メール・LINE）をタスクとして管理</div>
        </div>
      </div>

      {/* サマリーカード */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:10, marginBottom:16 }}>
        {CONTACT_TYPES.map(ct => {
          const total = stats.counts[ct.type];
          const d = stats.done[ct.type];
          const pending = total - d;
          return (
            <button key={ct.type} onClick={() => setFilterType(filterType === ct.type ? "all" : ct.type)}
              style={{ background: filterType === ct.type ? ct.bg : ct.light, color: filterType === ct.type ? "#fff" : ct.bg, border: `2px solid ${filterType === ct.type ? ct.bg : ct.border}`, borderRadius:12, padding:"12px 14px", cursor:"pointer", textAlign:"left" }}>
              <div style={{ fontSize:"clamp(14px,2vw,18px)", fontWeight:700 }}>{ct.label}</div>
              <div style={{ fontSize:"clamp(11px,1.4vw,13px)", marginTop:4, opacity:0.85 }}>{ct.desc}</div>
              <div style={{ fontSize:"clamp(20px,3vw,28px)", fontWeight:800, marginTop:6 }}>
                {pending > 0 ? pending : "✓"}
                <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:400, marginLeft:4 }}>/ {total}件</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* フィルター */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <select style={SEL} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
          <option value="all">全単会</option>
          {CHAPTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={{ ...(showDone ? BP : BC), padding:"5px 12px", fontSize:"clamp(12px,1.4vw,14px)" }}
          onClick={() => setShowDone(v => !v)}>
          {showDone ? "✓ 連絡済みも表示中" : "連絡済みも表示"}
        </button>
        {(filterType !== "all" || filterCh !== "all" || showDone) && (
          <button style={{ fontSize:"clamp(12px,1.4vw,14px)", padding:"5px 12px", borderRadius:14, border:"1px solid #EF5350", background:"#FFEBEE", color:"#B71C1C", cursor:"pointer", fontWeight:700 }}
            onClick={() => { setFilterType("all"); setFilterCh("all"); setShowDone(false); }}>
            ✕ リセット
          </button>
        )}
      </div>

      {/* タスクリスト */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map(({ sp, ct, diff, contacted }) => {
          const ch = getChapter(sp.chapterId);
          const ctInfo = CONTACT_TYPES.find(c => c.type === ct.type);
          const urgencyLabel = diff === null ? "" : diff === 0 ? "今日！" : diff === 1 ? "明日" : diff < 0 ? `${Math.abs(diff)}日前` : `あと${diff}日`;
          const isUrgent = diff !== null && diff >= 0 && diff <= 3;

          return (
            <div key={sp.id + ct.type} style={{
              background: contacted ? "#F9FBF9" : "#fff",
              borderRadius: 12,
              border: `1px solid ${contacted ? "#E0E0E0" : ctInfo?.border || "#E2E8F0"}`,
              borderLeft: `6px solid ${contacted ? "#A5D6A7" : ct.bg}`,
              padding: "clamp(10px,2vw,14px) clamp(12px,2vw,16px)",
              opacity: contacted ? 0.65 : 1,
              boxShadow: isUrgent && !contacted ? `0 0 0 2px ${ct.bg}33` : "none",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"clamp(10px,2vw,16px)", flexWrap:"wrap" }}>

                {/* チェックボックス */}
                <button onClick={() => toggleContacted(sp, ct.type)}
                  style={{ width:32, height:32, borderRadius:"50%", border: `2px solid ${contacted ? "#66BB6A" : ct.bg}`, background: contacted ? "#66BB6A" : "#fff", color: contacted ? "#fff" : ct.bg, fontSize:16, fontWeight:700, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}
                  title={contacted ? "未連絡に戻す" : "連絡済みにする"}>
                  {contacted ? "✓" : ""}
                </button>

                {/* タイプラベル */}
                <span style={{ fontSize:"clamp(12px,1.6vw,15px)", fontWeight:700, color:"#fff", background: ct.bg, padding:"4px 12px", borderRadius:20, flexShrink:0 }}>
                  {ct.label}
                </span>

                {/* 講師名 */}
                <div style={{ flex:"1 1 auto", minWidth:0 }}>
                  <div style={{ fontSize:"clamp(15px,2.2vw,20px)", fontWeight:700, color:"#061B44" }}>
                    {sp.speakerName}
                    <span style={{ fontSize:"clamp(12px,1.6vw,15px)", fontWeight:400, color:"#98A2B3", marginLeft:6 }}>様</span>
                  </div>
                  <div style={{ fontSize:"clamp(11px,1.4vw,13px)", color:"#667085", display:"flex", gap:8, flexWrap:"wrap", marginTop:2 }}>
                    <span style={{ color: ch?.color, fontWeight:600 }}>{ch?.name}</span>
                    <span>{sp.seminarDate ? formatDate(sp.seminarDate) : "日程未定"}</span>
                    {sp.topic && <span>「{sp.topic}」</span>}
                  </div>
                </div>

                {/* 日数 */}
                {urgencyLabel && (
                  <span style={{
                    fontSize:"clamp(12px,1.6vw,15px)", fontWeight:700, flexShrink:0,
                    color: diff < 0 ? "#6A1B9A" : diff === 0 ? "#B71C1C" : diff <= 3 ? "#E65100" : "#78909C",
                    background: diff < 0 ? "#F3E5F5" : diff === 0 ? "#FFEBEE" : diff <= 3 ? "#FFF3E0" : "#F5F5F5",
                    padding:"4px 10px", borderRadius:12,
                  }}>
                    {urgencyLabel}
                  </span>
                )}

                {/* アクションボタン */}
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={() => onEmail({ speaker: sp, defaultType: ct.type })}
                    style={{ fontSize:"clamp(12px,1.6vw,14px)", background: ct.bg, color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
                    ✉ メール
                  </button>
                  <button onClick={() => onLine(sp)}
                    style={{ fontSize:"clamp(12px,1.6vw,14px)", background:"#06C755", color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
                    LINE
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div style={{ ...CARD, textAlign:"center", color:"#98A2B3", padding:40 }}>
          {showDone ? "該当する講師がいません" : "🎉 すべての連絡が完了しています！"}
        </div>
      )}
    </div>
  );
});
