/**
 * フォントスケールシステム
 * 4種類 × 大中小の切り替えをCSS変数で管理
 */

// 4種類の基準サイズ（中スケール時）
const BASE = {
  xs: { min: 11, vw: 1.4, max: 13 },   // ボタン・補足ラベル
  sm: { min: 12, vw: 1.4, max: 14 },   // 本文・入力バー
  md: { min: 16, vw: 2.4, max: 20 },   // アクションボタン・セクション見出し
  lg: { min: 20, vw: 3.0, max: 28 },   // ページタイトル・大見出し
};

// スケール係数
export const SCALE_OPTIONS = [
  { key: 'small',  label: '小', factor: 0.875 },
  { key: 'medium', label: '中', factor: 1.0 },
  { key: 'large',  label: '大', factor: 1.25 },
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
