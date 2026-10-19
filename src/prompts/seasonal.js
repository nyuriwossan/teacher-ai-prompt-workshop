// v1.1：時期・学校行事・季節モチーフ・デザインテイストを依頼文に変換する部品。
// どれも未指定なら何も出さない（null / 空配列）ので、従来の依頼文は変わらない。
// 原則：時期・行事・名称・内容をツールやAIが勝手に決めない。

import { eventDisplayName } from '../data/schoolEvents.js';
import { ANNUAL_MOTIFS, formatTime } from '../data/seasonOptions.js';
import { designStyleLine } from '../data/designStyles.js';

const NO_EVENT_GUESS = 'ただし、実施する行事や学校の具体的な出来事を推測で追加しないでください。';

/**
 * 時期の指示文。
 * @param {object} v 値
 * @param {'doc'|'image'|'letter'} kind
 */
export function timeLine(v, kind = 'doc') {
  const t = formatTime(v.month, v.period);
  if (!t) return null;
  const base = `作成物の想定時期は${t}です。`;
  const hasMotifs = (v.motifs && v.motifs.length) || v.motifCustom;
  let body;
  switch (v.seasonReflect) {
    case 'text':
      body = kind === 'letter'
        ? '前文の時候のあいさつは、この時期に合う短い一文にしてください。'
        : '指定された時期の季節感を文章に適切に反映してください。デザインには季節の要素を新たに加えないでください。';
      break;
    case 'design':
      body = kind === 'image'
        ? '指定された時期の季節感をイラストに適切に反映してください。'
        : '指定された時期の季節感をデザイン（配色・挿絵・飾り）に適切に反映してください。文章には季節の話題を新たに加えないでください。';
      break;
    case 'both':
      body = '指定された時期を文章やデザインに適切に反映してください。';
      break;
    case 'none':
      if (kind === 'letter') body = '時候のあいさつや季節の表現は入れないでください。';
      else body = hasMotifs
        ? '選んだモチーフ以外に、季節的な表現を加えないでください。'
        : `季節感は${kind === 'image' ? 'イラストに' : '文章にもデザインにも'}反映しないでください。`;
      break;
    default:
      body = '時期に合わない表現は避けてください。季節的な表現を無理に加える必要はありません。';
  }
  return `${base}${body}${NO_EVENT_GUESS}`;
}

/** 時期・行事・モチーフに関する注意事項（該当するものだけ） */
export function seasonalCautions(v) {
  const items = [];
  if (v.month || (v.motifs && v.motifs.length) || v.motifCustom) {
    items.push('季節の進み方には地域差があります。木々の色づき・降雪・開花などの自然の様子を、実際の出来事として断定しないでください。');
  }
  if (v.motifs && v.motifs.some((m) => ANNUAL_MOTIFS.includes(m))) {
    items.push('正月・ハロウィンなどの年中行事・風物や祝日は、学校で実施した行事として書かないでください。');
  }
  return items;
}

const STAGE_TEXT = {
  prep: '事前案内・準備（日程・持ち物・準備などは入力された内容だけを使い、未定の項目は記入欄にする）',
  before: '実施直前（直前の呼びかけや確認にとどめ、練習の様子などは創作しない）',
  after: '実施後の振り返り（入力された事実だけで書き、ない部分は記入欄にする）',
  motif: 'デザイン・イラストのモチーフとしてのみ使う（本文で実施について触れない）',
  '': '扱い方の指定なし（行事名にふれる程度にとどめ、内容を創作しない）',
};

/**
 * 【学校行事】の節。行事が未選択なら null。
 * @param {object} v
 * @param {'doc'|'letter'|'image'|'design'} kind
 */
export function eventsSection(v, kind = 'doc') {
  const events = v.events || [];
  if (!events.length) return null;
  const isImage = kind === 'image';
  const items = [
    isImage
      ? '次の行事を、イラストのモチーフとして使ってください（ここに挙げた行事だけを使い、ほかの行事は加えないでください）。'
      : '次の行事を扱ってください（ここに挙げた行事だけを扱い、ほかの行事は加えないでください）。',
    ...events.map((e) => (isImage
      ? `－ ${eventDisplayName(e)}`
      : `－ ${eventDisplayName(e)}：${STAGE_TEXT[e.stage] || STAGE_TEXT['']}`)),
  ].join('\n');
  const notes = [items];
  if (events.some((e) => e.custom)) {
    notes.push('行事名は上の表記（学校での名称）をそのまま使ってください。かっこ内は行事の種類の説明です。');
  }
  if (isImage) {
    notes.push('行事の具体的な場面（競技名・演目・行き先など）は、主題に書かれていない限り特定せず、その行事を連想させる一般的なモチーフにとどめてください。');
  } else {
    notes.push('行事の実施日・時間・場所・内容・結果は、入力がない限り決めないでください。必要な箇所は「（実施日）」「（場所）」のような記入欄にしてください。');
    notes.push('行事名だけから、具体的な活動・成果・感想を創作しないでください。');
    if (events.some((e) => e.stage === 'after')) {
      notes.push('実施後の振り返りは、入力された事実だけをもとに書いてください。当日の様子・成果・感想が入力されていない部分は「（ここに当日の様子を入力）」のような記入欄にしてください。');
    }
  }
  if (v.month) notes.push('「作成物の想定時期」は行事の実施日を意味しません。混同しないでください。');
  return { h: '学校行事', items: notes };
}

/**
 * 季節モチーフの指示文。
 * @param {'doc'|'image'} kind
 */
export function motifLine(v, kind = 'doc') {
  const list = [...(v.motifs || []), ...(v.motifCustom ? [v.motifCustom] : [])];
  if (!list.length) return null;
  if (kind === 'image') {
    return `添えるモチーフ：${list.join('、')}。主題を最優先し、主題が分かりにくくならない範囲で控えめに添えてください。`;
  }
  return `季節モチーフ（飾り・挿絵の候補）：${list.join('、')}。モチーフは飾りとして使い、本文で実際の出来事や景色として書かないでください。`;
}

/** デザインテイストの指示文 */
export function designLine(v, { mono = false, subject = 'デザイン' } = {}) {
  return designStyleLine(v.designStyle, { mono, subject });
}
