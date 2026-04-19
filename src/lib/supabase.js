import { createClient } from '@supabase/supabase-js';
import { DISTRICT_ID } from '../constants';

const SUPABASE_URL = 'https://leqavpnmtylmankbcdkd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sAahVVEPRHnLDsOxawsI5w_XtGZe25O';

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

export const fromDB = r => ({
  id: r.id, chapterId: r.chapter_id, seminarType: r.seminar_type,
  speakerName: r.speaker_name, speakerKana: r.speaker_kana, speakerUnit: r.speaker_unit,
  company: r.company, role: r.role, seminarDate: r.seminar_date, topic: r.topic,
  status: r.status, phone: r.phone, email: r.email, requestDate: r.request_date,
  notes: r.notes, venue: r.venue, lineNotified: r.line_notified,
  materialUrl: r.material_url, materialName: r.material_name,
  lodging: r.lodging, printRequired: r.print_required,
  speakerChecks: r.speaker_checks || {}, calendarAdded: r.calendar_added,
  drinksAlcohol: r.drinks_alcohol, shioriArticle: r.shiori_article, postNotes: r.post_notes,
});

export const toDB = o => ({
  id: o.id, chapter_id: o.chapterId, district_id: DISTRICT_ID,
  seminar_type: o.seminarType, speaker_name: o.speakerName, speaker_kana: o.speakerKana,
  speaker_unit: o.speakerUnit, company: o.company, role: o.role,
  seminar_date: o.seminarDate, topic: o.topic, status: o.status,
  phone: o.phone, email: o.email, request_date: o.requestDate, notes: o.notes,
  venue: o.venue, line_notified: o.lineNotified, material_url: o.materialUrl,
  material_name: o.materialName, lodging: o.lodging, print_required: o.printRequired,
  speaker_checks: o.speakerChecks || {}, calendar_added: o.calendarAdded,
  drinks_alcohol: o.drinksAlcohol, shiori_article: o.shioriArticle, post_notes: o.postNotes,
});

export const taskFromDB = r => ({
  id: r.id, chapterId: r.chapter_id, title: r.title, dueDate: r.due_date,
  done: r.done, priority: r.priority, completedAt: r.completed_at,
});

export const taskToDB = o => ({
  id: o.id, chapter_id: o.chapterId, district_id: DISTRICT_ID,
  title: o.title, due_date: o.dueDate, done: o.done,
  priority: o.priority, completed_at: o.completedAt,
});
