import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { CHAPTERS, JIMU } from '../constants';
import { getSeminarType } from '../utils';
import { OV, MOD, MH, CARD, BP, BC, BG, INP, TBL, TH, TD, SEL, PILL, FS_XS, FS_SM, FS_MD, FS_LG } from '../styles';

export default memo(function FlyerView({ speakers, today, showToast, updateSpeaker }) {
  const months = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 3 + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const monthSpeakers = speakers.filter(s => s.seminarDate?.startsWith(ym) && s.status !== "cancelled");
    const ready = monthSpeakers.filter(s => s.speakerName && s.speakerKana && s.topic && s.materialUrl).length;
    const isPast = d < new Date(today.getFullYear(), today.getMonth(), 1);
    return { value: ym, label: `${d.getFullYear()}年${d.getMonth()+1}月号`, readyCount: ready, isPast };
  }), [today, speakers]);

  const [selMonth, setSelMonth] = useState(() => months[4].value);

  // スクロールヒント（スマホ用）
  const tableScrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  useEffect(() => {
    // 月切り替え時にヒントをリセット → スクロールが必要な幅かチェック
    setShowScrollHint(true);
    const el = tableScrollRef.current;
    if (!el) return;
    // 少し待ってからDOM幅を確認（レンダリング完了後）
    const t = setTimeout(() => {
      if (el.scrollWidth <= el.clientWidth) setShowScrollHint(false);
    }, 100);
    return () => clearTimeout(t);
  }, [selMonth]); // 月切り替え時にリセット
  const handleTableScroll = useCallback(() => setShowScrollHint(false), []);

  const [printEmail, setPrintEmail] = useState(() => localStorage.getItem('flyer_printEmail') || "");
  const [showEmailModal, setShowEmailModal] = useState(false);

  // 各単会・月ごとの予定講話者数 key = "YYYY-MM_chapterId"
  const [expectedCounts, setExpectedCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flyer_expected') || '{}'); } catch { return {}; }
  });
  const setExpected = useCallback((key, val) => {
    const n = Math.max(1, parseInt(val, 10) || 1);
    setExpectedCounts(prev => {
      const next = { ...prev, [key]: n };
      try { localStorage.setItem('flyer_expected', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const savePrintEmail = useCallback(v => {
    setPrintEmail(v);
    try { localStorage.setItem('flyer_printEmail', v); } catch {}
  }, []);

  const [downloading,     setDownloading]     = useState(false); // Excel-only ZIP
  const [downloadingFull, setDownloadingFull] = useState(false); // 写真込みZIP
  const [savingDrive,     setSavingDrive]     = useState(false); // Google Drive

  // ── flyerData（buildExcelBuffer より前に定義する必要あり） ────────
  const flyerData = useMemo(() => CHAPTERS.map(ch => {
    const sps = speakers
      .filter(s =>
        s.chapterId === ch.id &&
        s.seminarDate?.startsWith(selMonth) &&
        s.status !== "cancelled"
      )
      .sort((a, b) => (a.seminarDate || '').localeCompare(b.seminarDate || ''));
    return { ch, sps };
  }), [speakers, selMonth]);

  // ── 共通: Excelバッファ生成（ExcelJS・体裁整え版） ──────────────
  const buildExcelBuffer = useCallback(async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = '倫理法人会 南部地区合同事務局';
    wb.created = new Date();
    const ws = wb.addWorksheet(`${selMonth.replace('-','年')}月号`, {
      views: [{ state: 'frozen', ySplit: 1 }],     // ヘッダー固定
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // 列定義（幅・キー）
    ws.columns = [
      { header:'単会名',         key:'chapter',    width:14 },
      { header:'セミナー種別',   key:'stype',      width:18 },
      { header:'曜日',           key:'day',        width:8  },
      { header:'開催日',         key:'date',       width:13 },
      { header:'講師名',         key:'name',       width:18 },
      { header:'ふりがな',       key:'kana',       width:18 },
      { header:'所属法人会名',   key:'unit',       width:22 },
      { header:'法人会役職',     key:'role',       width:14 },
      { header:'勤務先',         key:'company',    width:24 },
      { header:'勤務先役職名',   key:'companyRole',width:16 },
      { header:'テーマ',         key:'topic',      width:36 },
      { header:'顔写真URL',      key:'photo',      width:60 },
    ];

    // ── ヘッダー行のスタイル ──
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.font = { name:'Yu Gothic', size:12, bold:true, color:{ argb:'FFFFFFFF' } };
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1A3A6B' } };
      cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
      cell.border = {
        top:    { style:'medium', color:{ argb:'FF0D1B3E' } },
        bottom: { style:'medium', color:{ argb:'FF0D1B3E' } },
        left:   { style:'thin',   color:{ argb:'FF7F8FA8' } },
        right:  { style:'thin',   color:{ argb:'FF7F8FA8' } },
      };
    });

    // 単会ごとの薄い背景色マップ
    const chBg = { todawarabi:'FFE8F5E9', kawaguchi_east:'FFE3F2FD', niiza_shiki:'FFEDE7F6', asaka:'FFFFF3E0', kawaguchi:'FFFFEBEE' };

    // データ行追加
    flyerData.forEach(({ ch, sps }) => {
      if (sps.length === 0) {
        const r = ws.addRow({ chapter: ch.name, stype:'', day: ch.dayName, date:'未登録', name:'', kana:'', unit:'', role:'', company:'', companyRole:'', topic:'', photo:'' });
        r.eachCell({ includeEmpty:true }, cell => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: chBg[ch.id] || 'FFFAFAFA' } };
        });
      } else {
        sps.forEach(sp => {
          const ext = sp.materialUrl ? (sp.materialUrl.split('.').pop().split('?')[0] || 'jpg') : '';
          const dlName = sp.materialUrl ? `${(sp.seminarDate||'').replace(/-/g,'')}_${ch.name}_${sp.speakerName||''}_顔写真.${ext}` : '';
          const photoUrl = sp.materialUrl ? `${sp.materialUrl}?download=${encodeURIComponent(dlName)}` : '';
          const r = ws.addRow({
            chapter: ch.name,
            stype:   getSeminarType(sp.seminarType).label,
            day:     ch.dayName,
            date:    sp.seminarDate || '',
            name:    sp.speakerName || '',
            kana:    sp.speakerKana || '',
            unit:    sp.speakerUnit || '',
            role:    sp.role || '',
            company: sp.company || '',
            companyRole: sp.companyRole || '',
            topic:   sp.topic || '',
            photo:   photoUrl || '（未受領）',
          });
          // 行全体の背景（単会色）
          r.eachCell({ includeEmpty:true }, cell => {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: chBg[ch.id] || 'FFFFFFFF' } };
          });
          // 顔写真URLはハイパーリンク化（青文字＋下線）
          if (photoUrl) {
            const photoCell = r.getCell('photo');
            photoCell.value = { text:'📷 写真を開く（クリックでダウンロード）', hyperlink: photoUrl, tooltip:'クリックしてダウンロード' };
            photoCell.font = { name:'Yu Gothic', size:11, color:{ argb:'FF1565C0' }, underline:true };
          }
        });
      }
    });

    // ── 全データ行の共通スタイル ──
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      row.height = 26;
      row.eachCell({ includeEmpty:true }, (cell, colNumber) => {
        if (!cell.font || (cell.font && !cell.font.color)) {
          cell.font = { name:'Yu Gothic', size:11 };
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colNumber >= 1 && colNumber <= 4) ? 'center' : 'left', // 単会名・種別・曜日・開催日
          wrapText: (colNumber === 11), // テーマ列のみ折返し
        };
        cell.border = {
          top:    { style:'thin', color:{ argb:'FFCFD8DC' } },
          bottom: { style:'thin', color:{ argb:'FFCFD8DC' } },
          left:   { style:'thin', color:{ argb:'FFCFD8DC' } },
          right:  { style:'thin', color:{ argb:'FFCFD8DC' } },
        };
      });
      // 単会名・曜日は太字
      row.getCell('chapter').font = { name:'Yu Gothic', size:11, bold:true, color:{ argb:'FF1A3A6B' } };
      row.getCell('day').font     = { name:'Yu Gothic', size:11, bold:true, color:{ argb:'FF546E7A' } };
      // 講師名も少し太字
      row.getCell('name').font    = { name:'Yu Gothic', size:11.5, bold:true };
      // 「未登録」「（未受領）」はグレー＋斜体
      if (row.getCell('date').value === '未登録') {
        row.getCell('date').font = { name:'Yu Gothic', size:11, italic:true, color:{ argb:'FFB71C1C' }, bold:true };
      }
      const photoVal = row.getCell('photo').value;
      if (photoVal === '（未受領）') {
        row.getCell('photo').font = { name:'Yu Gothic', size:11, italic:true, color:{ argb:'FF90A4AE' } };
      }
    }

    // オートフィルター（並び替え・絞り込み可能に）
    ws.autoFilter = { from:{ row:1, column:1 }, to:{ row:1, column:ws.columns.length } };

    // 印刷時マージン
    ws.pageSetup.margins = { left:0.3, right:0.3, top:0.5, bottom:0.5, header:0.3, footer:0.3 };

    // ArrayBuffer に書き出し
    return await wb.xlsx.writeBuffer();
  }, [flyerData, selMonth]);

  // ── ① Excel-only ZIP（軽量・メール添付用） ───────────────────────
  const downloadExcelZip = useCallback(async () => {
    setDownloading(true);
    showToast('📊 Excel作成中...');
    try {
      const zip = new JSZip();
      zip.file(`流し込みデータ_${selMonth}.xlsx`, await buildExcelBuffer());
      const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${selMonth}月号_チラシデータ.zip` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ ZIP（Excel）ダウンロード完了！写真はURL列からDL可能です');
    } catch (e) { showToast('⚠ 失敗: ' + (e.message||'')); }
    finally { setDownloading(false); }
  }, [buildExcelBuffer, selMonth, showToast]);

  // ── ② 写真込みZIP（全ファイル同梱） ─────────────────────────────
  const downloadFullZip = useCallback(async () => {
    setDownloadingFull(true);
    showToast('📦 写真を取得中... しばらくお待ちください');
    try {
      const zip = new JSZip();
      zip.file(`流し込みデータ_${selMonth}.xlsx`, await buildExcelBuffer());
      const photoFolder = zip.folder('顔写真');
      const fetches = [];
      flyerData.forEach(({ ch, sps }) => {
        sps.forEach(sp => {
          if (!sp.materialUrl) return;
          const ext = sp.materialUrl.split('.').pop().split('?')[0] || 'jpg';
          const name = `${(sp.seminarDate||'').replace(/-/g,'')}_${ch.name}_${sp.speakerName||''}_顔写真.${ext}`;
          fetches.push(fetch(sp.materialUrl).then(r => r.arrayBuffer()).then(buf => photoFolder.file(name, buf)).catch(()=>{}));
        });
      });
      await Promise.all(fetches);
      const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${selMonth}月号_チラシデータ（写真込み）.zip` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ ZIP（写真込み）ダウンロード完了！');
    } catch (e) { showToast('⚠ 失敗: ' + (e.message||'')); }
    finally { setDownloadingFull(false); }
  }, [buildExcelBuffer, flyerData, selMonth, showToast]);

  // ── ③ Googleドライブに保存 ────────────────────────────────────────
  const saveToDrive = useCallback(async () => {
    const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!CLIENT_ID) { showToast('⚠ Google Client IDが未設定です。管理者にご連絡ください'); return; }
    setSavingDrive(true);
    showToast('☁ Googleドライブに保存中...');
    try {
      // GIS スクリプト読み込み
      if (!window.google?.accounts?.oauth2) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      // OAuth トークン取得
      const token = await new Promise((res, rej) => {
        window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: r => r.error ? rej(new Error(r.error)) : res(r.access_token),
        }).requestAccessToken({ prompt: '' });
      });
      // ZIP生成（Excel only・軽量）
      const zip = new JSZip();
      zip.file(`流し込みデータ_${selMonth}.xlsx`, await buildExcelBuffer());
      const zipBlob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
      // Drive API アップロード
      const meta = { name: `${selMonth}月号_チラシデータ.zip`, mimeType: 'application/zip' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type:'application/json' }));
      form.append('file', zipBlob);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error('Drive APIエラー ' + res.status);
      const { webViewLink } = await res.json();
      await navigator.clipboard?.writeText(webViewLink).catch(()=>{});
      showToast('✅ Driveに保存完了！リンクをコピーしました 📋');
      window.open(webViewLink, '_blank');
    } catch (e) { showToast('⚠ Drive保存失敗: ' + (e.message||'')); }
    finally { setSavingDrive(false); }
  }, [buildExcelBuffer, selMonth, showToast]);

  const { year, month, daysLeft, deadlineColor } = useMemo(() => {
    const [y, m] = selMonth.split("-").map(Number);
    const dl = new Date(y, m - 1, 10);
    const days = Math.ceil((dl - today) / 86400000);
    return { year: y, month: m, deadline: dl, daysLeft: days, deadlineColor: days < 0 ? "#B71C1C" : days <= 3 ? "#E65100" : days <= 7 ? "#FF8F00" : "#2E7D32" };
  }, [selMonth, today]);

  // 完成度（予定人数基準）
  const completeness = useMemo(() => flyerData.map(({ ch, sps }) => {
    const key = `${selMonth}_${ch.id}`;
    const expected = expectedCounts[key] || Math.max(sps.length, 1);
    const ready = sps.filter(sp => sp.speakerName && sp.speakerKana && sp.topic && sp.materialUrl).length;
    const pct = Math.min(100, Math.round(ready / expected * 100));
    const missingSet = new Set();
    if (sps.length === 0) missingSet.add("講師未登録");
    sps.forEach(sp => {
      if (!sp.speakerKana) missingSet.add("ふりがな");
      if (!sp.topic)       missingSet.add("テーマ");
      if (!sp.materialUrl) missingSet.add("顔写真");
    });
    const unregistered = Math.max(0, expected - sps.length);
    if (unregistered > 0) missingSet.add(`未登録${unregistered}名`);
    return { ch, pct, missing: [...missingSet], ready, expected, registered: sps.length };
  }), [flyerData, expectedCounts, selMonth]);

  const readyCount = useMemo(() => completeness.filter(c => c.pct === 100).length, [completeness]);

  const buildLineText = useMemo(() => {
    const lines = [
      `【${selMonth.replace("-","年")}月号　チラシ流し込みデータ】`,
      `締め切り：${year}年${month}月10日`,
      ``,
    ];
    flyerData.forEach(({ ch, sps }) => {
      lines.push(`■ ${ch.name}（${ch.dayName} ${ch.time}）`);
      if (sps.length === 0) {
        lines.push(`  ※講師未登録`);
      } else {
        sps.forEach((sp, i) => {
          if (sps.length > 1) lines.push(`  ▷ 第${i + 1}講`);
          lines.push(`  開催日：${sp.seminarDate}`);
          lines.push(`  講師：${sp.speakerName}（${sp.speakerKana || "ふりがな未入力"}）`);
          lines.push(`  所属法人会：${sp.speakerUnit || "―"}　${sp.role || ""}`);
          lines.push(`  勤務先：${sp.company || "―"}　${sp.companyRole || ""}`);
          lines.push(`  テーマ：「${sp.topic || "未定"}」`);
          lines.push(`  写真：${sp.materialUrl || "※未受領"}`);
        });
      }
      lines.push(``);
    });
    lines.push(`倫理法人会 南部地区合同事務局`);
    return lines.join("\n");
  }, [selMonth, year, month, flyerData]);

  const buildEmailBody = useMemo(() => {
    const lines = [
      `お世話になっております。`,
      `倫理法人会 南部地区合同事務局です。`,
      ``,
      `${selMonth.replace("-","年")}月号の合同チラシ用データをお送りします。`,
      ``,
      `【流し込みデータ一覧】`,
    ];
    flyerData.forEach(({ ch, sps }) => {
      lines.push(`▼ ${ch.name}単会（${ch.dayName} ${ch.time}）`);
      if (sps.length === 0) {
        lines.push(`  ※後日送付`);
      } else {
        sps.forEach((sp, i) => {
          if (sps.length > 1) lines.push(`  ◆ 第${i + 1}講`);
          lines.push(`  開催日：${sp.seminarDate}`);
          lines.push(`  講師名：${sp.speakerName}`);
          lines.push(`  ふりがな：${sp.speakerKana || "―"}`);
          lines.push(`  所属法人会名：${sp.speakerUnit || "―"}`);
          lines.push(`  法人会役職：${sp.role || "―"}`);
          lines.push(`  勤務先：${sp.company || "―"}`);
          lines.push(`  勤務先役職名：${sp.companyRole || "―"}`);
          lines.push(`  テーマ：「${sp.topic || "未定"}」`);
          if (sp.materialUrl) {
            const ext = sp.materialUrl.split('.').pop().split('?')[0] || 'jpg';
            const dlName = `${(sp.seminarDate || '').replace(/-/g,'')}_${ch.name}_${sp.speakerName || ''}_顔写真.${ext}`;
            lines.push(`  顔写真：${sp.materialUrl}?download=${encodeURIComponent(dlName)}`);
          } else {
            lines.push(`  顔写真：※別途メール添付`);
          }
        });
      }
      lines.push(``);
    });
    lines.push(`ご不明点がございましたらご連絡ください。`);
    lines.push(`どうぞよろしくお願いいたします。`);
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`倫理法人会 南部地区合同事務局`);
    lines.push(`Mail：${JIMU.email}`);
    lines.push(`━━━━━━━━━━━━━━━`);
    return lines.join("\n");
  }, [selMonth, flyerData]);

  const emailSubject = useMemo(() => `【倫理法人会南部地区】${selMonth.replace("-","年")}月号チラシ流し込みデータ送付`, [selMonth]);

  const none = <span style={{ color:"#B0BEC5" }}>―</span>;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:FS_MD, fontWeight:700, color:"#061B44" }}>📋 チラシ流し込みデータ管理</div>
        <select style={{ ...SEL, fontWeight:700 }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
          {months.map(m => <option key={m.value} value={m.value}>{m.isPast ? "📁 " : ""}{m.label}　{m.readyCount === 5 ? "✓完成" : `${m.readyCount}件`}</option>)}
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          <button style={BP} onClick={() => { navigator.clipboard?.writeText(buildLineText).catch(() => {}); showToast("LINEテキストをコピーしました！グループに貼り付けてください 📱"); }}>📱 LINE</button>
          <button style={{ ...BP, background:"#1B5E20" }} onClick={() => setShowEmailModal(true)}>📧 印刷会社へメール</button>
          <button style={{ ...BP, background: downloading ? "#98A2B3" : "#6A1B9A", cursor: downloading ? "not-allowed" : "pointer" }} onClick={downloadExcelZip} disabled={downloading}>
            {downloading ? '⏳ 作成中...' : '📊 ZIP（メール用）'}
          </button>
          <button style={{ ...BP, background: downloadingFull ? "#98A2B3" : "#1565C0", cursor: downloadingFull ? "not-allowed" : "pointer" }} onClick={downloadFullZip} disabled={downloadingFull}>
            {downloadingFull ? '⏳ 取得中...' : '📦 ZIP（写真込み）'}
          </button>
          <button style={{ ...BP, background: savingDrive ? "#98A2B3" : "#1B5E20", cursor: savingDrive ? "not-allowed" : "pointer" }} onClick={saveToDrive} disabled={savingDrive}>
            {savingDrive ? '⏳ 保存中...' : '☁ Googleドライブに保存'}
          </button>
        </div>
      </div>

      {/* 締め切りバナー */}
      <div style={{ ...CARD, marginBottom:12, borderLeft:`5px solid ${deadlineColor}`, padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:FS_SM, color:"#667085" }}>データ送付締め切り</div>
            <div style={{ fontSize:FS_MD, fontWeight:800, color: deadlineColor }}>
              {year}年{month}月10日
              <span style={{ fontSize:FS_SM, marginLeft:10 }}>
                {daysLeft < 0 ? `⚠ ${Math.abs(daysLeft)}日超過` : daysLeft === 0 ? "⚠ 本日締め切り！" : `残り ${daysLeft}日`}
              </span>
            </div>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"center" }}>
            <div style={{ fontSize:FS_LG, fontWeight:800, color: readyCount === 5 ? "#1B5E20" : "#E65100" }}>
              {readyCount}<span style={{ fontSize:FS_SM, fontWeight:400 }}>/5単会</span>
            </div>
            <div style={{ fontSize:FS_SM, color:"#78909C" }}>データ揃い</div>
          </div>
        </div>
      </div>

      {/* 単会別 データ完成度 */}
      <div style={{ ...CARD, padding:"10px 14px", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <div style={{ fontSize:FS_SM, fontWeight:700, color:"#667085" }}>単会別 データ完成度</div>
          <div style={{ fontSize:FS_SM, color:"#98A2B3" }}>— 「予定」欄に講話者の人数を入力してください</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
          {completeness.map(({ ch, pct, missing, ready, expected, registered }) => {
            const key = `${selMonth}_${ch.id}`;
            const bg  = pct === 100 ? "#E8F5E9" : pct === 0 ? "#FFEBEE" : "#FFF8E1";
            const bdr = pct === 100 ? "#A5D6A7" : pct === 0 ? "#EF9A9A" : "#FFE082";
            const col = pct === 100 ? "#2E7D32" : pct === 0 ? "#B71C1C" : "#E65100";
            return (
              <div key={ch.id} style={{ padding:"8px 10px", background:bg, borderRadius:7, border:`1px solid ${bdr}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <span style={{ fontSize:FS_SM, fontWeight:700, color:ch.color }}>{ch.name}</span>
                  <span style={{ fontSize:FS_SM, fontWeight:800, color:col }}>{pct}%</span>
                </div>
                {/* 予定人数 ステッパー */}
                <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:5 }}>
                  <span style={{ fontSize:FS_SM, color:"#667085" }}>予定</span>
                  <button
                    onClick={() => setExpected(key, (expectedCounts[key] || Math.max(registered, 1)) - 1)}
                    style={{ width:26, height:26, borderRadius:5, border:"1px solid #B0BEC5", background:"#F1F5F9", fontSize:FS_SM, lineHeight:1, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"#667085" }}>−</button>
                  <span style={{ minWidth:22, textAlign:"center", fontSize:FS_SM, fontWeight:800, color:"#061B44" }}>
                    {expectedCounts[key] || Math.max(registered, 1)}
                  </span>
                  <button
                    onClick={() => setExpected(key, (expectedCounts[key] || Math.max(registered, 1)) + 1)}
                    style={{ width:26, height:26, borderRadius:5, border:"1px solid #B0BEC5", background:"#F1F5F9", fontSize:FS_SM, lineHeight:1, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"#667085" }}>＋</button>
                  <span style={{ fontSize:FS_SM, color:"#667085" }}>名中 {ready}名完成</span>
                </div>
                <div style={{ background:"#E0E0E0", borderRadius:3, height:6, overflow:"hidden" }}>
                  <div style={{ height:6, borderRadius:3, width:`${pct}%`, background: pct === 100 ? "#2E7D32" : pct === 0 ? "#B71C1C" : "#FF8F00", transition:"width .4s" }} />
                </div>
                {missing.length > 0 && (
                  <div style={{ fontSize:FS_SM, color:"#78909C", marginTop:3 }}>未：{missing.join("・")}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 一覧テーブル（複数講師対応） */}
      <div style={CARD}>
        {/* スクロールヒント（スマホ用） */}
        <div style={{ position:"relative" }}>
          <div ref={tableScrollRef} style={{ overflowX:"auto" }} onScroll={handleTableScroll}>
          <table style={TBL}>
            <thead>
              <tr>{["単会名","開催日","講師名（漢字）","ふりがな","所属法人会名","法人会役職","勤務先","勤務先役職名","テーマ","顔写真","状態","コピー"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {flyerData.map(({ ch, sps }) => {
                if (sps.length === 0) {
                  return (
                    <tr key={ch.id} className="hover-row">
                      <td style={TD}><span style={PILL(ch)}>{ch.name}</span><div style={{ fontSize:FS_SM, color:"#98A2B3", marginTop:2 }}>{ch.dayName}</div></td>
                      <td style={TD}>{none}</td>
                      <td style={TD}><span style={{ color:"#B71C1C", fontWeight:700 }}>未登録</span></td>
                      {Array(9).fill(0).map((_, i) => <td key={i} style={TD}>{none}</td>)}
                    </tr>
                  );
                }
                return sps.map((sp, idx) => {
                  const ready   = sp.speakerName && sp.speakerKana && sp.topic && sp.materialUrl;
                  const partial = (sp.speakerName || sp.topic) && !ready;
                  const statusColor = ready ? "#2E7D32" : partial ? "#FF8F00" : "#B71C1C";
                  const statusBg    = ready ? "#E8F5E9"  : partial ? "#FFF8E1" : "#FFEBEE";
                  const statusLabel = ready ? "✓ 完成"   : partial ? "▲ 不足あり" : "✗ 未登録";
                  // ── チラシ関連項目の更新バッジ ──
                  const ck = sp.speakerChecks || {};
                  const conf = ck._flyerConfirmedAt || '';
                  const showFlyerUpd = ck._flyerUpdatedAt && (!conf || ck._flyerUpdatedAt > conf);
                  const showPhotoUpd = ck._photoUpdatedAt && (!conf || ck._photoUpdatedAt > conf);
                  const fmtMd = iso => { const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()}`; };
                  return (
                    <tr key={sp.id} className="hover-row" style={{ borderTop: idx === 0 ? undefined : "1px dashed #F0F4F8" }}>
                      {idx === 0 ? (
                        <td style={{ ...TD, verticalAlign:"top" }} rowSpan={sps.length}>
                          <span style={PILL(ch)}>{ch.name}</span>
                          <div style={{ fontSize:FS_SM, color:"#98A2B3", marginTop:2 }}>{ch.dayName}</div>
                          {sps.length > 1 && <div style={{ marginTop:4, fontSize:FS_SM, color:ch.color, fontWeight:700 }}>{sps.length}名</div>}
                        </td>
                      ) : null}
                      <td style={{ ...TD, fontSize:FS_SM, whiteSpace:"nowrap" }}>
                        {sp.seminarDate || none}
                        {sp.seminarType && sp.seminarType !== "ms" && (
                          <span style={{ marginLeft:5, fontSize:FS_XS, fontWeight:700, color:"#fff", background:getSeminarType(sp.seminarType).color, padding:"1px 6px", borderRadius:8, whiteSpace:"nowrap" }}>{getSeminarType(sp.seminarType).short}</span>
                        )}
                      </td>
                      <td style={{ ...TD, fontWeight:700, fontSize:FS_SM, whiteSpace:"nowrap" }}>{sp.speakerName || none}</td>
                      <td style={{ ...TD, fontSize:FS_SM, color:"#667085" }}>{sp.speakerKana || none}</td>
                      <td style={{ ...TD, fontSize:FS_SM }}>{sp.speakerUnit || none}</td>
                      <td style={{ ...TD, fontSize:FS_SM }}>{sp.role || none}</td>
                      <td style={{ ...TD, fontSize:FS_SM }}>{sp.company || none}</td>
                      <td style={{ ...TD, fontSize:FS_SM }}>{sp.companyRole || none}</td>
                      <td style={{ ...TD, fontSize:FS_SM, maxWidth:160 }}>{sp.topic ? `「${sp.topic}」` : none}</td>
                      <td style={TD}>
                        {sp.materialUrl ? (
                          <a href={sp.materialUrl} target="_blank" rel="noreferrer" style={{ fontSize:FS_SM, color:"#1565C0", display:"flex", alignItems:"center", gap:6, textDecoration:"none", whiteSpace:"nowrap" }}>
                            {(/\.(jpg|jpeg|png|webp)$/i.test(sp.materialUrl) || sp.materialUrl.includes('/object/public/')) ? (
                              <img loading="lazy" src={sp.materialUrl} alt={sp.speakerName} style={{ width:40, height:40, objectFit:"cover", borderRadius:4, border:"1px solid #D9E1EE", flexShrink:0 }} onError={e => { e.target.style.display="none"; }} />
                            ) : null}
                            <span>📁 開く</span>
                          </a>
                        ) : <span style={{ fontSize:FS_SM, color:"#B0BEC5" }}>📭 未設定</span>}
                      </td>
                      <td style={TD}>
                        <span style={{ fontSize:FS_SM, fontWeight:700, color:statusColor, background:statusBg, padding:"3px 8px", borderRadius:4, whiteSpace:"nowrap" }}>{statusLabel}</span>
                        {partial && (
                          <div style={{ marginTop:4, fontSize:FS_SM, color:"#FF8F00", lineHeight:1.6 }}>
                            {!sp.speakerKana && <div>• ふりがな未入力</div>}
                            {!sp.topic && <div>• テーマ未入力</div>}
                            {!sp.materialUrl && <div>• 顔写真未設定</div>}
                          </div>
                        )}
                        {(showFlyerUpd || showPhotoUpd) && (
                          <div style={{ marginTop:5, display:"flex", flexWrap:"wrap", gap:4, alignItems:"center" }}>
                            {showFlyerUpd && (
                              <span title="チラシに関わる項目が更新されました" style={{ fontSize:FS_SM, fontWeight:700, color:"#fff", background:"#E8862A", padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap" }}>
                                🔄 更新 {fmtMd(ck._flyerUpdatedAt)}
                              </span>
                            )}
                            {showPhotoUpd && (
                              <span title="顔写真が差し替えられました" style={{ fontSize:FS_SM, fontWeight:700, color:"#fff", background:"#7B5EA7", padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap" }}>
                                📷 写真差替 {fmtMd(ck._photoUpdatedAt)}
                              </span>
                            )}
                            {updateSpeaker && (
                              <button title="チラシへの反映を確認したらバッジを消します"
                                onClick={() => updateSpeaker(sp.id, { speakerChecks: { ...ck, _flyerConfirmedAt: new Date().toISOString() } })}
                                style={{ fontSize:FS_SM, fontWeight:700, color:"#667085", background:"#fff", border:"1px solid #D9E1EE", borderRadius:10, padding:"2px 8px", cursor:"pointer", whiteSpace:"nowrap" }}>
                                ✓ 確認済み
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={TD}>
                        <button style={{ fontSize:FS_SM, background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, padding:"3px 8px", cursor:"pointer", color:"#1565C0", fontWeight:700, whiteSpace:"nowrap" }}
                          onClick={() => {
                            const lines = [
                              `■ ${ch.name}（${ch.dayName}）`,
                              `  開催日：${sp.seminarDate}`,
                              `  講師：${sp.speakerName}　${[sp.speakerUnit, sp.role, sp.company, sp.companyRole].filter(Boolean).join("　")}`,
                              `  テーマ：「${sp.topic}」`,
                              `  写真：${sp.materialUrl || "※未受領"}`,
                            ];
                            navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
                            showToast(`${ch.name}のデータをコピーしました 📋`);
                          }}>📋 コピー</button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
          </div>{/* /overflowX:auto */}
          {/* 右スクロールヒント */}
          {showScrollHint && (
            <>
              {/* 右端グラデーション */}
              <div style={{ position:"absolute", top:0, right:0, bottom:0, width:60,
                background:"linear-gradient(to right, transparent, rgba(255,255,255,.95))",
                pointerEvents:"none", borderRadius:"0 6px 6px 0" }} />
              {/* ヒントバッジ */}
              <div onClick={() => setShowScrollHint(false)} style={{
                position:"absolute", right:6, top:"50%", transform:"translateY(-50%)",
                background:"#061B44", color:"#fff", borderRadius:20,
                padding:"5px 11px", fontSize:11, fontWeight:700,
                whiteSpace:"nowrap", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,.28)",
                display:"flex", alignItems:"center", gap:4,
                animation:"hintPulse 1s ease-in-out infinite alternate",
              }}>
                <span style={{ fontSize:13 }}>👉</span> 右にスクロール
              </div>
            </>
          )}
        </div>{/* /position:relative */}
      </div>

      <div style={{ padding:"10px 14px", background:"#FFF8E1", borderRadius:6, fontSize:FS_SM, color:"#E65100", display:"flex", gap:8, alignItems:"flex-start", marginTop:8 }}>
        <span style={{ fontSize:FS_MD }}>💡</span>
        <div>
          <strong>顔写真の登録方法</strong>：講師管理タブの「編集」→「📤 アップロード」ボタンで直接アップロード、またはURLを入力してください。<br/>
          <span style={{ color:"#78909C" }}>写真URLが未設定の場合は「別途メール添付」として送付文に記載されます。</span>
        </div>
      </div>

      {/* 印刷会社メールモーダル */}
      {showEmailModal && (
        <div style={OV} onClick={() => setShowEmailModal(false)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label="印刷会社へのメール送信" style={{ ...MOD, maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <div style={MH}>📧 印刷会社へのメール送信</div>
            <div style={{ fontSize:FS_SM, color:"#78909C", marginBottom:3, fontWeight:600 }}>印刷会社のメールアドレス</div>
            <input style={{ ...INP, width:"100%", marginBottom:12 }} placeholder="print@example.com" value={printEmail} onChange={e => savePrintEmail(e.target.value)} />
            <div style={{ fontSize:FS_SM, color:"#78909C", marginBottom:3, fontWeight:600 }}>件名</div>
            <div style={{ fontSize:FS_SM, background:"#F5F5F5", padding:"7px 11px", borderRadius:6, marginBottom:10 }}>{emailSubject}</div>
            <div style={{ fontSize:FS_SM, color:"#78909C", marginBottom:3, fontWeight:600 }}>本文プレビュー</div>
            <pre style={{ background:"#F5F5F5", borderRadius:8, padding:12, fontSize:FS_SM, lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:280, overflowY:"auto", marginBottom:12 }}>{buildEmailBody}</pre>
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...BP, flex:1 }} onClick={() => { window.open(`mailto:${printEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(buildEmailBody)}`, "_blank"); setShowEmailModal(false); showToast("メールアプリを開きました 📧"); }}>✉ メールアプリで開く</button>
              <button style={{ ...BG, flex:1 }} onClick={() => { navigator.clipboard?.writeText(`件名：${emailSubject}\n\n${buildEmailBody}`).catch(() => {}); setShowEmailModal(false); showToast("メール文をコピーしました 📋"); }}>📋 コピーして送信</button>
              <button style={BC} onClick={() => setShowEmailModal(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
