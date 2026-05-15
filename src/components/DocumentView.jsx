import React, { useState, useEffect, useMemo, memo } from 'react';
import { JIMU } from '../constants';
import { getChapter, getSeminarType, formatDate, extractStaffNotes, toDateStr } from '../utils';
import { BP, SEL } from '../styles';

function DocSection({ title, color, children }) {
  const c = color || "#1A3A6B";
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:"11pt", fontWeight:700, color:c, marginBottom:4, letterSpacing:"0.05em" }}>{title}</div>
      <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function DocRow({ label, value, color }) {
  const c = color || "#1A3A6B";
  return (
    <tr>
      <th style={{ width:120, padding:"6px 10px", background:"#F5F6FA", border:"1px solid #D0D7E2", fontSize:"10.5pt", fontWeight:700, color:c, textAlign:"left", verticalAlign:"middle", whiteSpace:"nowrap" }}>{label}</th>
      <td style={{ padding:"6px 10px", border:"1px solid #D0D7E2", fontSize:"10.5pt", color:"#263238", background:"#fff", wordBreak:"break-all" }}>{value}</td>
    </tr>
  );
}

function Cb({ on, label }) {
  return (
    <span style={{ marginRight:10, whiteSpace:"nowrap", fontSize:"10.5pt" }}>
      <span style={{ fontSize:"12pt", verticalAlign:"middle", lineHeight:1 }}>{on ? "■" : "□"}</span>
      {" "}<span style={{ verticalAlign:"middle" }}>{label}</span>
    </span>
  );
}

export default memo(function DocumentView({ speakers, docSpeaker, setDocSpeaker, today, chapterSettings }) {
  const [sel, setSel] = useState(docSpeaker?.id || "");
  useEffect(() => { if (docSpeaker?.id) setSel(docSpeaker.id); }, [docSpeaker?.id]);

  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('doc_recent') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    if (!sel) return;
    setRecentIds(prev => {
      const next = [sel, ...prev.filter(id => id !== sel)].slice(0, 5);
      try { localStorage.setItem('doc_recent', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [sel]);
  const recentSpeakers = useMemo(() =>
    recentIds.map(id => speakers.find(x => x.id === id)).filter(Boolean),
    [recentIds, speakers]
  );
  const sortedSpeakers = useMemo(
    () => [...speakers].sort((a, b) => new Date(a.seminarDate) - new Date(b.seminarDate)),
    [speakers]
  );
  const sp = useMemo(() => speakers.find(x => x.id === sel), [speakers, sel]);
  const ch = useMemo(() => sp ? getChapter(sp.chapterId) : null, [sp]);
  const chSettings = useMemo(() =>
    (sp && chapterSettings) ? (chapterSettings[sp.chapterId] || {}) : {},
    [sp, chapterSettings]
  );

  const parsedNotes = useMemo(() => {
    if (!sp?.notes) return {};
    const result = {};
    const summaryMatch = sp.notes.match(/【内容要約】\n([\s\S]*?)(?=\n【|$)/);
    if (summaryMatch) result['内容要約'] = summaryMatch[1].trim();
    const tagLine = /【([^】]+)】([^\n【]*)/g;
    let m;
    while ((m = tagLine.exec(sp.notes)) !== null) {
      if (m[1] !== '内容要約') result[m[1]] = m[2].trim();
    }
    return result;
  }, [sp?.notes]);

  useEffect(() => {
    const onKey = e => {
      if (["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const idx = sortedSpeakers.findIndex(x => x.id === sel);
      if (e.key === "ArrowLeft" && idx > 0) {
        const prev = sortedSpeakers[idx - 1]; setSel(prev.id); setDocSpeaker(prev);
      }
      if (e.key === "ArrowRight" && idx < sortedSpeakers.length - 1) {
        const next = sortedSpeakers[idx + 1]; setSel(next.id); setDocSpeaker(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, sortedSpeakers, setDocSpeaker]);

  return (
    <div>
      <div className="no-print" style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>講師依頼確認書</div>
        <select style={{ ...SEL, minWidth:260 }} value={sel} onChange={e => { setSel(e.target.value); setDocSpeaker(speakers.find(x => x.id === e.target.value) || null); }}>
          <option value="">── 講師を選択 ──</option>
          {sortedSpeakers.map(sp => {
            const ch = getChapter(sp.chapterId);
            return <option key={sp.id} value={sp.id}>{sp.seminarDate} | {ch.name} | {sp.speakerName}</option>;
          })}
        </select>
        {recentSpeakers.length > 0 && (
          <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap", marginLeft:4 }}>
            <span style={{ fontSize:10, color:"#90A4AE", fontWeight:600, whiteSpace:"nowrap" }}>最近：</span>
            {recentSpeakers.filter(r => r.id !== sel).slice(0,4).map(r => {
              const rc = getChapter(r.chapterId);
              return (
                <button key={r.id} onClick={() => { setSel(r.id); setDocSpeaker(r); }}
                  style={{ fontSize:10, background: rc.light, color: rc.color, border:`1px solid ${rc.accent}`, borderRadius:10, padding:"2px 9px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
                  {r.speakerName}
                </button>
              );
            })}
          </div>
        )}
        {sp && (
          <>
            <button style={BP} onClick={() => {
              const orig = document.title;
              document.title = `${sp.seminarDate || ''}_${sp.speakerName || ''}_講師依頼確認書`;
              const restore = () => { document.title = orig; window.removeEventListener('afterprint', restore); };
              window.addEventListener('afterprint', restore);
              window.print();
              setTimeout(restore, 1000);
            }}>🖨 印刷 / PDF保存</button>
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
              {(() => { const i = sortedSpeakers.findIndex(x => x.id === sel); return i >= 0 && <span style={{ fontSize:11, color:"#90A4AE", minWidth:40, textAlign:"center" }}>{i+1}/{sortedSpeakers.length}</span>; })()}
              <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }}
                disabled={sortedSpeakers.findIndex(x => x.id === sel) <= 0}
                onClick={() => { const i = sortedSpeakers.findIndex(x => x.id === sel); if (i > 0) { const prev = sortedSpeakers[i-1]; setSel(prev.id); setDocSpeaker(prev); } }}>‹ 前</button>
              <button style={{ background:"#ECEFF1", border:"none", borderRadius:6, padding:"5px 11px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#37474F" }}
                disabled={sortedSpeakers.findIndex(x => x.id === sel) >= sortedSpeakers.length - 1}
                onClick={() => { const i = sortedSpeakers.findIndex(x => x.id === sel); if (i < sortedSpeakers.length - 1) { const next = sortedSpeakers[i+1]; setSel(next.id); setDocSpeaker(next); } }}>次 ›</button>
            </div>
          </>
        )}
      </div>

      {sp && ch ? (() => {
        const isKiso = sp.seminarType === "kiso";
        const st    = getSeminarType(sp.seminarType || "ms");
        const stMs  = getSeminarType("ms");
        const stKiso = getSeminarType("kiso");
        const lodgingRequired = sp.lodging === "要" || (sp.lodging && sp.lodging !== "不要" && sp.lodging !== "なし");
        const contactPerson = chSettings.contactPerson || ch.staff || "";

        // kiso day + 1 = MS day
        const msDateStr = isKiso && sp.seminarDate ? (() => {
          const d = new Date(sp.seminarDate + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          return toDateStr(d);
        })() : null;

        // ── Section builders (shared) ──

        const mkHeader = (sheetSt, dateStr) => (
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:"10.5pt", color:"#546E7A", marginBottom:6, letterSpacing:"0.1em" }}>倫理法人会　南部地区事務局</div>
            <div style={{ display:"inline-block", fontSize:"12pt", fontWeight:700, color:sheetSt.color,
              border:`2px solid ${sheetSt.color}`, padding:"4px 24px", marginBottom:8, letterSpacing:"0.15em" }}>
              {sheetSt.label}
            </div>
            <div style={{ fontSize:"18pt", fontWeight:800, color:"#1A1A2E", letterSpacing:"0.06em", marginBottom:8 }}>講師依頼確認書</div>
            <div style={{ height:1, background:`linear-gradient(to right, transparent, ${sheetSt.color}, transparent)`, margin:"0 40px 8px" }} />
            <div style={{ fontSize:"10.5pt", color:"#78909C", letterSpacing:"0.05em" }}>
              {sp.requestDate ? `受付日：${sp.requestDate}` : "受付日：　　　　年　　月　　日"}
              {"　　担当："}{contactPerson || "　　　　　　　　"}
            </div>
          </div>
        );

        const mkSpeaker = (c) => (
          <DocSection title="① 講師情報" color={c}>
            <DocRow label="お名前（漢字）"   value={`${sp.speakerName}　様`}  color={c} />
            <DocRow label="ふりがな"         value={sp.speakerKana || ""}     color={c} />
            <DocRow label="所属法人会名"     value={sp.speakerUnit || ""}     color={c} />
            <DocRow label="法人会役職"       value={sp.role || ""}            color={c} />
            <DocRow label="勤務先"           value={sp.company || ""}         color={c} />
            <DocRow label="勤務先役職名"     value={sp.companyRole || ""}     color={c} />
            <DocRow label="連絡先TEL"        value={sp.phone || ""}           color={c} />
            <DocRow label="メールアドレス"   value={sp.email || ""}           color={c} />
          </DocSection>
        );

        const mkTransport = (c, n) => (
          <DocSection title={`${n} 交通・当日の準備`} color={c}>
            {(() => {
              const t = parsedNotes['交通手段'];
              return <DocRow label="交通手段" color={c} value={
                <span>
                  <Cb on={t === "お車"} label="お車" />
                  <Cb on={t === "電車"} label="電車" />
                  <Cb on={t === "その他"} label="その他" />
                </span>
              } />;
            })()}
            <DocRow label="資料の有無" color={c} value={
              <span>
                <Cb on={!!(parsedNotes['資料01'] || parsedNotes['資料02'])} label="あり" />
                <Cb on={false} label="なし" />
              </span>
            } />
            {(() => {
              const req  = sp.printRequired === "あり" || sp.printRequired?.startsWith("要");
              const notR = sp.printRequired === "不要" || sp.printRequired?.startsWith("不要");
              return <DocRow label="印刷の要否" color={c} value={
                <span>
                  <Cb on={req}  label="要（単会で印刷）" />
                  <Cb on={notR} label="不要（持参）" />
                </span>
              } />;
            })()}
            {(() => {
              const p = parsedNotes['単会で準備'];
              const items = ["プロジェクタ","パソコン","ホワイトボード","その他","無し"];
              return <DocRow label="必要機材など" color={c} value={
                <span>{items.map(i => <Cb key={i} on={!!(p && p.includes(i))} label={i} />)}</span>
              } />;
            })()}
          </DocSection>
        );

        const mkLodging = (c, n) => (
          <DocSection title={`${n} 宿泊情報`} color={c}>
            {(() => {
              const req  = sp.lodging === "要" || (sp.lodging && sp.lodging !== "不要" && sp.lodging !== "なし");
              const notR = sp.lodging === "不要";
              return <DocRow label="前泊要否" color={c} value={
                <span>
                  <Cb on={req}  label="要" />
                  <Cb on={notR} label="不要" />
                </span>
              } />;
            })()}
            {lodgingRequired && (chSettings.hotelName || chSettings.hotelAddress || chSettings.hotelTel || chSettings.hotelStation || chSettings.hotelMapUrl) && (
              <>
                {chSettings.hotelName    && <DocRow label="ホテル名"     value={chSettings.hotelName}    color={c} />}
                {chSettings.hotelAddress && <DocRow label="ホテル住所"   value={chSettings.hotelAddress} color={c} />}
                {chSettings.hotelTel     && <DocRow label="ホテル連絡先" value={chSettings.hotelTel}     color={c} />}
                {chSettings.hotelStation && <DocRow label="最寄駅"       value={chSettings.hotelStation} color={c} />}
                {chSettings.hotelMapUrl  && (
                  <DocRow label="ホテル地図" color={c}
                    value={<a href={chSettings.hotelMapUrl} target="_blank" rel="noreferrer" style={{ color:"#1565C0", fontSize:"10.5pt" }}>Googleマップで開く →</a>} />
                )}
              </>
            )}
            {(() => {
              const room   = parsedNotes['禁煙ルーム']?.split('／')[0] || null;
              const pickup = parsedNotes['お迎え'] || null;
              return <>
                <DocRow label="お部屋のタイプ" color={c} value={
                  <span>{["禁煙","喫煙","どちらでも"].map(v => <Cb key={v} on={room === v} label={v} />)}</span>
                } />
                <DocRow label="お迎えの要否" color={c} value={
                  <span>
                    <Cb on={pickup === "要"}  label="要" />
                    <Cb on={pickup === "不要"} label="不要" />
                  </span>
                } />
              </>;
            })()}
            <DocRow label="領収証の宛名"   value={parsedNotes['領収証宛名'] || ""}     color={c} />
            <DocRow label="郵便番号"       value={parsedNotes['領収証郵便番号'] || ""} color={c} />
            <DocRow label="住所"           value={parsedNotes['領収証住所'] || ""}     color={c} />
          </DocSection>
        );

        const mkPhoto = (c, n) => (
          <DocSection title={`${n} 顔写真・資料`} color={c}>
            {sp.materialUrl && (/\.(jpg|jpeg|png|webp)$/i.test(sp.materialUrl) || sp.materialUrl.includes('/object/public/')) && (
              <tr>
                <th style={{ width:120, padding:"6px 10px", background:"#F5F6FA", border:"1px solid #D0D7E2", fontSize:"10.5pt", fontWeight:700, color:c, textAlign:"left", verticalAlign:"middle" }}>顔写真プレビュー</th>
                <td style={{ padding:"6px 10px", border:"1px solid #D0D7E2", background:"#fff" }}>
                  <img src={sp.materialUrl} alt={sp.speakerName} style={{ height:80, objectFit:"cover", borderRadius:4, border:"1px solid #CFD8DC" }} onError={e => { const tr = e.target.closest('tr'); if (tr) tr.style.display="none"; }} />
                </td>
              </tr>
            )}
            <DocRow label="顔写真" color={c} value={
              <span>
                <Cb on={!!sp.materialUrl} label="フォームアップ済" />
                <Cb on={false} label="メール送付済" />
                <Cb on={false} label="未受領" />
              </span>
            } />
            <DocRow label="講話資料" color={c} value={
              <span>
                <Cb on={!!(parsedNotes['資料01'] || parsedNotes['資料02'])} label="フォームアップ済" />
                <Cb on={false} label="メール送付済" />
                <Cb on={false} label="未受領" />
              </span>
            } />
            {sp.materialName && <DocRow label="ファイル名・メモ" value={sp.materialName} color={c} />}
            <DocRow label="顔写真の使用範囲" value={parsedNotes['顔写真の使用範囲'] || ""} color={c} />
          </DocSection>
        );

        const mkRemarks = (c, n) => (
          <DocSection title={`${n} 備考・特記事項`} color="#546E7A">
            <tr>
              <td colSpan={2} style={{ padding:"8px 10px", border:"1px solid #D0D7E2",
                fontSize:"10.5pt", color:"#263238", background:"#fff", minHeight:52, height:52,
                whiteSpace:"pre-wrap" }}>
                {extractStaffNotes(sp.notes)}
              </td>
            </tr>
          </DocSection>
        );

        const mkFooter = (c) => (
          <div style={{ marginTop:16, paddingTop:10, borderTop:`2px solid ${c}`,
            fontSize:"10.5pt", color:"#546E7A", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
            <div>
              <span style={{ fontWeight:700 }}>【事務局連絡先】　倫理法人会　南部地区合同事務局</span>
              {JIMU.tel && <span>　TEL：{JIMU.tel}</span>}
              <span>　Mail：<span style={{ color:"#1565C0" }}>{JIMU.email}</span></span>
            </div>
            <div style={{ color:"#90A4AE" }}>確認日　　年　　月　　日</div>
          </div>
        );

        const docWrapStyle = (sheetSt) => ({
          background:"#fff", maxWidth:700, margin:"0 auto",
          padding:"32px 40px 24px", boxShadow:"0 2px 16px rgba(0,0,0,.10)",
          border:"1px solid #D0D7E2", borderRadius:4, position:"relative", overflow:"hidden",
          fontFamily:"'Hiragino Sans','Meiryo',sans-serif"
        });

        const mkCornerBadge = (sheetSt) => (<>
          <div style={{ position:"absolute", top:0, right:0, width:0, height:0,
            borderStyle:"solid", borderWidth:"0 72px 72px 0",
            borderColor:`transparent ${sheetSt.color} transparent transparent` }} />
          <div style={{ position:"absolute", top:10, right:7, fontSize:"10pt", fontWeight:800,
            color:"#fff", zIndex:2, lineHeight:1.1, textAlign:"right" }}>{sheetSt.short}</div>
        </>);

        // ── KISO: 2 documents ──
        if (isKiso) {
          const c1 = stKiso.color;
          const c2 = stMs.color;
          return (
            <>
              {/* ─── Document 1: 倫理経営基礎講座 ─── */}
              <div id="print-doc" style={docWrapStyle(stKiso)}>
                {mkCornerBadge(stKiso)}
                {mkHeader(stKiso, sp.seminarDate)}
                {mkSpeaker(c1)}
                <DocSection title="② 開催情報（倫理経営基礎講座）" color={c1}>
                  <DocRow label="講話日"     value={formatDate(sp.seminarDate)}       color={c1} />
                  <DocRow label="開催場所"   value={chSettings.kisoVenue || ""}       color={c1} />
                  <DocRow label="会場住所"   value={chSettings.kisoAddress || ""}     color={c1} />
                  {chSettings.kisoMapUrl && (
                    <DocRow label="会場地図" color={c1}
                      value={<a href={chSettings.kisoMapUrl} target="_blank" rel="noreferrer" style={{ color:"#1565C0", fontSize:"10.5pt" }}>Googleマップで開く →</a>} />
                  )}
                </DocSection>
                <DocSection title="③ 倫理経営基礎講座 内容" color={c1}>
                  <DocRow label="テキスト"
                    value={chSettings.kisoTextChapter ? `第${chSettings.kisoTextChapter}講` : "（設定で入力）"}
                    color={c1} />
                </DocSection>
                {mkTransport(c1, "④")}
                {mkLodging(c1, "⑤")}
                {mkPhoto(c1, "⑥")}
                {mkRemarks(c1, "⑦")}
                {mkFooter(c1)}
              </div>

              {/* ─── Page break between docs ─── */}
              <div style={{ pageBreakAfter:"always", height:0 }} />
              <div className="no-print" style={{ height:36 }} />

              {/* ─── Document 2: MS確認書 ─── */}
              <div id="print-doc-ms" style={docWrapStyle(stMs)}>
                {mkCornerBadge(stMs)}
                {mkHeader(stMs, msDateStr)}
                {mkSpeaker(c2)}
                <DocSection title="② 開催情報（モーニングセミナー）" color={c2}>
                  <DocRow label="講話日"         value={formatDate(msDateStr)}                           color={c2} />
                  <DocRow label="講話単会名"      value={chSettings.name || ch.name}                     color={c2} />
                  <DocRow label="開催曜日・時間"  value={`${ch.dayName}　${ch.time}`}                   color={c2} />
                  <DocRow label="開催場所"        value={chSettings.msVenue || ch.venue}                  color={c2} />
                  <DocRow label="会場住所"        value={chSettings.msAddress || ch.address}              color={c2} />
                  {chSettings.msStation && <DocRow label="最寄駅"    value={chSettings.msStation}         color={c2} />}
                  <DocRow label="会場地図" color={c2}
                    value={<a href={chSettings.msMapUrl || ch.mapUrl} target="_blank" rel="noreferrer" style={{ color:"#1565C0", fontSize:"10.5pt" }}>Googleマップで開く →</a>} />
                  {chSettings.msParking && <DocRow label="駐車場"    value={chSettings.msParking}         color={c2} />}
                  <DocRow label="会場連絡先"      value={chSettings.msVenueTel || ch.venueTel || "—"}   color={c2} />
                </DocSection>
                <DocSection title="③ MS講話内容" color={c2}>
                  <DocRow label="タイトル"  value={sp.topic ? `「${sp.topic}」` : ""}  color={c2} />
                  <DocRow label="内容要約"  value={parsedNotes['内容要約'] || ""}       color={c2} />
                </DocSection>
                {mkTransport(c2, "④")}
                {mkLodging(c2, "⑤")}
                {mkPhoto(c2, "⑥")}
                {mkRemarks(c2, "⑦")}
                {mkFooter(c2)}
              </div>
            </>
          );
        }

        // ── Non-kiso: single document ──
        return (
          <div id="print-doc" style={docWrapStyle(st)}>
            {mkCornerBadge(st)}
            {mkHeader(st, sp.seminarDate)}
            {mkSpeaker(st.color)}
            <DocSection title="② 開催情報" color={st.color}>
              <DocRow label="講話日"          value={formatDate(sp.seminarDate)}                              color={st.color} />
              <DocRow label="講話単会名"      value={chSettings.name || ch.name}                              color={st.color} />
              <DocRow label="開催曜日・時間"  value={`${ch.dayName}　${ch.time}`}                            color={st.color} />
              <DocRow label="開催場所"        value={chSettings.msVenue || ch.venue}                          color={st.color} />
              <DocRow label="会場住所"        value={chSettings.msAddress || ch.address}                      color={st.color} />
              {chSettings.msStation && <DocRow label="最寄駅"  value={chSettings.msStation}                   color={st.color} />}
              <DocRow label="会場地図" color={st.color}
                value={<a href={chSettings.msMapUrl || ch.mapUrl} target="_blank" rel="noreferrer" style={{ color:"#1565C0", fontSize:"10.5pt" }}>Googleマップで開く →</a>} />
              {chSettings.msParking && <DocRow label="駐車場"  value={chSettings.msParking}                   color={st.color} />}
              <DocRow label="会場連絡先"      value={chSettings.msVenueTel || ch.venueTel || "—"}            color={st.color} />
            </DocSection>
            <DocSection title="③ MS講話内容" color={st.color}>
              <DocRow label="タイトル"  value={sp.topic ? `「${sp.topic}」` : ""}  color={st.color} />
              <DocRow label="内容要約"  value={parsedNotes['内容要約'] || ""}       color={st.color} />
            </DocSection>
            {mkTransport(st.color, "④")}
            {mkLodging(st.color, "⑤")}
            {mkPhoto(st.color, "⑥")}
            {mkRemarks(st.color, "⑦")}
            {mkFooter(st.color)}
          </div>
        );
      })() : (
        <div style={{ textAlign:"center", padding:38, color:"#90A4AE", fontSize:13,
          background:"#fff", borderRadius:8, border:"2px dashed #CFD8DC" }}>
          ← 上のセレクトボックスから講師を選択してください
        </div>
      )}
    </div>
  );
});
