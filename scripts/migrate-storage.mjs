// 既存アップロードファイルを新ルールのパスへ一括リネームする一回限りの移行スクリプト
//   旧: doc1__20260516.pdf 等（フラット・タイムスタンプ）
//   新: {単会ID}/{開催日}/{講師名ローマ字}/{種別}.ext
// 使い方:
//   DRY_RUN（既定）: node scripts/migrate-storage.mjs
//   実行           : node scripts/migrate-storage.mjs --apply
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://leqavpnmtylmankbcdkd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sAahVVEPRHnLDsOxawsI5w_XtGZe25O';
const BUCKET = 'speaker-files';
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const APPLY = process.argv.includes('--apply');

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const KANA_ROMAJI = {
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho','にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo','びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo','ぢゃ':'ja','ぢゅ':'ju','ぢょ':'jo',
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'o','ん':'n',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
};
function kanaToRomaji(str) {
  if (!str) return '';
  let s = str.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
             .replace(/[\s　ー・]/g, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const two = s.substr(i, 2);
    if (KANA_ROMAJI[two]) { out += KANA_ROMAJI[two]; i++; continue; }
    if (s[i] === 'っ') { const n = KANA_ROMAJI[s.substr(i+1,2)] || KANA_ROMAJI[s[i+1]] || ''; out += n[0] || ''; continue; }
    out += KANA_ROMAJI[s[i]] ?? '';
  }
  return out.toLowerCase();
}

function decodePath(url) {
  if (!url || !url.startsWith(PUBLIC_PREFIX)) return null;
  let p = url.slice(PUBLIC_PREFIX.length).split('?')[0];
  try { p = decodeURIComponent(p); } catch {}
  return p;
}

function buildPath(sp, typeKey, oldPath) {
  const d = (sp.seminar_date || '').replace(/-/g, '') || String(Date.now());
  const name = kanaToRomaji(sp.speaker_kana)
    || (sp.speaker_name || '').replace(/[^\x21-\x7E]/g, '').replace(/\s/g, '').toLowerCase()
    || String(Date.now());
  const ch = (sp.chapter_id || 'unknown').replace(/[^\x21-\x7E]/g, '');
  const ext = typeKey === 'photo' ? 'jpg' : (oldPath.split('.').pop() || 'dat');
  return `${ch}/${d}/${name}/${typeKey}.${ext}`;
}

async function moveFile(from, to) {
  const { error } = await db.storage.from(BUCKET).move(from, to);
  if (error) {
    // 同一パスや既移動済みは無害扱い
    if (/exists|not found|same/i.test(error.message)) return { skipped: error.message };
    throw new Error(error.message);
  }
  return { moved: true };
}
const publicUrl = path => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

const run = async () => {
  console.log(`=== Storage migration (${APPLY ? 'APPLY — 本番変更' : 'DRY-RUN — 変更なし'}) ===\n`);
  const { data: speakers, error } = await db.from('speakers').select('*');
  if (error) { console.error('DB読み込み失敗:', error.message); process.exit(1); }
  console.log(`講師レコード: ${speakers.length}件\n`);

  let plan = 0, moved = 0, skipped = 0, errors = 0;

  for (const sp of speakers) {
    const tag = `[${sp.chapter_id}/${sp.seminar_date}] ${sp.speaker_name || '(無名)'}`;
    const jobs = [];

    const photoPath = decodePath(sp.material_url);
    if (photoPath && !photoPath.includes('/')) {
      jobs.push({ kind: 'photo', oldPath: photoPath, newPath: buildPath(sp, 'photo', photoPath) });
    }

    let notes = sp.notes || '';
    const docRe = /【(資料\d+)】\s*(https?:\/\/\S+)/g;
    let m;
    while ((m = docRe.exec(notes)) !== null) {
      const op = decodePath(m[2]);
      if (op && !op.includes('/')) {
        const typeKey = m[1] === '資料01' ? 'doc1' : 'doc2';
        jobs.push({ kind: m[1], oldUrl: m[2], oldPath: op, newPath: buildPath(sp, typeKey, op) });
      }
    }

    if (jobs.length === 0) continue;

    let newMaterialUrl = sp.material_url;
    let newNotes = notes;

    for (const j of jobs) {
      plan++;
      console.log(`${tag}\n  ${j.kind}: ${j.oldPath}\n       → ${j.newPath}`);
      if (!APPLY) continue;
      try {
        const r = await moveFile(j.oldPath, j.newPath);
        if (r.skipped) { skipped++; console.log(`       (skip: ${r.skipped})`); }
        else moved++;
        const nu = publicUrl(j.newPath);
        if (j.kind === 'photo') newMaterialUrl = nu;
        else newNotes = newNotes.replace(j.oldUrl, nu);
      } catch (e) { errors++; console.log(`       !! ERROR: ${e.message}`); }
    }

    if (APPLY && (newMaterialUrl !== sp.material_url || newNotes !== notes)) {
      const { error: ue } = await db.from('speakers')
        .update({ material_url: newMaterialUrl, notes: newNotes }).eq('id', sp.id);
      if (ue) { errors++; console.log(`  !! DB更新失敗 (${sp.id}): ${ue.message}`); }
      else console.log(`  ✓ DB更新済`);
    }
  }

  console.log(`\n=== 集計 ===`);
  console.log(`対象ファイル: ${plan}件`);
  if (APPLY) console.log(`移動成功: ${moved} / スキップ: ${skipped} / エラー: ${errors}`);
  else console.log(`(DRY-RUN: 実行するには  node scripts/migrate-storage.mjs --apply )`);
};

run().catch(e => { console.error(e); process.exit(1); });
