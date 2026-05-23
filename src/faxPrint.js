// FAX用紙印刷ロジック（FormURLModal と FaxPrintModal で共用）
// デザインは public/form.html（Webフォーム）に寄せた印刷版
import { SEMINAR_TYPES } from './constants';
import { formatDate } from './utils';

const LECTURE_TIME = {
  ms: '35分', kiso: '90分', tsudoi: '60分', evening: '60分', koen: '90分',
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cb  = label => `<span class="cb"><span class="cb-box"></span>${esc(label)}</span>`;

/**
 * FAX確認書を新しいウィンドウで開き、印刷ダイアログを起動する
 * @param {Object} opts
 * @param {Object} opts.chapter        - { id, name, venue, time, ... }
 * @param {string} opts.seminarDate    - "YYYY-MM-DD" or ""
 * @param {string} opts.seminarType    - "ms" | "kiso" | "tsudoi" | "evening" | "koen"
 * @param {string} [opts.chapterEmail] - 単会連絡先メール（未指定時は事務局）
 * @param {Function} [opts.showToast]
 */
export function printFaxForm({ chapter, seminarDate, seminarType, chapterEmail, showToast }) {
  const w = window.open('', '_blank');
  if (!w) { showToast?.('⚠ ポップアップを許可してください'); return; }

  const ch = chapter || {};
  const stInfo = SEMINAR_TYPES.find(t => t.id === seminarType) || SEMINAR_TYPES[0];
  const seminarTypeLabel = stInfo.label;
  const formattedDate = seminarDate ? formatDate(seminarDate) : '　　　年　　月　　日（　）';
  const lectureTime = LECTURE_TIME[seminarType] || '所定時間';
  const isLodgingOptional = stInfo.hasLodging === 'optional';
  const mail = chapterEmail || 'rinri.nanbu@gmail.com';

  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>${esc(seminarTypeLabel)}講師依頼確認書 - ${esc(ch.name)}</title>
<style>
  @page { size: A4; margin: 10mm 11mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif; font-size: 10pt; line-height: 1.5; color: #263238; background: #fff; }

  /* ヘッダー（form.htmlの header と同じ青グラデ） */
  .head { background: linear-gradient(135deg,#0D1B3E 0%,#1A3A6B 100%); color:#fff; padding: 5mm 6mm; text-align:center; border-radius: 3mm; margin-bottom: 3mm; }
  .head .org { font-size: 8.5pt; letter-spacing: .15em; opacity: .9; margin-bottom: 1mm; }
  .head h1 { font-size: 16pt; font-weight: 800; letter-spacing: .05em; margin: 0; }
  .head .sub { font-size: 8.5pt; opacity: .85; margin-top: 1.2mm; }

  /* セミナー種別バッジ */
  .stype-wrap { text-align:center; margin: 0 0 3mm 0; }
  .stype-badge { display: inline-block; background:#1A3A6B; color:#fff; font-weight:800; font-size:10pt; padding: 1.2mm 6mm; border-radius: 2mm; letter-spacing: .1em; }

  /* 依頼内容バナー（form.htmlの event-banner と同じ） */
  .event-banner { background: linear-gradient(135deg,#EDE7F6,#E8EAF6); border: 1.5px solid #7E57C2; border-radius: 3mm; padding: 3mm 4mm; margin-bottom: 3mm; page-break-inside: avoid; }
  .event-banner-label { font-size: 9pt; font-weight: 800; color:#5E35B1; letter-spacing: .1em; margin-bottom: 2mm; }
  .event-grid { display: grid; grid-template-columns: 32mm 1fr; row-gap: 1.5mm; column-gap: 3mm; }
  .event-grid .k { font-size: 8.5pt; font-weight: 700; color:#7E57C2; }
  .event-grid .v { font-size: 10pt; color:#311B92; font-weight: 700; }

  /* セクションカード（form.htmlの section-card と同じ） */
  .section { background:#fff; border: 1px solid #D0D7E2; border-radius: 3mm; overflow: hidden; margin-bottom: 3mm; page-break-inside: avoid; }
  .section-header { background:#1A3A6B; color:#fff; padding: 2mm 4mm; font-size: 10pt; font-weight: 800; letter-spacing: .04em; }
  .section-body { padding: 3mm 4mm; }

  /* フィールド */
  .field { margin-bottom: 2mm; display: flex; align-items: flex-start; gap: 2mm; }
  .field:last-child { margin-bottom: 0; }
  .field-label { width: 30mm; flex-shrink: 0; font-size: 9pt; font-weight: 700; color:#37474F; padding-top: 1.5mm; }
  .field-label .req { color:#E53935; margin-left: 2px; }
  .field-label .hint { display: block; font-size: 7.5pt; color:#90A4AE; font-weight: 400; margin-top: 0.3mm; }
  .field-input { flex: 1; min-height: 7mm; background:#FAFAFA; border: 1px solid #CFD8DC; border-radius: 1.5mm; padding: 1.5mm 2mm; font-size: 10pt; color:#263238; }
  .field-input.printed { background: #fff; border-color:#fff; padding-left: 0; font-weight: 600; }
  .field-input.tall { min-height: 14mm; }
  .field-input.xtall { min-height: 32mm; }
  .field-input.short { max-width: 60mm; }

  /* 2カラム */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }

  /* チェックボックス（form.html の radio-item と同じ風） */
  .cbrow { display: flex; flex-wrap: wrap; gap: 1.5mm; }
  .cb { display: inline-flex; align-items: center; gap: 1.5mm; background:#F5F7FA; border: 1px solid #D0D7E2; border-radius: 1.5mm; padding: 1.2mm 3mm; font-size: 9.5pt; white-space: nowrap; }
  .cb-box { display: inline-block; width: 3.5mm; height: 3.5mm; border: 1.3px solid #1A3A6B; background:#fff; border-radius: 0.5mm; flex-shrink: 0; }

  /* 注意書き */
  .photo-warn { background:#FFEBEE; border-left: 3px solid #E53935; color:#B71C1C; padding: 1.8mm 3mm; font-size: 9pt; font-weight: 700; margin-bottom: 3mm; border-radius: 1.5mm; page-break-inside: avoid; }

  /* フッター（返信先） */
  .footer { background:#FFF8E1; border: 1.5px solid #FFC107; border-radius: 3mm; padding: 3mm 4mm; text-align:center; margin-top: 3mm; page-break-inside: avoid; }
  .footer .title { font-weight: 800; font-size: 10pt; color:#B71C1C; margin-bottom: 1.5mm; }
  .footer .body { font-size: 9.5pt; font-weight: 700; color:#263238; }
  .footer .mail { font-size: 10.5pt; font-weight: 800; color:#1A3A6B; margin-top: 1mm; }
  .footer .note { font-size: 8.5pt; color:#546E7A; margin-top: 2mm; line-height: 1.6; font-weight: 400; }

  /* つづきページの小見出し */
  .head-mini { background: linear-gradient(135deg,#0D1B3E 0%,#1A3A6B 100%); color:#fff; padding: 2mm 4mm; border-radius: 2mm; margin-bottom: 3mm; display:flex; justify-content:space-between; align-items:center; }
  .head-mini .ttl { font-size: 11pt; font-weight: 800; letter-spacing: .05em; }
  .head-mini .sub { font-size: 8.5pt; opacity: .9; }

  /* 印刷時の最適化 */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .noprint { display: none !important; }
    .section, .event-banner, .footer, .photo-warn { page-break-inside: avoid; }
  }

  /* 強制改ページ */
  .page-break { page-break-before: always; break-before: page; }

  /* 操作ボタン（印刷時非表示） */
  .noprint { text-align:center; margin: 6mm 0 10mm 0; }
  .noprint button { background:#1A3A6B; color:#fff; border:none; border-radius:6px; padding: 9px 28px; font-size: 12pt; font-weight: 700; cursor: pointer; }
</style></head><body>

<!-- ===== PAGE 1 ===== -->
<div class="head">
  <div class="org">倫理法人会　南部地区合同事務局　${esc(ch.name)}単会</div>
  <h1>講話依頼確認書</h1>
  <div class="sub">ご記入いただいた情報はチラシ・確認書に使用します</div>
</div>

<div class="stype-wrap"><span class="stype-badge">${esc(seminarTypeLabel)}</span></div>

<div class="photo-warn">⚠ 顔写真はFAXでは送付できません。メール添付または郵送にて別途お送りください。</div>

<!-- ① 依頼内容（事務局記入済） -->
<div class="event-banner">
  <div class="event-banner-label">📅 ご依頼内容の確認（事務局記入済）</div>
  <div class="event-grid">
    <div class="k">単 会 名</div><div class="v">${esc(ch.name)}${ch.name ? '単会' : ''}</div>
    <div class="k">セミナー種別</div><div class="v">${esc(seminarTypeLabel)}（講話${esc(lectureTime)}）</div>
    <div class="k">開 催 日</div><div class="v">${esc(formattedDate)}</div>
    <div class="k">開催時間</div><div class="v">${esc(ch.time)}</div>
    <div class="k">会　　場</div><div class="v">${esc(ch.venue)}</div>
  </div>
</div>

<!-- ② 講師プロフィール -->
<div class="section">
  <div class="section-header">👤 講師プロフィール</div>
  <div class="section-body">
    <div class="two-col">
      <div class="field"><div class="field-label">講師名（漢字）<span class="req">*</span></div><div class="field-input"></div></div>
      <div class="field"><div class="field-label">ふりがな<span class="req">*</span><span class="hint">ひらがな</span></div><div class="field-input"></div></div>
    </div>
    <div class="two-col">
      <div class="field"><div class="field-label">所属法人会名</div><div class="field-input"></div></div>
      <div class="field"><div class="field-label">法人会役職</div><div class="field-input"></div></div>
    </div>
    <div class="two-col">
      <div class="field"><div class="field-label">勤　務　先<span class="req">*</span><span class="hint">チラシ記載</span></div><div class="field-input"></div></div>
      <div class="field"><div class="field-label">勤務先役職名<span class="req">*</span><span class="hint">チラシ記載</span></div><div class="field-input"></div></div>
    </div>
    <div class="two-col">
      <div class="field"><div class="field-label">連絡先TEL<span class="req">*</span></div><div class="field-input"></div></div>
      <div class="field"><div class="field-label">メールアドレス</div><div class="field-input"></div></div>
    </div>
  </div>
</div>

<!-- ③ 講話内容 -->
<div class="section">
  <div class="section-header">🎤 講話内容</div>
  <div class="section-body">
    <div class="field"><div class="field-label">講話タイトル<span class="req">*</span><span class="hint">30字以内</span></div><div class="field-input tall"></div></div>
    <div class="field"><div class="field-label">内 容 要 約<span class="req">*</span><span class="hint">300字以内<br>${esc(lectureTime)}の講話</span></div><div class="field-input xtall"></div></div>
  </div>
</div>

<!-- ===== PAGE 2 ===== -->
<div class="page-break"></div>

<div class="head-mini">
  <div class="ttl">講話依頼確認書（つづき）</div>
  <div class="sub">${esc(seminarTypeLabel)}　／　${esc(ch.name)}単会　${esc(formattedDate)}</div>
</div>

<!-- ④ 当日のご準備 -->
<div class="section">
  <div class="section-header">🚗 当日のご準備</div>
  <div class="section-body">
    <div class="field"><div class="field-label">交通手段<span class="req">*</span></div><div style="flex:1;"><div class="cbrow">${cb('お車')}${cb('電車')}${cb('その他（　　　　　　）')}</div></div></div>
    <div class="field"><div class="field-label">必要機材<span class="req">*</span><span class="hint">複数選択可</span></div><div style="flex:1;"><div class="cbrow">${cb('プロジェクタ')}${cb('パソコン')}${cb('ホワイトボード')}${cb('その他')}${cb('無し')}</div></div></div>
  </div>
</div>

<!-- ⑤ 宿泊 -->
<div class="section">
  <div class="section-header">🏨 宿泊について${isLodgingOptional ? '（任意）' : ''}</div>
  <div class="section-body">
    <div class="field"><div class="field-label">前 泊 要 否<span class="req">*</span></div><div style="flex:1;"><div class="cbrow">${cb('要（ホテルを手配します）')}${cb('不要')}</div></div></div>
    <div class="field"><div class="field-label">禁煙ルーム希望</div><div style="flex:1;"><div class="cbrow">${cb('禁煙')}${cb('喫煙')}${cb('どちらでも')}</div></div></div>
    <div class="field"><div class="field-label">お迎えの要否</div><div style="flex:1;"><div class="cbrow">${cb('要')}${cb('不要')}</div></div></div>
  </div>
</div>

<!-- ⑥ 講話資料 -->
<div class="section">
  <div class="section-header">📄 講話資料</div>
  <div class="section-body">
    <div class="field"><div class="field-label">資料の有無<span class="req">*</span></div><div style="flex:1;"><div class="cbrow">${cb('あり')}${cb('なし')}</div></div></div>
    <div class="field"><div class="field-label">印刷の要否<span class="hint">「あり」の場合</span></div><div style="flex:1;"><div class="cbrow">${cb('要（単会で印刷）')}${cb('不要（持参）')}</div></div></div>
  </div>
</div>

<!-- ⑦ 領収証 -->
<div class="section">
  <div class="section-header">🧾 領収証</div>
  <div class="section-body">
    <div class="field"><div class="field-label">宛　　名<span class="req">*</span></div><div style="flex:1;"><div class="cbrow">${cb('個人宛')}${cb('会社宛')}</div></div></div>
    <div class="two-col">
      <div class="field"><div class="field-label">郵便番号<span class="hint">7桁</span></div><div class="field-input short"></div></div>
      <div></div>
    </div>
    <div class="field"><div class="field-label">住　　所<span class="req">*</span></div><div class="field-input tall"></div></div>
  </div>
</div>

<!-- ⑧ 顔写真の使用範囲 -->
<div class="section">
  <div class="section-header">📸 顔写真の使用範囲（チラシ・広報物）</div>
  <div class="section-body">
    <div class="field"><div style="flex:1;"><div class="cbrow">${cb('全ての媒体を承諾します')}${cb('公式ホームページのみ')}${cb('Facebookのみ')}${cb('要相談')}</div></div></div>
  </div>
</div>

<!-- フッター -->
<div class="footer">
  <div class="title">▼ ご記入後の返信先 ▼</div>
  <div class="body">倫理法人会 南部地区合同事務局　${esc(ch.name)}単会</div>
  <div class="mail">Mail：${esc(mail)}</div>
  <div class="note">本確認書をご記入の上、FAXまたは上記メールアドレスにてご返信ください。<br>
  <strong style="color:#B71C1C;">※ 顔写真はメール添付または郵送にて別途お送りください（FAXでは送付不可）</strong></div>
</div>

<div class="noprint"><button onclick="window.print()">🖨 印刷する</button></div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),400);});</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
  showToast?.(`🖨 ${seminarTypeLabel}用の印刷ダイアログを開きます`);
}
