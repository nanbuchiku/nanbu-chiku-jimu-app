import React, { useState, useMemo, useCallback, memo } from 'react';
import { CHAPTERS, JIMU } from '../constants';
import { OV, MOD, MH, CARD, BP, BC, BG, INP, TBL, TH, TD, SEL, PILL } from '../styles';

export default memo(function FlyerView({ speakers, today, showToast }) {
  const months = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 3 + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const monthSpeakers = speakers.filter(s => (!s.seminarType || s.seminarType === "ms") && s.seminarDate?.startsWith(ym) && s.status !== "cancelled");
    const ready = monthSpeakers.filter(s => s.speakerName && s.topic && s.materialUrl).length;
    const isPast = d < new Date(today.getFullYear(), today.getMonth(), 1);
    return { value: ym, label: `${d.getFullYear()}年${d.getMonth()+1}月号`, readyCount: ready, isPast };
  }), [today, speakers]);
  const [selMonth, setSelMonth] = useState(() => months[4].value);
  const [printEmail, setPrintEmail] = useState(() => localStorage.getItem('flyer_printEmail') || "");
  const [showEmailModal, setShowEmailModal] = useState(false);

  const savePrintEmail = useCallback(v => {
    setPrintEmail(v);
    try { localStorage.setItem('flyer_printEmail', v); } catch {}
  }, []);

  const { year, month, deadline, daysLeft, deadlineColor } = useMemo(() => {
    const [y, m] = selMonth.split("-").map(Number);
    const dl = new Date(y, m - 1, 10);
    const days = Math.ceil((dl - today) / 86400000);
    return { year: y, month: m, deadline: dl, daysLeft: days, deadlineColor: days < 0 ? "#B71C1C" : days <= 3 ? "#E65100" : days <= 7 ? "#FF8F00" : "#2E7D32" };
  }, [selMonth, today]);

  const flyerData = useMemo(() => CHAPTERS.map(ch => {
    const sp = speakers.find(s =>
      (!s.seminarType || s.seminarType === "ms") &&
      s.chapterId === ch.id &&
      s.seminarDate &&
      s.seminarDate.startsWith(selMonth) &&
      s.status !== "cancelled"
    );
    return { ch, sp };
  }), [speakers, selMonth]);

  const readyCount = useMemo(() => flyerData.filter(({ sp }) => sp && sp.speakerName && sp.topic && sp.materialUrl).length, [flyerData]);

  const buildLineText = useMemo(() => {
    const lines = [
      `【${selMonth.replace("-","年")}月号　チラシ流し込みデータ】`,
      `締め切り：${year}年${month}月10日`,
      ``,
    ];
    flyerData.forEach(({ ch, sp }) => {
      lines.push(`■ ${ch.name}（${ch.dayName} ${ch.time}）`);
      if (sp) {
        lines.push(`  開催日：${sp.seminarDate}`);
        lines.push(`  講師：${sp.speakerName}（${sp.speakerKana || "ふりがな未入力"}）`);
        lines.push(`  所属：${sp.company}　${sp.role}`);
        lines.push(`  テーマ：「${sp.topic}」`);
        lines.push(`  写真：${sp.materialUrl || "※未受領"}`);
      } else {
        lines.push(`  ※講師未登録`);
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
    flyerData.forEach(({ ch, sp }) => {
      lines.push(`▼ ${ch.name}単会（${ch.dayName} ${ch.time}）`);
      if (sp) {
        lines.push(`  開催日：${sp.seminarDate}`);
        lines.push(`  講師名：${sp.speakerName}`);
        lines.push(`  ふりがな：${sp.speakerKana || "―"}`);
        lines.push(`  所属単会：${sp.speakerUnit || "―"}`);
        lines.push(`  企業名：${sp.company}`);
        lines.push(`  役職・役目：${sp.role}`);
        lines.push(`  テーマ：「${sp.topic}」`);
        lines.push(`  顔写真：${sp.materialUrl || "※別途メール添付"}`);
      } else {
        lines.push(`  ※後日送付`);
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

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#1A3A6B" }}>📋 チラシ流し込みデータ管理</div>
        <select style={{ ...SEL, fontWeight:700 }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
          {months.map(m => <option key={m.value} value={m.value}>{m.isPast ? "📁 " : ""}{m.label}　{m.readyCount === 5 ? "✓完成" : `${m.readyCount}/5`}</option>)}
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          <button style={BP} onClick={() => { navigator.clipboard?.writeText(buildLineText).catch(() => {}); showToast("LINEテキストをコピーしました！グループに貼り付けてください 📱"); }}>📱 LINE共有テキストをコピー</button>
          <button style={{ ...BP, background:"#1B5E20" }} onClick={() => setShowEmailModal(true)}>📧 印刷会社にメール送信</button>
        </div>
      </div>

      <div style={{ ...CARD, marginBottom:12, borderLeft:`5px solid ${deadlineColor}`, padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:11, color:"#546E7A" }}>データ送付締め切り</div>
            <div style={{ fontSize:16, fontWeight:800, color: deadlineColor }}>
              {year}年{month}月10日
              <span style={{ fontSize:13, marginLeft:10 }}>
                {daysLeft < 0 ? `⚠ ${Math.abs(daysLeft)}日超過` : daysLeft === 0 ? "⚠ 本日締め切り！" : `残り ${daysLeft}日`}
              </span>
            </div>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"center" }}>
            <div style={{ fontSize:24, fontWeight:800, color: readyCount === 5 ? "#1B5E20" : "#E65100" }}>{readyCount}<span style={{ fontSize:13, fontWeight:400 }}>/5単会</span></div>
            <div style={{ fontSize:11, color:"#78909C" }}>データ揃い</div>
          </div>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ overflowX:"auto" }}>
          <table style={TBL}>
            <thead>
              <tr>{["単会名","開催日","講師名（漢字）","ふりがな","所属単会","企業名","役職・役目","テーマ","顔写真","状態","コピー"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {flyerData.map(({ ch, sp }) => {
                const ready   = sp && sp.speakerName && sp.speakerKana && sp.topic && sp.materialUrl;
                const partial = sp && (sp.speakerName || sp.topic) && !ready;
                const statusColor = ready ? "#2E7D32" : partial ? "#FF8F00" : "#B71C1C";
                const statusBg    = ready ? "#E8F5E9" : partial ? "#FFF8E1" : "#FFEBEE";
                const statusLabel = ready ? "✓ 完成" : partial ? "▲ 不足あり" : "✗ 未登録";
                const none = <span style={{ color:"#B0BEC5" }}>―</span>;
                return (
                  <tr key={ch.id} className="hover-row">
                    <td style={TD}><span style={PILL(ch)}>{ch.name}</span><div style={{ fontSize:10, color:"#90A4AE", marginTop:2 }}>{ch.dayName}</div></td>
                    <td style={{ ...TD, fontSize:12, whiteSpace:"nowrap" }}>{sp?.seminarDate || none}</td>
                    <td style={{ ...TD, fontWeight:700, fontSize:12, whiteSpace:"nowrap" }}>{sp?.speakerName || <span style={{ color:"#B71C1C" }}>未登録</span>}</td>
                    <td style={{ ...TD, fontSize:11, color:"#546E7A" }}>{sp?.speakerKana || none}</td>
                    <td style={{ ...TD, fontSize:11 }}>{sp?.speakerUnit || none}</td>
                    <td style={{ ...TD, fontSize:11 }}>{sp?.company || none}</td>
                    <td style={{ ...TD, fontSize:11 }}>{sp?.role || none}</td>
                    <td style={{ ...TD, fontSize:11, maxWidth:160 }}>{sp?.topic ? `「${sp.topic}」` : none}</td>
                    <td style={TD}>
                      {sp?.materialUrl ? (
                        <a href={sp.materialUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#1565C0", display:"flex", alignItems:"center", gap:4, textDecoration:"none", whiteSpace:"nowrap" }}>
                          <span>📁</span>フォルダを開く
                        </a>
                      ) : <span style={{ fontSize:11, color:"#B0BEC5" }}>📭 未設定</span>}
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize:11, fontWeight:700, color:statusColor, background:statusBg, padding:"3px 8px", borderRadius:4, whiteSpace:"nowrap" }}>{statusLabel}</span>
                      {partial && (
                        <div style={{ marginTop:4, fontSize:9, color:"#FF8F00", lineHeight:1.6 }}>
                          {!sp.speakerKana && <div>• ふりがな未入力</div>}
                          {!sp.topic && <div>• テーマ未入力</div>}
                          {!sp.materialUrl && <div>• 顔写真URL未設定</div>}
                        </div>
                      )}
                    </td>
                    <td style={TD}>
                      {sp && (
                        <button style={{ fontSize:10, background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, padding:"3px 8px", cursor:"pointer", color:"#1565C0", fontWeight:700, whiteSpace:"nowrap" }}
                          onClick={() => {
                            const lines = [
                              `■ ${ch.name}（${ch.dayName}）`,
                              `  開催日：${sp.seminarDate}`,
                              `  講師：${sp.speakerName}　${sp.company}　${sp.role}`,
                              `  テーマ：「${sp.topic}」`,
                              `  写真：${sp.materialUrl || "※未受領"}`,
                            ];
                            navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
                            showToast(`${ch.name}のデータをコピーしました 📋`);
                          }}>📋 コピー</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding:"10px 14px", background:"#FFF8E1", borderRadius:6, fontSize:11, color:"#E65100", display:"flex", gap:8, alignItems:"flex-start" }}>
        <span style={{ fontSize:16 }}>💡</span>
        <div>
          <strong>顔写真フォルダURLの登録方法</strong>：講師管理タブの「編集」→「講話資料URL」欄にGoogleドライブのフォルダURLを入力してください。<br/>
          <span style={{ color:"#78909C" }}>写真URLが未設定の場合は「別途メール添付」として送付文に記載されます。</span>
        </div>
      </div>

      {showEmailModal && (
        <div style={OV} onClick={() => setShowEmailModal(false)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label="印刷会社へのメール送信" style={{ ...MOD, maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div style={MH}>📧 印刷会社へのメール送信</div>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>印刷会社のメールアドレス</div>
            <input style={{ ...INP, width:"100%", marginBottom:12 }} placeholder="print@example.com" value={printEmail} onChange={e => savePrintEmail(e.target.value)} />
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>件名</div>
            <div style={{ fontSize:12, background:"#F5F5F5", padding:"7px 11px", borderRadius:6, marginBottom:10 }}>{emailSubject}</div>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>本文プレビュー</div>
            <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:11, lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:280, overflowY:"auto", marginBottom:12 }}>{buildEmailBody}</pre>
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
