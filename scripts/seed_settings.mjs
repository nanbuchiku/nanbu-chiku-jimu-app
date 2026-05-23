// 単会設定の初期データをSupabase Storageにアップロードする1回限りのスクリプト
// 実行: node scripts/seed_settings.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://euxssgbhbnmnxyzeehea.supabase.co';
const SUPABASE_KEY = 'sb_publishable_y3S-bGIi1TaJIh73_r9syA_ZvoTseeU';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const settings = {
  todawarabi: {
    name:            "とだわらび",
    msVenue:         "戸田市商工会館",
    msAddress:       "戸田市上戸田１−２１−２３",
    msStation:       "",
    msMapUrl:        "https://share.google/LBrDQ6899ccNm89hv",
    msParking:       "",
    msVenueTel:      "０４８−４４１−２６１７",
    kisoVenue:       "",
    kisoAddress:     "",
    kisoMapUrl:      "",
    kisoTextChapter: "",
    hotelName:       "",
    hotelTel:        "",
    hotelAddress:    "",
    hotelStation:    "",
    hotelParking:    "",
    hotelMapUrl:     "",
    contactPerson:   "",
    contactTel:      "",
    chapterEmail:    "",
  },
  kawaguchi_east: {
    name:            "川口東",
    msVenue:         "川口緑化センター　樹里安",
    msAddress:       "川口安行領家８４４−２",
    msStation:       "",
    msMapUrl:        "https://share.google/7QSKHBQCh0the5Cb7",
    msParking:       "",
    msVenueTel:      "―",
    kisoVenue:       "",
    kisoAddress:     "",
    kisoMapUrl:      "",
    kisoTextChapter: "",
    hotelName:       "",
    hotelTel:        "",
    hotelAddress:    "",
    hotelStation:    "",
    hotelParking:    "",
    hotelMapUrl:     "",
    contactPerson:   "",
    contactTel:      "",
    chapterEmail:    "",
  },
  niizashiki: {
    name:            "新座・志木",
    msVenue:         "CKスクエア新座　６F",
    msAddress:       "新座市野火止５−２−１０（駐車場：４F無料）",
    msStation:       "",
    msMapUrl:        "https://share.google/rSXTQ2jqiGDttsCyE",
    msParking:       "４F無料",
    msVenueTel:      "―",
    kisoVenue:       "",
    kisoAddress:     "",
    kisoMapUrl:      "",
    kisoTextChapter: "3",
    hotelName:       "東横イン志木東口",
    hotelTel:        "",
    hotelAddress:    "",
    hotelStation:    "志木駅 徒歩2分",
    hotelParking:    "有料駐車場あり",
    hotelMapUrl:     "",
    contactPerson:   "小林靖会長",
    contactTel:      "",
    chapterEmail:    "nizashikirinri@gmail.com",
  },
  asaka: {
    name:            "朝霞",
    msVenue:         "浜崎会館　２Fホール（氷川神社境内）",
    msAddress:       "朝霞市浜崎３丁目９番地",
    msStation:       "",
    msMapUrl:        "https://maps.app.goo.gl/phdDu7hZSuUbmErN6",
    msParking:       "",
    msVenueTel:      "―",
    kisoVenue:       "",
    kisoAddress:     "",
    kisoMapUrl:      "",
    kisoTextChapter: "",
    hotelName:       "",
    hotelTel:        "",
    hotelAddress:    "",
    hotelStation:    "",
    hotelParking:    "",
    hotelMapUrl:     "",
    contactPerson:   "",
    contactTel:      "",
    chapterEmail:    "",
  },
  kawaguchi: {
    name:            "川口",
    msVenue:         "元郷四丁目町会会館",
    msAddress:       "川口市元郷４丁目１２−２（駐車場：（株）もといち　川口市元郷４−８−２４）",
    msStation:       "",
    msMapUrl:        "https://share.google/nIYPjDL6MsMpt1ek8",
    msParking:       "（株）もといち　川口市元郷４−８−２４",
    msVenueTel:      "―",
    kisoVenue:       "",
    kisoAddress:     "",
    kisoMapUrl:      "",
    kisoTextChapter: "",
    hotelName:       "",
    hotelTel:        "",
    hotelAddress:    "",
    hotelStation:    "",
    hotelParking:    "",
    hotelMapUrl:     "",
    contactPerson:   "",
    contactTel:      "",
    chapterEmail:    "",
  },
};

const json = JSON.stringify(settings, null, 2);
// application/json は拒否されるため text/plain で代替アップロード
const blob = new Blob([json], { type: 'text/plain' });

console.log('Uploading chapter_settings.json to Supabase Storage...');

const { data, error } = await db.storage
  .from('speaker-files')
  .upload('settings/chapter_settings.json', blob, {
    upsert: true,
    contentType: 'text/plain',
  });

if (error) {
  console.error('❌ Upload failed:', error.message);
  process.exit(1);
}

console.log('✅ Done! chapter_settings.json uploaded successfully.');
console.log('Path:', data.path);
