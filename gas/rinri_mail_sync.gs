// ===================================================
// 倫理法人会メール → Google Drive + Supabase 連携
// ===================================================

var CONFIG = {
  SUPABASE_URL:    'https://leqavpnmtylmankbcdkd.supabase.co',
  SUPABASE_KEY:    'sb_publishable_sAahVVEPRHnLDsOxawsI5w_XtGZe25O',
  DISTRICT_ID:     'nanbu',
  DRIVE_FOLDER_ID: '',   // ← 保存先フォルダID（初回設定必須）
  SHEET_NAME:      '倫理メール一覧',
  ALLOWED_SENDERS: ['saitamaken@rinri-saitama.org', 'shioiri@rinri-saitama.org'],
  DEADLINE_PATTERNS: [
    /(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/,   // 2026年5月31日 / 2026/05/31
    /(\d{1,2})[月\/](\d{1,2})日?(?:まで|迄|締切|期限)/,  // 5月31日まで
    /(?:まで|迄|締切|期限)[^\d]{0,5}(\d{1,2})[月\/](\d{1,2})/,
  ],
  EXCLUDE_URL_PATTERN: /https?:\/\/(www\.)?(pref\.|city\.|go\.jp)/,
};

// ===================================================
// メインエントリーポイント（トリガー設定推奨: 毎時）
// ===================================================
function syncRinriMails() {
  var props   = PropertiesService.getScriptProperties();
  var lastRun = props.getProperty('LAST_RUN_DATE');
  var sheet   = getOrCreateSheet_();

  // 初回は30日遡り、以降は前回実行以降
  var after = lastRun ? new Date(lastRun) : new Date(Date.now() - 30 * 86400000);
  var query  = buildGmailQuery_(after);
  var threads = GmailApp.search(query, 0, 100);

  var processed = 0;
  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(msg) {
      if (msg.getDate() <= after) return;
      var from = extractEmail_(msg.getFrom());
      if (!CONFIG.ALLOWED_SENDERS.some(function(s){ return from.indexOf(s) !== -1; })) return;

      var result = processMessage_(msg, sheet);
      if (result) processed++;
    });
  });

  props.setProperty('LAST_RUN_DATE', new Date().toISOString());
  Logger.log('処理件数: ' + processed);
}

// ===================================================
// 1通分の処理
// ===================================================
function processMessage_(msg, sheet) {
  var subject  = msg.getSubject();
  var body     = msg.getPlainBody();
  var from     = extractEmail_(msg.getFrom());
  var dateStr  = msg.getDate().toISOString();
  var id       = 'gas_' + msg.getId();

  // 本文プレビュー（先頭300文字）
  var preview = body.replace(/\r?\n/g, ' ').trim().substring(0, 300);

  // 締切日の抽出
  var deadlineInfo = extractDeadline_(subject + '\n' + body, msg.getDate());

  // Drive 保存
  var driveUrl = '';
  if (CONFIG.DRIVE_FOLDER_ID) {
    try {
      var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      var fileName = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyyMMdd_HHmm') + '_' + subject.substring(0, 40) + '.txt';
      var content  = '差出人: ' + msg.getFrom() + '\n受信日時: ' + msg.getDate() + '\n件名: ' + subject + '\n\n' + body;
      var file = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
      driveUrl = file.getUrl();
    } catch(e) {
      Logger.log('Drive保存エラー: ' + e);
    }
  }

  // シートに記録
  appendToSheet_(sheet, {
    id: id, date: dateStr, from: from, subject: subject,
    hasDeadline: deadlineInfo.hasDeadline, deadlineDate: deadlineInfo.deadlineDate,
    driveUrl: driveUrl,
  });

  // Supabase に upsert
  saveToSupabase_({
    id:            id,
    district_id:   CONFIG.DISTRICT_ID,
    from_email:    from,
    subject:       subject,
    received_at:   dateStr,
    has_deadline:  deadlineInfo.hasDeadline,
    deadline_date: deadlineInfo.deadlineDate || null,
    body_preview:  preview,
    drive_url:     driveUrl || null,
  });

  return true;
}

// ===================================================
// 締切日抽出
// ===================================================
function extractDeadline_(text, baseDate) {
  // 県HP等のURL行を除外
  var cleanText = text.split('\n').filter(function(line) {
    return !CONFIG.EXCLUDE_URL_PATTERN.test(line);
  }).join('\n');

  var year = baseDate.getFullYear();

  // YYYY年MM月DD日 パターン
  var m = cleanText.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
  if (m) {
    var d = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
    if (d >= baseDate) {
      return { hasDeadline: true, deadlineDate: formatDate_(d) };
    }
  }

  // MM月DD日 + 締切キーワード
  var patterns = [
    /(\d{1,2})[月\/](\d{1,2})日?(?:まで|迄|締切|期限)/,
    /(?:まで|迄|締切|期限)[^\d]{0,5}(\d{1,2})[月\/](\d{1,2})/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var mm = cleanText.match(patterns[i]);
    if (mm) {
      var month = parseInt(mm[1]), day = parseInt(mm[2]);
      var candidate = new Date(year, month-1, day);
      if (candidate < baseDate) candidate = new Date(year+1, month-1, day);
      return { hasDeadline: true, deadlineDate: formatDate_(candidate) };
    }
  }

  return { hasDeadline: false, deadlineDate: '' };
}

// ===================================================
// Supabase upsert
// ===================================================
function saveToSupabase_(record) {
  var url = CONFIG.SUPABASE_URL + '/rest/v1/rinri_emails';
  var options = {
    method:      'POST',
    contentType: 'application/json',
    headers: {
      'apikey':        CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      'Prefer':        'resolution=merge-duplicates',
    },
    payload:          JSON.stringify(record),
    muteHttpExceptions: true,
  };
  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() >= 400) {
    Logger.log('Supabaseエラー: ' + res.getContentText());
  }
}

// ===================================================
// ヘルパー
// ===================================================
function buildGmailQuery_(after) {
  var senders = CONFIG.ALLOWED_SENDERS.map(function(s){ return 'from:' + s; }).join(' OR ');
  var afterStr = Utilities.formatDate(after, 'UTC', 'yyyy/MM/dd');
  return '(' + senders + ') after:' + afterStr;
}

function extractEmail_(fromStr) {
  var m = fromStr.match(/<(.+?)>/);
  return m ? m[1].toLowerCase() : fromStr.toLowerCase().trim();
}

function formatDate_(d) {
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['ID','受信日時','差出人','件名','締切あり','締切日','DriveURL']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendToSheet_(sheet, row) {
  // 既存IDチェック（重複防止）
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === row.id) return;
  }
  sheet.appendRow([row.id, row.date, row.from, row.subject, row.hasDeadline ? '◯' : '', row.deadlineDate, row.driveUrl]);
}

// ===================================================
// 初回セットアップ用（手動実行）
// ===================================================
function setup() {
  // 時間ベーストリガー設定（毎時）
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncRinriMails').timeBased().everyHours(1).create();
  Logger.log('トリガー設定完了。DRIVE_FOLDER_ID を設定してください。');
}
