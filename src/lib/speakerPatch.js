// 講師の行を保存するときの、「変えた項目だけ」を扱う処理。
// 古い画面（読み込んだあとに、講師がフォームで入力した内容を知らない画面）から保存しても、
// その入力を空で上書きしないために使う。

// base（画面が持っていた元の内容）と next（保存したい内容）を比べて、違う項目だけを返す
export function diffFields(base, next) {
  const out = {};
  Object.keys(next || {}).forEach(k => {
    if (k === 'id') return;
    if (JSON.stringify(next[k]) !== JSON.stringify((base || {})[k])) out[k] = next[k];
  });
  return out;
}

// チェック記録（speakerChecks）の重ね合わせ。
// fresh=DBの最新、base=画面が持っていた元の内容、mine=保存したい内容。
// 自分が変えたキーだけを fresh に重ねる（講師フォームが足した印など、自分が触っていないキーは消さない）
export function mergeSpeakerChecks(fresh, base, mine) {
  const merged = { ...(fresh || {}) };
  const b = base || {}, m = mine || {};
  new Set([...Object.keys(b), ...Object.keys(m)]).forEach(k => {
    if (JSON.stringify(b[k]) !== JSON.stringify(m[k])) {
      if (k in m) merged[k] = m[k]; else delete merged[k];
    }
  });
  return merged;
}
