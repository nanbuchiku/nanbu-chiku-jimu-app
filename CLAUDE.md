# 倫理法人会 南部地区5単会タスク管理アプリ

## プロジェクト概要

倫理法人会 南部地区（埼玉）の5単会が共同で使う事務局向け業務管理アプリ。
講師の登録・管理、講話依頼確認フォーム、チラシデータ管理、タスク管理を一元化する。
GitHub Pages で公開し、データは Supabase に保存。

## 公開URL

- アプリ本体: https://nanbuchiku.github.io/nanbu-chiku-jimu-app/
- 講師依頼確認フォーム: https://nanbuchiku.github.io/nanbu-chiku-jimu-app/form.html

## 5単会

| ID | 単会名 | 曜日 | 備考 |
|----|--------|------|------|
| todawarabi | とだわらび | 火曜 | |
| kawaguchi_east | 川口東 | 水曜 | |
| niizashiki | 新座・志木 | 木曜 | |
| asaka | 朝霞 | 金曜 | |
| kawaguchi | 川口 | 土曜 | |

## セミナー種別

- ms: モーニングセミナー（メイン）
- kiso: 倫理経営基礎講座
- tsudoi: 経営者の集い
- evening: イブニングセミナー
- koen: 倫理経営講演会

## 技術スタック

- フロントエンド: React (JSX) + Vite 5
- データベース: Supabase (PostgreSQL)
- ホスティング: GitHub Pages
- CI/CD: GitHub Actions（mainへのpushで自動ビルド・デプロイ）
- PDF生成: html2pdf.js
- Excel出力: exceljs
- ZIP生成: jszip

## ビルド手順

iCloud フォルダ内で `npm install` すると node_modules が壊れる場合がある。
その場合は `/tmp/nanbu-build` にソースをコピーしてビルドする：

```bash
mkdir -p /tmp/nanbu-build/src/components /tmp/nanbu-build/src/lib
cp -R ~/Desktop/nanbu-chiku-jimu-app/src/* /tmp/nanbu-build/src/
cp ~/Desktop/nanbu-chiku-jimu-app/{package.json,package-lock.json,vite.config.js,index.html} /tmp/nanbu-build/
cd /tmp/nanbu-build && npm install && npm run build
```

ソースの変更は元のリポジトリでコミット・プッシュ。
GitHub Actions が独自にビルド・デプロイするので、ローカルの dist は不要。

## Git プッシュ

リポジトリオーナーは `nanbuchiku` アカウント。
`hosina0447-ctrl` では権限がないため、nanbuchiku の PAT でプッシュする：

```bash
git push https://nanbuchiku:<PAT>@github.com/nanbuchiku/nanbu-chiku-jimu-app.git main
```

## ファイル構成

```
nanbu-chiku-jimu-app/
├── index.html              （Vite エントリ）
├── form.html               （講師依頼確認フォーム、単独HTML）
├── vite.config.js
├── src/
│   ├── App.jsx             （メインコンポーネント、タブ管理、モーダル管理）
│   ├── constants.js        （CHAPTERS, SEMINAR_TYPES, STATUS 定数）
│   ├── utils.js            （日付処理、講師タスク生成など）
│   ├── styles.js           （共通スタイル定数）
│   ├── lib/
│   │   ├── supabase.js     （DB接続、fromDB/toDB変換）
│   │   └── fontScale.js    （文字サイズ設定）
│   └── components/
│       ├── Dashboard.jsx         （ダッシュボード）
│       ├── CalendarView.jsx      （カレンダー）
│       ├── SpeakersView.jsx      （講師一覧・管理）
│       ├── SpeakerContactView.jsx（講師連絡タスク）
│       ├── SpeakerTasksView.jsx  （講師別タスク進捗）
│       ├── SpeakerForm.jsx       （講師登録・編集フォーム）
│       ├── DocumentView.jsx      （確認書作成・プレビュー）
│       ├── FormURLModal.jsx      （講師依頼確認フォームURL生成）
│       ├── EmailModal.jsx        （メール送信モーダル）
│       ├── FlyerView.jsx         （チラシ流し込みデータ管理）
│       ├── TasksView.jsx         （汎用タスク管理）
│       ├── RankingView.jsx       （完了ランキング）
│       ├── FaxPrintModal.jsx     （FAX用紙印刷）
│       ├── FileViewModal.jsx     （ファイルプレビュー）
│       ├── SettingsModal.jsx     （単会設定）
│       ├── LoginPage.jsx         （ログイン）
│       └── ErrorBoundary.jsx
├── gas/                    （Google Apps Script 連携）
├── scripts/                （ユーティリティスクリプト）
└── .github/workflows/      （GitHub Actions デプロイ設定）
```

## 主要機能

### タブ構成（サイドバー）

1. ダッシュボード - 全体概要、今週の予定
2. 講師管理 - 講師一覧、スマートメールボタン、LINE送信
3. 講師連絡タスク - メール/LINE連絡をタスクとして独立管理
4. 確認書作成 - 講話依頼確認書PDF
5. 講師タスク - 講師別のチェックリスト進捗
6. チラシ管理 - 月別チラシ流し込みデータ、印刷会社送付
7. タスク管理 - 汎用タスク
8. 完了ランキング

### 講師依頼確認フォーム（form.html）

- 講師がブラウザで回答する独立HTML
- URLパラメータで講師情報をプリセット
- 3ページ構成（プロフィール → 講話内容 → 写真・資料）
- 基礎講座の場合: 顔写真は任意、第○講の入力欄あり
- コンボボックス式の役職選択（24種 + 自由入力）
- 回答は Supabase に直接保存

### メール送信

- スマートメール: 日付に応じて自動でタイプ選択（お礼/リマインド/資料催促/宣伝案内）
- 宣伝メール: 10パターンのアピール文を「🔄」ボタンで切り替え
- メーラー自動判定: 単会メールアドレスのドメインで Gmail/Outlook/デフォルトを判別
- LINE送信: 10パターンの宣伝文、コピーしてLINEに貼り付け

### チラシ管理

- 月別の講師データ完成度を5単会横断で管理
- 締め切り: 対象月の前月10日（「チラシデータ事務局宛て締め切り」）
- LINE/メールで印刷会社へデータ送付
- ZIP/Google Drive/Canva 連携

## Supabase

- プロジェクトID: leqavpnmtylmankbcdkd
- 主要テーブル: speakers, tasks, chapter_settings, rinri_emails
- district_id: 'nanbu' でフィルタ

## デザイン方針

- デスクトップ優先（事務局PCで使用）
- サイドバーナビゲーション
- メインカラー: ネイビー (#061B44)
- 各単会に固有のカラーコード
- clamp() による可変フォントサイズ
- 印刷対応（.no-print / .sp-print-only）
