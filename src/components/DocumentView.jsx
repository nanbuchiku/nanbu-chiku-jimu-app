import React, { useState, useEffect, useMemo } from 'react';
import { JIMU } from '../constants';
import { getChapter, getSeminarType, formatDate } from '../utils';
import { BP, SEL } from '../styles';

function DocSection({ title, color, children }) {
  const c = color || "#1A3A6B";
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:700, color:c, marginBottom:4, letterSpacing:"0.05em" }}>{title}</div>
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
      <th style={{ width:120, padding:"6px 10px", background:"#F5F6FA", border:"1px solid #D0D7E2", fontSize:10, fontWeight:700, color:c, textAlign:"left", verticalAlign:"middle", whiteSpace:"nowrap" }}>{label}</th>
      <td style={{ padding:"6px 10px", border:"1px solid #D0D7E2", fontSize:11, color:"#263238", background:"#fff", wordBreak:"break-all" }}>{value}</td>
    </tr>
  );
}

export default function DocumentView({ speakers, docSpeaker, setDocSpeaker, today }) {
  const [sel, setSel] = useState(docSpeaker?.id || "");
  useEffect(() => { if (docSpeaker?.id) setSel(docSpeaker.id); }, [docSpeaker?.id]);
  const sortedSpeakers = useMemo(
    () => [...speakers].sort((a, b) => new Date(a.seminarDate) - new Date(b.seminarDate)),
    [speakers]
  );
  const sp = speakers.find(x => x.id === sel);
  const ch = sp ? getChapter(sp.chapterId) : null;

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
        {sp && <button style={BP} onClick={() => window.print()}>🖨 印刷 / PDF保存</button>}
      </div>

      {sp && ch ? (() => {
        const st = getSeminarType(sp.seminarType || "ms");
        return (
          <div id="print-doc" style={{
            background:"#fff", maxWidth:700, margin:"0 auto",
            padding:"32px 40px 24px", boxShadow:"0 2px 16px rgba(0,0,0,.10)",
            border:"1px solid #D0D7E2", borderRadius:4, position:"relative", overflow:"hidden",
            fontFamily:"'Hiragino Sans','Meiryo',sans-serif"
          }}>
            <div style={{ position:"absolute", top:0, right:0, width:0, height:0,
              borderStyle:"solid", borderWidth:"0 72px 72px 0",
              borderColor:`transparent ${st.color} transparent transparent` }} />
            <div style={{ position:"absolute", top:10, right:7, fontSize:13, fontWeight:800,
              color:"#fff", zIndex:2, lineHeight:1.1, textAlign:"right" }}>{st.short}</div>

            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:11, color:"#546E7A", marginBottom:6, letterSpacing:"0.1em" }}>倫理法人会　南部地区事務局</div>
              <div style={{ display:"inline-block", fontSize:15, fontWeight:700, color:st.color,
                border:`2px solid ${st.color}`, padding:"4px 24px", marginBottom:10, letterSpacing:"0.15em" }}>
                {st.label}
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:"#1A1A2E", letterSpacing:"0.06em", marginBottom:10 }}>講師依頼確認書</div>
              <div style={{ height:1, background:`linear-gradient(to right, transparent, ${st.color}, transparent)`, margin:"0 40px 10px" }} />
              <div style={{ fontSize:11, color:"#78909C", letterSpacing:"0.05em" }}>受付日：　　　　年　　月　　日　　担当：</div>
            </div>

            <DocSection title="① 開催情報" color={st.color}>
              <DocRow label="講話単会名"      value={ch.name}                      color={st.color} />
              <DocRow label="開催曜日・時間"  value={`${ch.dayName}　${ch.time}`}  color={st.color} />
              <DocRow label="開催場所"        value={ch.venue}                     color={st.color} />
              <DocRow label="会場住所"        value={ch.address}                   color={st.color} />
              <DocRow label="会場地図"        color={st.color}
                value={<a href={ch.mapUrl} target="_blank" rel="noreferrer" style={{ color:"#1565C0", fontSize:11 }}>Googleマップで開く →</a>} />
              <DocRow label="会場連絡先"      value={ch.venueTel || "—"}           color={st.color} />
              {ch.staff && <DocRow label="担当者" value={ch.staff}                 color={st.color} />}
            </DocSection>

            <DocSection title="② 講師情報" color={st.color}>
              <DocRow label="お名前（漢字）"     value={`${sp.speakerName}　様`}  color={st.color} />
              <DocRow label="お名前（ふりがな）" value={sp.speakerKana || ""}     color={st.color} />
              <DocRow label="所属法人会名"       value={sp.company || ""}         color={st.color} />
              <DocRow label="役職名"             value={sp.role || ""}            color={st.color} />
              <DocRow label="連絡先TEL"          value={sp.phone || ""}           color={st.color} />
              <DocRow label="メールアドレス"     value={sp.email || ""}           color={st.color} />
            </DocSection>

            <DocSection title="③ 講話内容" color={st.color}>
              <DocRow label="タイトル" value={sp.topic ? `「${sp.topic}」` : ""} color={st.color} />
              <DocRow label="内容要約" value="" color={st.color} />
            </DocSection>

            <DocSection title="④ 交通・当日の準備" color={st.color}>
              <DocRow label="交通手段"           value="□ お車　□ 電車　□ その他"                               color={st.color} />
              <DocRow label="資料の有無"         value="□ あり　□ なし"                                         color={st.color} />
              <DocRow label="印刷の要否"         value="□ 要（単会で印刷）　□ 不要（持参）"                      color={st.color} />
              <DocRow label="単会で準備するもの" value="□ プロジェクタ　□ パソコン　□ ホワイトボード　□ その他　□ 無し" color={st.color} />
            </DocSection>

            <DocSection title="⑤ 宿泊情報" color={st.color}>
              <DocRow label="前泊要否"       value="□ 要　□ 不要"  color={st.color} />
              <DocRow label="お迎えの要否"   value="□ 要　□ 不要"  color={st.color} />
              <DocRow label="お部屋のタイプ" value="□ 禁煙　□ 喫煙" color={st.color} />
              <DocRow label="領収証の宛名"   value=""               color={st.color} />
              <DocRow label="郵便番号"       value=""               color={st.color} />
              <DocRow label="住所"           value=""               color={st.color} />
            </DocSection>

            <DocSection title="⑥ 顔写真・資料" color={st.color}>
              <DocRow label="顔写真"           value="□ フォームアップ済　□ メール送付済　□ 未受領" color={st.color} />
              <DocRow label="講話資料"         value="□ フォームアップ済　□ メール送付済　□ 未受領" color={st.color} />
              <DocRow label="顔写真の使用範囲" value=""                                               color={st.color} />
            </DocSection>

            <DocSection title="⑦ 備考・特記事項" color="#546E7A">
              <tr>
                <td colSpan={2} style={{ padding:"8px 10px", border:"1px solid #D0D7E2",
                  fontSize:11, color:"#263238", background:"#fff", minHeight:52, height:52 }}>
                  {sp.notes || ""}
                </td>
              </tr>
            </DocSection>

            <div style={{ marginTop:16, paddingTop:10, borderTop:`2px solid ${st.color}`,
              fontSize:10.5, color:"#546E7A", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
              <div>
                <span style={{ fontWeight:700 }}>【事務局連絡先】　倫理法人会　南部地区合同事務局</span>
                {JIMU.tel && <span>　TEL：{JIMU.tel}</span>}
                <span>　Mail：<span style={{ color:"#1565C0" }}>{JIMU.email}</span></span>
              </div>
              <div style={{ color:"#90A4AE" }}>確認日　　年　　月　　日</div>
            </div>
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
}
