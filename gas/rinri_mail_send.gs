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
//
// ===================================================
// 追加機能：各単会アドレスを「差出人」として送信する
// ===================================================
// 講師タスク管理（EmailModal）からのメールは、合同事務局からではなく
// 各単会のメールアドレスを差出人として送信したい、という要望に対応するため、
// payload.from に単会メールアドレスが指定された場合は、そのアドレスを
// GmailApp.sendEmail の from オプションに渡して送信する。
//
// ただし Gmail の仕様上、from に指定できるのは「このスクリプトを
// デプロイしたアカウント（rinri.nanbu@gmail.com）」自身が
// Gmail設定で「他のメールアドレスを追加」（Send mail as）として
// 事前に登録・確認済みのアドレスに限られる。未登録のアドレスを
// 指定した場合はGoogle側でエラーになり、そのままメール送信に失敗する。
//
// 【単会ごとに1回だけ必要な設定手順】（rinri.nanbu@gmail.com でログインして行う）
//   1. Gmailを開き、右上の歯車 →「すべての設定を表示」
//   2.「アカウントとインポート」タブ →「名前」の下、
//      「他のメールアドレスを追加」をクリック
//   3. 単会のメールアドレス（例：nizashikirinri@gmail.com）を入力して次へ
//      「エイリアスとして扱います」にチェックを入れて次のステップへ
//   4. 確認コード付きのメールがその単会アドレス宛に届くので、
//      単会側にメール本文中のリンクをクリック（またはコードを入力）してもらう
//   5. 確認が完了すると、以後そのアドレスを from に指定して送信できるようになる
//   ※ 5単会すべてで同様に設定すれば、各単会からの送信が可能になる
//   ※ 未確認のアドレスを from に指定した場合は下記 catch でエラーが返り、
//      アプリ側は自動的に合同事務局からの送信にフォールバックしない
//      （フォールバックはアプリ側のコードで別途行っている）

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
    var from    = String(payload.from || '').trim();
    var senderName = String(payload.senderName || '').trim();

    if (!to || !subject) {
      return jsonResponse_({ ok: false, error: 'to または subject が空です' });
    }

    var options = { name: senderName || '倫理法人会 南部地区合同事務局' };
    if (cc) options.cc = cc;
    if (from) options.from = from;

    // PDF等の添付ファイル（base64エンコード済みのデータを受け取り、Blobに戻して添付する）
    if (payload.attachmentBase64 && payload.attachmentFilename) {
      var mimeType = payload.attachmentMimeType || 'application/pdf';
      var bytes = Utilities.base64Decode(payload.attachmentBase64);
      var blob  = Utilities.newBlob(bytes, mimeType, payload.attachmentFilename);
      options.attachments = [blob];
    }

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
