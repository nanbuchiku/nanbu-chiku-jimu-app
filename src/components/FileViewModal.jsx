import React, { useState } from 'react';
import { JIMU } from '../constants';
import { getChapter, formatDate } from '../utils';
import { OV, MOD, MH, BP, BC, BG } from '../styles';

const isImage = url => /\.(jpg|jpeg|png|webp|gif)$/i.test(url?.split('?')[0] || '');
const isPDF   = url => /\.pdf$/i.test(url?.split('?')[0] || '');

function downloadFile(url, filename) {
  const dlUrl = url.includes('supabase.co')
    ? url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(filename)
    : url;
  const a = document.createElement('a');
  a.href = dlUrl;
  a.download = filename;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function FileViewModal({ url, name, speaker, onClose }) {
  const [copied, setCopied] = useState(false);
  const [driveToast, setDriveToast] = useState(false);
  const ch = speaker ? getChapter(speaker.chapterId) : null;
  const fileExt = (url?.split('?')[0].split('.').pop() || '').toLowerCase();
  const typeLabel =
    /顔写真|photo/i.test(name || '')  ? '顔写真' :
    /資料0?2|doc2/i.test(name || '')  ? '講話資料2' :
    /資料|doc1/i.test(name || '')     ? '講話資料' :
    (name || 'ファイル');
  const displayName = speaker && ch
    ? `${(speaker.seminarDate || '').replace(/-/g,'')}_${ch.name}_${speaker.speakerName || ''}_${typeLabel}${fileExt ? '.' + fileExt : ''}`
    : (name || decodeURIComponent(url?.split('/').pop()?.split('?')[0] || 'ファイル'));

  const handleDownload = () => downloadFile(url, displayName);

  const handleSaveToDrive = () => {
    downloadFile(url, displayName);
    setTimeout(() => window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener'), 400);
    setDriveToast(true);
    setTimeout(() => setDriveToast(false), 4000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSendToJimu = () => {
    if (!speaker || !JIMU.email) return;
    const fileType = isImage(url) ? '顔写真' : '講話資料';
    const subject = `【${ch.name}単会】${speaker.speakerName}様の${fileType}が届きました`;
    const body =
`${speaker.speakerName}様より${fileType}が届きましたのでご確認ください。

【講師名】${speaker.speakerName}${speaker.speakerKana ? `（${speaker.speakerKana}）` : ''}
【所属法人会】${[speaker.speakerUnit, speaker.role].filter(Boolean).join('　')}
【勤務先】${[speaker.company, speaker.companyRole].filter(Boolean).join('　')}
【登壇日】${formatDate(speaker.seminarDate)}
【単　会】${ch.name}単会
【ファイル名】${displayName}
【ファイルURL】${url}

━━━━━━━━━━━━━━━━━
倫理法人会 南部地区合同事務局
━━━━━━━━━━━━━━━━━`;
    const params = [
      JIMU.cc ? `cc=${encodeURIComponent(JIMU.cc)}` : '',
      `subject=${encodeURIComponent(subject)}`,
      `body=${encodeURIComponent(body)}`,
    ].filter(Boolean).join('&');
    window.open(`mailto:${JIMU.email}?${params}`, '_blank');
  };

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="ファイルビューア"
        style={{ ...MOD, maxWidth:700, maxHeight:'92vh', display:'flex', flexDirection:'column', padding:18 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ ...MH, marginBottom:10, position:'relative', paddingRight:36 }}>
          📎 <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</span>
          {speaker?.speakerName && <span style={{ fontSize:11, fontWeight:400, color:'#90A4AE', whiteSpace:'nowrap' }}>{speaker.speakerName}</span>}
          <button onClick={onClose} aria-label="閉じる"
            style={{ position:'absolute', top:-4, right:-4, width:32, height:32, borderRadius:'50%', border:'none', background:'#ECEFF1', color:'#37474F', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
            ×
          </button>
        </div>

        {/* Preview */}
        <div style={{ flex:1, overflow:'auto', background:'#37474F', borderRadius:8, marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', minHeight:180, maxHeight:460 }}>
          {isImage(url) ? (
            <img src={url} alt={displayName}
              style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', display:'block', borderRadius:4 }} />
          ) : isPDF(url) ? (
            <iframe src={url} title={displayName}
              style={{ width:'100%', height:440, border:'none', borderRadius:8 }} />
          ) : (
            <div style={{ textAlign:'center', color:'#90A4AE', padding:48 }}>
              <div style={{ fontSize:56, lineHeight:1 }}>📄</div>
              <div style={{ fontSize:14, marginTop:14, color:'#CFD8DC' }}>{displayName}</div>
              <div style={{ fontSize:11, marginTop:6 }}>このファイル形式はプレビューできません</div>
            </div>
          )}
        </div>

        {/* Drive Toast */}
        {driveToast && (
          <div style={{ background:'#E8F5E9', border:'1px solid #A5D6A7', borderRadius:6, padding:'7px 12px', fontSize:11, color:'#2E7D32', marginBottom:10, lineHeight:1.6 }}>
            ✅ ファイルをダウンロードしました。<br />
            Googleドライブ（新規 → ファイルのアップロード）からアップロードしてください。
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
          <button style={{ ...BP, flex:1, minWidth:90 }}
            onClick={() => window.open(url, '_blank', 'noopener')}>
            🔗 開く
          </button>
          <button style={{ ...BP, flex:1, minWidth:110, background:'#2E7D32' }}
            onClick={handleDownload}>
            ⬇ ダウンロード
          </button>
          <button style={{ ...BP, flex:1, minWidth:120, background:'#1565C0' }}
            onClick={handleSaveToDrive}
            title="ファイルをダウンロードしてGoogleドライブを開きます">
            🗂 Driveへ保存
          </button>
          {speaker && JIMU.email && (
            <button style={{ ...BP, flex:1, minWidth:130, background:'#E65100' }}
              onClick={handleSendToJimu}
              title={`事務局（${JIMU.email}）へ転送`}>
              📧 事務局へ転送
            </button>
          )}
          <button style={{ ...BG, flex:1, minWidth:90, background: copied ? '#388E3C' : '#06C755' }}
            onClick={handleCopy}>
            {copied ? '✓ コピー済' : '📋 URLコピー'}
          </button>
        </div>

        {/* 事務局メール宛先表示 */}
        {speaker && JIMU.email && (
          <div style={{ fontSize:10, color:'#78909C', marginBottom:8, padding:'5px 9px', background:'#FFF3E0', borderRadius:4, lineHeight:1.6 }}>
            <div>📮 To：{JIMU.email}</div>
            {JIMU.cc && <div>📋 CC：{JIMU.cc}</div>}
          </div>
        )}

        <button onClick={onClose}
          style={{ width:'100%', background:'#37474F', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          ✕ 閉じる
        </button>
      </div>
    </div>
  );
}
