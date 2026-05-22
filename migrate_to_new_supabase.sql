-- =============================================
-- 新Supabaseプロジェクト移行用SQL
-- 新座のSQLエディタで実行してください
-- =============================================

-- 1. テーブル作成
CREATE TABLE IF NOT EXISTS districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chapters (
  id text PRIMARY KEY,
  district_id uuid REFERENCES districts(id),
  name text NOT NULL,
  short_name text,
  day integer,
  day_name text,
  color text,
  light text,
  accent text,
  time text,
  venue text,
  address text,
  venue_tel text,
  map_url text,
  staff text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS speakers (
  id text PRIMARY KEY DEFAULT ('s' || floor(extract(epoch from now()) * 1000)::text),
  chapter_id text,
  district_id uuid,
  seminar_type text DEFAULT 'ms',
  speaker_name text,
  speaker_kana text,
  speaker_unit text,
  company text,
  company_role text,
  role text,
  seminar_date date,
  topic text,
  status text DEFAULT 'pending',
  phone text,
  email text,
  request_date date,
  notes text,
  venue text,
  line_notified boolean DEFAULT false,
  material_url text,
  material_name text,
  lodging text,
  print_required text,
  speaker_checks jsonb DEFAULT '{}',
  calendar_added boolean DEFAULT false,
  drinks_alcohol text,
  shiori_article text,
  post_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY DEFAULT ('t' || floor(extract(epoch from now()) * 1000)::text),
  chapter_id text,
  district_id uuid,
  title text NOT NULL,
  due_date date,
  done boolean DEFAULT false,
  priority text DEFAULT 'medium',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rinri_emails (
  id text PRIMARY KEY,
  district_id text NOT NULL DEFAULT 'nanbu',
  from_email text,
  subject text,
  received_at text,
  has_deadline boolean DEFAULT false,
  deadline_date text,
  body_preview text,
  drive_url text,
  sheet_row integer,
  created_at timestamptz DEFAULT now()
);

-- 2. RLS無効化（必要に応じて設定）
ALTER TABLE districts DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapters DISABLE ROW LEVEL SECURITY;
ALTER TABLE speakers DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE rinri_emails DISABLE ROW LEVEL SECURITY;

-- 3. データ投入

-- districts
INSERT INTO districts (id, name, created_at) VALUES
('11111111-1111-1111-1111-111111111111', '南部地区', '2026-04-19 11:54:38.82535+00')
ON CONFLICT (id) DO NOTHING;

-- chapters
INSERT INTO chapters (id, district_id, name, short_name, day, day_name, color, light, accent, time, venue, address, venue_tel, map_url, staff, created_at) VALUES
('todawarabi', '11111111-1111-1111-1111-111111111111', 'とだわらび', 'とだわらび', 2, '火曜日', '#1B5E20', '#E8F5E9', '#A5D6A7', 'AM6:00〜7:00', '戸田市商工会館', '戸田市上戸田１−２１−２３', '０４８−４４１−２６１７', 'https://share.google/LBrDQ6899ccNm89hv', '', '2026-04-19 11:54:38.82535+00'),
('kawaguchi_east', '11111111-1111-1111-1111-111111111111', '川口東', '川口東', 3, '水曜日', '#1A3A6B', '#E3F2FD', '#90CAF9', 'AM6:00〜7:00', '川口緑化センター　樹里安', '川口安行領家８４４−２', '―', 'https://share.google/7QSKHBQCh0the5Cb7', '', '2026-04-19 11:54:38.82535+00'),
('niizashiki', '11111111-1111-1111-1111-111111111111', '新座・志木', '新座志木', 4, '木曜日', '#6D4C9F', '#EDE7F6', '#B39DDB', 'AM6:00〜7:00', 'CKスクエア新座　６F', '新座市野火止５−２−１０', '―', 'https://share.google/rSXTQ2jqiGDttsCyE', '小林靖会長', '2026-04-19 11:54:38.82535+00'),
('asaka', '11111111-1111-1111-1111-111111111111', '朝霞', '朝霞', 5, '金曜日', '#BF360C', '#FFF3E0', '#FFCC80', 'AM6:30〜7:30', '浜崎会館　２Fホール（氷川神社境内）', '朝霞市浜崎３丁目９番地', '―', 'https://maps.app.goo.gl/phdDu7hZSuUbmErN6', '', '2026-04-19 11:54:38.82535+00'),
('kawaguchi', '11111111-1111-1111-1111-111111111111', '川口', '川口', 6, '土曜日', '#B71C1C', '#FFEBEE', '#EF9A9A', 'AM6:30〜7:30', '元郷四丁目町会会館', '川口市元郷４丁目１２−２', '―', 'https://share.google/nIYPjDL6MsMpt1ek8', '', '2026-04-19 11:54:38.82535+00')
ON CONFLICT (id) DO NOTHING;

-- speakers
INSERT INTO speakers (id, chapter_id, district_id, seminar_type, speaker_name, speaker_kana, speaker_unit, company, company_role, role, seminar_date, topic, status, phone, email, request_date, notes, venue, line_notified, material_url, material_name, lodging, print_required, speaker_checks, calendar_added, created_at) VALUES
('s1778867819022', 'niizashiki', '11111111-1111-1111-1111-111111111111', 'ms', '小串和美', 'ほしなのぞみ', '新座・志木倫理法人会', '代表', 'ほしなのぞみNET', '事務長', '2026-05-22', 'テスラと栞と宇宙の法則', 'confirmed', '07083571212', 'kazu20210205@icloud.com', '2026-05-15', '【内容要約】\n科学で証明。100日実践の裏側で何が起きているか\n【交通手段】お車\n【単会で準備】プロジェクタ・パソコン\n【禁煙ルーム】禁煙／【お迎え】要\n【領収証宛名】個人宛\n【領収証郵便番号】350-2226\n【領収証住所】鶴ヶ島市中新田３６０−３２\n【顔写真の使用範囲】全媒体承諾', null, false, null, '顔写真', '要', '要（単会で印刷）', '{"hotel_paid":true,"hotel_sent":true,"hotel_booked":true,"hotel_pickup":true,"hotel_greeting":true}', false, '2026-05-15 17:56:59.471616+00'),
('s1778933237843', 'todawarabi', '11111111-1111-1111-1111-111111111111', 'ms', '星奈希見', 'ほしなのぞみ', '新座・志木倫理法人会', 'ほしなのぞみNET', '代表', '事務長', '2026-05-26', 'リアル', 'confirmed', '07083571212', 'hosina0447@gmail.com', '2026-05-16', '【内容要約】\nモーニング\n【交通手段】お車\n【単会で準備】プロジェクタ・ホワイトボード\n【禁煙ルーム】禁煙／【お迎え】要\n【領収証宛名】個人宛\n【領収証郵便番号】350-2226\n【領収証住所】鶴ヶ島市中新田３６０−３２\n【顔写真の使用範囲】全媒体承諾', null, false, null, '顔写真', '要', '要（単会で印刷）', '{"hotel_paid":true,"hotel_sent":true,"hotel_booked":true,"hotel_pickup":true,"hotel_greeting":true}', false, '2026-05-16 12:07:18.021573+00'),
('s1778976190855', 'todawarabi', '11111111-1111-1111-1111-111111111111', 'ms', '星奈希見', 'ほしなのぞみ', '新座・志木倫理法人会', 'ほしなのぞみNET', '代表', '事務長', '2026-05-26', '科学とAIと倫理', 'confirmed', '07083571212', 'hosina0447@gmail.com', '2026-05-17', '【内容要約】\n栞の言葉　行動　引き寄せ\n【交通手段】お車\n【単会で準備】プロジェクタ・パソコン・ホワイトボード\n【禁煙ルーム】禁煙／【お迎え】不要\n【領収証宛名】会社宛\n【領収証郵便番号】350-2226\n【領収証住所】鶴ヶ島市中新田３６０−３２\n【顔写真の使用範囲】全媒体承諾', null, false, null, '顔写真', '要', '要（単会で印刷）', '{"hotel_paid":true,"hotel_sent":false,"hotel_greeting":false}', false, '2026-05-17 00:03:11.386686+00'),
('s1779249271218', 'niizashiki', '11111111-1111-1111-1111-111111111111', 'kiso', '星奈希見', 'ほしなのぞみ', '新座・志木倫理法人会', 'ほしなのぞみNET', '代表', '事務長', '2026-08-06', 'テスラと栞と宇宙の法則', 'confirmed', '07083571212', 'hosina0447@gmail.com', '2026-05-20', '【内容要約】\nテスラさん\n【交通手段】電車\n【単会で準備】無し\n【禁煙ルーム】禁煙／【お迎え】要\n【領収証宛名】個人宛\n【領収証郵便番号】3502226\n【領収証住所】鶴ヶ島市中新田360-32\n【顔写真の使用範囲】全媒体承諾', null, false, null, '顔写真', '要', '要（単会で印刷）', '{}', false, '2026-05-20 03:54:31.715754+00'),
('s1779402134918', 'niizashiki', '11111111-1111-1111-1111-111111111111', 'ms', '荒井　秀樹', 'あらいひでき', '西入間', '有限会社　リトルプリンス', '会長', '相談役', '2026-07-02', '倫理の学びを実践し、仕事と人生を楽しむ', 'confirmed', '09032180163', 'litpri.arai@gmail.com', '2026-05-21', '【内容要約】\n創業から40年で数々の苦難は倫理の学びを実践して解決。\n社員さんへ事業承継、その後新規事業をスタート。仕事と人生を楽しむ (  勤労歓喜　)\n【交通手段】お車\n【単会で準備】ホワイトボード\n【領収証宛名】個人宛\n【領収証郵便番号】350-1175\n【領収証住所】川越市笠幡2614\n【顔写真の使用範囲】全媒体承諾', null, false, null, '顔写真', '不要', '不要', '{}', false, '2026-05-21 22:22:15.531493+00'),
('s1779413326012', 'niizashiki', '11111111-1111-1111-1111-111111111111', 'ms', '谷口　友保', 'たにぐちともやす', '新宿区', '株式会社M&Aコーポレート・アドバザリー', '代表取締役', '事務長', '2026-07-30', 'パワハラ社長の涙　-美しき罪悪（ツミ）-', 'confirmed', '09085583061', 'taniguchi@ma-advisory.com', '2026-05-22', '【内容要約】\nパワハラ社長であった私が倫理法人会に入会して、どんなことを学び、どんな気づきを得て、どんな風に変わっていったのか、そしてその結果どんな素晴らしい結果が出たのか、をお話しさせていただきます！\n【交通手段】お車\n【単会で準備】プロジェクタ\n【領収証宛名】個人宛\n【領収証郵便番号】154-0002\n【領収証住所】東京都世田谷区下馬6-41-13\n【顔写真の使用範囲】全媒体承諾', null, false, null, '顔写真', '不要', '不要（持参）', '{}', false, '2026-05-22 01:28:48.999238+00')
ON CONFLICT (id) DO NOTHING;

-- tasks
INSERT INTO tasks (id, chapter_id, district_id, title, due_date, done, priority, completed_at, created_at) VALUES
('t1778980026345', 'niizashiki', '11111111-1111-1111-1111-111111111111', '会計商標類の', '2026-05-26', false, 'high', null, '2026-05-17 01:07:06.507197+00'),
('t1778981255460', 'niizashiki', '11111111-1111-1111-1111-111111111111', '会計入力', '2026-05-28', false, 'medium', null, '2026-05-17 01:27:36.012969+00')
ON CONFLICT (id) DO NOTHING;
