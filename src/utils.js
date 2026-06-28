import { CHAPTERS, ALL_CHAPTER, SEMINAR_TYPES } from './constants';

const FALLBACK_CHAPTER = { id:"", name:"不明", short:"?", color:"#98A2B3", accent:"#B0BEC5", light:"#FAFAFA", day:-1, dayName:"不明", venue:"", time:"" };
export const getChapter = id => (id === ALL_CHAPTER.id ? ALL_CHAPTER : CHAPTERS.find(c => c.id === id)) || FALLBACK_CHAPTER;
// 既知の種別はそのまま、未知の値（自主企画の自由入力テキスト）はラベルとして合成して返す
export const getSeminarType = id => {
  if (!id) return SEMINAR_TYPES[0];
  return SEMINAR_TYPES.find(t => t.id === id)
    || { id, label: id, short: id.slice(0, 2), color: "#78909C", venueFixed: false, hasLodging: "optional" };
};
export const realToday = () => new Date();
export const toDateStr = d => {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};

export const parseDate = s => s ? new Date(s + 'T00:00:00') : null;

export const formatDate = d => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日（${"日月火水木金土"[dt.getDay()]}）`;
};

export const getWeekDates = (base, offset = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x;
  });
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

// ── Supabase Storage パス生成（form.html と統一） ──────────────────
// ひらがな／カタカナ → ローマ字（Supabase Storage キーはASCIIのみ対応のため）
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
export function kanaToRomaji(str) {
  if (!str) return '';
  let s = String(str).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
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

/**
 * 講師ファイルの保存先パスを生成（form.html と完全に統一）
 * 例: `niizashiki/20260709/kotakitoshirou/photo.jpg`
 * @param {string} chapterId - 単会ID（'niizashiki' 等）
 * @param {string} seminarDate - 講演日（YYYY-MM-DD）
 * @param {string} speakerKana - 講師のふりがな（ローマ字変換に使用）
 * @param {string} speakerName - 講師名（ふりがな無い場合のフォールバック）
 * @param {'photo'|'doc1'|'doc2'} typeKey - ファイル種別
 * @param {string} ext - 拡張子（'jpg' 等、ドット無し）
 */
export function buildSpeakerStoragePath(chapterId, seminarDate, speakerKana, speakerName, typeKey, ext) {
  const d  = seminarDate ? seminarDate.replace(/-/g, '') : String(Date.now());
  const nm = kanaToRomaji(speakerKana)
    || (speakerName || '').replace(/[^\x21-\x7E]/g, '').replace(/\s/g, '').toLowerCase()
    || String(Date.now());
  const ch = (chapterId || 'unknown').replace(/[^\x21-\x7E]/g, '');
  return `${ch}/${d}/${nm}/${typeKey}.${ext}`;
}

export function extractStaffNotes(notes) {
  if (!notes) return '';
  return String(notes)
    .replace(/\\n/g, '\n') // 旧データの literal \n を正規化
    .replace(/【内容要約】\n[\s\S]*?(?=\n【|$)/g, '')
    .replace(/【[^】]+】[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractMaterialLinks(notes) {
  if (!notes) return [];
  const normalized = String(notes).replace(/\\n/g, '\n');
  const out = [];
  const re = /【(資料\d+)】\s*(https?:\/\/\S+)/g;
  let m;
  while ((m = re.exec(normalized)) !== null) out.push({ label: m[1], url: m[2] });
  return out;
}

export function buildSpeakerTasks(sp) {
  const tasks = [];
  const add = (id, label, category) => tasks.push({ id, label, category });

  add("req_sent",    "依頼メール送信",           "依頼");
  add("form_sent",   "確認フォームURL送付",       "依頼");
  add("form_recvd",  "フォーム回答受領",          "依頼");
  add("doc_sent",    "確認書送付",               "依頼");

  if (sp.lodging && sp.lodging !== "不要" && sp.lodging !== "なし") {
    if (sp.lodging !== "あり（当日のみ）") {
      add("hotel_rsrv", "ホテル予約完了",          "宿泊");
      add("hotel_conf", "ホテル確認連絡（講師へ）", "宿泊");
    }
    add("pickup_plan","お迎え手配",               "宿泊");
  }

  add("material_chk","資料・写真受領確認",         "資料");
  if (sp.printRequired && !sp.printRequired.startsWith("不要")) {
    add("print_done", "資料印刷完了",             "資料");
  }

  add("venue_ready", "会場準備・当日連絡",         "当日");
  add("intro_prep",  "紹介文・プロフィール確認",   "当日");

  add("thanks_sent", "お礼メール送信",            "講話後");
  add("receipt_sent","領収書・謝礼送付",           "講話後");
  add("report_done", "講話レポート・メモ記録",     "講話後");

  return tasks;
}
