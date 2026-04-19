import React, { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { getChapter } from '../utils';
import { CARD, BP, BSM, SEL, INP, TBL, TH, TD, PILL } from '../styles';

export default memo(function SpeakersView({ speakers, filterCh, filterSt, setFilterCh, setFilterSt, today, onEdit, onDelete, onStatusChange, onDoc, onEmail, onFormUrl, onLine, updateSpeaker, showToast, onAdd }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const exportCSV = useCallback(() => {
    const headers = ["開催日","単会","講師名","ふりがな","所属単会","企業名","役職","テーマ","ステータス","メール","電話"];
    const rows = filtered.map(sp => {
      const ch = getChapter(sp.chapterId);
      return [sp.seminarDate, ch.name, sp.speakerName, sp.speakerKana, sp.speakerUnit, sp.company, sp.role, sp.topic, STATUS[sp.status]?.label || sp.status, sp.email, sp.phone];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"})), download:`講師一覧_${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("CSVをエクスポートしました 📥");
  }, [filtered, showToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...speakers]
      .filter(sp =>
        (filterCh === "all" || sp.chapterId === filterCh) &&
        (filterSt === "all" || sp.status === filterSt) &&
        (!q || sp.speakerName?.toLowerCase().includes(q) || sp.company?.toLowerCase().includes(q) || sp.topic?.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(a.seminarDate) - new Date(b.seminarDate));
  }, [speakers, filterCh, filterSt, search]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>
          講師管理
          <span style={{ fontSize:12, fontWeight:400, color:"#90A4AE", marginLeft:8 }}>{filtered.length}/{speakers.length}件</span>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", flexWrap:"wrap", alignItems:"center" }}>
          <input style={{ ...INP, width:160, fontSize:11 }} placeholder="🔍 名前・会社・テーマ検索" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          <select style={SEL} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
            <option value="all">全単会</option>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <select style={SEL} value={filterSt} onChange={e => setFilterSt(e.target.value)}>
            <option value="all">全ステータス</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button style={{ ...BP, background:"#2E7D32" }} onClick={exportCSV}>📥 CSV出力</button>
          <button style={BP} onClick={onAdd}>＋ 新規登録</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["開催日","単会","講師名・所属","テーマ","ステータス","講話資料","連絡","📅 カレンダー","📝 確認フォーム","操作"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(sp => {
                const ch = getChapter(sp.chapterId);
                const daysUntil = sp.seminarDate ? Math.ceil((new Date(sp.seminarDate) - today) / 86400000) : null;
                const isPast = daysUntil !== null && daysUntil < 0;
                const rowBg = daysUntil === 0 ? "#FFEBEE" : daysUntil !== null && daysUntil > 0 && daysUntil <= 3 ? "#FFF8E1" : "white";
                return (
                  <tr key={sp.id} className="hover-row" style={{ background: rowBg, opacity: isPast ? 0.6 : 1 }}>
                    <td style={TD}>
                      <div style={{ fontWeight:600, fontSize:12 }}>{sp.seminarDate}</div>
                      <div style={{ fontSize:10, color:"#90A4AE" }}>{ch.dayName}</div>
                      {daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && (
                        <div style={{ fontSize:9, fontWeight:700, color: daysUntil === 0 ? "#B71C1C" : daysUntil <= 3 ? "#E65100" : "#FF8F00" }}>
                          {daysUntil === 0 ? "今日！" : `あと${daysUntil}日`}
                        </div>
                      )}
                    </td>
                    <td style={TD}><span style={PILL(ch)}>{ch.name}</span></td>
                    <td style={TD}><div style={{ fontWeight:600, fontSize:12 }}>{sp.speakerName}</div><div style={{ fontSize:10, color:"#78909C" }}>{sp.company}　{sp.role}</div></td>
                    <td style={{ ...TD, maxWidth:150, fontSize:11 }}>「{sp.topic}」</td>
                    <td style={TD}>
                      <select style={{ ...SEL, fontSize:11, color: STATUS[sp.status].color }} value={sp.status} onChange={e => onStatusChange(sp.id, e.target.value)}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={TD}>
                      {sp.materialUrl ? (
                        <a href={sp.materialUrl} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#1565C0", fontWeight:600, textDecoration:"none" }}>
                          <span style={{ fontSize:13 }}>📄</span>
                          <span style={{ maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp.materialName || "資料を開く"}</span>
                        </a>
                      ) : (
                        <span style={{ fontSize:10, color:"#B0BEC5", display:"flex", alignItems:"center", gap:3 }}>
                          <span>📭</span> 未受信
                        </span>
                      )}
                    </td>
                    <td style={TD}>
                      <div style={{ display:"flex", gap:3, flexDirection:"column" }}>
                        <button style={{ ...BSM, background:"#1A3A6B", color:"#fff", fontSize:10 }} title="メール送信" onClick={() => onEmail(sp)}>📧 メール</button>
                        {sp.lineNotified ? (
                          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                            <span style={{ color:"#06C755", fontSize:10, fontWeight:600 }}>✓LINE済</span>
                            <button style={{ ...BSM, fontSize:9, color:"#78909C", padding:"1px 4px" }} title="LINE送信済をリセット" aria-label="LINE送信済をリセット" onClick={() => { updateSpeaker(sp.id,{lineNotified:false}); showToast("LINE未送信に戻しました"); }}>↩</button>
                          </div>
                        ) : (
                          <button style={{ ...BSM, background:"#06C755", color:"#fff", fontSize:10 }} title="LINEメッセージを作成" onClick={() => onLine(sp)}>📱 LINE</button>
                        )}
                      </div>
                    </td>
                    <td style={TD}>
                      {sp.calendarAdded ? (
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ color:"#2E7D32", fontSize:11, fontWeight:600 }}>✓ 転記済</span>
                          <button style={{ ...BSM, fontSize:10, color:"#78909C" }} title="未転記に戻す" aria-label="カレンダー転記済をリセット" onClick={() => { updateSpeaker(sp.id,{calendarAdded:false}); showToast("未転記に戻しました"); }}>↩</button>
                        </div>
                      ) : (
                        <button style={{ ...BSM, background:"#E3F2FD", color:"#1565C0", border:"1px solid #90CAF9", fontSize:10 }} onClick={() => { updateSpeaker(sp.id,{calendarAdded:true}); showToast("カレンダー転記済にしました 📅"); }}>📅 転記済にする</button>
                      )}
                    </td>
                    <td style={TD}>
                      <button style={{ ...BSM, background:"#EDE7F6", color:"#4527A0", border:"1px solid #B39DDB", fontSize:10, whiteSpace:"nowrap" }} onClick={() => onFormUrl(sp)}>
                        📝 フォーム作成
                      </button>
                    </td>
                    <td style={TD}>
                      <div style={{ display:"flex", gap:3 }}>
                        <button style={BSM} aria-label={`${sp.speakerName}の確認書を表示`} onClick={() => onDoc(sp)}>確認書</button>
                        <button style={BSM} aria-label={`${sp.speakerName}を編集`} onClick={() => onEdit(sp)}>編集</button>
                        <button style={{ ...BSM, color:"#B71C1C" }} aria-label={`${sp.speakerName}を削除`} onClick={() => onDelete(sp.id)}>削除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ ...TD, textAlign:"center", padding:32 }}>
                  <div style={{ color:"#90A4AE", fontSize:13, marginBottom:10 }}>
                    {search || filterCh !== "all" || filterSt !== "all" ? "条件に一致する講師がいません" : "講師データがありません"}
                  </div>
                  {(searchInput || filterCh !== "all" || filterSt !== "all") && (
                    <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"6px 14px", fontSize:12, cursor:"pointer", color:"#546E7A", fontWeight:600 }}
                      onClick={() => { setSearchInput(""); setSearch(""); setFilterCh("all"); setFilterSt("all"); }}>
                      フィルターをリセット
                    </button>
                  )}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
        {Object.entries(STATUS).map(([k, v]) => {
          const count = speakers.filter(sp => sp.status === k).length;
          if (count === 0) return null;
          return <span key={k} style={{ fontSize:11, padding:"3px 10px", borderRadius:12, fontWeight:600, color: v.color, background: v.bg, border:`1px solid ${v.color}33` }}>{v.label} {count}件</span>;
        })}
      </div>
      <div style={{ marginTop:10, padding:"10px 14px", background:"#E8F5E9", borderRadius:6, fontSize:11, color:"#2E7D32", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>🤖</span>
        <div>
          <span style={{ fontWeight:700 }}>講話資料の自動格納について（準備中）</span>
          <span style={{ color:"#546E7A", marginLeft:8 }}>講師からのメール添付ファイルを <strong>nanbugoudou.jimu@gmail.com</strong> で受信すると、Googleドライブに自動保存され、この列にリンクが表示されます。</span>
        </div>
      </div>
    </div>
  );
});
