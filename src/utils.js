import { CHAPTERS, SEMINAR_TYPES } from './constants';

const FALLBACK_CHAPTER = { id:"", name:"不明", short:"?", color:"#90A4AE", accent:"#B0BEC5", light:"#FAFAFA", day:-1, dayName:"不明", venue:"", time:"" };
export const getChapter = id => CHAPTERS.find(c => c.id === id) || FALLBACK_CHAPTER;
export const getSeminarType = id => SEMINAR_TYPES.find(t => t.id === id) || SEMINAR_TYPES[0];
export const realToday = () => new Date();
export const toDateStr = d => {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};

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

export function extractStaffNotes(notes) {
  if (!notes) return '';
  return notes
    .replace(/【内容要約】\n[\s\S]*?(?=\n【|$)/g, '')
    .replace(/【[^】]+】[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
