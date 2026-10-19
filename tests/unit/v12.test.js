// v1.2：Canva AI 向け依頼文のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS, getTask, CANVA_TASK_IDS } from '../../src/data/taskCatalog.js';
import { buildPrompt, cleanValues, getDefaults, getFields, isVisible } from '../../src/prompts/buildPrompt.js';
import { buildCanvaPrompt, isCanvaMode, CANVA_URL } from '../../src/prompts/canvaPrompt.js';
import { getEventByName } from '../../src/data/schoolEvents.js';
import { minimalValues, fullValues } from '../fixtures.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ev = (name, stage = '', custom = '') => {
  const e = getEventByName(name);
  return { key: e.id, base: e.name, custom, stage };
};
const canva = (id, extra = {}) => {
  const t = getTask(id);
  const r = buildCanvaPrompt(t, { ...minimalValues(t), target: 'canva', ...extra });
  assert.ok(r.ok, JSON.stringify(r.errors));
  return r;
};

test('回帰：通常AI向けは v1.1 と同じ依頼文（追加設定の組み合わせ44通り）', () => {
  const snap = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/v1.1-prompts.json'), 'utf8'));
  let n = 0;
  for (const [id, cases] of Object.entries(snap)) {
    for (const c of cases) {
      assert.equal(buildPrompt(getTask(id), c.values).text, c.text, `${id} ${c.kind} ${c.level}`);
      n += 1;
    }
  }
  assert.equal(n, 44);
});

test('出力先の選択はF05〜F08だけにあり、初期値は「通常のAI向け」', () => {
  assert.deepEqual(CANVA_TASK_IDS, ['F05', 'F06', 'F07', 'F08']);
  for (const t of TASKS) {
    const f = getFields(t).find((x) => x.id === 'target');
    if (CANVA_TASK_IDS.includes(t.id)) {
      assert.ok(f, t.id);
      assert.equal(getDefaults(t).target, 'general');
      assert.equal(isCanvaMode(t, getDefaults(t)), false);
    } else {
      assert.equal(f, undefined, t.id);
    }
  }
});

test('F06：メール・連絡アプリでは Canva 向けにならない', () => {
  const t = getTask('F06');
  const mail = { ...minimalValues(t), medium: 'mail', target: 'canva' };
  assert.equal(isCanvaMode(t, mail), false);
  assert.equal(cleanValues(t, mail).target, '');
  // メールの通常出力は target の値に影響されない（仕上がりの使い方も消えない）
  assert.equal(buildPrompt(t, mail).text, buildPrompt(t, { ...mail, target: 'general' }).text);
  const delivery = getFields(t).find((f) => f.id === 'delivery');
  assert.ok(isVisible(delivery, mail));
  assert.equal(isCanvaMode(t, { ...mail, medium: 'letter' }), true);
});

test('F08：Canva向けでは「使うソフト」を隠すが、値は消さず、通常AI向けの出力も変えない', () => {
  const t = getTask('F08');
  const raw = { ...minimalValues(t), tool: 'Canva' };
  const general = buildPrompt(t, raw).text;
  assert.match(general, /作るときに使うソフト：Canva/);
  const tool = getFields(t).find((f) => f.id === 'tool');
  assert.equal(isVisible(tool, { ...raw, target: 'canva' }), false);
  assert.equal(cleanValues(t, { ...raw, target: 'canva' }).tool, '');
  assert.equal(raw.tool, 'Canva', '元の入力値は残る');
  assert.equal(buildPrompt(t, { ...raw, target: 'general' }).text, general);
});

test('Canva向け依頼文：4フォームとも制作指示として成立し、教師向けの注意を混ぜない', () => {
  for (const id of CANVA_TASK_IDS) {
    for (const extra of [{}, { level: 'short' }, { level: 'detailed' }]) {
      const t = getTask(id);
      const r = buildCanvaPrompt(t, { ...fullValues(t), target: 'canva', medium: 'letter', ...extra });
      assert.ok(r.ok, `${id} ${JSON.stringify(r.errors)}`);
      const s = r.text;
      assert.ok(!/undefined|null|NaN|\[object|\{[a-zA-Z_]+\}/.test(s), id);
      assert.match(s, /■ /);
      assert.ok(!s.includes('【'), `${id}：通常AI向けの見出し形式を流用していない`);
      assert.ok(!/教師が確認|先生が確認/.test(s), `${id}：教師向けの注意が依頼文に混ざっている`);
      assert.match(s, /説明や指示の文章[はを]、?(デザイン|画像)の中に文字として入れないでください/);
      assert.ok(r.notes.length >= 2);
      for (const n of r.notes) assert.ok(!s.includes(n), `${id}：注意事項がコピー対象に入っている`);
      assert.ok(!/全機能|必ず編集でき|保証します/.test(s + r.notes.join('')), id);
    }
  }
});

test('Canva向け：F05・F06・F08 は完成デザインと編集しやすさを求め、F07 は編集可能を必須にしない', () => {
  for (const id of ['F05', 'F06', 'F08']) {
    const s = canva(id).text;
    assert.match(s, /完成したデザインを作ってください/, id);
    assert.match(s, /可能な限り、文字・図形・写真枠を後から個別に編集しやすい形で制作してください/, id);
    assert.match(s, /記入欄/, id);
  }
  const f07 = canva('F07').text;
  assert.match(f07, /イラスト画像を1枚生成してください/);
  assert.ok(!f07.includes('個別に編集しやすい'));
  assert.match(canva('F05').notes.join(), /個別に編集できるとは限りません/);
});

test('Canva向け F05：記事の見出し・材料を配置し、出来事を創作させない', () => {
  const r = canva('F05', { paper: 'A4縦', pages: '1枚', photoSlots: '1', mono: true });
  const s = r.text;
  assert.match(s, /中学校2年の学級通信の紙面デザイン/);
  assert.match(s, /用紙：A4サイズ・縦向き、1ページ/);
  assert.match(s, /見出し：「合唱コンクールに向けて」/);
  assert.match(s, /本文の材料：朝の練習が始まりました。/);
  assert.match(s, /材料にない出来事・児童生徒の様子や感想は加えず/);
  assert.match(s, /通信名：「（通信名）」の記入欄/);
  assert.match(s, /号数「第○号」・発行日「○月○日」/);
  assert.match(s, /写真・イラストの枠：1か所/);
  assert.match(s, /文字を極端に小さくせず、レイアウトや余白の調整を優先/);
  assert.match(s, /モノクロ印刷で読みやすいデザイン/);
  assert.ok(!/\d+月\d+日|\d{4}年/.test(s), '入力にない日付が入っている');
  assert.match(r.notes.join(), /掲載の同意/);
});

test('Canva向け F06：事実を正確に、重要情報を見つけやすく、正式文書らしく', () => {
  const r = canva('F06', { medium: 'letter', requests: '参加票を提出' });
  const s = r.text;
  assert.match(s, /伝える事実（このとおり正確に掲載）：11月8日（金）の校外学習は/);
  assert.match(s, /日時・場所・持ち物・期限は、本文とは別に見つけやすい枠や箇条書き/);
  assert.match(s, /学校の正式な文書にふさわしい、落ち着いて整ったレイアウト/);
  assert.match(s, /切り取り線つきの返信欄/);
  assert.match(s, /保護者各位/);
  assert.ok(!/(?<!11)月\d+日/.test(s.replace('11月8日', '').replace('11日', '')), '入力にない日付がない');
  assert.match(canva('F06', { medium: 'letter', month: '12', seasonReflect: 'none' }).text, /時候のあいさつは入れず/);
});

test('Canva向け F07：主題・画風・比率・色・背景・文字なしを反映し、余計な装飾を増やさない', () => {
  const s = canva('F07', { color: 'lineart', aspect: '正方形（1:1）', background: 'white', textMode: 'none', style: 'やわらかい水彩風' }).text;
  assert.match(s, /主題：落ち葉のある校庭と秋の樹木/);
  assert.match(s, /絵柄：やわらかい水彩風/);
  assert.match(s, /比率：正方形（1:1）/);
  assert.match(s, /ぬりえ用線画/);
  assert.match(s, /背景：白/);
  assert.match(s, /文字・数字・記号は一切入れない/);
  assert.match(s, /指定していないモチーフや装飾を増やさないでください/);
  assert.ok(!s.includes('■ 季節・行事'), '季節・行事の指定がなければ節ごと出さない');
});

test('Canva向け F08：種類を冒頭に、スライドは投影、掲示物は離れた場所からの可読性', () => {
  const slide = canva('F08', { kind: 'スライド（授業・説明会）', size: 'スライド16:9', slideCount: '5枚' }).text;
  assert.match(slide.split('\n')[0], /スライド（授業・説明会）として使うスライド資料を作成してください/);
  assert.match(slide, /サイズ：スライド（16:9）、5枚/);
  assert.match(slide, /投影したときに見やすい/);
  const poster = canva('F08', { kind: '掲示物・ポスター', size: 'A3縦' }).text;
  assert.match(poster.split('\n')[0], /掲示物・ポスターのデザインを作成してください/);
  assert.match(poster, /A3サイズ・縦向き/);
  assert.match(poster, /離れた場所からでも読める/);
  assert.match(poster, /次の文言を正確に掲載してください（意味を変えたり省略したりしない）：\n　廊下は右側を歩こう。/);
});

test('Canva向け：v1.1 の時期・行事・モチーフ・テイストが反映される', () => {
  const s = canva('F05', {
    month: '10', period: '下旬', seasonReflect: 'design',
    events: [ev('体育祭', 'after'), ev('文化祭', 'motif', '青葉祭')],
    motifs: ['どんぐり'], designStyle: 'pop', mono: true,
  }).text;
  assert.match(s, /使う時期：10月下旬（季節感は配色や飾りだけに反映する）。この時期は行事の実施日ではありません/);
  assert.match(s, /－ 体育祭：実施後の振り返り（当日の様子は入力された内容だけ/);
  assert.match(s, /モチーフにする行事：青葉祭（文化祭）/);
  assert.match(s, /季節モチーフ：どんぐり/);
  assert.match(s, /ポップ・元気。モノクロ印刷のため、カラフルな色づかいは前提にせず/);
  assert.match(s, /ここに挙げていない行事は加えないでください/);
  assert.ok(!s.includes('明るい配色'));
});

test('Canva向け：月を選んだだけで行事・モチーフを追加しない（テストF相当）', () => {
  for (const id of CANVA_TASK_IDS) {
    const s = canva(id, { month: '10', medium: 'letter' }).text;
    for (const w of ['運動会', '体育祭', 'ハロウィン', '紅葉', '取り上げる行事', 'モチーフにする行事', '季節モチーフ']) {
      assert.ok(!s.includes(w), `${id}: ${w}`);
    }
  }
});

test('Canva向けも必須入力の検証は同じ', () => {
  for (const id of CANVA_TASK_IDS) {
    const t = getTask(id);
    const r = buildCanvaPrompt(t, { ...getDefaults(t), target: 'canva', medium: 'letter' });
    assert.equal(r.ok, false, id);
    assert.equal(r.text, '');
    assert.ok(r.errors.length > 0);
  }
});

test('Canvaのリンクはトップページだけで、依頼文をURLに含めない', () => {
  assert.equal(CANVA_URL, 'https://www.canva.com/');
  const app = readFileSync(join(ROOT, 'src/app.js'), 'utf8');
  assert.ok(!/canva\.com\/[^'"\s]/.test(app));
  assert.ok(!/encodeURIComponent/.test(app));
});
