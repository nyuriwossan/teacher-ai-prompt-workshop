// テスト用の入力値。フォーム定義から機械的に作るので、フォームを追加しても使える。
import { getFields, getDefaults, normalizeOptions, isVisible } from '../src/prompts/buildPrompt.js';

const SAMPLE_TEXT = {
  subject: '理科',
  unit: 'てこのはたらき',
  goal: 'てこが水平につり合うときのきまりを、実験結果から説明できる。',
  aim: '支点・力点・作用点の位置関係を理解しているか確かめたい',
  topic: '光合成のしくみ',
  commonGoal: '説明文の段落の役割を理解し、要旨をまとめられる。',
  facts: '11月8日（金）の校外学習は、雨天の場合11日（月）に延期します。お弁当と水筒が必要です。',
  eventName: '学年レクリエーション大会',
  participants: '中学2年 4クラス 約130名',
  timeframe: '5・6時間目（13:30〜15:20）',
  purpose: '学年会で決まったことを欠席者と共有する',
  points: '・期末テストの日程確認\n・学年集会の担当決め（未決）',
  service: 'Google Classroom',
  detail: '提出された課題をまとめて返却したい',
  text: '来週の参観日わ、10時から始まります。お忙しいところ恐縮ですが、ぜひお越しください。',
  want: '給食の残食を減らすための、学級での呼びかけ案を考えてほしい',
  audience: '小学4年の学級全体',
  activity: '意見文（400字）を書く活動',
  content: '廊下は右側を歩こう。理由：ぶつからない、安全に移動できる。',
  use: '学級通信・おたより',
};

const SAMPLE_BY_TASK = {
  F07: { subject: '落ち葉のある校庭と秋の樹木' },
};

/** 必須項目だけを埋めた値 */
export function minimalValues(task) {
  const v = getDefaults(task);
  for (const f of getFields(task)) {
    if (!f.required || !isVisible(f, v)) continue;
    fillField(f, v, false, task.id);
  }
  // F12：資料ありなら要点は任意
  return v;
}

/** 表示中のすべての項目を埋めた値 */
export function fullValues(task) {
  const v = getDefaults(task);
  // showIf の親を先に決めるため2周する
  for (let pass = 0; pass < 2; pass += 1) {
    for (const f of getFields(task)) {
      if (!isVisible(f, v)) continue;
      fillField(f, v, true, task.id);
    }
  }
  return v;
}

function fillField(f, v, full = false, taskId = '') {
  const opts = f.options ? normalizeOptions(f.options) : [];
  switch (f.type) {
    case 'schoolGrade':
      v[f.id] = { school: 'junior', grade: '2' };
      break;
    case 'articles':
      v[f.id] = [
        { heading: '合唱コンクールに向けて', body: '朝の練習が始まりました。パートごとに声をそろえています。' },
        { heading: '衣替えのお知らせ', body: '10月から移行期間です。' },
      ];
      break;
    case 'checks': {
      if (full) v[f.id] = opts.slice(0, Math.max(f.min || 1, 2)).map((o) => o.value);
      else if ((v[f.id] || []).length < (f.min || 1)) v[f.id] = opts.slice(0, f.min || 1).map((o) => o.value);
      break;
    }
    case 'check':
      if (full) v[f.id] = true;
      break;
    case 'events':
      if (full) v[f.id] = [{ key: 'sports-02', base: '体育祭', custom: '', stage: f.stages ? f.stages[f.stages.length - 1] : '' }];
      else v[f.id] = [];
      break;
    case 'motifs':
      v[f.id] = full ? ['紅葉'] : [];
      break;
    case 'select':
    case 'radio':
      if (!v[f.id]) v[f.id] = (opts.find((o) => o.value) || {}).value;
      if (full && f.id === 'fillMode') v[f.id] = 'given';
      if (full && f.id === 'textMode') v[f.id] = 'some';
      break;
    default:
      if (!v[f.id]) v[f.id] = SAMPLE_BY_TASK[taskId]?.[f.id] || SAMPLE_TEXT[f.id] || `${f.label}のテスト入力`;
  }
}
