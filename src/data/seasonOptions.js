// 時期・季節モチーフの共通データ（v1.1）
// 月と学校行事は対応付けない。月ごとの「おすすめモチーフ」は表示だけで、自動選択はしない。

export const MONTH_OPTIONS = [
  { value: '', label: '指定しない' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` })),
];

export const PERIOD_OPTIONS = [
  { value: '', label: '指定しない' },
  { value: '上旬', label: '上旬' },
  { value: '中旬', label: '中旬' },
  { value: '下旬', label: '下旬' },
];

export const MOTIF_GROUPS = [
  { id: 'spring', label: '春', items: ['桜', '菜の花', '新緑', '若葉', '春の花', '春風'] },
  { id: 'summer', label: '夏', items: ['青空', '入道雲', 'ひまわり', '海', '朝顔', '夏の植物'] },
  { id: 'autumn', label: '秋', items: ['紅葉', '落ち葉', 'どんぐり', 'すすき', '秋の草花', '実り'] },
  { id: 'winter', label: '冬', items: ['雪', '雪の結晶', '椿', '冬の星空', '冬景色'] },
  { id: 'annual', label: '季節の行事・風物', items: ['正月', '節分', 'ひな祭り', '端午の節句', '七夕', '十五夜', 'ハロウィン', 'クリスマス', '年末年始'] },
  { id: 'school', label: '学校生活全般', items: ['文房具', '黒板', '教室', '校舎', '本', '音符', '星', '幾何学模様'] },
];

export const ALL_MOTIFS = MOTIF_GROUPS.flatMap((g) => g.items);

/** 年中行事・風物（学校の行事と混同させないための判定に使う） */
export const ANNUAL_MOTIFS = MOTIF_GROUPS.find((g) => g.id === 'annual').items;

// 月ごとのおすすめ（表示のみ）。季節感には地域差があるため、あくまで候補。
const SEASON_BY_MONTH = { 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'autumn', 10: 'autumn', 11: 'autumn', 12: 'winter' };
const ANNUAL_BY_MONTH = {
  1: ['正月'], 2: ['節分'], 3: ['ひな祭り'], 5: ['端午の節句'], 7: ['七夕'], 9: ['十五夜'], 10: ['ハロウィン'], 12: ['クリスマス', '年末年始'],
};

/** 月に合うモチーフ候補（表示用）。月が未指定なら空 */
export function recommendedMotifs(month) {
  const m = Number(month);
  if (!m) return [];
  const season = MOTIF_GROUPS.find((g) => g.id === SEASON_BY_MONTH[m]);
  return [...(season ? season.items : []), ...(ANNUAL_BY_MONTH[m] || [])];
}

/** 季節感の反映方法。用途ごとに使う選択肢を絞る */
export const SEASON_REFLECT_OPTIONS = {
  all: [
    { value: '', label: '指定しない' },
    { value: 'text', label: '文章に反映' },
    { value: 'design', label: 'デザインに反映' },
    { value: 'both', label: '文章とデザインの両方に反映' },
    { value: 'none', label: '反映しない' },
  ],
  image: [
    { value: '', label: '指定しない' },
    { value: 'design', label: 'イラストに反映' },
    { value: 'none', label: '反映しない' },
  ],
  letter: [
    { value: '', label: '指定しない' },
    { value: 'text', label: '時候のあいさつに反映' },
    { value: 'none', label: '季節の表現を入れない' },
  ],
};

export function formatTime(month, period) {
  if (!month) return '';
  return `${month}月${period || ''}`;
}
