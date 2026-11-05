import { isTaskDone } from '../utils';

// 講師の行を誤って増やす・消すのを防ぐための判定。

// 「花谷　彰久」「花谷 彰久」「花谷彰久」を同じ名前として扱う
export function normalizeName(name) {
  return String(name || '').normalize('NFKC').replace(/\s+/g, '');
}

// 同じ単会・同じ開催日・同じ講師名の行を探す（excludeId の行は除く）
export function findSameSpeaker(rows, { chapterId, seminarDate, speakerName }, excludeId) {
  const name = normalizeName(speakerName);
  if (!name || !chapterId || !seminarDate) return null;
  return (rows || []).find(s =>
    s.id !== excludeId &&
    s.chapterId === chapterId &&
    s.seminarDate === seminarDate &&
    normalizeName(s.speakerName) === name
  ) || null;
}

// 講師のフォーム回答や、消すと困る入力が入っている行か
export function hasSpeakerAnswer(sp) {
  if (!sp) return false;
  return isTaskDone(sp.speakerChecks, 'form_recvd') || !!(sp.topic || sp.speakerKana || sp.materialUrl);
}
