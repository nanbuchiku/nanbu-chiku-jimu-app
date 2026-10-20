// 「フォーム回答の一覧」：講師フォームの入力の保管表(form_submissions)と、講師の行(speakers)を突き合わせる処理。
import { fromDB } from './supabase';
import { extractStaffNotes } from '../utils';

const norm = v => String(v == null ? '' : v).trim();

// 同じ講師（同じURLのID）が何度も送った場合は、いちばん新しい回答だけを「現在の回答」として扱う
export function markLatest(subs) {
  const seen = new Set();
  return [...(subs || [])]
    .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
    .map(s => { const key = s.speaker_id || `#${s.id}`; const latest = !seen.has(key); seen.add(key); return { ...s, latest }; });
}

// 反映の状態：'ok'＝講師の行に入っている／'stale'＝行はあるが入っていない／'missing'＝行そのものがない
// （フォームが新しい行として登録し直した場合も「入っている」とみなすため、同じ単会・同じ日付・同じテーマの行も探す）
export function reflectionStatus(sub, speakers) {
  const p = sub.payload || {};
  const topic = norm(p.topic);
  const row = (speakers || []).find(s => s.id === sub.speaker_id);
  if (row && norm(row.topic) === topic) return { status: 'ok', row };
  const alt = (speakers || []).find(s => s.chapterId === sub.chapter_id && s.seminarDate === sub.seminar_date && norm(s.topic) === topic && topic);
  if (alt) return { status: 'ok', row: alt };
  return { status: row ? 'stale' : 'missing', row: row || null };
}

// 既存の行に反映するときの、変更項目（変えた項目だけを保存する updateSpeaker に渡す）
// 事務局が行に書いたメモ（構造化タグ以外）は残す
export function buildApplyPatch(sub, row) {
  const p = sub.payload || {};
  const staff = extractStaffNotes(row?.notes || '');
  const notes = [p.notes || '', staff].filter(Boolean).join('\n\n');
  const patch = {
    speakerKana: p.speaker_kana ?? '', company: p.company ?? '', companyRole: p.company_role ?? '',
    role: p.role ?? '', phone: p.phone ?? '', topic: p.topic ?? '', notes,
    lodging: p.lodging ?? row?.lodging ?? '', printRequired: p.print_required ?? '',
    status: 'confirmed', formRequestedAt: null,
    speakerChecks: { ...(row?.speakerChecks || {}), form_recvd: { done: true, at: sub.submitted_at } },
  };
  if (p.material_url) { patch.materialUrl = p.material_url; patch.materialName = p.material_name || '顔写真'; }
  if (p.kiso_number) patch.kisoNumber = p.kiso_number;
  if (p.ms_topic) patch.msTopic = p.ms_topic;
  return patch;
}

// 行そのものがないときに作る、新しい行（URLのIDをそのまま使う＝講師が送り直しても、同じ行に入る）
export function buildNewRow(sub) {
  const p = { ...(sub.payload || {}) };
  const base = fromDB({ ...p, id: sub.speaker_id || ('s' + Date.now()) });
  return {
    ...base,
    chapterId: base.chapterId || sub.chapter_id, seminarDate: base.seminarDate || sub.seminar_date,
    seminarType: base.seminarType || sub.seminar_type || 'ms', speakerName: base.speakerName || sub.speaker_name,
    status: 'confirmed', formRequestedAt: null,
    requestDate: String(sub.submitted_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    speakerChecks: { form_recvd: { done: true, at: sub.submitted_at } },
  };
}
