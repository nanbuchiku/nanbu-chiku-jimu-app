// フリーメールに付ける「講話の様子の写真・動画」の準備と、送信方法の振り分け。
// 方針：
//   ・写真は自動で縮小して、そのままメールに添付する
//   ・動画は、メールの添付に収まる大きさ（合計 DIRECT_BUDGET まで）ならそのまま添付し、
//     収まらない場合は保存先(Supabase Storage)にアップロードして、ダウンロード用リンクを本文に入れる
//   ・添付できるのは4つまで。写真と動画以外は受け付けない

export const MAX_FILES = 4;
// メールに直接添付できる合計サイズの上限（GASへ送る際のbase64化で約1.33倍になるため、余裕を見て10MB）
export const DIRECT_BUDGET = 10 * 1024 * 1024;
// 保存先に置ける1ファイルの上限（Supabase無料枠の上限）
export const MAX_UPLOAD = 50 * 1024 * 1024;

export const fmtSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

const isHeicLike = (f) => /image\/hei[cf]/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || '');
export const kindOf = (f) => (/^image\//i.test(f.type || '') || /\.(jpe?g|png|gif|webp|hei[cf]|bmp)$/i.test(f.name || '')) ? 'image'
  : (/^video\//i.test(f.type || '') || /\.(mp4|mov|m4v|avi|wmv|mkv|webm)$/i.test(f.name || '')) ? 'video' : 'other';

// 写真を長辺1600px・約900KB以下のJPEGにする。読み込めない形式（HEICなど）は例外にする
function compressImage(file, maxDim = 1600, maxKB = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        if (!img.width || !img.height) throw new Error('size0');
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let q = 0.88;
        const step = () => canvas.toBlob(b => {
          if (!b) { reject(new Error('toBlob failed')); return; }
          if (b.size <= maxKB * 1024 || q <= 0.3) resolve(b); else { q -= 0.1; step(); }
        }, 'image/jpeg', q);
        step();
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

// 選ばれたファイルを、メールに付ける形に整える。{ id, name, kind, file, size } を返す
export async function prepareAttachment(file) {
  const kind = kindOf(file);
  if (kind === 'other') throw new Error(`「${file.name}」は、写真・動画ではないため付けられません。`);
  const id = Math.random().toString(36).slice(2, 10);
  if (kind === 'image') {
    try {
      const blob = await compressImage(file);
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return { id, name, kind, file: new File([blob], name, { type: 'image/jpeg' }), size: blob.size };
    } catch (e) {
      if (isHeicLike(file)) throw new Error(`「${file.name}」は形式（HEIC）の関係で読み込めませんでした。iPhoneの場合は、写真アプリで「JPEG形式で書き出し」をするか、別の写真をお選びください。`);
      if (file.size > 5 * 1024 * 1024) throw new Error(`「${file.name}」を読み込めず、サイズも大きいため付けられません。`);
      return { id, name: file.name, kind, file, size: file.size };
    }
  }
  if (file.size > MAX_UPLOAD) throw new Error(`「${file.name}」は${fmtSize(file.size)}あり、50MBを超えるため付けられません。動画を短くするか、Googleドライブ等のリンクを本文に貼ってください。`);
  return { id, name: file.name, kind, file, size: file.size };
}

// 直接添付するものと、リンクにするものに振り分ける（写真を優先して添付し、動画は残りの枠に収まる順に添付）
export function planAttachments(items) {
  let used = 0;
  const direct = [], link = [];
  [...items].sort((a, b) => (a.kind === 'image' ? 0 : 1) - (b.kind === 'image' ? 0 : 1)).forEach(it => {
    if (used + it.size <= DIRECT_BUDGET) { direct.push(it); used += it.size; }
    else link.push(it);
  });
  // 表示は、選んだ順に戻す
  const order = new Map(items.map((it, i) => [it.id, i]));
  direct.sort((a, b) => order.get(a.id) - order.get(b.id));
  link.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { direct, link, used };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
    r.onerror = () => reject(new Error('ファイルを読み込めませんでした'));
    r.readAsDataURL(file);
  });
}

// 大きな動画などを保存先にアップロードして、ダウンロード用の公開リンクを返す
// （URLの一部に推測されにくい文字列を入れる。リンクを知っている人は誰でも見られる点に注意）
export async function uploadForLink(db, item, chapterId, date) {
  const ext = (item.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const path = `mail-attach/${(chapterId || 'x').replace(/[^a-z0-9_]/gi, '')}/${(date || '').replace(/-/g, '')}/${rand}.${ext}`;
  let lastErr = null;
  for (let i = 1; i <= 3; i++) {
    try {
      const { error } = await db.storage.from('speaker-files').upload(path, item.file, { upsert: false, contentType: item.file.type || undefined });
      if (error) throw new Error(error.message);
      lastErr = null; break;
    } catch (e) { lastErr = e; if (i < 3) await new Promise(r => setTimeout(r, i * 1500)); }
  }
  if (lastErr) throw new Error(`「${item.name}」のアップロードに失敗しました（${lastErr.message}）`);
  return db.storage.from('speaker-files').getPublicUrl(path).data.publicUrl;
}
