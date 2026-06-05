/**
 * フォントサイズ定数 (CSS変数 → src/lib/fontScale.js で設定)
 * --fs-xs : ボタン・補足ラベル
 * --fs-sm : 本文・入力バー・テーブル
 * --fs-md : アクションボタン・セクション見出し (max 20px)
 * --fs-lg : ページタイトル・大見出し
 */
export const FS_XS = "var(--fs-xs)";
export const FS_SM = "var(--fs-sm)";
export const FS_MD = "var(--fs-md)";
export const FS_LG = "var(--fs-lg)";

// ─── カラーパレット（南部地区5単会 デザイントークン）─────────────────
// 90%は白・淡色、濃紺はブランド/重要操作、状態色は信号として使う
export const C = {
  bgApp:       "#F4F5F7",
  surface:     "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  surfaceWarm: "#FFFCED",
  border:      "#E2E8F0",
  borderLight: "#EEF2F7",
  textMain:    "#101828",
  textHeading: "#061B44",
  textSub:     "#667085",
  textMuted:   "#98A2B3",
  // ブランド/ナビ/重要ボタン
  navy:        "#061B44",
  navyHover:   "#0A2A5F",
  navyDeep:    "#082B66",
  gold:        "#F6B73C",
  yellow:      "#FFE066",
  // 人物情報エリア
  personBg:       "#EAF0FF",
  personBgStrong: "#E4ECFF",
  personBorder:   "#B3C2FF",
  avatarBorder:   "#2563EB",
  avatarEmptyBg:  "#DDEAFF",
  avatarEmptyIcon:"#2563EB",
  // アクション
  mail:    "#1769D8",
  line:    "#13B94F",
  csv:     "#16813A",
  // 状態
  successBg:"#E8FFF8", successText:"#16813A", successBorder:"#B7F3DF",
  warningBg:"#FFF4E5", warningText:"#C05621", warningBorder:"#FFB86B", warningOrange:"#FFB86B",
  attentionBg:"#FFF8D8", attentionText:"#92400E", attentionBorder:"#FFE066",
  neutralBg:"#F4F4F5", neutralText:"#71717A", neutralBorder:"#E4E4E7",
  danger:"#DC2626", dangerBg:"#FEF2F2", dangerBorder:"#FECACA",
};

export const CARD = { background:C.surface, borderRadius:14, padding:"13px", border:`1px solid ${C.border}`, boxShadow:"0 8px 24px rgba(15,35,71,.06)", marginBottom:12 };
export const OV   = { position:"fixed", inset:0, background:"rgba(6,27,68,.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"clamp(6px,2vw,16px)" };
export const MOD  = { background:C.surface, borderRadius:16, padding:"clamp(14px,3vw,22px)", width:"100%", maxWidth:560, maxHeight:"min(92dvh, 92vh)", overflowY:"auto", WebkitOverflowScrolling:"touch" };
export const MH   = { fontSize:FS_SM, fontWeight:700, color:C.textHeading, borderBottom:`2px solid ${C.navy}`, paddingBottom:7, display:"flex", alignItems:"center", gap:7, marginBottom:8 };
export const BP   = { background:C.navy, color:"#fff", border:`1px solid ${C.navy}`, borderRadius:10, padding:"7px 15px", fontSize:FS_XS, fontWeight:700, cursor:"pointer" };
export const BC   = { background:C.surface, color:C.textMain, border:`1px solid #D9E1EE`, borderRadius:10, padding:"7px 15px", fontSize:FS_XS, fontWeight:600, cursor:"pointer" };
export const BG   = { background:C.line, color:"#fff", border:"none", borderRadius:10, padding:"7px 15px", fontSize:FS_XS, fontWeight:700, cursor:"pointer" };
export const SEL  = { border:`1px solid #D9E1EE`, borderRadius:8, padding:"5px 8px", fontSize:FS_SM, background:"#fff", cursor:"pointer" };
export const INP  = { border:`1px solid #D9E1EE`, borderRadius:8, padding:"6px 8px", fontSize:FS_SM, background:"#fff" };
export const BSM  = { background:C.neutralBg, border:"none", borderRadius:8, padding:"3px 8px", fontSize:FS_XS, cursor:"pointer", fontWeight:600, color:C.textSub };
export const TBL  = { width:"100%", borderCollapse:"collapse" };
export const TH   = { padding:"8px 10px", fontSize:FS_SM, fontWeight:700, textAlign:"left", color:C.textSub, background:C.surfaceSoft };
export const TD   = { padding:"8px 10px", fontSize:FS_SM, verticalAlign:"middle", borderBottom:`1px solid ${C.borderLight}` };
export const PILL = (ch) => ({ fontSize:FS_XS, padding:"2px 8px", borderRadius:999, fontWeight:700, background: ch.light, color: ch.color });
