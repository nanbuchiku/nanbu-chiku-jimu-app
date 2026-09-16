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

// 倫理法人会の年度は9月始まり。今日を含む年度の開始日（YYYY-09-01）を返す
export const getFiscalYearStart = (today) => {
  const y = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${y}-09-01`;
};

// 期間フィルタの「月で絞り込む」選択肢を作る。過去はアプリ運用開始の2026年6月から、
// 未来は今日から12ヶ月先まで（valuePrefixは呼び出し側のvalue形式に合わせる。例: "cal:"）
export function buildMonthRanges(today, valuePrefix = "") {
  const opts = [];
  const start = new Date(2026, 5, 1); // 2026年6月
  const end = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const label = y === today.getFullYear() ? `${m}月` : `${y}年${m}月`;
    opts.push({ value: `${valuePrefix}${y}-${String(m).padStart(2, "0")}`, label });
  }
  return opts;
}

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

// 顔写真②③（1枚目は materialUrl、追加分は notes に【顔写真0N】として埋め込む）
export function extractPhotoLinks(notes) {
  if (!notes) return [];
  const normalized = String(notes).replace(/\\n/g, '\n');
  const out = [];
  const re = /【(顔写真\d+)】\s*(https?:\/\/\S+)/g;
  let m;
  while ((m = re.exec(normalized)) !== null) out.push({ label: m[1], url: m[2] });
  return out;
}

// タスクのチェック状態を統一的に読むためのヘルパー
// 旧データ（true/false のみ）と新データ（{done,at,by,dest}）の両方を扱う
export function isTaskDone(checks, id) {
  const c = checks?.[id];
  return c === true || (c && typeof c === 'object' && c.done === true);
}
export function getTaskMeta(checks, id) {
  const c = checks?.[id];
  return (c && typeof c === 'object') ? c : null;
}
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 毎月28日までに揃えたい「講師基本情報 7点セット」
export const SEVEN_SET_ITEMS = [
  { key: "seminarDate", label: "講話日" },
  { key: "speakerName", label: "名前" },
  { key: "materialUrl", label: "顔写真" },
  { key: "company",     label: "所属名" },
  { key: "topic",       label: "講話タイトル" },
  { key: "email",       label: "メールアドレス" },
  { key: "phone",       label: "電話番号" },
];

export function getSevenSetProgress(sp) {
  const items = SEVEN_SET_ITEMS.map(it => ({ ...it, done: !!String(sp?.[it.key] ?? "").trim() }));
  const done = items.filter(it => it.done).length;
  return { items, done, total: items.length };
}

export function buildSpeakerTasks(sp) {
  const tasks = [];
  const add = (id, label, category, extra) => tasks.push({ id, label, category, ...extra });
  const checks = sp.speakerChecks || {};

  // 送信手段（メール／LINE／FAX）を記録する専用タスクとして扱う（method: true）
  add("form_sent",   "講師依頼フォーム作成・送信", "依頼", { method: true });
  add("form_recvd",  "フォーム回答受領",          "依頼");
  add("doc_sent",    "確認書送付",               "依頼");

  if (sp.lodging && sp.lodging !== "不要" && sp.lodging !== "なし") {
    if (sp.lodging !== "あり（当日のみ）") {
      add("hotel_rsrv",   "ホテル予約完了",       "宿泊");
      add("hotel_conf",   "ホテル情報の共有",     "宿泊");
      add("hotel_paid",   "支払い完了",           "宿泊");
    }
    add("meetup_plan",   "待ち合わせ場所の相談",   "宿泊");
    add("pickup_plan",   "お迎え担当手配",         "宿泊");
    add("hotel_greeting","会長からの挨拶連絡",     "宿泊");
  }

  // 顔写真・資料は別々に届く可能性があり、かつ「単会」宛か「合同事務局」宛かが
  // わかりにくいため、受領時に宛先を記録する専用タスクとして扱う（receipt: true）
  add("photo_received",    "顔写真受領",         "資料", { receipt: true });
  add("photo_checked",     "顔写真の内容確認",   "資料");
  if (getTaskMeta(checks, "photo_received")?.dest === "office") {
    add("photo_shared",    "顔写真を単会へ共有", "資料");
  }
  add("material_received", "資料受領",           "資料", { receipt: true });
  add("material_checked",  "資料の内容確認",     "資料");
  if (getTaskMeta(checks, "material_received")?.dest === "office") {
    add("material_shared", "資料を単会へ共有",   "資料");
  }
  if (sp.printRequired && !sp.printRequired.startsWith("不要")) {
    add("print_done", "資料印刷完了",             "資料");
  }
  add("material_check", "資料有無・印刷要否などの確認", "資料");

  // 講師管理画面の「宣伝・ご案内」「前日リマインダー」メールをその場で開くボタン付きタスク
  // （emailType: EmailModalのdefaultTypeとして渡す）
  add("contact_speaker", "セミナーの宣伝",              "前日まで", { emailType: "promo" });
  add("reminder_sent",   "前日リマインダーのメール",     "前日まで", { emailType: "reminder" });
  add("receipt_issued",  "領収証発行（スマイル）",       "前日まで");
  add("app_reception_ready", "倫理アプリ受付準備（ゲスト登録・会員前日まで受付など）", "前日まで");
  add("venue_ready", "会場準備・当日連絡", "前日まで");

  add("receipt_confirmed", "領収証受領内容確認",         "講話後");
  add("thanks_sent",       "講師へのお礼メール",         "講話後", { emailType: "thanks" });
  add("prefecture_report", "県ポータルサイトへ参加人数入力", "講話後");
  add("app_attendee_check","倫理アプリの参加者一覧確認", "講話後");
  add("guest_thanks",      "ゲストへお礼と次回のお知らせ", "講話後");

  return tasks;
}
