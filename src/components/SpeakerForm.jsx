import React, { useState } from 'react';
import { CHAPTERS, STATUS, SEMINAR_TYPES } from '../constants';
import { getChapter, getSeminarType } from '../utils';
import { OV, MOD, MH, BP, BC, INP } from '../styles';

const BLANK = { chapterId:"kawaguchi", speakerName:"", speakerKana:"", speakerUnit:"", company:"", role:"", seminarDate:"", topic:"", status:"pending", phone:"", email:"", requestDate:"", notes:"", venue:"", seminarType:"ms", lodging:"不要", printRequired:"不要", materialUrl:"" };

export default function SpeakerForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => initial || { ...BLANK, requestDate: new Date().toISOString().slice(0,10) });
  const [err, setErr] = useState("");
  const set = (k, v) => {
    setErr("");
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'seminarType' || k === 'chapterId') {
        const newSt = getSeminarType(k === 'seminarType' ? v : f.seminarType);
        const newCh = getChapter(k === 'chapterId' ? v : f.chapterId);
        if (newSt?.venueFixed && newCh) next.venue = newCh.venue;
      }
      return next;
    });
  };
  const ch = getChapter(form.chapterId);
  const st = getSeminarType(form.seminarType || "ms");

  return (
    <div style={OV} onClick={onClose}>
      <div style={{ ...MOD, maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div style={{ ...MH, borderBottomColor: st.color }}>{initial ? "講師情報を編集" : "新規講師登録"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
          {[
            { l:"種別 *",      k:"seminarType", t:"select", o: SEMINAR_TYPES.map(t => ({ v:t.id, l:t.label })) },
            { l:"単会",        k:"chapterId",   t:"select", o: CHAPTERS.map(c => ({ v:c.id, l:c.name })) },
            { l:"開催日 *",    k:"seminarDate", t:"date" },
            { l:"講師名 *",    k:"speakerName", t:"text",  p:"山田 太郎" },
            { l:"ふりがな",    k:"speakerKana", t:"text",  p:"やまだ たろう" },
            { l:"所属単会",    k:"speakerUnit", t:"text",  p:"川口単会" },
            { l:"企業名",      k:"company",     t:"text",  p:"株式会社○○" },
            { l:"役職・役目",  k:"role",        t:"text",  p:"会長・専任幹事など" },
            { l:"メール *",    k:"email",       t:"email", p:"email@example.com" },
            { l:"電話",        k:"phone",       t:"text",  p:"090-0000-0000" },
            { l:"ステータス",  k:"status",      t:"select", o: Object.entries(STATUS).map(([k, v]) => ({ v:k, l:v.label })) },
            { l:"依頼日",      k:"requestDate", t:"date" },
          ].map(({ l, k, t, p, o }) => (
            <div key={k}>
              <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>{l}</div>
              {t === "select" ? (
                <select style={{ ...INP, width:"100%" }} value={form[k] || ""} onChange={e => set(k, e.target.value)}>
                  {o.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
              ) : (
                <input type={t} style={{ ...INP, width:"100%" }} placeholder={p} value={form[k] || ""} onChange={e => set(k, e.target.value)} />
              )}
            </div>
          ))}

          <div>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>前泊・宿泊</div>
            <select style={{ ...INP, width:"100%" }} value={form.lodging || "不要"} onChange={e => set("lodging", e.target.value)}>
              <option value="不要">不要</option>
              <option value="あり（前泊）">あり（前泊）</option>
              <option value="あり（当日のみ）">あり（当日のみ）</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>資料印刷</div>
            <select style={{ ...INP, width:"100%" }} value={form.printRequired || "不要"} onChange={e => set("printRequired", e.target.value)}>
              <option value="不要">不要（持参 or なし）</option>
              <option value="あり">あり（単会で印刷）</option>
            </select>
          </div>

          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>
              開催場所
              {st.venueFixed && <span style={{ fontSize:10, color:"#90A4AE", marginLeft:6 }}>※ 単会マスターから自動取得</span>}
            </div>
            {st.venueFixed ? (
              <div style={{ ...INP, background:"#F5F5F5", color:"#90A4AE", cursor:"not-allowed", display:"flex", alignItems:"center" }}>
                {ch.venue}
              </div>
            ) : (
              <input type="text" style={{ ...INP, width:"100%" }} placeholder="会場名を入力" value={form.venue || ""} onChange={e => set("venue", e.target.value)} />
            )}
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>テーマ</div>
            <input type="text" style={{ ...INP, width:"100%" }} placeholder="セミナーテーマ" value={form.topic || ""} onChange={e => set("topic", e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>顔写真・資料フォルダURL</div>
            <input type="url" style={{ ...INP, width:"100%" }} placeholder="https://drive.google.com/..." value={form.materialUrl || ""} onChange={e => set("materialUrl", e.target.value)} />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>備考</div>
            <textarea style={{ ...INP, width:"100%", minHeight:54, resize:"vertical" }} value={form.notes || ""} onChange={e => set("notes", e.target.value)} />
          </div>

          <div style={{ gridColumn:"1/-1", borderTop:"2px dashed #E0E0E0", paddingTop:12, marginTop:4 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#546E7A", marginBottom:8 }}>📝 講話後メモ（終了後に記入）</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>お酒を飲むか</div>
                <select style={{ ...INP, width:"100%" }} value={form.drinksAlcohol || ""} onChange={e => set("drinksAlcohol", e.target.value)}>
                  <option value="">未確認</option>
                  <option value="飲む">飲む</option>
                  <option value="飲まない">飲まない</option>
                  <option value="少量なら">少量なら</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>栞・第何条</div>
                <select style={{ ...INP, width:"100%" }} value={form.shioriArticle || ""} onChange={e => set("shioriArticle", e.target.value)}>
                  <option value="">未記入</option>
                  {Array.from({length:17},(_,i)=>`第${i+1}条`).map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={{ fontSize:11, color:"#78909C", marginBottom:3, fontWeight:600 }}>講話内容・特記事項・次回への申し送り</div>
                <textarea style={{ ...INP, width:"100%", minHeight:80, resize:"vertical" }} placeholder="講話の内容、参加者の反応、次回依頼時の注意点など自由に記入" value={form.postNotes || ""} onChange={e => set("postNotes", e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        {err && <div style={{ marginTop:10, padding:"8px 12px", background:"#FFEBEE", border:"1px solid #FFCDD2", borderRadius:6, fontSize:12, color:"#B71C1C", fontWeight:600 }}>⚠ {err}</div>}
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button style={{ ...BP, opacity: saving ? .6 : 1 }} disabled={saving} onClick={() => {
            if (!form.speakerName) return setErr("講師名は必須です");
            if (!form.seminarDate) return setErr("開催日は必須です");
            onSave(form);
          }}>
            {saving ? "⏳ 保存中..." : initial ? "💾 変更を保存" : "✓ 登録する"}
          </button>
          <button style={BC} disabled={saving} onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
