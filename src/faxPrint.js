// FAX用紙印刷ロジック（FormURLModal と FaxPrintModal で共用）
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
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 9.5pt; line-height: 1.45; color: #000; margin: 0; }
  h1 { text-align: center; font-size: 16pt; margin: 0 0 2mm 0; letter-spacing: 0.25em; font-weight: 800; }
  .stype-badge { font-size: 11pt; font-weight: 700; color: #fff; background: #1A3A6B; display: inline-block; padding: 1.5mm 8mm; border-radius: 3mm; }
  .stype-wrap { text-align: center; margin-bottom: 3mm; }
  .org { text-align: center; font-size: 9pt; margin-bottom: 3mm; color: #333; }
  .section { border: 1.5px solid #000; margin-bottom: 2.5mm; }
  .section-title { font-size: 10pt; font-weight: 800; background: #1A3A6B; color: #fff; padding: 1.5mm 3mm; }
  .section-body { padding: 2mm 3mm; }
  .row { display: flex; padding: 1.2mm 0; border-bottom: 1px dotted #999; min-height: 7mm; align-items: center; }
  .row:last-child { border-bottom: none; }
  .row.tall { min-height: 12mm; align-items: flex-start; padding-top: 2mm; }
  .row.xtall { min-height: 22mm; align-items: flex-start; padding-top: 2mm; }
  .label { width: 32mm; font-weight: 700; flex-shrink: 0; color: #1A3A6B; font-size: 9pt; }
  .label .hint { font-size: 7.5pt; font-weight: 400; color: #666; display: block; margin-top: 0.5mm; }
  .value { flex: 1; padding-left: 2mm; font-size: 9.5pt; }
  .blank { flex: 1; border-bottom: 1px solid #000; min-height: 6mm; margin-left: 2mm; }
  .blank-area { flex: 1; border: 1px solid #000; min-height: 20mm; margin-left: 2mm; }
  .cb { display: inline-flex; align-items: center; gap: 1.5mm; margin-right: 5mm; font-size: 9.5pt; white-space: nowrap; }
  .cb-box { display: inline-block; width: 3.5mm; height: 3.5mm; border: 1.2px solid #000; }
  .cbrow { display: flex; flex-wrap: wrap; gap: 1mm 0; padding: 0.5mm 0; }
  .footer { margin-top: 3mm; padding: 3mm 4mm; border: 1.5px solid #000; background: #FFF8E1; text-align: center; }
  .footer .title { font-weight: 800; margin-bottom: 1.5mm; font-size: 10pt; color: #B71C1C; }
  .note { font-size: 8pt; color: #444; margin-top: 1.5mm; line-height: 1.5; }
  .photo-warn { background:#FFEBEE; border:1px solid #E53935; color:#B71C1C; padding:1.5mm 3mm; font-size:8.5pt; font-weight:700; margin-bottom:2.5mm; border-radius:1mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .noprint { display: none; } }
  .noprint { text-align: center; margin: 6mm 0; }
  .noprint button { background: #1A3A6B; color: #fff; border: none; border-radius: 6px; padding: 8px 24px; font-size: 12pt; cursor: pointer; }
  .page-break { page-break-before: always; }
</style></head><body>

<h1>講 話 依 頼 確 認 書</h1>
<div class="stype-wrap"><span class="stype-badge">${esc(seminarTypeLabel)}</span></div>
<div class="org">倫理法人会 南部地区合同事務局　${esc(ch.name)}単会</div>

<div class="photo-warn">⚠ 顔写真はFAXでは送付できません。メール添付または郵送にて別途お送りください。</div>

<div class="section">
  <div class="section-title">① 講話の依頼内容（事務局記入済）</div>
  <div class="section-body">
    <div class="row"><div class="label">単 会 名</div><div class="value">${esc(ch.name)}${ch.name ? '単会' : ''}</div></div>
    <div class="row"><div class="label">セミナー種別</div><div class="value">${esc(seminarTypeLabel)}（講話${esc(lectureTime)}）</div></div>
    <div class="row"><div class="label">開 催 日</div><div class="value">${esc(formattedDate)}</div></div>
    <div class="row"><div class="label">開催時間</div><div class="value">${esc(ch.time)}</div></div>
    <div class="row"><div class="label">会　　場</div><div class="value">${esc(ch.venue)}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">② 講師プロフィール</div>
  <div class="section-body">
    <div class="row"><div class="label">講師名（漢字）</div><div class="blank"></div></div>
    <div class="row"><div class="label">ふ り が な<span class="hint">ひらがな</span></div><div class="blank"></div></div>
    <div class="row"><div class="label">所属法人会名</div><div class="blank"></div></div>
    <div class="row"><div class="label">法人会役職</div><div class="blank"></div></div>
    <div class="row"><div class="label">勤　務　先<span class="hint">チラシ記載</span></div><div class="blank"></div></div>
    <div class="row"><div class="label">勤務先役職名<span class="hint">チラシ記載</span></div><div class="blank"></div></div>
    <div class="row"><div class="label">連絡先TEL</div><div class="blank"></div></div>
    <div class="row"><div class="label">メールアドレス</div><div class="blank"></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">③ 講話内容</div>
  <div class="section-body">
    <div class="row tall"><div class="label">講話タイトル<span class="hint">（30字以内）</span></div><div class="blank" style="min-height:10mm;"></div></div>
    <div class="row xtall"><div class="label">内 容 要 約<span class="hint">300字以内<br>${esc(lectureTime)}の講話</span></div><div class="blank-area" style="min-height:32mm;"></div></div>
  </div>
</div>

<div class="page-break"></div>

<h1 style="font-size:14pt;margin-bottom:2mm;">講 話 依 頼 確 認 書（つづき）</h1>
<div class="stype-wrap"><span class="stype-badge" style="font-size:9pt;padding:1mm 5mm;">${esc(seminarTypeLabel)}　／　${esc(ch.name)}単会　${esc(formattedDate)}</span></div>

<div class="section">
  <div class="section-title">④ 当日のご準備</div>
  <div class="section-body">
    <div class="row"><div class="label">交通手段</div><div class="value"><div class="cbrow">${cb('お車')}${cb('電車')}${cb('その他（　　　　　　　）')}</div></div></div>
    <div class="row tall"><div class="label">必要機材<span class="hint">複数選択可</span></div><div class="value"><div class="cbrow">${cb('プロジェクタ')}${cb('パソコン')}${cb('ホワイトボード')}${cb('その他')}${cb('無し')}</div></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">⑤ 宿泊について${isLodgingOptional ? '（任意）' : ''}</div>
  <div class="section-body">
    <div class="row"><div class="label">前 泊 要 否</div><div class="value"><div class="cbrow">${cb('要（ホテルを手配します）')}${cb('不要')}</div></div></div>
    <div class="row"><div class="label">禁煙ルーム希望</div><div class="value"><div class="cbrow">${cb('禁煙')}${cb('喫煙')}${cb('どちらでも')}</div></div></div>
    <div class="row"><div class="label">お迎えの要否</div><div class="value"><div class="cbrow">${cb('要')}${cb('不要')}</div></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">⑥ 講話資料</div>
  <div class="section-body">
    <div class="row"><div class="label">資料の有無</div><div class="value"><div class="cbrow">${cb('あり')}${cb('なし')}</div></div></div>
    <div class="row"><div class="label">印刷の要否<span class="hint">「あり」の場合</span></div><div class="value"><div class="cbrow">${cb('要（単会で印刷）')}${cb('不要(持参)')}</div></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">⑦ 領収証</div>
  <div class="section-body">
    <div class="row"><div class="label">宛　　名</div><div class="value"><div class="cbrow">${cb('個人宛')}${cb('会社宛')}</div></div></div>
    <div class="row"><div class="label">郵便番号<span class="hint">7桁</span></div><div class="blank" style="max-width:60mm;"></div></div>
    <div class="row tall"><div class="label">住　　所</div><div class="blank" style="min-height:11mm;"></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">⑧ 顔写真の使用範囲（チラシ・広報物）</div>
  <div class="section-body">
    <div class="row tall"><div class="value"><div class="cbrow" style="gap:1.5mm 0;">${cb('全ての媒体を承諾します')}${cb('公式ホームページのみ')}${cb('Facebookのみ')}${cb('要相談')}</div></div></div>
  </div>
</div>

<div class="footer">
  <div class="title">▼ ご記入後の返信先 ▼</div>
  <div style="font-weight:700;">倫理法人会 南部地区合同事務局　${esc(ch.name)}単会</div>
  <div style="margin-top:1mm;">Mail：${esc(mail)}</div>
  <div class="note">本確認書をご記入の上、FAXまたは上記メールアドレスにてご返信ください。<br><strong style="color:#B71C1C;">※ 顔写真はメール添付または郵送にて別途お送りください（FAXでは送付不可）</strong></div>
</div>

<div class="noprint"><button onclick="window.print()">🖨 印刷する</button></div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),400);});</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
  showToast?.(`🖨 ${seminarTypeLabel}用の印刷ダイアログを開きます`);
}
