// 旧Supabase Storage のファイルを新Supabase Storageにコピーし、DBのURLを更新するスクリプト
// 実行: node scripts/migrate_files.mjs

import { createClient } from '@supabase/supabase-js';

const OLD_BASE = 'https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files';
const NEW_URL  = 'https://euxssgbhbnmnxyzeehea.supabase.co';
const NEW_KEY  = 'sb_publishable_y3S-bGIi1TaJIh73_r9syA_ZvoTseeU';
const NEW_PUB  = `${NEW_URL}/storage/v1/object/public/speaker-files`;

const db = createClient(NEW_URL, NEW_KEY);

// ── 移行対象ファイル（旧パス → MIME） ─────────────────────────────
const FILES = [
  { path: 'niizashiki/20260522/hoshinanozomi/photo.jpg',      mime: 'image/jpeg' },
  { path: 'niizashiki/20260522/hoshinanozomi/doc1.pdf',       mime: 'application/pdf' },
  { path: 'todawarabi/20260526/hoshinanozomi/photo.jpg',      mime: 'image/jpeg' },
  { path: 'todawarabi/20260526/hoshinanozomi/doc1.pdf',       mime: 'application/pdf' },
  { path: 'niizashiki/20260702/araihideki/photo.jpg',         mime: 'image/jpeg' },
  { path: 'niizashiki/20260730/taniguchitomoyasu/photo.jpg',  mime: 'image/jpeg' },
  { path: 'niizashiki/20260806/hoshinanozomi/photo.jpg',      mime: 'image/jpeg' },
  { path: 'niizashiki/20260806/hoshinanozomi/doc1.pdf',       mime: 'application/pdf' },
];

// ── ファイルごとにダウンロード → アップロード ─────────────────────
const urlMap = {}; // oldUrl → newUrl のマッピング

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📦 STEP 1: ファイルをダウンロード → 新Storageにアップロード');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const { path, mime } of FILES) {
  const oldUrl = `${OLD_BASE}/${path}`;
  const newUrl = `${NEW_PUB}/${path}`;

  process.stdout.write(`  ${path} ... `);

  // ダウンロード
  let res;
  try {
    res = await fetch(oldUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.log(`❌ DL失敗: ${e.message}`);
    continue;
  }

  const blob = await res.arrayBuffer();

  // アップロード（MIMEがダメなら octet-stream にフォールバック）
  let uploadErr = null;
  for (const contentType of [mime, 'application/octet-stream']) {
    const { error } = await db.storage.from('speaker-files').upload(path, blob, {
      upsert: true,
      contentType,
    });
    if (!error) { uploadErr = null; break; }
    uploadErr = error;
  }

  if (uploadErr) {
    console.log(`❌ UL失敗: ${uploadErr.message}`);
    continue;
  }

  urlMap[oldUrl] = newUrl;
  console.log(`✅`);
}

console.log(`\n移行完了ファイル: ${Object.keys(urlMap).length} / ${FILES.length} 件\n`);

if (Object.keys(urlMap).length === 0) {
  console.log('移行するファイルがなかったため、DB更新をスキップします。');
  process.exit(0);
}

// ── 新DBの speakers を取得して URL を書き換え ─────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 STEP 2: 新DB の speakers URL を新しいURLに更新');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const { data: speakers, error: fetchErr } = await db
  .from('speakers')
  .select('id, speaker_name, material_url, notes')
  .or(Object.keys(urlMap).map(u => `material_url.eq.${u}`).join(',') +
      ',' + Object.keys(urlMap).map(() => `notes.like.%leqavpnmtylmankbcdkd%`).join(','));

if (fetchErr) {
  console.error('❌ 検索エラー:', fetchErr.message);
  process.exit(1);
}

// 重複除去
const targets = [...new Map((speakers || []).map(s => [s.id, s])).values()];
console.log(`対象レコード: ${targets.length} 件\n`);

let updCount = 0;

for (const sp of targets) {
  const updates = {};

  // material_url の書き換え
  const newMaterialUrl = urlMap[sp.material_url];
  if (newMaterialUrl) updates.material_url = newMaterialUrl;

  // notes の中の旧URLを一括書き換え
  let notes = sp.notes || '';
  let notesChanged = false;
  for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
    if (notes.includes(oldUrl)) {
      notes = notes.replaceAll(oldUrl, newUrl);
      notesChanged = true;
    }
  }
  if (notesChanged) updates.notes = notes;

  if (Object.keys(updates).length === 0) continue;

  const { error: upErr } = await db.from('speakers').update(updates).eq('id', sp.id);
  if (upErr) {
    console.log(`  ❌ 更新失敗 (${sp.speaker_name}): ${upErr.message}`);
  } else {
    console.log(`  ✅ 更新完了: ${sp.speaker_name}  ${Object.keys(updates).join(' + ')}`);
    updCount++;
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📊 結果まとめ`);
console.log(`  ファイル移行: ${Object.keys(urlMap).length} / ${FILES.length} 件`);
console.log(`  DB更新:       ${updCount} / ${targets.length} 件`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log('\n✅ 完了！旧Supabaseへの依存がなくなりました。');
