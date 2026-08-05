// ===================================================
// 講師依頼メールを「合同事務局アカウント自身」から確実に送信するWebアプリ
// ===================================================
// 目的：
//   これまでアプリの「Gmailで開く」ボタンは、操作した人のブラウザが
//   rinri.nanbu@gmail.com にログイン済みでない限り、その人個人の
//   アカウントから送信されてしまい、
//     ・合同事務局の送信履歴に残らない
//     ・送信元がどのアカウントか分からず不安
//   という問題があった。
//   このスクリプトを合同事務局アカウント自身にデプロイして使うことで、
//   誰がボタンを押しても必ず合同事務局アカウントから送信され、
//   合同事務局の「送信済み」フォルダに確実に残るようになる。
//
// デプロイ手順（rinri.nanbu@gmail.com でログインした状態で行う）：
//   1. https://script.google.com/ を開く（合同事務局アカウントでログイン）
//   2. 「新しいプロジェクト」→ このファイルの中身を貼り付けて保存
//   3. 左メニュー「プロジェクトの設定」→「スクリプト プロパティ」で
//      MAIL_SEND_TOKEN というキーに、他人に推測されない長いランダム文字列を設定
//      （例：openssl rand -hex 24 などで生成したもの）
//   4. 右上「デプロイ」→「新しいデプロイ」→ 種類は「ウェブアプリ」
//      - 実行するユーザー：自分（rinri.nanbu@gmail.com）
//      - アクセスできるユーザー：全員
//      デプロイ実行時に権限の承認を求められるので許可する
//   5. 発行された「ウェブアプリ URL」をコピーし、
//      GitHub Secrets の VITE_MAIL_SEND_URL に設定
//      （手順3で決めたトークンは VITE_MAIL_SEND_TOKEN に設定）
//
// 注意：
//   この仕組みはトークンさえ知っていれば誰でも呼び出せる公開エンドポイントです。
//   トークンはアプリのビルド後のJSファイル内に埋め込まれるため、
//   ブラウザの開発者ツールを使えば技術的には見えてしまいます
//   （現状のSupabase publishable keyと同じ性質のリスクです）。
//   万一漏れた場合は、MAIL_SEND_TOKEN を再発行して再デプロイしてください。

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    var token = PropertiesService.getScriptProperties().getProperty('MAIL_SEND_TOKEN');
    if (!token || payload.token !== token) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }

    var to      = String(payload.to || '').trim();
    var cc      = String(payload.cc || '').trim();
    var subject = String(payload.subject || '').trim();
    var body    = String(payload.body || '');

    if (!to || !subject) {
      return jsonResponse_({ ok: false, error: 'to または subject が空です' });
    }

    var options = { name: '倫理法人会 南部地区合同事務局' };
    if (cc) options.cc = cc;

    GmailApp.sendEmail(to, subject, body, options);

    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
