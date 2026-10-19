// v1.1：時期・学校行事・季節モチーフ・デザインテイストの受け入れテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS, getTask } from '../../src/data/taskCatalog.js';
import { buildPrompt, getDefaults, cleanValues, getFields } from '../../src/prompts/buildPrompt.js';
import { EVENTS, getEventByName, searchEvents, eventDisplayName, MAX_EVENTS } from '../../src/data/schoolEvents.js';
import { recommendedMotifs } from '../../src/data/seasonOptions.js';
import { DESIGN_STYLES } from '../../src/data/designStyles.js';
import { minimalValues } from '../fixtures.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ev = (name, stage = '', custom = '') => {
  const e = getEventByName(name);
  return { key: e.id, base: e.name, custom, stage };
};
const build = (id, extra) => {
  const t = getTask(id);
  const r = buildPrompt(t, { ...minimalValues(t), ...extra });
  assert.ok(r.ok, JSON.stringify(r.errors));
  return r.text;
};

test('テストG：追加設定を使わなければ、v1.0と同じ依頼文になる（16フォーム×96通り）', () => {
  const snap = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/v1.0-prompts.json'), 'utf8'));
  let n = 0;
  for (const [id, cases] of Object.entries(snap)) {
    for (const c of cases) {
      assert.equal(buildPrompt(getTask(id), c.values).text, c.text, `${id} ${c.kind} ${c.level}`);
      n += 1;
    }
  }
  assert.equal(n, 96);
});

test('追加設定はF05〜F08だけにあり、ほかのフォームは変わらない', () => {
  for (const t of TASKS) {
    const extra = getFields(t).filter((f) => f.group === 'extra');
    if (['F05', 'F06', 'F07', 'F08'].includes(t.id)) assert.ok(extra.length > 0, t.id);
    else assert.equal(extra.length, 0, t.id);
  }
});

test('テストA：5月上旬・運動会・ポップ（F05／F08）', () => {
  for (const id of ['F05', 'F08']) {
    const s = build(id, { month: '5', period: '上旬', events: [ev('運動会', 'prep')], designStyle: 'pop', mono: false });
    assert.match(s, /作成物の想定時期は5月上旬です/);
    assert.match(s, /－ 運動会：事前案内・準備/);
    assert.match(s, /テイスト：ポップ・元気（明るい配色、楽しさ、躍動感）/);
    assert.ok(!/体育祭|体育大会/.test(s), '関連名称が依頼文に混入しない');
  }
});

test('テストB：10月下旬・修学旅行・フォーマル', () => {
  const s = build('F05', { month: '10', period: '下旬', events: [ev('修学旅行', 'prep')], designStyle: 'formal' });
  assert.match(s, /10月下旬/);
  assert.match(s, /－ 修学旅行：事前案内・準備/);
  assert.match(s, /フォーマル・端正/);
  assert.match(s, /「作成物の想定時期」は行事の実施日を意味しません/);
  assert.ok(!/研修旅行|海外研修/.test(s));
  // 保護者文書（F06）は文体優先で、デザインの指定はない
  const l = build('F06', { month: '10', period: '下旬', events: [ev('修学旅行', 'prep')] });
  assert.match(l, /－ 修学旅行：事前案内・準備/);
  assert.ok(!/テイスト/.test(l));
});

test('テストC：6月中旬・文化祭・レトロ・新聞風', () => {
  const s = build('F05', { month: '6', period: '中旬', events: [ev('文化祭', 'before')], designStyle: 'retro', mono: false });
  assert.match(s, /6月中旬/);
  assert.match(s, /－ 文化祭：実施直前/);
  assert.match(s, /レトロ・新聞風（クラシックな見出し、新聞調）/);
  assert.ok(!/学校祭|学園祭/.test(s));
});

test('テストD：10月下旬に、体育祭の振り返りと修学旅行の事前案内を同時に指定', () => {
  const s = build('F05', { month: '10', period: '下旬', events: [ev('体育祭', 'after'), ev('修学旅行', 'prep')] });
  assert.match(s, /－ 体育祭：実施後の振り返り（入力された事実だけで書き/);
  assert.match(s, /－ 修学旅行：事前案内・準備（日程・持ち物/);
  assert.match(s, /（ここに当日の様子を入力）/);
  assert.match(s, /行事名だけから、具体的な活動・成果・感想を創作しないでください/);
  assert.match(s, /内容が重なる記事があればその記事の中で扱い/);
});

test('テストE：学校独自の行事名「青葉祭」が正しく入る', () => {
  const only = build('F05', { events: [{ key: 'custom:1', base: '', custom: '青葉祭', stage: 'after' }] });
  assert.match(only, /－ 青葉祭（学校独自の行事）：実施後の振り返り/);
  const withBase = build('F05', { events: [ev('文化祭', 'after', '青葉祭')] });
  assert.match(withBase, /－ 青葉祭（文化祭）：実施後の振り返り/);
  assert.match(withBase, /行事名は上の表記（学校での名称）をそのまま使ってください/);
  assert.equal(eventDisplayName({ base: '文化祭', custom: '' }), '文化祭');
  assert.equal(eventDisplayName({ base: '文化祭', custom: '文化祭' }), '文化祭');
});

test('テストF：10月を選んでも、運動会・ハロウィン・紅葉が勝手に追加されない', () => {
  for (const id of ['F05', 'F06', 'F07', 'F08']) {
    const s = build(id, { month: '10' });
    for (const w of ['運動会', '体育祭', 'ハロウィン', '紅葉', '【学校行事】']) assert.ok(!s.includes(w), `${id}: ${w}`);
    const t = getTask(id);
    const cleaned = cleanValues(t, { ...minimalValues(t), month: '10' });
    assert.deepEqual(cleaned.events, []);
    if ('motifs' in cleaned) assert.deepEqual(cleaned.motifs, []);
  }
  // おすすめは「表示用」の候補で、値には入らない
  assert.ok(recommendedMotifs('10').includes('紅葉'));
  assert.ok(recommendedMotifs('10').includes('ハロウィン'));
  assert.deepEqual(recommendedMotifs(''), []);
});

test('テストH：モノクロ＋ポップでは、色に依存しない指示になる', () => {
  const f05 = build('F05', { designStyle: 'pop', mono: true });
  assert.match(f05, /紙面のデザインのテイスト：ポップ・元気。モノクロ印刷のため、カラフルな色づかいは前提にせず/);
  assert.ok(!f05.includes('明るい配色'));
  const f08 = build('F08', { designStyle: 'pop', mono: true });
  assert.match(f08, /カラフルな色づかいは前提にせず/);
  assert.match(f08, /モノクロ印刷・読みやすさの条件は、デザインテイストより優先/);
  const f07 = build('F07', { designStyle: 'natural', color: 'mono' });
  assert.match(f07, /イラスト全体のテイスト：ナチュラル・自然。モノクロ印刷のため/);
  assert.ok(!f07.includes('自然な色、素朴な質感'));
  const color = build('F08', { designStyle: 'pop', mono: false });
  assert.match(color, /ポップ・元気（明るい配色/);
});

test('デザインテイストと文体は独立している（F05）', () => {
  const s = build('F05', { designStyle: 'pop', tone: 'concise' });
  assert.match(s, /敬体（です・ます）で、簡潔で読みやすい文体/);
  assert.match(s, /ポップ・元気/);
  assert.match(s, /デザインのテイストに合わせて文体を変えないでください/);
});

test('F07：絵柄を優先し、主題を最優先してモチーフを控えめに添える', () => {
  const s = build('F07', { style: 'やわらかい水彩風', designStyle: 'natural', motifs: ['どんぐり'], events: [ev('遠足')] });
  assert.match(s, /絵柄（やわらかい水彩風）の指定を優先/);
  assert.match(s, /添えるモチーフ：どんぐり。主題を最優先/);
  assert.match(s, /－ 遠足\n/);
  assert.match(s, /一般的なモチーフにとどめてください/);
  assert.ok(!/文章に反映/.test(s));
});

test('季節モチーフ：自由入力と年中行事の注意', () => {
  const s = build('F08', { motifs: ['ハロウィン', '星'], motifCustom: 'いちょう' });
  assert.match(s, /季節モチーフ（飾り・挿絵の候補）：ハロウィン、星、いちょう/);
  assert.match(s, /学校で実施した行事として書かないでください/);
});

test('季節感の反映方法が依頼文に反映される', () => {
  assert.match(build('F05', { month: '1', seasonReflect: 'both' }), /指定された時期を文章やデザインに適切に反映してください。ただし、実施する行事や学校の具体的な出来事を推測で追加しないでください。/);
  assert.match(build('F05', { month: '1', seasonReflect: 'design' }), /デザイン（配色・挿絵・飾り）に適切に反映/);
  assert.match(build('F05', { month: '1', seasonReflect: 'none' }), /季節感は文章にもデザインにも反映しないでください/);
  assert.match(build('F05', { month: '1' }), /季節的な表現を無理に加える必要はありません/);
  assert.match(build('F07', { month: '1', seasonReflect: 'design' }), /イラストに適切に反映/);
});

test('F06：正式な文書では、季節のあいさつを自動で増やさない', () => {
  const none = build('F06', { medium: 'letter', month: '12', seasonReflect: 'none' });
  assert.match(none, /時候のあいさつや季節の表現は入れないでください/);
  assert.ok(!none.includes('前文の時候のあいさつは短く一文程度'));
  const text = build('F06', { medium: 'letter', month: '12', period: '中旬', seasonReflect: 'text' });
  assert.match(text, /前文の時候のあいさつは、この時期に合う短い一文にしてください/);
  // メールでは季節の表現の項目自体を使わない
  const mail = cleanValues(getTask('F06'), { ...minimalValues(getTask('F06')), medium: 'mail', seasonReflect: 'text' });
  assert.equal(mail.seasonReflect, '');
});

test('行事マスタ：全候補を収録し、実施月を固定していない', () => {
  assert.equal(EVENTS.length, 14 + 19 + 16 + 17 + 18 + 24);
  for (const e of EVENTS) assert.ok(!('month' in e), e.name);
  for (const name of ['入学式', '百人一首大会', '薬物乱用防止教室', 'スキー教室', '作業製品販売会', 'オリエンテーション']) {
    assert.ok(getEventByName(name), name);
  }
});

test('行事検索：表記ゆれを関連付けるが、同一扱いしない', () => {
  const r = searchEvents('体育祭');
  assert.equal(r[0].event.name, '体育祭');
  assert.equal(r[0].via, null);
  const names = r.map((x) => x.event.name);
  for (const n of ['運動会', '体育大会']) assert.ok(names.includes(n), n);
  assert.equal(r.find((x) => x.event.name === '運動会').via, '体育祭');
  for (const [q, want] of [['文化祭', '学園祭'], ['林間学校', '自然教室'], ['音楽会', '合唱祭'], ['うんどうかい', '運動会']]) {
    assert.ok(searchEvents(q).some((x) => x.event.name === want), `${q} → ${want}`);
  }
});

test('行事の値の整え方：未知の行事・不正な扱い方・上限', () => {
  const t = getTask('F06');
  const v = cleanValues(t, {
    ...getDefaults(t),
    events: [
      { key: 'zzz-99', base: '謎の行事', custom: '', stage: 'after' },
      ev('文化祭', 'motif'), // F06には「モチーフのみ」はない
      { key: 'custom:a', base: '', custom: '  青葉祭\u0007 ', stage: 'prep' },
      ev('文化祭', 'after'), // 重複
    ],
  });
  assert.deepEqual(v.events.map((e) => [e.base, e.custom, e.stage]), [['文化祭', '', ''], ['', '青葉祭', 'prep']]);
  const many = cleanValues(getTask('F05'), { events: EVENTS.slice(0, 10).map((e) => ({ key: e.id, base: e.name, custom: '', stage: '' })) });
  assert.equal(many.events.length, MAX_EVENTS);
});

test('デザインテイストは8種類', () => {
  assert.equal(DESIGN_STYLES.length, 8);
  assert.deepEqual(DESIGN_STYLES.map((d) => d.label), ['癒し・やわらか', 'ポップ・元気', 'カジュアル・親しみ', 'フォーマル・端正', 'シンプル・すっきり', 'ナチュラル・自然', '上品・落ち着き', 'レトロ・新聞風']);
  for (const d of DESIGN_STYLES) assert.ok(d.mono && d.feature);
});
