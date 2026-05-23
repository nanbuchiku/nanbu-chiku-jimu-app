// 旧Supabaseのnotesに埋まっている資料URL（【資料01】形式）を新Supabaseに復元するスクリプト
// 実行: node scripts/restore_docs.mjs

import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://euxssgbhbnmnxyzeehea.supabase.co';
const NEW_KEY = 'sb_publishable_y3S-bGIi1TaJIh73_r9syA_ZvoTseeU';
const db = createClient(NEW_URL, NEW_KEY);

// 旧DBから取得した資料URLを含むnotesデータ
const OLD_DATA = [
  {
    speakerName: '小串和美',
    seminarDate: '2026-05-22',
    chapterId: 'niizashiki',
    oldNotes: `【内容要約】\n科学で証明。100日実践の裏側で何が起きているか\n【交通手段】お車\n【単会で準備】プロジェクタ・パソコン\n【禁煙ルーム】禁煙／【お迎え】要\n【領収証宛名】個人宛\n【領収証郵便番号】350-2226\n【領収証住所】鶴ヶ島市中新田３６０−３２\n【顔写真の使用範囲】全媒体承諾\n\n【資料01】https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/niizashiki/20260522/hoshinanozomi/doc1.pdf`,
  },
  {
    speakerName: '星奈希見',
    seminarDate: '2026-05-26',
    chapterId: 'todawarabi',
    oldNotes: `【内容要約】\nモーニング\n【交通手段】お車\n【単会で準備】プロジェクタ・ホワイトボード\n【禁煙ルーム】禁煙／【お迎え】要\n【領収証宛名】個人宛\n【領収証郵便番号】350-2226\n【領収証住所】鶴ヶ島市中新田３６０−３２\n【顔写真の使用範囲】全媒体承諾\n\n【資料01】https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/todawarabi/20260526/hoshinanozomi/doc1.pdf`,
  },
  {
    speakerName: '星奈希見',
    seminarDate: '2026-08-06',
    chapterId: 'niizashiki',
    oldNotes: `【内容要約】\nテスラさん\n【交通手段】電車\n【単会で準備】無し\n【禁煙ルーム】禁煙／【お迎え】要\n【領収証宛名】個人宛\n【領収証郵便番号】3502226\n【領収証住所】鶴ヶ島市中新田360-32\n【顔写真の使用範囲】全媒体承諾\n\n【資料01】https://leqavpnmtylmankbcdkd.supabase.co/storage/v1/object/public/speaker-files/niizashiki/20260806/hoshinanozomi/doc1.pdf`,
  },
];

console.log('🔍 新Supabaseの対象speakersを検索・更新中...\n');

let updated = 0;
let notFound = 0;

for (const item of OLD_DATA) {
  // 新DBの現在のnotesを取得
  const { data, error } = await db
    .from('speakers')
    .select('id, speaker_name, seminar_date, notes')
    .eq('speaker_name', item.speakerName)
    .eq('seminar_date', item.seminarDate)
    .eq('chapter_id', item.chapterId);

  if (error) {
    console.error(`❌ 検索エラー (${item.speakerName}):`, error.message);
    continue;
  }

  if (!data || data.length === 0) {
    console.log(`⚠  見つからず: ${item.seminarDate} ${item.chapterId} ${item.speakerName}`);
    notFound++;
    continue;
  }

  for (const sp of data) {
    const currentNotes = sp.notes || '';

    // 既に資料URLが含まれていたらスキップ
    if (currentNotes.includes('【資料01】')) {
      console.log(`⏭  スキップ（資料URL既存）: ${item.speakerName}`);
      continue;
    }

    // 旧notesを新notesにマージ（新notesが空なら旧を丸ごと使用、あれば末尾に追記）
    const docLine = item.oldNotes.match(/\n\n【資料01】.+/)?.[0] || '';
    const mergedNotes = currentNotes
      ? currentNotes + (docLine ? '\n' + docLine.trim() : '')
      : item.oldNotes;

    const { error: upErr } = await db
      .from('speakers')
      .update({ notes: mergedNotes })
      .eq('id', sp.id);

    if (upErr) {
      console.error(`❌ 更新エラー (${item.speakerName}):`, upErr.message);
    } else {
      console.log(`✅ 資料URL復元: ${item.seminarDate} ${item.chapterId} ${item.speakerName}`);
      updated++;
    }
  }
}

console.log(`\n📊 結果: ${updated}件復元, ${notFound}件は新DBに見つからず`);
