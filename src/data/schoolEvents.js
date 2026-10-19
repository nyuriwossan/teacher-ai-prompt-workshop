// 学校行事マスタ（v1.1）
// - 実施月は登録しない。どの月でも、どの行事でも選べる。
// - related は「検索で一緒に出す関連名称のグループ」。同一の行事として扱うわけではなく、
//   依頼文には利用者が選んだ名称（と学校での名称）だけを入れる。

export const EVENT_CATEGORIES = [
  { id: 'ceremony', label: '儀式・節目' },
  { id: 'culture', label: '文化・発表' },
  { id: 'sports', label: '体育・健康・安全' },
  { id: 'trip', label: '校外学習・旅行・宿泊' },
  { id: 'work', label: '勤労・体験・交流' },
  { id: 'life', label: '学校生活・保護者・進路' },
];

const RAW = {
  ceremony: ['入学式', '始業式', '終業式', '修了式', '卒業式', '新入生歓迎会', '対面式', '離任式', '着任式', '卒業生を送る会', '卒業を祝う会', '立志式', '創立記念式典', '周年記念行事'],
  culture: ['文化祭', '学校祭', '学園祭', '文化発表会', '学習発表会', '学芸会', '作品展', '展覧会', '音楽会', '合唱祭', '合唱コンクール', '合唱発表会', '探究発表会', '研究発表会', '芸術鑑賞会', '演劇鑑賞会', '読書発表会', '百人一首大会', '英語スピーチコンテスト'],
  sports: ['運動会', '体育祭', '体育大会', 'スポーツフェスティバル', '球技大会', 'マラソン大会', '持久走大会', 'なわとび大会', '体力テスト', '健康診断', '保健講話', '避難訓練', '防災訓練', '引き渡し訓練', '交通安全教室', '薬物乱用防止教室'],
  trip: ['遠足', '校外学習', '社会科見学', '施設見学', '修学旅行', '研修旅行', '海外研修', '林間学校', '自然教室', '野外学習', '野外活動', '宿泊学習', '移動教室', '臨海学校', 'スキー教室', 'キャンプ', '自然体験学習'],
  work: ['職場体験', 'インターンシップ', '職業講話', '企業見学', '地域清掃', '校内美化活動', 'ボランティア活動', '田植え', '稲刈り', '収穫祭', '栽培活動', '地域交流', '異学年交流', '福祉体験', '施設訪問', '校内実習', '現場実習', '作業製品販売会'],
  life: ['授業参観', '学校公開', '公開授業', '保護者会', '個人懇談', '三者懇談', '進路説明会', '入学説明会', '定期テスト', '実力テスト', '学力調査', '検定', '児童会選挙', '生徒会役員選挙', '生徒総会', '委員会活動', '部活動紹介', '部活動体験', '壮行会', '引退式', '読書週間', '人権週間', '給食週間', 'オリエンテーション'],
};

/** 検索上の関連名称グループ（表記ゆれ・近い行事）。出力には使わない。 */
const RELATED_GROUPS = [
  ['運動会', '体育祭', '体育大会', 'スポーツフェスティバル'],
  ['文化祭', '学校祭', '学園祭', '文化発表会'],
  ['林間学校', '自然教室', '野外学習', '野外活動', '自然体験学習', 'キャンプ'],
  ['音楽会', '合唱祭', '合唱発表会', '合唱コンクール'],
  ['学習発表会', '学芸会', '文化発表会'],
  ['作品展', '展覧会'],
  ['マラソン大会', '持久走大会'],
  ['避難訓練', '防災訓練', '引き渡し訓練'],
  ['遠足', '校外学習', '社会科見学', '施設見学'],
  ['修学旅行', '研修旅行', '海外研修'],
  ['宿泊学習', '移動教室', '林間学校', '臨海学校'],
  ['職場体験', 'インターンシップ', '企業見学', '職業講話'],
  ['授業参観', '学校公開', '公開授業'],
  ['保護者会', '個人懇談', '三者懇談'],
  ['卒業生を送る会', '卒業を祝う会'],
  ['離任式', '着任式'],
  ['児童会選挙', '生徒会役員選挙'],
  ['探究発表会', '研究発表会'],
  ['芸術鑑賞会', '演劇鑑賞会'],
  ['定期テスト', '実力テスト'],
];

/** 検索用の読み・言い換え（出力には使わない） */
const SEARCH_HINTS = {
  運動会: ['うんどうかい'],
  体育祭: ['たいいくさい'],
  文化祭: ['ぶんかさい'],
  修学旅行: ['しゅうがくりょこう'],
  合唱コンクール: ['がっしょう', '合唱'],
  入学式: ['にゅうがくしき'],
  卒業式: ['そつぎょうしき'],
  遠足: ['えんそく'],
  授業参観: ['参観', 'さんかん', '参観日'],
  定期テスト: ['中間テスト', '期末テスト', 'テスト'],
  個人懇談: ['個人面談', '面談'],
  三者懇談: ['三者面談'],
  避難訓練: ['ひなん'],
  職場体験: ['職業体験'],
  部活動紹介: ['部活'],
  部活動体験: ['部活', '仮入部'],
  始業式: ['新学期'],
  終業式: ['学期末'],
};

export const EVENTS = Object.entries(RAW).flatMap(([category, names]) => names.map((name, i) => ({
  id: `${category}-${String(i + 1).padStart(2, '0')}`,
  name,
  category,
})));

const BY_NAME = new Map(EVENTS.map((e) => [e.name, e]));

/** 「よく使う行事」（最初のタブに出す） */
export const POPULAR_EVENT_NAMES = [
  '入学式', '始業式', '終業式', '卒業式', '運動会', '体育祭', '文化祭', '合唱コンクール',
  '遠足', '校外学習', '修学旅行', '宿泊学習', '授業参観', '保護者会', '個人懇談', '定期テスト',
  '避難訓練', '職場体験',
];

export function getEventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}

export function getEventByName(name) {
  return BY_NAME.get(name) || null;
}

/** 関連名称（検索で一緒に出すもの）。自分自身は含めない */
export function relatedNames(name) {
  const set = new Set();
  for (const g of RELATED_GROUPS) if (g.includes(name)) g.forEach((n) => n !== name && set.add(n));
  return [...set];
}

function norm(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s・、。ー－-]/g, '');
}

/**
 * 行事名で検索する。直接一致した行事を先に、関連名称で見つかった行事を後に並べる。
 * @returns {Array<{event, via: string|null}>} via は関連付けの元になった名称
 */
export function searchEvents(query) {
  const q = norm(query);
  if (!q) return [];
  const direct = EVENTS.filter((e) => {
    const terms = [e.name, ...(SEARCH_HINTS[e.name] || [])].map(norm);
    return terms.some((t) => t.includes(q) || (q.length >= 2 && q.includes(t)));
  });
  const seen = new Set(direct.map((e) => e.id));
  const related = [];
  for (const e of direct) {
    for (const rn of relatedNames(e.name)) {
      const r = BY_NAME.get(rn);
      if (r && !seen.has(r.id)) { seen.add(r.id); related.push({ event: r, via: e.name }); }
    }
  }
  return [...direct.map((event) => ({ event, via: null })), ...related];
}

// ---------- 行事の扱い方 ----------

export const EVENT_STAGES = [
  { value: '', label: '指定しない' },
  { value: 'prep', label: '事前案内・準備' },
  { value: 'before', label: '実施直前' },
  { value: 'after', label: '実施後の振り返り' },
  { value: 'motif', label: 'デザイン・イラストのモチーフのみ' },
];

export const MAX_EVENTS = 6;

/** 依頼文に入れる行事の表示名。「青葉祭（文化祭）」の形 */
export function eventDisplayName(entry) {
  const base = entry.base || '';
  const custom = entry.custom || '';
  if (base && custom && custom !== base) return `${custom}（${base}）`;
  if (base) return base;
  if (custom) return `${custom}（学校独自の行事）`;
  return '';
}
