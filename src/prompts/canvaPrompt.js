// Canva 向けの依頼文（v1.2 で追加、v1.3 で「通りやすい型」に作り直し）。
// 共通（通常AI向け：buildPrompt / taskTemplates）とは独立した組み立て処理。
//
// v1.3 の型（完成デザイン生成に向けた、入れ子の少ない自然文）：
//   冒頭：何を作るか・完成デザインであること・配布用であること
//   ■ サイズ・形式 → ■ デザイン → ■ 紙面に入れる内容（固定で入れる文字／記入欄／本文の材料）
//   → ■ 文章の書き方 → ■ レイアウト → ■ してほしくないこと
// - 箇条書きは1段だけ。Markdown 記法は使わない。
// - 教師向けの注意事項は依頼文に混ぜず、notes として返して画面側で別に表示する
//   （注意書きがデザイン内の文字として印刷されるのを防ぐため）。
// - 行事・季節・テイストのデータは v1.1 の共通データを再利用する（重複実装しない）。

import { validate, makeContext, cleanValues } from './buildPrompt.js';
import { CANVA_TASK_IDS } from '../data/taskCatalog.js';
import { ANNUAL_MOTIFS, formatTime } from '../data/seasonOptions.js';
import { designStyleLine, designStyleSentence } from '../data/designStyles.js';

// ---------------------------------------------------------------- 判定

/** Canva 向けの依頼文を作る状態か（F06 はお知らせ文書のときだけ） */
export function isCanvaMode(task, values) {
  if (!task || !CANVA_TASK_IDS.includes(task.id)) return false;
  const v = cleanValues(task, values || {});
  return v.target === 'canva';
}

/** 画面に出す Canva 向けのヒント（依頼文には含めない） */
export const CANVA_TIP = 'Canvaでは、完成デザインの生成が不安定な場合があります。うまくいかないときは、内容を少し簡潔にするか、既存のテンプレートの編集と併用してください。';

export const CANVA_URL = 'https://www.canva.com/';

// ---------------------------------------------------------------- 共通部品

/** 複数行を1行にまとめる（句点などの後は空白を入れない） */
const oneLine = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean)
  .reduce((acc, line) => (!acc ? line : `${acc}${/[。．！？!?」）)]$/.test(acc) ? '' : '、'}${line}`), '');

function paperDesc(paper) {
  if (!paper) return '';
  const m = String(paper).match(/^(A3|A4|B4|B5)(縦|横)$/);
  if (m) return `${m[1]}${m[2]}`;
  return paper;
}

/** 「紙面の想定時期は10月下旬です。季節感は控えめにしてください。」 */
function timeSentence(v, kind = 'doc') {
  const t = formatTime(v.month, v.period);
  const hasMotifs = (v.motifs && v.motifs.length) || v.motifCustom;
  if (!t) return null;
  const subject = kind === 'image' ? 'イラストの想定時期' : '紙面の想定時期';
  const reflect = {
    '': '季節感は控えめにしてください。',
    text: '季節感は文章にだけ少し反映し、飾りには加えないでください。',
    design: kind === 'image' ? '季節感をイラストに反映してください（盛りすぎない程度に）。' : '季節感は配色や飾りにだけ反映してください（盛りすぎない程度に）。',
    both: '季節感を文章と飾りの両方に反映してください（盛りすぎない程度に）。',
    none: hasMotifs ? '選んだ季節の飾り以外に、季節の表現は入れないでください。' : '季節の表現は入れないでください。',
  }[v.seasonReflect || ''] || '季節感は控えめにしてください。';
  const notEventDate = (v.events || []).length ? 'この時期は行事の実施日ではありません。' : '';
  return `${subject}は${t}です。${reflect}${notEventDate}`;
}

function motifSentence(v, kind = 'doc') {
  const list = [...(v.motifs || []), ...(v.motifCustom ? [v.motifCustom] : [])];
  if (!list.length) return null;
  return kind === 'image'
    ? `${list.join('・')}を、主題が分かりにくくならない程度に控えめに添えてください。`
    : `季節の飾りとして、${list.join('・')}を控えめに使ってください。`;
}

/** 行事の名前の文。「行事名は『青葉祭』を使用してください。文化祭にあたる行事です。」 */
function eventNameSentence(e) {
  const custom = (e.custom || '').trim();
  if (e.base && custom && custom !== e.base) return `行事名は「${custom}」を使用してください。${e.base}にあたる行事です。`;
  if (!e.base && custom) return `「${custom}」は学校独自の行事名です。表記はこのまま使ってください。`;
  return null;
}

function eventName(e) {
  const custom = (e.custom || '').trim();
  return custom || e.base;
}

/** 本文で扱う行事の文（モチーフのみの行事は除く） */
function eventContentSentences(v) {
  const out = [];
  for (const e of (v.events || []).filter((x) => x.stage !== 'motif')) {
    const n = `「${eventName(e)}」`;
    const nameS = eventNameSentence(e);
    if (nameS) out.push(nameS);
    out.push({
      prep: `${n}は事前のお知らせとして扱います。日程・持ち物などは書き加えず、必要な所は記入欄にしてください。`,
      before: `${n}は実施直前の呼びかけとして扱います。練習の様子などは書き加えないでください。`,
      after: `${n}は実施後の振り返りとして扱います。当日の様子や結果は書き加えず、「（ここに当日の様子を入力）」の記入欄にしてください。`,
      '': `${n}は名前にふれる程度にしてください。内容や結果は書き加えないでください。`,
    }[e.stage || '']);
  }
  return out;
}

/** 飾りのモチーフとして使う行事の文 */
function eventMotifSentences(v, { all = false } = {}) {
  const list = (v.events || []).filter((e) => all || e.stage === 'motif');
  if (!list.length) return [];
  const out = list.map(eventNameSentence).filter(Boolean);
  out.push(`${list.map((e) => `「${eventName(e)}」`).join('・')}は、その行事を連想させる一般的な飾りのモチーフとしてだけ使い${all ? 'ます' : '、本文では触れないでください'}。`);
  return out;
}

/** 最後にまとめる「してほしくないこと」（1段の箇条書き） */
function prohibitions(v, { image = false, fixedText = true } = {}) {
  return [
    image ? null : '・入力していない日時・場所・名称・出来事・人物を足さない',
    (v.events || []).length ? '・ここに挙げていない行事を足さない' : null,
    (v.motifs || []).some((m) => ANNUAL_MOTIFS.includes(m)) ? '・正月・ハロウィンなどの年中行事を、学校で行った行事として書かない' : null,
    image ? null : (fixedText ? '・固定で入れる文字を変えたり省いたりしない' : null),
    image
      ? '・実在の校章・学校名・ロゴ・商標、既存のキャラクター、実在の人物の顔や容姿を描かない'
      : '・実在の学校名・校章・ロゴや、実在の人物の写真・似顔絵を入れない',
    image ? null : '・児童生徒の名前など、個人が特定できる情報を入れない',
    image ? '・この依頼文の文章を画像の中に文字として入れない' : '・この依頼文の文章そのものを紙面に入れない',
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
  const twoPages = v.pages && v.pages.startsWith('2');
  const readers = { parents: '保護者', both: '児童生徒と保護者', students: '児童生徒' }[v.audience] || '保護者';
  const tone = {
    warm: '敬体（です・ます）で温かく',
    concise: '敬体（です・ます）で簡潔に',
    friendly: '児童生徒も読みやすい親しみのある敬体で',
  }[v.tone] || '敬体（です・ます）で温かく';

  const fixed = [
    v.title ? `・通信名「${v.title}」` : null,
    ...articles.filter((a) => a.heading).map((a) => `・見出し「${a.heading}」`),
    v.notices ? `・家庭への連絡（囲み枠で）「${oneLine(v.notices)}」` : null,
  ].filter(Boolean);
  const blanks = [
    v.title ? null : '・通信名（「（通信名）」）',
    '・号数（第○号）',
    '・発行日（○月○日）',
    '・学年・学級名、担任名',
    ...articles.map((a, i) => (a.heading ? null : `・記事${i + 1}の見出し`)),
    ...articles.map((a, i) => (a.body ? null : `・記事${i + 1}の本文（「（ここに本文を入力）」）`)),
  ].filter(Boolean);
  const materials = articles
    .map((a, i) => (a.body ? `・${a.heading ? `「${a.heading}」` : `記事${i + 1}`}：${oneLine(a.body)}` : null))
    .filter(Boolean);

  return {
    lead: `${v.kind}（${school}）の完成した紙面デザインを作ってください。レイアウト案の説明ではなく、印刷してそのまま${readers}に配布できる完成デザインにしてください。`,
    sections: [
      { h: 'サイズ・形式', lines: [
        `${paperDesc(v.paper || 'A4縦')}・${twoPages ? '2ページ（表裏）' : '1ページ'}です。読者は${readers}です。`,
      ] },
      { h: 'デザイン', lines: [
        designStyleSentence(v.designStyle, { mono: v.mono }),
        timeSentence(v),
        motifSentence(v),
        ...eventMotifSentences(v),
      ] },
      { h: '紙面に入れる内容', lines: [
        fixed.length ? '固定で入れる文字（このとおりに入れてください）：' : null,
        ...fixed,
        '記入欄として残す部分（後から書き込めるように）：',
        ...blanks,
        materials.length ? '記事本文の材料：' : null,
        ...materials,
        photos > 0 ? `写真枠：${photos}か所。後から写真を差し替えやすい空の枠にし、写真の中身は描かないでください。` : null,
      ] },
      { h: '文章の書き方', lines: [
        `各記事の本文は、上の材料だけを使って${tone}、短くまとめてください。材料にない出来事・感想・児童生徒の様子は加えず、材料が少ない記事は短いままで構いません。`,
        ...eventContentSentences(v),
      ] },
      { h: 'レイアウト', lines: [
        `見出しを本文より大きく太くし、記事${articles.length > 1 ? 'ごと' : ''}のまとまりが分かるように配置してください。本文は印刷して読みやすい大きさ（10.5pt以上が目安）にし、入り切らないときは文字を小さくしすぎず、余白や配置で調整してください。`,
        `文字・図形・写真枠は、可能な限り後から個別に編集しやすい形で作ってください。`,
      ] },
      { h: 'してほしくないこと', lines: prohibitions(v, { fixedText: fixed.length > 0 }) },
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
  if (v.seasonReflect === 'none') greeting = '時候のあいさつは入れず、前置きは短くしてください。';
  else if (v.seasonReflect === 'text' && t) greeting = `前文には${t}に合う時候のあいさつを短く一文入れてください。`;
  else greeting = '前文は短く一文程度にしてください。';

  const fixed = [
    v.audience === 'individual' ? null : '・宛名「保護者各位」',
    `・伝える事実「${oneLine(v.facts)}」`,
    v.requests ? `・保護者へのお願い「${oneLine(v.requests)}」` : null,
    v.contact ? `・問い合わせ先「${oneLine(v.contact)}」` : null,
  ].filter(Boolean);
  const blanks = [
    v.audience === 'individual' ? '・宛名（「（保護者名）様」）' : null,
    '・発行日',
    '・発信者（学校名・担任名など）',
    v.contact ? null : '・問い合わせ先',
    v.requests ? '・切り取り線つきの返信欄' : null,
  ].filter(Boolean);

  return {
    lead: `${audience}に向けたお知らせ文書の完成した紙面デザインを作ってください。印刷やPDFで配布する学校の正式な文書なので、装飾は控えめにし、丁寧で読みやすい配置を重視してください。`,
    sections: [
      { h: 'サイズ・形式', lines: [
        `A4縦・${v.length === 'long' ? '1ページ（どうしても収まらない場合のみ2ページ）' : '1ページ'}です。読者は${audience}です。`,
        v.easyJapanese ? '次のページに、同じ内容の「やさしい日本語版」を入れてください。' : null,
      ] },
      { h: 'デザイン', lines: [
        '落ち着いて整った、学校の文書らしいデザインにしてください。日時・場所・持ち物・期限は、罫線や囲みで本文と分けて見つけやすくしてください（伝える事実に書かれているものだけ）。',
        t ? `紙面の想定時期は${t}です。イラストや季節の飾りは${v.seasonReflect === 'none' ? '使わないでください' : '使わないか、ごく小さくしてください'}。` : 'イラストや飾りは使わないか、ごく小さくしてください。',
      ] },
      { h: '紙面に入れる内容', lines: [
        '固定で入れる文字（このとおりに入れてください）：',
        ...fixed,
        '記入欄として残す部分：',
        ...blanks,
        `表題は、${v.purpose && v.purpose !== 'その他' ? `連絡の目的（${v.purpose}）` : '内容'}に合う短いものにしてください。`,
      ] },
      { h: '文章の書き方', lines: [
        `${tone}で書いてください。${greeting}伝える事実の日時・場所・金額などは書き換えたり補ったりしないでください。`,
        ...eventContentSentences(v),
        v.audience === 'individual' ? '個別の家庭への連絡ですが、欠席・成績・トラブル・家庭の事情など、個別の事情には触れないでください。' : null,
      ] },
      { h: 'レイアウト', lines: [
        '本文は印刷して読みやすい大きさ（10.5〜12ptが目安）にし、余白を十分にとってください。文字・罫線・囲みは、可能な限り後から個別に編集しやすい形で作ってください。',
      ] },
      { h: 'してほしくないこと', lines: prohibitions(v) },
    ],
    notes: [
      ...COMMON_NOTES,
      '日付と曜日の組み合わせなど、伝える事実に誤りがないか確認してください。',
      '正式な文書として出す前に、学校の発信の手順（管理職の確認など）に沿っているか確認してください。',
    ],
  };
}

// ---------------------------------------------------------------- F07 教材用イラスト（任意対応）

function canvaF07(v, c) {
  const n = Number(String(v.variants).replace(/[^0-9]/g, '')) || 1;
  const mono = v.color === 'mono' || v.color === 'lineart';
  const colorText = {
    color: 'カラーで、印刷しても色がつぶれない明るさとコントラストにしてください。',
    pale: '淡くやさしい色合いにし、輪郭ははっきりさせてください。',
    mono: '白黒（モノクロ）にし、細かいグレーの階調に頼らず、モノクロ印刷でも形がはっきり分かるようにしてください。',
    lineart: '黒い線だけのぬりえ用線画にしてください。塗りつぶしやグレーは使わず、線は太めで、塗りやすい閉じた形にしてください。',
  }[v.color];
  const bg = {
    subtle: '背景は控えめにし、主題を目立たせてください。',
    full: '背景まで描いてかまいませんが、主題が埋もれないようにしてください。',
    white: '背景は白にしてください（切り抜きやすく）。',
    transparent: '背景は透明にしてください（できない場合は白）。',
  }[v.background];
  const people = {
    none: '人物は描かないでください。',
    small: '人物は小さく、後ろ姿など顔が分からない描き方にしてください。',
    generic: '人物は、特定の誰かではないデフォルメした子どもにしてください。',
  }[v.people];
  const text = v.textMode === 'some' && v.textContent
    ? `画像内の文字は「${v.textContent}」だけにし、正確に表記してください（崩れる場合は文字なしにしてください）。`
    : '文字・数字・記号は一切入れないでください。';

  return {
    lead: `${v.use}に使う教材用のイラスト画像を${n > 1 ? `${n}案` : '1枚'}生成してください。主題は「${oneLine(v.subject)}」です。${people || ''}`,
    sections: [
      { h: '画風・構図', lines: [
        `絵柄は${v.style}、比率は${v.aspect}です。${bg || ''}`,
        v.designStyle ? `${designStyleLine(v.designStyle, { mono, subject: '全体' })}絵柄の指定を優先し、テイストは雰囲気を補う程度にしてください。` : null,
        v.printSize ? `${v.printSize}で使います。${v.printSize === '紙面に小さく配置' ? '小さくても判別できるよう、形を大きくシンプルにしてください。' : ''}` : null,
      ] },
      { h: '色と文字', lines: [colorText, text] },
      { h: '季節・行事', lines: [
        timeSentence(v, 'image'),
        motifSentence(v, 'image'),
        ...eventMotifSentences(v, { all: true }),
      ] },
      { h: '仕上がりの条件', lines: [
        '主題をいちばん目立たせ、指定していないモチーフや装飾を増やさないでください。特定の作家・作品・キャラクターの画風はまねないでください。',
        c.std('手や指、物の形に不自然な描写がないようにしてください。'),
      ] },
      { h: 'してほしくないこと', lines: [
        ...prohibitions(v, { image: true }),
        '・怖い・暴力的・不安をあおる表現にしない',
        v.avoid ? `・${oneLine(v.avoid)}` : null,
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
  const audience = c.label('audience', v.audience);
  const who = `${audience}${v.grade ? `（${v.grade}）` : ''}`;
  const mood = v.mood || [];
  const slots = Number(v.imageSlots || 0);
  const sizeText = isSlide
    ? `スライド（${v.size.replace('スライド', '')}）${v.slideCount ? `・${v.slideCount}` : '・枚数は内容に合わせて最小限'}`
    : (v.size === 'はがき・カードサイズ' ? 'はがき・カードサイズ' : `${paperDesc(v.size)}・1ページ`);
  const use = isSlide
    ? '教室などで投影して見せます'
    : (isPoster ? '掲示して、離れた場所から見ます' : '印刷して配布します');
  const contentLines = String(v.content || '').split('\n').map((x) => x.trim()).filter(Boolean);

  return {
    lead: isSlide
      ? `${kind}として使う、完成したスライド資料を作ってください。レイアウト案の説明ではなく、そのまま投影できる完成デザインにしてください。`
      : `${kind}の完成したデザインを作ってください。レイアウト案の説明ではなく、${isPoster ? 'そのまま掲示できる' : 'そのまま印刷して配布できる'}完成デザインにしてください。`,
    sections: [
      { h: 'サイズ・形式', lines: [`${sizeText}です。${use}。見る人は${who}です。`] },
      { h: 'デザイン', lines: [
        mood.length ? `雰囲気は「${mood.join('・')}」にしてください。` : null,
        designStyleSentence(v.designStyle, { mono: v.mono }),
        v.colors ? `使いたい色は${v.colors}です。${v.mono ? '（モノクロ印刷のため、色ではなく濃淡で表現してください）' : ''}` : null,
        v.designStyle || mood.includes('色覚の多様性に配慮') ? '色だけで情報を区別せず、読みやすさや色覚の多様性への配慮を、デザインの好みより優先してください。' : null,
        timeSentence(v),
        motifSentence(v),
        ...eventMotifSentences(v),
      ] },
      { h: '紙面に入れる内容', lines: [
        '固定で入れる文字（このとおりに入れてください）：',
        ...contentLines.map((l) => `・${l}`),
        ...eventContentSentences(v),
        slots > 0 ? `写真・イラストの枠：${slots}か所。後から差し替えやすい空の枠にしてください。` : null,
        '日時や場所など、上の文字に書かれていない情報が必要な場合は、記入欄として残してください。',
      ] },
      { h: 'レイアウト', lines: [
        '最も伝えたいことを一番大きく目立たせ、見出しと本文の大きさ・太さにはっきり差をつけてください。',
        isSlide ? '投影したときに見やすいよう、1枚あたりの文字を少なくし、文字を大きくしてください。' : null,
        isPoster ? '離れた場所からでも読めるよう、見出しはとても大きく、本文も大きめにしてください。' : null,
        !isSlide && !isPoster ? '印刷して手元で読みやすい文字の大きさ（10.5pt以上が目安）にしてください。' : null,
        '文字・図形・枠は、可能な限り後から個別に編集しやすい形で作ってください。',
      ] },
      { h: 'してほしくないこと', lines: prohibitions(v) },
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

function clean(lines) {
  return (lines || []).flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false)
    .map((x) => String(x).trim()).filter(Boolean);
}

/**
 * Canva 向けの依頼文を作る。
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
    .map((s) => ({ h: s.h, lines: clean(s.lines) }))
    .filter((s) => s.lines.length)
    .map((s) => `■ ${s.h}\n${s.lines.join('\n')}`);
  const text = [String(out.lead).trim(), ...body].join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return { ok: true, errors: [], text, notes: clean(out.notes), values };
}
