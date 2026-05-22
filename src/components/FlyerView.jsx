import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS, JIMU } from '../constants';
import { OV, MOD, MH, CARD, BP, BC, BG, INP, TBL, TH, TD, SEL, PILL } from '../styles';

export default memo(function FlyerView({ speakers, today, showToast }) {
  const months = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 3 + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const monthSpeakers = speakers.filter(s => (!s.seminarType || s.seminarType === "ms") && s.seminarDate?.startsWith(ym) && s.status !== "cancelled");
    const ready = monthSpeakers.filter(s => s.speakerName && s.speakerKana && s.topic && s.materialUrl).length;
    const isPast = d < new Date(today.getFullYear(), today.getMonth(), 1);
    return { value: ym, label: `${d.getFullYear()}年${d.getMonth()+1}月号`, readyCount: ready, isPast };
  }), [today, speakers]);

  const [selMonth, setSelMonth] = useState(() => months[4].value);
  const [printEmail, setPrintEmail] = useState(() => localStorage.getItem('flyer_printEmail') || "");
  const [showEmailModal, setShowEmailModal] = useState(false);

  // 各単会・月ごとの予定講話者数 key = "YYYY-MM_chapterId"
  const [expectedCounts, setExpectedCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flyer_expected') || '{}'); } catch { return {}; }
  });
  const setExpected = useCallback((key, val) => {
    const n = Math.max(1, parseInt(val, 10) || 1);
    setExpectedCounts(prev => {
      const next = { ...prev, [key]: n };
      try { localStorage.setItem('flyer_expected', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const savePrintEmail = useCallback(v => {
    setPrintEmail(v);
    try { localStorage.setItem('flyer_printEmail', v); } catch {}
  }, []);

  const { year, month, daysLeft, deadlineColor } = useMemo(() => {
    const [y, m] = selMonth.split("-").map(Number);
    const dl = new Date(y, m - 1, 10);
    const days = Math.ceil((dl - today) / 86400000);
    return { year: y, month: m, deadline: dl, daysLeft: days, deadlineColor: days < 0 ? "#B71C1C" : days <= 3 ? "#E65100" : days <= 7 ? "#FF8F00" : "#2E7D32" };
  }, [selMonth, today]);

  // 各単会の全講師リスト（複数対応）
  const flyerData = useMemo(() => CHAPTERS.map(ch => {
    const sps = speakers
      .filter(s =>
        (!s.seminarType || s.seminarType === "ms") &&
        s.chapterId === ch.id &&
        s.seminarDate?.startsWith(selMonth) &&
        s.status !== "cancelled"
      )
      .sort((a, b) => (a.seminarDate || '').localeCompare(b.seminarDate || ''));
    return { ch, sps };
  }), [speakers, selMonth]);

  // 完成度（予定人数基準）
  const completeness = useMemo(() => flyerData.map(({ ch, sps }) => {
    const key = `${selMonth}_${ch.id}`;
    const expected = expectedCounts[key] || Math.max(sps.length, 1);
    const ready = sps.filter(sp => sp.speakerName && sp.speakerKana && sp.topic && sp.materialUrl).length;
    const pct = Math.min(100, Math.round(ready / expected * 100));
    const missingSet = new Set();
    if (sps.length === 0) missingSet.add("講師未登録");
    sps.forEach(sp => {
      if (!sp.speakerKana) missingSet.add("ふりがな");
      if (!sp.topic)       missingSet.add("テーマ");
      if (!sp.materialUrl) missingSet.add("顔写真");
    });
    const unregistered = Math.max(0, expected - sps.length);
    if (unregistered > 0) missingSet.add(`未登録${unregistered}名`);
    return { ch, pct, missing: [...missingSet], ready, expected, registered: sps.length };
  }), [flyerData, expectedCounts, selMonth]);

  const readyCount = useMemo(() => completeness.filter(c => c.pct === 100).length, [completeness]);

  const buildLineText = useMemo(() => {
    const lines = [
      `【${selMonth.replace("-","年")}月号　チラシ流し込みデータ】`,
      `締め切り：${year}年${month}月10日`,
      ``,
    ];
    flyerData.forEach(({ ch, sps }) => {
      lines.push(`■ ${ch.name}（${ch.dayName} ${ch.time}）`);
      if (sps.length === 0) {
        lines.push(`  ※講師未登録`);
      } else {
        sps.forEach((sp, i) => {
          if (sps.length > 1) lines.push(`  ▷ 第${i + 1}講`);
          lines.push(`  開催日：${sp.seminarDate}`);
          lines.push(`  講師：${sp.speakerName}（${sp.speakerKana || "ふりがな未入力"}）`);
          lines.push(`  所属法人会：${sp.speakerUnit || "―"}　${sp.role || ""}`);
          lines.push(`  勤務先：${sp.company || "―"}　${sp.companyRole || ""}`);
          lines.push(`  テーマ：「${sp.topic || "未定"}」`);
          lines.push(`  写真：${sp.materialUrl || "※未受領"}`);
        });
      }
      lines.push(``);
    });
    lines.push(`倫理法人会 南部地区合同事務局`);
    return lines.join("\n");
  }, [selMonth, year, month, flyerData]);

  const buildEmailBody = useMemo(() => {
    const lines = [
      `お世話になっております。`,
      `倫理法人会 南部地区合同事務局です。`,
      ``,
      `${selMonth.replace("-","年")}月号の合同チラシ用データをお送りします。`,
      ``,
      `【流し込みデータ一覧】`,
    ];
    flyerData.forEach(({ ch, sps }) => {
      lines.push(`▼ ${ch.name}単会（${ch.dayName} ${ch.time}）`);
      if (sps.length === 0) {
        lines.push(`  ※後日送付`);
      } else {
        sps.forEach((sp, i) => {
          if (sps.length > 1) lines.push(`  ◆ 第${i + 1}講`);
          lines.push(`  開催日：${sp.seminarDate}`);
          lines.push(`  講師名：${sp.speakerName}`);
          lines.push(`  ふりがな：${sp.speakerKana || "―"}`);
          lines.push(`  所属法人会名：${sp.speakerUnit || "―"}`);
          lines.push(`  法人会役職：${sp.role || "―"}`);
          lines.push(`  勤務先：${sp.company || "―"}`);
          lines.push(`  勤務先役職名：${sp.companyRole || "―"}`);
          lines.push(`  テーマ：「${sp.topic || "未定"}」`);
          if (sp.materialUrl) {
            const ext = sp.materialUrl.split('.').pop().split('?')[0] || 'jpg';
            const dlName = `${(sp.seminarDate || '').replace(/-/g,'')}_${ch.name}_${sp.speakerName || ''}_顔写真.${ext}`;
            lines.push(`  顔写真：${sp.materialUrl}?download=${encodeURIComponent(dlName)}`);
          } else {
            lines.push(`  顔写真：※別途メール添付`);
          }
        });
      }
      lines.push(``);
    });
    lines.push(`ご不明点がございましたらご連絡ください。`);
    lines.push(`どうぞよろしくお願いいたします。`);
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`倫理法人会 南部地区合同事務局`);
    lines.push(`Mail：${JIMU.email}`);
    lines.push(`━━━━━━━━━━━━━━━`);
    return lines.join("\n");
  }, [selMonth, flyerData]);

  const emailSubject = useMemo(() => `【倫理法人会南部地区】${selMonth.replace("-","年")}月号チラシ流し込みデータ送付`, [selMonth]);

  const none = <span style={{ color:"#B0BEC5" }}>―</span>;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:700, color:"#1A3A6B" }}>📋 チラシ流し込みデータ管理</div>
        <select style={{ ...SEL, fontWeight:700 }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
          {months.map(m => <option key={m.value} value={m.value}>{m.isPast ? "📁 " : ""}{m.label}　{m.readyCount === 5 ? "✓完成" : `${m.readyCount}件`}</option>)}
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          <button style={BP} onClick={() => { navigator.clipboard?.writeText(buildLineText).catch(() => {}); showToast("LINEテキストをコピーしました！グループに貼り付けてください 📱"); }}>📱 LINE共有テキストをコピー</button>
          <button style={{ ...BP, background:"#1B5E20" }} onClick={() => setShowEmailModal(true)}>📧 印刷会社にメール送信</button>
        </div>
      </div>

      {/* 締め切りバナー */}
      <div style={{ ...CARD, marginBottom:12, borderLeft:`5px solid ${deadlineColor}`, padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#546E7A" }}>データ送付締め切り</div>
            <div style={{ fontSize:"clamp(16px,2.4vw,20px)", fontWeight:800, color: deadlineColor }}>
              {year}年{month}月10日
              <span style={{ fontSize:"clamp(13px,1.8vw,16px)", marginLeft:10 }}>
                {daysLeft < 0 ? `⚠ ${Math.abs(daysLeft)}日超過` : daysLeft === 0 ? "⚠ 本日締め切り！" : `残り ${daysLeft}日`}
              </span>
            </div>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"center" }}>
            <div style={{ fontSize:"clamp(20px,3vw,28px)", fontWeight:800, color: readyCount === 5 ? "#1B5E20" : "#E65100" }}>
              {readyCount}<span style={{ fontSize:"clamp(13px,1.8vw,16px)", fontWeight:400 }}>/5単会</span>
            </div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C" }}>データ揃い</div>
          </div>
        </div>
      </div>

      {/* 単会別 データ完成度 */}
      <div style={{ ...CARD, padding:"10px 14px", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:"#546E7A" }}>単会別 データ完成度</div>
          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#90A4AE" }}>— 「予定」欄に講話者の人数を入力してください</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
          {completeness.map(({ ch, pct, missing, ready, expected, registered }) => {
            const key = `${selMonth}_${ch.id}`;
            const bg  = pct === 100 ? "#E8F5E9" : pct === 0 ? "#FFEBEE" : "#FFF8E1";
            const bdr = pct === 100 ? "#A5D6A7" : pct === 0 ? "#EF9A9A" : "#FFE082";
            const col = pct === 100 ? "#2E7D32" : pct === 0 ? "#B71C1C" : "#E65100";
            return (
              <div key={ch.id} style={{ padding:"8px 10px", background:bg, borderRadius:7, border:`1px solid ${bdr}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:ch.color }}>{ch.name}</span>
                  <span style={{ fontSize:"clamp(13px,1.6vw,15px)", fontWeight:800, color:col }}>{pct}%</span>
                </div>
                {/* 予定人数 入力 */}
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                  <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#546E7A" }}>予定</span>
                  <input
                    type="number" min="1" max="10"
                    value={expectedCounts[key] || Math.max(registered, 1)}
                    onChange={e => setExpected(key, e.target.value)}
                    style={{ ...INP, width:44, textAlign:"center", padding:"2px 4px", fontSize:"clamp(13px,1.6vw,15px)", fontWeight:700 }}
                  />
                  <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#546E7A" }}>名中 {ready}名完成</span>
                </div>
                <div style={{ background:"#E0E0E0", borderRadius:3, height:6, overflow:"hidden" }}>
                  <div style={{ height:6, borderRadius:3, width:`${pct}%`, background: pct === 100 ? "#2E7D32" : pct === 0 ? "#B71C1C" : "#FF8F00", transition:"width .4s" }} />
                </div>
                {missing.length > 0 && (
                  <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginTop:3 }}>未：{missing.join("・")}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 一覧テーブル（複数講師対応） */}
      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["単会名","開催日","講師名（漢字）","ふりがな","所属法人会名","法人会役職","勤務先","勤務先役職名","テーマ","顔写真","状態","コピー"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {flyerData.map(({ ch, sps }) => {
                if (sps.length === 0) {
                  return (
                    <tr key={ch.id} className="hover-row">
                      <td style={TD}><span style={PILL(ch)}>{ch.name}</span><div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#90A4AE", marginTop:2 }}>{ch.dayName}</div></td>
                      <td style={TD}>{none}</td>
                      <td style={TD}><span style={{ color:"#B71C1C", fontWeight:700 }}>未登録</span></td>
                      {Array(9).fill(0).map((_, i) => <td key={i} style={TD}>{none}</td>)}
                    </tr>
                  );
                }
                return sps.map((sp, idx) => {
                  const ready   = sp.speakerName && sp.speakerKana && sp.topic && sp.materialUrl;
                  const partial = (sp.speakerName || sp.topic) && !ready;
                  const statusColor = ready ? "#2E7D32" : partial ? "#FF8F00" : "#B71C1C";
                  const statusBg    = ready ? "#E8F5E9"  : partial ? "#FFF8E1" : "#FFEBEE";
                  const statusLabel = ready ? "✓ 完成"   : partial ? "▲ 不足あり" : "✗ 未登録";
                  return (
                    <tr key={sp.id} className="hover-row" style={{ borderTop: idx === 0 ? undefined : "1px dashed #F0F4F8" }}>
                      {idx === 0 ? (
                        <td style={{ ...TD, verticalAlign:"top" }} rowSpan={sps.length}>
                          <span style={PILL(ch)}>{ch.name}</span>
                          <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#90A4AE", marginTop:2 }}>{ch.dayName}</div>
                          {sps.length > 1 && <div style={{ marginTop:4, fontSize:"clamp(12px,1.4vw,14px)", color:ch.color, fontWeight:700 }}>{sps.length}名</div>}
                        </td>
                      ) : null}
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)", whiteSpace:"nowrap" }}>{sp.seminarDate || none}</td>
                      <td style={{ ...TD, fontWeight:700, fontSize:"clamp(12px,1.4vw,14px)", whiteSpace:"nowrap" }}>{sp.speakerName || none}</td>
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)", color:"#546E7A" }}>{sp.speakerKana || none}</td>
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)" }}>{sp.speakerUnit || none}</td>
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)" }}>{sp.role || none}</td>
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)" }}>{sp.company || none}</td>
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)" }}>{sp.companyRole || none}</td>
                      <td style={{ ...TD, fontSize:"clamp(12px,1.4vw,14px)", maxWidth:160 }}>{sp.topic ? `「${sp.topic}」` : none}</td>
                      <td style={TD}>
                        {sp.materialUrl ? (
                          <a href={sp.materialUrl} target="_blank" rel="noreferrer" style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#1565C0", display:"flex", alignItems:"center", gap:6, textDecoration:"none", whiteSpace:"nowrap" }}>
                            {(/\.(jpg|jpeg|png|webp)$/i.test(sp.materialUrl) || sp.materialUrl.includes('/object/public/')) ? (
                              <img loading="lazy" src={sp.materialUrl} alt={sp.speakerName} style={{ width:40, height:40, objectFit:"cover", borderRadius:4, border:"1px solid #CFD8DC", flexShrink:0 }} onError={e => { e.target.style.display="none"; }} />
                            ) : null}
                            <span>📁 開く</span>
                          </a>
                        ) : <span style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#B0BEC5" }}>📭 未設定</span>}
                      </td>
                      <td style={TD}>
                        <span style={{ fontSize:"clamp(12px,1.4vw,14px)", fontWeight:700, color:statusColor, background:statusBg, padding:"3px 8px", borderRadius:4, whiteSpace:"nowrap" }}>{statusLabel}</span>
                        {partial && (
                          <div style={{ marginTop:4, fontSize:"clamp(12px,1.4vw,14px)", color:"#FF8F00", lineHeight:1.6 }}>
                            {!sp.speakerKana && <div>• ふりがな未入力</div>}
                            {!sp.topic && <div>• テーマ未入力</div>}
                            {!sp.materialUrl && <div>• 顔写真未設定</div>}
                          </div>
                        )}
                      </td>
                      <td style={TD}>
                        <button style={{ fontSize:"clamp(12px,1.4vw,14px)", background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, padding:"3px 8px", cursor:"pointer", color:"#1565C0", fontWeight:700, whiteSpace:"nowrap" }}
                          onClick={() => {
                            const lines = [
                              `■ ${ch.name}（${ch.dayName}）`,
                              `  開催日：${sp.seminarDate}`,
                              `  講師：${sp.speakerName}　${[sp.speakerUnit, sp.role, sp.company, sp.companyRole].filter(Boolean).join("　")}`,
                              `  テーマ：「${sp.topic}」`,
                              `  写真：${sp.materialUrl || "※未受領"}`,
                            ];
                            navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
                            showToast(`${ch.name}のデータをコピーしました 📋`);
                          }}>📋 コピー</button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding:"10px 14px", background:"#FFF8E1", borderRadius:6, fontSize:"clamp(12px,1.4vw,14px)", color:"#E65100", display:"flex", gap:8, alignItems:"flex-start", marginTop:8 }}>
        <span style={{ fontSize:"clamp(16px,2.4vw,20px)" }}>💡</span>
        <div>
          <strong>顔写真の登録方法</strong>：講師管理タブの「編集」→「📤 アップロード」ボタンで直接アップロード、またはURLを入力してください。<br/>
          <span style={{ color:"#78909C" }}>写真URLが未設定の場合は「別途メール添付」として送付文に記載されます。</span>
        </div>
      </div>

      {/* 印刷会社メールモーダル */}
      {showEmailModal && (
        <div style={OV} onClick={() => setShowEmailModal(false)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label="印刷会社へのメール送信" style={{ ...MOD, maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div style={MH}>📧 印刷会社へのメール送信</div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>印刷会社のメールアドレス</div>
            <input style={{ ...INP, width:"100%", marginBottom:12 }} placeholder="print@example.com" value={printEmail} onChange={e => savePrintEmail(e.target.value)} />
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>件名</div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", background:"#F5F5F5", padding:"7px 11px", borderRadius:6, marginBottom:10 }}>{emailSubject}</div>
            <div style={{ fontSize:"clamp(12px,1.4vw,14px)", color:"#78909C", marginBottom:3, fontWeight:600 }}>本文プレビュー</div>
            <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:"clamp(12px,1.4vw,14px)", lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:280, overflowY:"auto", marginBottom:12 }}>{buildEmailBody}</pre>
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...BP, flex:1 }} onClick={() => { window.open(`mailto:${printEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(buildEmailBody)}`, "_blank"); setShowEmailModal(false); showToast("メールアプリを開きました 📧"); }}>✉ メールアプリで開く</button>
              <button style={{ ...BG, flex:1 }} onClick={() => { navigator.clipboard?.writeText(`件名：${emailSubject}\n\n${buildEmailBody}`).catch(() => {}); setShowEmailModal(false); showToast("メール文をコピーしました 📋"); }}>📋 コピーして送信</button>
              <button style={BC} onClick={() => setShowEmailModal(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
