// デザインテイスト（v1.1）。文章の文体とは独立して扱う。
// mono はモノクロ印刷（白黒）のときに置き換える指示。色に頼らない表現にする。
// canva / canvaMono は Canva 向け依頼文の自然文用（v1.3）。

export const DESIGN_STYLES = [
  {
    value: 'soft', label: '癒し・やわらか', feature: '淡い色彩、柔らかい線、丸み',
    mono: '細めでやわらかい線、角の丸い囲み、余白を多めにとった穏やかな構成',
    canva: '淡い色と柔らかい線、丸みのある形でやさしい雰囲気にしてください',
    canvaMono: '細くやわらかい線と丸い囲み、広めの余白で',
  },
  {
    value: 'pop', label: 'ポップ・元気', feature: '明るい配色、楽しさ、躍動感',
    mono: '太めの見出し、吹き出しや動きのある線・記号、白と黒のはっきりしたコントラストで元気さを出す',
    canva: '明るい配色と躍動感で、楽しく元気な雰囲気を出してください',
    canvaMono: '太めの見出しや吹き出し、動きのある線や記号で',
  },
  {
    value: 'casual', label: 'カジュアル・親しみ', feature: '手描き風、気取らない雰囲気',
    mono: '手描き風の線や囲み、少し崩した配置で気取らない雰囲気を出す',
    canva: '手描き風の線や気取らない配置で、親しみやすい雰囲気にしてください',
    canvaMono: '手描き風の線や囲みで',
  },
  {
    value: 'formal', label: 'フォーマル・端正', feature: '整然とした構成、控えめな装飾',
    mono: '罫線と余白で整然と区切り、装飾は最小限にした端正な構成',
    canva: '整然とした構成にし、装飾は控えめにしてください',
    canvaMono: '罫線と余白で整然と区切って',
  },
  {
    value: 'simple', label: 'シンプル・すっきり', feature: '余白重視、最小限の装飾',
    mono: '余白を広くとり、線と文字の太さの差だけで情報を整理する',
    canva: '余白を広くとり、装飾は最小限にしてすっきりまとめてください',
    canvaMono: '広い余白と線の太さの差で',
  },
  {
    value: 'natural', label: 'ナチュラル・自然', feature: '植物、自然な色、素朴な質感',
    mono: '植物などの線画モチーフや素朴な線の質感で自然な雰囲気を出す（色は使わない）',
    canva: '植物などの自然のモチーフと落ち着いた自然な色で、素朴な質感にしてください',
    canvaMono: '植物などの線画モチーフと素朴な線で',
  },
  {
    value: 'elegant', label: '上品・落ち着き', feature: '繊細なライン、洗練された印象',
    mono: '細い罫線と控えめな飾り線、落ち着いた文字組みで上品さを出す',
    canva: '繊細なラインを使い、洗練された落ち着いた印象にしてください',
    canvaMono: '細い罫線と控えめな飾り線で',
  },
  {
    value: 'retro', label: 'レトロ・新聞風', feature: 'クラシックな見出し、新聞調',
    mono: '新聞のような段組み・見出し・罫線で構成する（モノクロと相性がよい）',
    canva: 'クラシックな見出しと段組みで、新聞のような紙面にしてください',
    canvaMono: '新聞のような段組み・見出し・罫線で',
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

/**
 * Canva 向けの自然文（v1.3）。例：「デザインはポップ・元気で、明るい配色と躍動感で…してください。」
 * モノクロのときは色に頼らない表現にする。
 */
export function designStyleSentence(value, { mono = false } = {}) {
  const s = getDesignStyle(value);
  if (mono) {
    if (!s) return 'モノクロ印刷で使うため、白黒で読みやすくし、濃淡や線・囲みで情報を整理してください。';
    return `デザインは${s.label}にしてください。モノクロ印刷で使うため白黒で読みやすくし、${s.canvaMono}${s.label}の雰囲気を出してください。`;
  }
  if (!s) return null;
  return `デザインは${s.label}で、${s.canva}。`;
}
