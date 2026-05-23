// 旧Supabaseに残っている顔写真URLを新Supabaseのspeakersテーブルに復元するスクリプト
// 実行: node scripts/restore_photos.mjs

import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://euxssgbhbnmnxyzeehea.supabase.co';
const NEW_KEY = 'sb_publishable_y3S-bGIi1TaJIh73_r9syA_ZvoTseeU';
const db = createClient(NEW_URL, NEW_KEY);

// 旧Supabaseから取得した写真データ（speaker_name + seminar_date + chapter_id で照合）
const OLD_PHOTOS = [
  {
    speakerName: '小串和美',
    seminarDate: '2026-05-22',
    chapterId:   'niizashiki',
    materialUrl: 'https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/niizashiki/20260522/hoshinanozomi/photo.jpg',
    materialName: '顔写真',
  },
  {
    speakerName: '星奈希見',
    seminarDate: '2026-05-26',
    chapterId:   'todawarabi',
    materialUrl: 'https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/todawarabi/20260526/hoshinanozomi/photo.jpg',
    materialName: '顔写真',
  },
  {
    speakerName: '荒井　秀樹',
    seminarDate: '2026-07-02',
    chapterId:   'niizashiki',
    materialUrl: 'https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/niizashiki/20260702/araihideki/photo.jpg',
    materialName: '顔写真',
  },
  {
    speakerName: '谷口　友保',
    seminarDate: '2026-07-30',
    chapterId:   'niizashiki',
    materialUrl: 'https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/niizashiki/20260730/taniguchitomoyasu/photo.jpg',
    materialName: '顔写真',
  },
  {
    speakerName: '星奈希見',
    seminarDate: '2026-08-06',
    chapterId:   'niizashiki',
    materialUrl: 'https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/niizashiki/20260806/hoshinanozomi/photo.jpg',
    materialName: '顔写真',
  },
];

console.log('🔍 新Supabaseのspeakersを検索中...\n');

let updated = 0;
let notFound = 0;

for (const photo of OLD_PHOTOS) {
  const { data, error } = await db
    .from('speakers')
    .select('id, speaker_name, seminar_date, chapter_id')
    .eq('speaker_name', photo.speakerName)
    .eq('seminar_date', photo.seminarDate)
    .eq('chapter_id', photo.chapterId);

  if (error) {
    console.error(`❌ 検索エラー (${photo.speakerName}):`, error.message);
    continue;
  }

  if (!data || data.length === 0) {
    console.log(`⚠  見つからず: ${photo.seminarDate} ${photo.chapterId} ${photo.speakerName}`);
    notFound++;
    continue;
  }

  for (const sp of data) {
    const { error: upErr } = await db
      .from('speakers')
      .update({ material_url: photo.materialUrl, material_name: photo.materialName })
      .eq('id', sp.id);

    if (upErr) {
      console.error(`❌ 更新エラー (${photo.speakerName}):`, upErr.message);
    } else {
      console.log(`✅ 復元完了: ${photo.seminarDate} ${photo.chapterId} ${photo.speakerName}`);
      updated++;
    }
  }
}

console.log(`\n📊 結果: ${updated}件復元, ${notFound}件は新DBに見つからず`);
