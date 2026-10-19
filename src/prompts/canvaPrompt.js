// v1.2：Canva AI 向けの依頼文。
// 通常AI向け（buildPrompt / taskTemplates）とは独立した組み立て処理。
// - Canva に直接貼り付けて「完成したデザイン」を作ってもらうための、簡潔な制作指示にする。
// - 教師向けの注意事項は依頼文に混ぜず、notes として返して画面側で別に表示する
//   （注意書きがデザイン内の文字として印刷されるのを防ぐため）。
// - 行事・季節・テイストのデータは v1.1 の共通データを再利用する（重複実装しない）。

import { validate, makeContext, cleanValues } from './buildPrompt.js';
import { CANVA_TASK_IDS } from '../data/taskCatalog.js';
import { eventDisplayName } from '../data/schoolEvents.js';
import { ANNUAL_MOTIFS, formatTime } from '../data/seasonOptions.js';
import { designStyleLine } from '../data/designStyles.js';

// ---------------------------------------------------------------- 判定

/** Canva 向けの依頼文を作る状態か（F06 はお知らせ文書のときだけ） */
export function isCanvaMode(task, values) {
  if (!task || !CANVA_TASK_IDS.includes(task.id)) return false;
  const v = cleanValues(task, values || {});
  return v.target === 'canva';
}

// ---------------------------------------------------------------- 共通部品

function paperDesc(paper) {
  if (!paper) return '';
  const m = String(paper).match(/^(A3|A4|B4|B5)(縦|横)$/);
  if (m) return `${m[1]}サイズ・${m[2]}向き`;
  return paper;
}

const REFLECT_TEXT = {
  doc: {
    '': '季節の表現は控えめにし、無理に加えない',
    text: '季節感は文章だけに反映する',
    design: '季節感は配色や飾りだけに反映する',
    both: '季節感を文章とデザインの両方に反映する',
    none: '季節の表現は入れない',
  },
  image: {
    '': '季節の表現は控えめにし、無理に加えない',
    design: '季節感をイラストに反映する',
    none: '季節の表現は入れない',
  },
};

function timeItem(v, kind = 'doc') {
  const t = formatTime(v.month, v.period);
  if (!t) return null;
  const hasMotifs = (v.motifs && v.motifs.length) || v.motifCustom;
  let r = (REFLECT_TEXT[kind] || REFLECT_TEXT.doc)[v.seasonReflect || ''] || REFLECT_TEXT.doc[''];
  if (v.seasonReflect === 'none' && hasMotifs) r = '選んだモチーフ以外の季節の表現は入れない';
  return `使う時期：${t}（${r}）。この時期は行事の実施日ではありません。`;
}

function motifItem(v) {
  const list = [...(v.motifs || []), ...(v.motifCustom ? [v.motifCustom] : [])];
  if (!list.length) return null;
  return `季節モチーフ：${list.join('、')}（飾りとして控えめに使う）`;
}

const STAGE_SHORT = {
  prep: '事前のお知らせ・準備',
  before: '実施直前の呼びかけ',
  after: '実施後の振り返り（当日の様子は入力された内容だけ。ない部分は記入欄）',
  motif: '飾り・イラストのモチーフとしてだけ使う',
  '': '名前にふれる程度',
};

/** 掲載内容として扱う行事（モチーフのみ以外） */
function contentEventItems(v) {
  const list = (v.events || []).filter((e) => e.stage !== 'motif');
  if (!list.length) return [];
  return [
    ['取り上げる行事（表記はこのまま使う）', ...list.map((e) => `－ ${eventDisplayName(e)}：${STAGE_SHORT[e.stage] || STAGE_SHORT['']}`)].join('\n'),
  ];
}

/** デザインのモチーフとして扱う行事 */
function motifEventItem(v, all = false) {
  const list = (v.events || []).filter((e) => all || e.stage === 'motif');
  if (!list.length) return null;
  return `モチーフにする行事：${list.map(eventDisplayName).join('、')}（その行事を連想させる一般的な絵柄にとどめる）`;
}

function eventRule(v) {
  if (!(v.events || []).length) return null;
  return '行事の日付・場所・内容・結果は書き加えず、必要なら記入欄にしてください。ここに挙げていない行事は加えないでください。';
}

function annualRule(v) {
  return (v.motifs || []).some((m) => ANNUAL_MOTIFS.includes(m))
    ? '正月・ハロウィンなどの年中行事は、学校で実施した行事として書かないでください。'
    : null;
}

function editableRules({ editable = true } = {}) {
  return [
    editable ? '可能な限り、文字・図形・写真枠を後から個別に編集しやすい形で制作してください。' : null,
    '掲載する内容に書かれていない日時・場所・名称・出来事・人物を加えないでください。',
    '指定した見出し・本文・連絡事項の文言を、勝手に削除したり意味を変えたりしないでください。',
    '情報が足りない部分は「（日時）」「（場所）」のような、編集できる記入欄として残してください。',
    '実在の学校名・校章・ロゴや、実在の人物の写真・似顔絵は使わないでください。',
    'この依頼文の説明や指示の文章は、デザインの中に文字として入れないでください。',
  ];
}

const COMMON_NOTES = [
  'Canva AIの機能や使える範囲は、Canvaのプランや学校・自治体の設定によって異なります。',
  '生成されたデザインで、文字や図形を個別に編集できるとは限りません。',
  '日付・名称・本文などの内容は、使う前に必ず先生が確認してください。',
];

// ---------------------------------------------------------------- F05 学級通信

function canvaF05(v, c) {
  const school = c.sg(v.schoolGrade);
  const articles = v.articles || [];
  const photos = Number(v.photoSlots || 0);
  const pages = v.pages && v.pages.startsWith('2') ? '2ページ（表裏）' : '1ページ';
  const readers = { parents: '保護者', both: '児童生徒と保護者', students: '児童生徒' }[v.audience] || '保護者';
  const tone = {
    warm: '敬体（です・ます）で温かく落ち着いた文章',
    concise: '敬体（です・ます）で簡潔な文章',
    friendly: '児童生徒も読みやすい、親しみのある敬体の文章',
  }[v.tone] || '敬体（です・ます）で温かく落ち着いた文章';

  const articleItems = articles.map((a, i) => {
    const lines = [`記事${i + 1}`];
    lines.push(a.heading ? `見出し：「${a.heading}」` : '見出し：内容に合う短い見出し');
    if (a.body) lines.push(`本文の材料：${a.body.split('\n').join('\n　')}`);
    else lines.push('本文：「（ここに本文を入力）」の記入欄');
    return lines.join('\n');
  });

  return {
    lead: [
      `${school}の${v.kind}の紙面デザインを作成してください。`,
      'レイアウト案の説明ではなく、印刷してそのまま配布できる完成したデザインを作ってください。',
    ],
    sections: [
      { h: 'サイズ・形式', items: [
        `用紙：${paperDesc(v.paper || 'A4縦')}、${pages}`,
        `用途：印刷して配布する（おもな読者：${readers}）`,
        v.mono ? 'モノクロ印刷で読みやすいデザインにしてください（色に頼らず、太字・罫線・囲み・濃淡で区別する）。' : null,
      ] },
      { h: '掲載する内容', items: [
        v.title ? `通信名：「${v.title}」` : '通信名：「（通信名）」の記入欄',
        '紙面の上部に、号数「第○号」・発行日「○月○日」・学年学級名と担任名の記入欄',
        ...articleItems,
        `各記事の本文は、上の材料だけをもとに${tone}で短くまとめてください。材料にない出来事・児童生徒の様子や感想は加えず、材料が少なければ短いままで構いません。`,
        ...contentEventItems(v),
        v.notices ? `家庭への連絡（囲み枠で）：${v.notices}` : null,
        photos > 0 ? `写真・イラストの枠：${photos}か所（あとで写真を差し替えられる空の枠にし、写真の中身は描き込まない）` : null,
      ] },
      { h: 'デザイン', items: [
        `レイアウト：記事${articles.length}本${photos > 0 ? `と写真枠${photos}か所` : ''}を、見出しと本文のまとまりが分かるように配置する。見出しは本文より大きく太くする。`,
        '本文は印刷して読みやすい大きさ（目安10.5pt以上）にしてください。入り切らない場合は、文字を極端に小さくせず、レイアウトや余白の調整を優先してください。',
        designStyleLine(v.designStyle, { mono: v.mono, subject: 'デザイン' }),
        timeItem(v),
        motifItem(v),
        motifEventItem(v),
      ] },
      { h: '制作の条件', items: [
        ...editableRules(),
        eventRule(v),
        annualRule(v),
        '児童生徒の名前や、個人が特定できる写真・描写は入れないでください。',
      ] },
    ],
    notes: [
      ...COMMON_NOTES,
      photos > 0 ? '写真を入れる場合は、学校の方針（掲載の同意など）を確認してください。' : null,
      '発行前に、学年主任・管理職の確認が必要かを確認してください。',
    ],
  };
}

// ---------------------------------------------------------------- F06 保護者向け文書（お知らせ文書のみ）

function canvaF06(v, c) {
  const audience = c.label('audience', v.audience);
  const t = formatTime(v.month, v.period);
  const tone = {
    polite: '保護者に向けた丁寧な敬語',
    'more-polite': 'より丁寧な敬語（必要に応じておわびや感謝の言葉を添える）',
    concise: '丁寧さを保った簡潔な文章',
  }[v.tone] || '保護者に向けた丁寧な敬語';
  let greeting;
  if (v.seasonReflect === 'none') greeting = '前文：時候のあいさつは入れず、短い前置きだけにする';
  else if (v.seasonReflect === 'text' && t) greeting = `前文：${t}に合う時候のあいさつを短く一文`;
  else greeting = '前文：短く一文程度';

  return {
    lead: [
      `${audience}に向けたお知らせ文書のデザインを作成してください。`,
      '印刷・PDFで配布する、学校の正式な文書にふさわしい完成したデザインを作ってください。',
    ],
    sections: [
      { h: 'サイズ・形式', items: [
        `用紙：A4サイズ・縦向き、${v.length === 'long' ? '1ページ（どうしても収まらない場合のみ2ページ）' : '1ページ'}`,
        '用途：印刷またはPDFで保護者に配布する',
        v.easyJapanese ? '次のページに、同じ内容の「やさしい日本語版」を入れてください（一文を短く、日時・持ち物は箇条書き）。' : null,
      ] },
      { h: '掲載する内容', items: [
        v.audience === 'individual' ? '宛名：「（保護者名）様」の記入欄' : '宛名：「保護者各位」',
        '発行日・発信者（学校名・担任名など）：記入欄',
        v.purpose && v.purpose !== 'その他' ? `表題：内容に合う短い表題（連絡の目的：${v.purpose}）` : '表題：内容に合う短い表題',
        greeting,
        c.kv('伝える事実（このとおり正確に掲載）', v.facts),
        c.kv('保護者へのお願い', v.requests),
        v.requests ? '返信欄：提出や回答が必要な場合は、切り取り線つきの返信欄' : null,
        v.contact ? c.kv('問い合わせ先', v.contact) : '問い合わせ先：記入欄',
        ...contentEventItems(v),
        `文章：${tone}`,
      ] },
      { h: 'デザイン', items: [
        '日時・場所・持ち物・期限は、本文とは別に見つけやすい枠や箇条書きにまとめてください（伝える事実に書かれているものだけ）。',
        '学校の正式な文書にふさわしい、落ち着いて整ったレイアウトにしてください。装飾は控えめにし、本文の読みやすさを妨げないでください。',
        '本文は印刷して読みやすい大きさ（目安10.5〜12pt）にしてください。',
        t ? `使う時期：${t}。季節の飾りは${v.seasonReflect === 'none' ? '入れないでください' : '入れないか、ごく控えめにしてください'}。` : null,
      ] },
      { h: '制作の条件', items: [
        ...editableRules(),
        '伝える事実の日時・場所・金額などを書き換えたり、補ったりしないでください。',
        eventRule(v),
        v.audience === 'individual' ? '欠席・成績・トラブル・家庭の事情など、個別の事情に踏み込んだ内容は書かないでください。' : null,
      ] },
    ],
    notes: [
      ...COMMON_NOTES,
      '日付と曜日の組み合わせなど、伝える事実に誤りがないか確認してください。',
      '正式な文書として出す前に、学校の発信の手順（管理職の確認など）に沿っているか確認してください。',
    ],
  };
}

// ---------------------------------------------------------------- F07 教材用イラスト

function canvaF07(v, c) {
  const n = Number(String(v.variants).replace(/[^0-9]/g, '')) || 1;
  const mono = v.color === 'mono' || v.color === 'lineart';
  const colorText = {
    color: 'カラー。印刷しても色がつぶれない明るさとコントラスト',
    pale: '淡くやさしい色合い。輪郭ははっきりさせる',
    mono: '白黒（モノクロ）。グレーの細かい階調に頼らず、モノクロ印刷でも形がはっきり分かるコントラスト',
    lineart: '黒い線だけのぬりえ用線画。塗りつぶし・グレーは使わず、線は太めで、塗りやすい閉じた形',
  }[v.color];
  const bg = {
    subtle: '控えめにし、主題を目立たせる',
    full: '背景まで描くが、主題が埋もれないようにする',
    white: '白（切り抜きやすく）',
    transparent: '透明（できない場合は白）',
  }[v.background];
  const people = {
    none: '人物は描かない',
    small: '人物は小さく、後ろ姿など顔が分からない描き方',
    generic: '人物は、特定の誰かではないデフォルメした子ども',
  }[v.people];
  const text = v.textMode === 'some' && v.textContent
    ? `画像内の文字は「${v.textContent}」だけにし、正確に表記する（崩れる場合は文字なしにする）`
    : '文字・数字・記号は一切入れない';

  return {
    lead: [
      `教材用のイラスト画像を${n > 1 ? `${n}案` : '1枚'}生成してください。`,
      `用途：${v.use}`,
    ],
    sections: [
      { h: '描くもの', items: [`主題：${v.subject}`, people] },
      { h: '画風・構図', items: [
        `絵柄：${v.style}`,
        designStyleLine(v.designStyle, { mono, subject: '全体' }),
        v.designStyle ? `絵柄の指定を優先し、テイストは雰囲気を補う程度にする` : null,
        `比率：${v.aspect}`,
        bg ? `背景：${bg}` : null,
        v.printSize ? `使う大きさ：${v.printSize}${v.printSize === '紙面に小さく配置' ? '（小さくても判別できるよう、形を大きくシンプルに）' : ''}` : null,
      ] },
      { h: '色', items: [colorText] },
      { h: '文字', items: [text] },
      { h: '季節・行事', items: [
        timeItem(v, 'image'),
        motifItem(v),
        motifEventItem(v, true),
      ] },
      { h: '入れないもの', items: [
        '余計な文字や装飾、読めない文字',
        '実在の校章・学校名・ロゴ・商標、既存の作品のキャラクター',
        '怖い・暴力的・不安をあおる表現',
        '実在の児童生徒や人物の顔・容姿の再現',
        v.avoid || null,
      ] },
      { h: '制作の条件', items: [
        '主題をいちばん目立たせ、指定していないモチーフや装飾を増やさないでください。',
        '特定の作家・作品・キャラクターの画風をまねないでください。',
        c.std('手や指、物の形に不自然な描写がないようにしてください。'),
        'この依頼文の説明や指示の文章を、画像の中に文字として入れないでください。',
      ] },
    ],
    notes: [
      'Canva AIの画像生成の機能や使える範囲は、Canvaのプランや学校・自治体の設定によって異なります。',
      '生成した画像を学校の配布物に使えるか、利用条件を確認してください。',
      '縮小やモノクロ印刷で見やすいか、不自然な描写や意図しない文字がないかを確認してください。',
    ],
  };
}

// ---------------------------------------------------------------- F08 掲示物・スライド・プリント

function canvaF08(v, c) {
  const isSlide = v.size && v.size.startsWith('スライド');
  const kind = v.kind || '';
  const isPoster = !isSlide && /掲示|ポスター|めあて/.test(kind);
  const sizeText = isSlide
    ? `スライド（${v.size.replace('スライド', '')}）${v.slideCount ? `、${v.slideCount}` : '、枚数は内容に合わせて最小限'}`
    : (v.size === 'はがき・カードサイズ' ? 'はがき・カードサイズ' : paperDesc(v.size));
  const use = isSlide ? '教室などで投影して見せる' : (isPoster ? '掲示して、離れた場所から見る' : '印刷して配布する');
  const audience = c.label('audience', v.audience);
  const mood = v.mood || [];
  const slots = Number(v.imageSlots || 0);

  return {
    lead: [
      isSlide ? `${kind}として使うスライド資料を作成してください。` : `${kind}のデザインを作成してください。`,
      'レイアウト案の説明ではなく、完成したデザインを作ってください。',
    ],
    sections: [
      { h: 'サイズ・形式', items: [
        `サイズ：${sizeText}`,
        `用途：${use}（見る人：${audience}${v.grade ? `・${v.grade}` : ''}）`,
        v.mono ? 'モノクロ印刷で読みやすいデザインにしてください（色に頼らず、太字・罫線・囲み・濃淡で区別する）。' : null,
      ] },
      { h: '掲載する内容', items: [
        `次の文言を正確に掲載してください（意味を変えたり省略したりしない）：\n${v.content}`,
        ...contentEventItems(v),
        slots > 0 ? `写真・イラストの枠：${slots}か所（あとで差し替えられる空の枠）` : null,
      ] },
      { h: 'デザイン', items: [
        '最も伝えたいことを一番大きく目立たせ、見出しと本文に大きさ・太さのはっきりした差をつけてください。',
        isSlide ? '投影したときに見やすいよう、1枚あたりの文字を少なくし、文字を大きくしてください。' : null,
        isPoster ? '離れた場所からでも読めるよう、見出しはとても大きく、本文も大きめにしてください。' : null,
        !isSlide && !isPoster ? '印刷して手元で読みやすい文字の大きさ（目安10.5pt以上）にしてください。' : null,
        mood.length ? `雰囲気：${mood.join('、')}` : null,
        v.colors ? `使いたい色：${v.colors}${v.mono ? '（モノクロ印刷のため、色ではなく濃淡で表現）' : ''}` : null,
        designStyleLine(v.designStyle, { mono: v.mono, subject: 'デザイン' }),
        v.designStyle || mood.includes('色覚の多様性に配慮') ? '色だけで情報を区別しないでください。読みやすさ・色覚の多様性への配慮・モノクロの条件を、デザインの好みより優先してください。' : null,
        timeItem(v),
        motifItem(v),
        motifEventItem(v),
      ] },
      { h: '制作の条件', items: [
        ...editableRules(),
        eventRule(v),
        annualRule(v),
      ] },
    ],
    notes: [
      ...COMMON_NOTES,
      '掲示・配布についての校内のルールに沿っているか確認してください。',
      isSlide ? '実際に投影して、後ろの席から文字が読めるか確認してください。' : '実際に印刷して、見え方を確認してください。',
    ],
  };
}

export const CANVA_TEMPLATES = { F05: canvaF05, F06: canvaF06, F07: canvaF07, F08: canvaF08 };

// ---------------------------------------------------------------- テキスト化

function clean(items) {
  return (items || []).flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false)
    .map((x) => String(x).trim()).filter(Boolean);
}

function renderItem(it) {
  const [first, ...rest] = it.split('\n');
  return [`・${first}`, ...rest.map((r) => (r.startsWith('　') ? r : `　${r}`))].join('\n');
}

/**
 * Canva AI 向けの依頼文を作る。
 * @returns {{ok:boolean, errors:Array, text:string, notes:string[], values:object}}
 */
export function buildCanvaPrompt(task, raw) {
  const { ok, errors, values } = validate(task, raw);
  if (!ok) return { ok, errors, text: '', notes: [], values };
  const tpl = CANVA_TEMPLATES[task.id];
  if (!tpl || values.target !== 'canva') {
    throw new Error(`Canva向けの依頼文に対応していない状態です: ${task.id}`);
  }
  const out = tpl(values, makeContext(task, values));
  const body = out.sections
    .map((s) => ({ h: s.h, items: clean(s.items) }))
    .filter((s) => s.items.length)
    .map((s) => `■ ${s.h}\n${s.items.map(renderItem).join('\n')}`);
  const text = [clean(out.lead).join('\n'), ...body].join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return { ok: true, errors: [], text, notes: clean(out.notes), values };
}

export const CANVA_URL = 'https://www.canva.com/';
