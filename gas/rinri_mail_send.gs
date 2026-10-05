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

    // 講師が依頼フォームを送信した直後の自動確認メール（講師本人＋単会・合同事務局CC）。
    // 公開フォーム(form.html)から呼ぶためトークンを持たせられない。代わりに、宛先は1件のみ・
    // 件名と本文の体裁を固定・同一宛先への連続送信と全体の送信数を制限して、踏み台悪用を抑える。
    if (payload.action === 'form_receipt') {
      return jsonResponse_(sendFormReceipt_(payload));
    }

    var token = PropertiesService.getScriptProperties().getProperty('MAIL_SEND_TOKEN');
    if (!token || payload.token !== token) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }

    // アプリが、各単会の代表メールアドレスを預けるための窓口（講師フォームの確認メールで単会にCCするため）
    if (payload.action === 'sync_chapter_emails') {
      return jsonResponse_(syncChapterEmails_(payload));
    }
    // 差出人として使えるアドレス（このアカウントのGmailに「他のメールアドレス」として登録済みのもの）の一覧
    if (payload.action === 'aliases') {
      return jsonResponse_({ ok: true, aliases: GmailApp.getAliases() });
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
    // 差出人は、Gmailに「他のメールアドレス」として登録済みのアドレスしか指定できない（Outlook等の未登録アドレスは不可）。
    // 未登録の場合は失敗させず、合同事務局のアドレスから送り、返信先（Reply-To）を単会アドレスにする。
    var sentAs = 'office';
    if (from) {
      var aliases = GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); });
      if (aliases.indexOf(from.toLowerCase()) >= 0) { options.from = from; sentAs = 'chapter'; }
      else { options.replyTo = from; }
    }

    // PDF等の添付ファイル（base64エンコード済みのデータを受け取り、Blobに戻して添付する）
    // 複数添付は payload.attachments=[{base64, filename, mimeType}]、単数は従来の attachmentBase64 系
    var atts = Array.isArray(payload.attachments) ? payload.attachments.slice(0, 5) : [];
    if (!atts.length && payload.attachmentBase64 && payload.attachmentFilename) {
      atts = [{ base64: payload.attachmentBase64, filename: payload.attachmentFilename, mimeType: payload.attachmentMimeType }];
    }
    var blobs = [];
    atts.forEach(function (a) {
      if (!a || !a.base64 || !a.filename) return;
      var bytes = Utilities.base64Decode(a.base64);
      blobs.push(Utilities.newBlob(bytes, a.mimeType || 'application/pdf', a.filename));
    });
    if (blobs.length) options.attachments = blobs;

    GmailApp.sendEmail(to, subject, body, options);

    return jsonResponse_({ ok: true, sentAs: sentAs });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function sendFormReceipt_(p) {
  var to = String(p.to || '').trim();
  var re = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  if (!re.test(to)) return { ok: false, error: 'invalid to' };

  var ccArr = String(p.cc || '').split(',').map(function (s) { return s.trim(); });
  // フォームから単会アドレスが渡されなかった場合（古いURL）は、アプリから預かった一覧で補う
  var chId = String(p.chapter_id || '').trim();
  if (/^[a-z_]{1,30}$/.test(chId)) {
    var chMail = getChapterEmails_()[chId];
    if (chMail) ccArr.push(chMail);
  }
  var seen = {};
  var cc = ccArr.filter(function (s) {
    var k = s.toLowerCase();
    if (!re.test(s) || seen[k] || k === to.toLowerCase()) return false;
    seen[k] = true; return true;
  }).slice(0, 3).join(',');

  var subject = String(p.subject || '').trim();
  if (subject.indexOf('【講師依頼確認書】') !== 0 || subject.length > 150) {
    return { ok: false, error: 'invalid subject' };
  }
  var body = String(p.body || '');
  if (!body || body.length > 8000) return { ok: false, error: 'invalid body' };

  // 連続送信・総量の制限
  var cache = CacheService.getScriptCache();
  var key = 'receipt_' + to.toLowerCase();
  if (cache.get(key)) return { ok: false, error: 'rate limited' };
  var total = Number(cache.get('receipt_total') || 0);
  if (total >= 60) return { ok: false, error: 'rate limited (total)' };
  cache.put(key, '1', 120);
  cache.put('receipt_total', String(total + 1), 3600);

  var options = { name: '倫理法人会 南部地区合同事務局', replyTo: 'rinri.nanbu@gmail.com' };
  if (cc) options.cc = cc;
  GmailApp.sendEmail(to, subject, body, options);
  return { ok: true };
}

function getChapterEmails_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CHAPTER_EMAILS') || '{}') || {}; }
  catch (err) { return {}; }
}

// 単会ID→代表メールアドレスを、既存の一覧に上書き・追加（空欄の単会は削除）して保存する
function syncChapterEmails_(p) {
  var re = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  var emails = p.emails || {};
  var cur = getChapterEmails_();
  Object.keys(emails).forEach(function (id) {
    if (!/^[a-z_]{1,30}$/.test(id)) return;
    var v = String(emails[id] || '').trim();
    if (!v) { delete cur[id]; }
    else if (re.test(v)) { cur[id] = v; }
  });
  PropertiesService.getScriptProperties().setProperty('CHAPTER_EMAILS', JSON.stringify(cur));
  return { ok: true, count: Object.keys(cur).length };
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
