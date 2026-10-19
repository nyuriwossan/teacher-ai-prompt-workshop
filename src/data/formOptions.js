// 校種・学年、出力条件など、複数のフォームで共有する選択肢。
// 値（value）はプロンプト生成で使い、表示（label）は画面で使う。

export const APP_NAME = '先生のAI依頼文工房';

export const SCHOOL_TYPES = [
  { value: 'elementary', label: '小学校' },
  { value: 'junior', label: '中学校' },
  { value: 'senior', label: '高等学校' },
  { value: 'special', label: '特別支援学校' },
];

const range = (n, prefix = '', suffix = '年') =>
  Array.from({ length: n }, (_, i) => ({ value: `${prefix}${i + 1}`, label: `${prefix ? prefixLabel(prefix) : ''}${i + 1}${suffix}` }));

function prefixLabel(prefix) {
  return { e: '小学部', j: '中学部', h: '高等部' }[prefix] || '';
}

const COMMON_GRADE = { value: 'all', label: '学年共通・複数学年' };

// 校種ごとに学年の選択肢を変える（学年を一律1〜6にしない）
export const GRADES_BY_SCHOOL = {
  elementary: [...range(6), COMMON_GRADE],
  junior: [...range(3), COMMON_GRADE],
  senior: [...range(3), { value: '4', label: '4年（定時制など）' }, COMMON_GRADE],
  special: [...range(6, 'e'), ...range(3, 'j'), ...range(3, 'h'), COMMON_GRADE],
};

export function schoolLabel(school) {
  return SCHOOL_TYPES.find((s) => s.value === school)?.label || '';
}

export function gradeLabel(school, grade) {
  const g = (GRADES_BY_SCHOOL[school] || []).find((x) => x.value === grade);
  return g ? g.label : '';
}

/** 「中学校2年」「特別支援学校 中学部2年」「小学校（学年共通・複数学年）」の形に整える */
export function formatSchoolGrade(sg) {
  if (!sg || !sg.school) return '';
  const s = schoolLabel(sg.school);
  if (!sg.grade) return s;
  const g = gradeLabel(sg.school, sg.grade);
  if (!g) return s;
  if (sg.grade === 'all') return `${s}（${g}）`;
  if (sg.school === 'special') return `${s} ${g}`;
  return `${s}${g}`;
}

/** 校種に応じた学習者の呼び方 */
export function learnerTerm(sg) {
  if (!sg || !sg.school) return '児童生徒';
  if (sg.school === 'elementary') return '児童';
  if (sg.school === 'junior' || sg.school === 'senior') return '生徒';
  if (sg.school === 'special') {
    if (sg.grade && sg.grade.startsWith('e')) return '児童';
    if (sg.grade && (sg.grade.startsWith('j') || sg.grade.startsWith('h'))) return '生徒';
  }
  return '児童生徒';
}

/** 1単位時間の標準（授業時間の初期値に使う） */
export function standardLessonMinutes(sg) {
  if (!sg || !sg.school) return '';
  if (sg.school === 'elementary') return '45分';
  if (sg.school === 'junior' || sg.school === 'senior') return '50分';
  if (sg.school === 'special') {
    if (sg.grade && sg.grade.startsWith('e')) return '45分';
    return '45〜50分（学校の設定に合わせる）';
  }
  return '';
}

export const SUBJECT_SUGGESTIONS = [
  '国語', '社会', '地理歴史', '公民', '算数', '数学', '理科', '生活', '音楽', '図画工作', '美術', '芸術',
  '家庭', '技術・家庭', '体育', '保健体育', '外国語', '外国語活動', '英語', '情報', '特別の教科 道徳',
  '総合的な学習の時間', '総合的な探究の時間', '特別活動', '学級活動', '自立活動', '日本語指導',
];

export const ICT_SERVICE_SUGGESTIONS = [
  'Chromebook', 'iPad', 'Windows端末', 'Google Classroom', 'Googleフォーム', 'Googleドライブ',
  'Microsoft Teams', 'Microsoft Forms', 'ロイロノート・スクール', 'ミライシード', 'Canva',
  'Zoom', '電子黒板', 'プロジェクター・大型提示装置', 'プリンター', '校務支援システム',
];

// ---- 出力条件（必要なフォームだけが使う） ----

export const LEVEL_OPTIONS = [
  { value: 'short', label: '短く依頼する', hint: '要点だけの短い依頼文' },
  { value: 'standard', label: '標準', hint: 'ふだんはこれで十分です' },
  { value: 'detailed', label: '詳しく依頼する', hint: '条件や確認を多めに入れる' },
];

export const DELIVERY_DOC = [
  { value: 'word', label: 'Wordで後から編集' },
  { value: 'gdocs', label: 'Googleドキュメントで編集' },
  { value: 'pdf', label: 'PDF化を依頼' },
  { value: 'text', label: '単純なテキスト' },
];

export const DELIVERY_TABLE = [
  { value: 'excel', label: 'Excel・スプレッドシートで編集' },
  { value: 'word', label: 'Wordの表で編集' },
  { value: 'pdf', label: 'PDF化を依頼' },
  { value: 'text', label: '貼り付けられる表（テキスト）' },
];

export const DELIVERY_PLAIN = [
  { value: 'text', label: 'そのまま使えるテキスト' },
  { value: 'word', label: 'Wordで後から編集' },
  { value: 'gdocs', label: 'Googleドキュメントで編集' },
];

export const PAPER_PRINT = [
  { value: 'A4縦', label: 'A4縦' },
  { value: 'A4横', label: 'A4横' },
  { value: 'B4縦', label: 'B4縦' },
  { value: 'B4横', label: 'B4横' },
  { value: 'B5縦', label: 'B5縦' },
  { value: 'A3縦', label: 'A3縦' },
  { value: 'A3横', label: 'A3横' },
  { value: '', label: '指定しない' },
];
