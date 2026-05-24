/**
 * フォントスケールシステム
 * 4種類 × 大中小の切り替えをCSS変数で管理
 */

// 4種類の基準サイズ（中スケール時）— スマホ基準で設定
const BASE = {
  xs: { min: 12, vw: 1.5, max: 14 },   // ボタン・補足ラベル
  sm: { min: 14, vw: 1.8, max: 16 },   // 本文・入力バー・テーブル
  md: { min: 18, vw: 2.6, max: 22 },   // アクションボタン・セクション見出し
  lg: { min: 22, vw: 3.2, max: 30 },   // ページタイトル・大見出し
};

// スケール係数 — 20%ずつ変化
export const SCALE_OPTIONS = [
  { key: 'small',  label: '小', factor: 0.8  },   // 基準の80%
  { key: 'medium', label: '中', factor: 1.0  },   // 基準
  { key: 'large',  label: '大', factor: 1.2  },   // 基準の120%
];

const STORAGE_KEY = 'fontScale';

function makeClamp({ min, vw, max }, factor) {
  const s = (v) => Math.round(v * factor);
  const f = (v) => (v * factor).toFixed(2).replace(/\.?0+$/, '');
  return `clamp(${s(min)}px, ${f(vw)}vw, ${s(max)}px)`;
}

/** CSS変数をrootに適用してlocalStorageに保存 */
export function applyFontScale(scaleKey) {
  const opt = SCALE_OPTIONS.find(o => o.key === scaleKey) || SCALE_OPTIONS[1];
  const root = document.documentElement;
  Object.entries(BASE).forEach(([key, size]) => {
    root.style.setProperty(`--fs-${key}`, makeClamp(size, opt.factor));
  });
  try { localStorage.setItem(STORAGE_KEY, opt.key); } catch {}
}

/** 起動時に呼び出してlocalStorageから復元 */
export function initFontScale() {
  let saved = 'medium';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'medium'; } catch {}
  applyFontScale(saved);
  return saved;
}

/** 現在のスケールキーを取得 */
export function getCurrentScale() {
  try { return localStorage.getItem(STORAGE_KEY) || 'medium'; } catch { return 'medium'; }
}
