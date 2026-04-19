import React from 'react';
import { CHAPTERS, STATUS } from '../constants';
import { getChapter } from '../utils';
import { CARD, BP, BSM, SEL, TBL, TH, TD, PILL } from '../styles';

export default function SpeakersView({ speakers, filterCh, filterSt, setFilterCh, setFilterSt, today, onEdit, onDelete, onStatusChange, onDoc, onEmail, onFormUrl, onLine, updateSpeaker, showToast, onAdd }) {
  const filtered = [...speakers]
    .filter(sp => (filterCh === "all" || sp.chapterId === filterCh) && (filterSt === "all" || sp.status === filterSt))
    .sort((a, b) => new Date(a.seminarDate) - new Date(b.seminarDate));

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>講師管理</div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto", flexWrap:"wrap" }}>
          <select style={SEL} value={filterCh} onChange={e => setFilterCh(e.target.value)}>
            <option value="all">全単会</option>
            {CHAPTERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <select style={SEL} value={filterSt} onChange={e => setFilterSt(e.target.value)}>
            <option value="all">全ステータス</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button style={BP} onClick={onAdd}>＋ 新規登録</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["開催日","単会","講師名・所属","テーマ","ステータス","講話資料","依頼メール","LINE通知","📅 カレンダー","📝 確認フォーム","操作"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(sp => {
                const ch = getChapter(sp.chapterId);
                return (
                  <tr key={sp.id} className="hover-row">
                    <td style={TD}><div style={{ fontWeight:600, fontSize:12 }}>{sp.seminarDate}</div><div style={{ fontSize:10, color:"#90A4AE" }}>{ch.dayName}</div></td>
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
                      <button style={{ ...BSM, background:"#1A3A6B", color:"#fff", fontSize:10 }} onClick={() => onEmail(sp)}>📧 送信</button>
                    </td>
                    <td style={TD}>
                      {sp.lineNotified ? (
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ color:"#06C755", fontSize:11, fontWeight:600 }}>✓ 送信済</span>
                          <button style={{ ...BSM, fontSize:10, color:"#78909C" }} onClick={() => { updateSpeaker(sp.id,{lineNotified:false}); showToast("LINE未送信に戻しました"); }}>↩</button>
                        </div>
                      ) : (
                        <button style={{ ...BSM, background:"#06C755", color:"#fff", fontSize:10 }} onClick={() => onLine(sp)}>📱 LINE</button>
                      )}
                    </td>
                    <td style={TD}>
                      {sp.calendarAdded ? (
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ color:"#2E7D32", fontSize:11, fontWeight:600 }}>✓ 転記済</span>
                          <button style={{ ...BSM, fontSize:10, color:"#78909C" }} onClick={() => { updateSpeaker(sp.id,{calendarAdded:false}); showToast("未転記に戻しました"); }}>↩</button>
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
                        <button style={BSM} onClick={() => onDoc(sp)}>確認書</button>
                        <button style={BSM} onClick={() => onEdit(sp)}>編集</button>
                        <button style={{ ...BSM, color:"#B71C1C" }} onClick={() => onDelete(sp.id)}>削除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={11} style={{ ...TD, textAlign:"center", color:"#90A4AE", padding:28 }}>該当データなし</td></tr>}
            </tbody>
          </table>
        </div>
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
}
