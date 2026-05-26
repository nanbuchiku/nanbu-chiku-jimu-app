-- ============================================================
-- rinri_emails テーブルのデータ全削除
-- 理由: アプリが Gmail API を直接参照するようになったため不要
--       GAS からの Supabase 書き込みも停止済み (2026-05)
-- 実行場所: Supabase Dashboard > SQL Editor
-- ============================================================

-- 既存データをすべて削除（テーブル構造は残す）
TRUNCATE TABLE rinri_emails;

-- 確認用（0件になっていればOK）
SELECT COUNT(*) AS remaining_rows FROM rinri_emails;
