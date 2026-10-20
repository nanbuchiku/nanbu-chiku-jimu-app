-- =====================================================================
-- 安全網（2026-10-20）：Supabase の SQL Editor で、1回だけ実行する
--   ① 変更履歴：講師の行(speakers)が書き換わる・削除されるたびに、元の内容を自動で保存する
--   ② 講師フォームの入力を、1通ずつ別の表に保存する（講師の行が消えても、入力は残る）
-- 何度実行しても同じ結果になるように書いてある（再実行しても安全）
-- =====================================================================

-- ① 変更履歴 ---------------------------------------------------------
create table if not exists public.speakers_history (
  hid        bigserial primary key,
  changed_at timestamptz not null default now(),
  op         text not null,              -- UPDATE（書き換え） / DELETE（削除）
  speaker_id text,
  old_row    jsonb not null              -- 書き換え・削除される前の、行の内容まるごと
);
create index if not exists speakers_history_sid on public.speakers_history (speaker_id, changed_at desc);
alter table public.speakers_history enable row level security;
drop policy if exists history_read on public.speakers_history;
create policy history_read on public.speakers_history for select to authenticated using (true);
grant select on public.speakers_history to authenticated;

create or replace function public.speakers_keep_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.speakers_history(op, speaker_id, old_row) values (TG_OP, OLD.id, to_jsonb(OLD));
  return null;
end $$;

drop trigger if exists speakers_history_upd on public.speakers;
create trigger speakers_history_upd after update on public.speakers
  for each row when (old.* is distinct from new.*) execute function public.speakers_keep_history();
drop trigger if exists speakers_history_del on public.speakers;
create trigger speakers_history_del after delete on public.speakers
  for each row execute function public.speakers_keep_history();

-- ② 講師フォームの入力の保管 -------------------------------------------
create table if not exists public.form_submissions (
  id           bigserial primary key,
  submitted_at timestamptz not null default now(),
  speaker_id   text,          -- 講師に送ったURLのID（新規依頼のときは、フォームが作った行のID）
  chapter_id   text,
  seminar_date text,
  seminar_type text,
  speaker_name text,
  payload      jsonb not null -- 講師が送った内容そのもの
);
create index if not exists form_submissions_sid on public.form_submissions (speaker_id, submitted_at desc);
alter table public.form_submissions enable row level security;
drop policy if exists submissions_insert on public.form_submissions;
create policy submissions_insert on public.form_submissions for insert to anon, authenticated with check (true);
drop policy if exists submissions_read on public.form_submissions;
create policy submissions_read on public.form_submissions for select to authenticated using (true);
grant insert on public.form_submissions to anon, authenticated;
grant select on public.form_submissions to authenticated;
grant usage, select on sequence public.form_submissions_id_seq to anon, authenticated;

-- 確認：作られたものの一覧
select 'speakers_history' as name, count(*) from public.speakers_history
union all select 'form_submissions', count(*) from public.form_submissions;
