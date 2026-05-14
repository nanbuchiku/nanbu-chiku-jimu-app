import React, { useState } from 'react';
import { OV, MOD, MH, BP, BC, BG } from '../styles';

const isImage = url => /\.(jpg|jpeg|png|webp|gif)$/i.test(url?.split('?')[0] || '');
const isPDF   = url => /\.pdf$/i.test(url?.split('?')[0] || '');

function downloadFile(url, filename) {
  const dlUrl = url.includes('supabase.co')
    ? url + (url.includes('?') ? '&' : '?') + 'download'
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

export default function FileViewModal({ url, name, speakerName, onClose, onEmail }) {
  const [copied, setCopied] = useState(false);
  const [driveToast, setDriveToast] = useState(false);
  const displayName = name || decodeURIComponent(url?.split('/').pop()?.split('?')[0] || 'ファイル');

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

  return (
    <div style={OV} onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="ファイルビューア"
        style={{ ...MOD, maxWidth:700, maxHeight:'92vh', display:'flex', flexDirection:'column', padding:18 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ ...MH, marginBottom:10 }}>
          📎 <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</span>
          {speakerName && <span style={{ fontSize:11, fontWeight:400, color:'#90A4AE', whiteSpace:'nowrap' }}>{speakerName}</span>}
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
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
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
          {onEmail && (
            <button style={{ ...BP, flex:1, minWidth:110, background:'#6A1B9A' }}
              onClick={() => { onClose(); onEmail(); }}>
              📧 メール送信
            </button>
          )}
          <button style={{ ...BG, flex:1, minWidth:90, background: copied ? '#388E3C' : '#06C755' }}
            onClick={handleCopy}>
            {copied ? '✓ コピー済' : '📋 URLコピー'}
          </button>
          <button style={BC} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
