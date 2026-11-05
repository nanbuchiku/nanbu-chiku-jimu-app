-- 基礎講座の「第◯講」の確認（読むだけ。データは変更しない）
-- ルール：単会ごとに 2026-09-01 以降の基礎講座を日付順に数える（第1〜18講で循環）。
-- 中止・休会は数えない。同じ日の行は1回として数える。
with kiso as (
  select id, chapter_id, seminar_date, speaker_name, status, kiso_number,
         regexp_replace(coalesce(speaker_name, ''), '[[:space:]　]', '', 'g') as name_key
  from public.speakers
  where seminar_type = 'kiso' and seminar_date >= '2026-09-01'
),
counted as (
  select *, dense_rank() over (partition by chapter_id order by seminar_date) as nth
  from kiso
  where coalesce(status, '') not in ('cancelled', 'kyukai')
)
select
  k.chapter_id as 単会,
  k.seminar_date as 開催日,
  k.speaker_name as 講師,
  k.status as 状態,
  k.kiso_number as 今の番号,
  case when c.nth is null then null else ((c.nth - 1) % 18) + 1 end as 正しい番号,
  case
    when c.nth is null then '数えない'
    when k.kiso_number is null then '未選択'
    when k.kiso_number::text = (((c.nth - 1) % 18) + 1)::text then 'OK'
    else 'ズレ'
  end as 判定,
  case when count(*) over (partition by k.chapter_id, k.name_key) > 1 then '同じ講師が複数行' else '' end as 重複
from kiso k
left join counted c on c.id = k.id
order by k.chapter_id, k.seminar_date, k.id;
