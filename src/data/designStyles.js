// デザインテイスト（v1.1）。文章の文体とは独立して扱う。
// mono はモノクロ印刷（白黒）のときに置き換える指示。色に頼らない表現にする。

export const DESIGN_STYLES = [
  {
    value: 'soft', label: '癒し・やわらか', feature: '淡い色彩、柔らかい線、丸み',
    mono: '細めでやわらかい線、角の丸い囲み、余白を多めにとった穏やかな構成',
  },
  {
    value: 'pop', label: 'ポップ・元気', feature: '明るい配色、楽しさ、躍動感',
    mono: '太めの見出し、吹き出しや動きのある線・記号、白と黒のはっきりしたコントラストで元気さを出す',
  },
  {
    value: 'casual', label: 'カジュアル・親しみ', feature: '手描き風、気取らない雰囲気',
    mono: '手描き風の線や囲み、少し崩した配置で気取らない雰囲気を出す',
  },
  {
    value: 'formal', label: 'フォーマル・端正', feature: '整然とした構成、控えめな装飾',
    mono: '罫線と余白で整然と区切り、装飾は最小限にした端正な構成',
  },
  {
    value: 'simple', label: 'シンプル・すっきり', feature: '余白重視、最小限の装飾',
    mono: '余白を広くとり、線と文字の太さの差だけで情報を整理する',
  },
  {
    value: 'natural', label: 'ナチュラル・自然', feature: '植物、自然な色、素朴な質感',
    mono: '植物などの線画モチーフや素朴な線の質感で自然な雰囲気を出す（色は使わない）',
  },
  {
    value: 'elegant', label: '上品・落ち着き', feature: '繊細なライン、洗練された印象',
    mono: '細い罫線と控えめな飾り線、落ち着いた文字組みで上品さを出す',
  },
  {
    value: 'retro', label: 'レトロ・新聞風', feature: 'クラシックな見出し、新聞調',
    mono: '新聞のような段組み・見出し・罫線で構成する（モノクロと相性がよい）',
  },
];

export const DESIGN_STYLE_OPTIONS = [
  { value: '', label: '指定しない' },
  ...DESIGN_STYLES.map((s) => ({ value: s.value, label: s.label, hint: s.feature })),
];

export function getDesignStyle(value) {
  return DESIGN_STYLES.find((s) => s.value === value) || null;
}

/**
 * デザインテイストの指示文。
 * @param {string} value
 * @param {{mono?: boolean, subject?: string}} opts mono=モノクロ印刷／白黒
 */
export function designStyleLine(value, { mono = false, subject = 'デザイン' } = {}) {
  const s = getDesignStyle(value);
  if (!s) return null;
  if (mono) {
    return `${subject}のテイスト：${s.label}。モノクロ印刷のため、カラフルな色づかいは前提にせず、色に頼らない次の工夫で雰囲気を表現してください：${s.mono}。`;
  }
  return `${subject}のテイスト：${s.label}（${s.feature}）。`;
}
