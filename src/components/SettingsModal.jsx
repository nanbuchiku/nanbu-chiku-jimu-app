import React, { useState, useEffect } from 'react';
import { CHAPTERS } from '../constants';
import { OV, MH, BP, BC, INP } from '../styles';

const DEFAULTS = ch => ({
  name:            ch.name      || '',
  msVenue:         ch.venue     || '',
  msAddress:       ch.address   || '',
  msStation:       '',
  msMapUrl:        ch.mapUrl    || '',
  msParking:       '',
  msVenueTel:      ch.venueTel  || '',
  kisoVenue:       '',
  kisoAddress:     '',
  kisoMapUrl:      '',
  kisoTextChapter: '',
  hotelName:       '',
  hotelTel:        '',
  hotelAddress:    '',
  hotelStation:    '',
  hotelParking:    '',
  contactPerson:   ch.staff     || '',
});

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:'#546E7A', background:'#ECEFF1',
      padding:'5px 10px', borderRadius:4, margin:'12px 0 6px' }}>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
      <div style={{ width:140, fontSize:11, color:'#546E7A', flexShrink:0, textAlign:'right', lineHeight:1.3 }}>
        {label}
      </div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  );
}

function Inp({ value, onChange, placeholder, type }) {
  return (
    <input type={type || 'text'} value={value || ''} placeholder={placeholder || ''}
      onChange={e => onChange(e.target.value)}
      style={{ ...INP, width:'100%', fontSize:12, boxSizing:'border-box' }} />
  );
}

export default function SettingsModal({ chapterSettings, onSave, onClose, saving }) {
  const [activeId, setActiveId] = useState(CHAPTERS[0].id);
  const [form, setForm] = useState({});

  useEffect(() => {
    const ch = CHAPTERS.find(c => c.id === activeId);
    setForm({ ...DEFAULTS(ch), ...(chapterSettings[activeId] || {}) });
  }, [activeId, chapterSettings]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const activeCh = CHAPTERS.find(c => c.id === activeId);

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="単会設定"
        onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:10, width:'100%', maxWidth:620,
          maxHeight:'92vh', display:'flex', flexDirection:'column', padding:20, boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>

        <div style={{ ...MH, marginBottom:14 }}>⚙ 単会設定</div>

        {/* Chapter tabs */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
          {CHAPTERS.map(ch => (
            <button key={ch.id} onClick={() => setActiveId(ch.id)}
              style={{ padding:'5px 13px', fontSize:12, fontWeight:700, borderRadius:20, border:'none',
                cursor:'pointer', transition:'background .15s',
                background: activeId === ch.id ? ch.color : '#ECEFF1',
                color:      activeId === ch.id ? '#fff'   : '#546E7A' }}>
              {ch.short || ch.name}
            </button>
          ))}
        </div>

        <div style={{ fontSize:12, fontWeight:700, color: activeCh.color, marginBottom:10,
          padding:'5px 10px', background: activeCh.light, borderRadius:6 }}>
          {activeCh.name}単会 の設定
        </div>

        {/* Scrollable form */}
        <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>

          <SectionTitle>🏛 モーニングセミナー情報</SectionTitle>
          <Row label="単会名">
            <Inp value={form.name} onChange={v => set('name', v)} placeholder={activeCh.name} />
          </Row>
          <Row label="MS会場名">
            <Inp value={form.msVenue} onChange={v => set('msVenue', v)} placeholder={activeCh.venue} />
          </Row>
          <Row label="MS会場住所">
            <Inp value={form.msAddress} onChange={v => set('msAddress', v)} placeholder={activeCh.address} />
          </Row>
          <Row label="MS最寄駅">
            <Inp value={form.msStation} onChange={v => set('msStation', v)} placeholder="例: 武蔵浦和駅 徒歩5分" />
          </Row>
          <Row label="MS会場地図URL">
            <Inp value={form.msMapUrl} onChange={v => set('msMapUrl', v)} placeholder={activeCh.mapUrl} />
          </Row>
          <Row label="駐車場情報">
            <Inp value={form.msParking} onChange={v => set('msParking', v)} placeholder="例: 無料駐車場あり（10台）" />
          </Row>
          <Row label="会場連絡先TEL">
            <Inp value={form.msVenueTel} onChange={v => set('msVenueTel', v)} placeholder={activeCh.venueTel || '例: 048-000-0000'} />
          </Row>

          <SectionTitle>📚 倫理経営基礎講座</SectionTitle>
          <Row label="基礎講座会場">
            <Inp value={form.kisoVenue} onChange={v => set('kisoVenue', v)} placeholder="例: ○○会館" />
          </Row>
          <Row label="基礎講座住所">
            <Inp value={form.kisoAddress} onChange={v => set('kisoAddress', v)} placeholder="例: さいたま市○○区..." />
          </Row>
          <Row label="基礎講座会場地図URL">
            <Inp value={form.kisoMapUrl} onChange={v => set('kisoMapUrl', v)} placeholder="https://maps.app.goo.gl/..." />
          </Row>
          <Row label={<>倫理経営基礎講座<br />テキスト 第<span style={{fontWeight:700}}>〜</span>講</>}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ fontSize:12, color:'#37474F' }}>第</span>
              <input type="number" min="1" max="20" value={form.kisoTextChapter || ''}
                onChange={e => set('kisoTextChapter', e.target.value)}
                placeholder="3"
                style={{ ...INP, width:60, fontSize:13, fontWeight:700, textAlign:'center' }} />
              <span style={{ fontSize:12, color:'#37474F' }}>講</span>
            </div>
          </Row>

          <SectionTitle>🏨 ホテル情報</SectionTitle>
          <Row label="ホテル名">
            <Inp value={form.hotelName} onChange={v => set('hotelName', v)} placeholder="例: 東横イン志木東口" />
          </Row>
          <Row label="連絡先TEL">
            <Inp value={form.hotelTel} onChange={v => set('hotelTel', v)} placeholder="例: 048-000-0000" />
          </Row>
          <Row label="ホテル住所">
            <Inp value={form.hotelAddress} onChange={v => set('hotelAddress', v)} placeholder="例: 新座市○○..." />
          </Row>
          <Row label="ホテル最寄駅">
            <Inp value={form.hotelStation} onChange={v => set('hotelStation', v)} placeholder="例: 志木駅 徒歩2分" />
          </Row>
          <Row label="ホテル駐車場情報">
            <Inp value={form.hotelParking} onChange={v => set('hotelParking', v)} placeholder="例: 有料駐車場あり" />
          </Row>

          <SectionTitle>👤 担当者</SectionTitle>
          <Row label="単会担当者名">
            <Inp value={form.contactPerson} onChange={v => set('contactPerson', v)} placeholder={activeCh.staff || '例: 山田 太郎'} />
          </Row>

          <div style={{ height:8 }} />
        </div>

        <div style={{ display:'flex', gap:8, marginTop:14, paddingTop:10, borderTop:'1px solid #ECEFF1' }}>
          <button style={{ ...BP, flex:1, opacity: saving ? .6 : 1 }} disabled={saving}
            onClick={() => onSave(activeId, form)}>
            {saving ? '保存中...' : '💾 この単会の設定を保存'}
          </button>
          <button style={BC} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
