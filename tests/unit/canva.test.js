// v1.2〜v1.3：出力先の選択と Canva 向け依頼文のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS, getTask, CANVA_TASK_IDS, TARGET_OPTIONS } from '../../src/data/taskCatalog.js';
import { buildPrompt, cleanValues, getDefaults, getFields, isVisible } from '../../src/prompts/buildPrompt.js';
import { buildCanvaPrompt, isCanvaMode, CANVA_URL, CANVA_TIP } from '../../src/prompts/canvaPrompt.js';
import { getEventByName } from '../../src/data/schoolEvents.js';
import { DESIGN_STYLES } from '../../src/data/designStyles.js';
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
const section = (text, name) => {
  const m = text.split(/\n\n(?=■ )/).find((b) => b.startsWith(`■ ${name}\n`));
  return m || '';
};

// ---------------------------------------------------------------- 出力先の選択

test('回帰：共通（通常AI向け）は v1.1 と同じ依頼文（追加設定の組み合わせ44通り）', () => {
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

test('出力先は「共通・ChatGPT・Gemini・Claude・Canva」の5つで、F05〜F08だけにあり、初期値は共通', () => {
  assert.deepEqual(TARGET_OPTIONS.map((o) => o.value), ['general', 'chatgpt', 'gemini', 'claude', 'canva']);
  assert.match(TARGET_OPTIONS[0].label, /共通/);
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

test('テストG：ChatGPT・Gemini・Claude向けは、共通と同じ依頼文（モデル別の最適化を装わない）', () => {
  for (const id of CANVA_TASK_IDS) {
    const t = getTask(id);
    for (const base of [minimalValues(t), fullValues(t)]) {
      const common = buildPrompt(t, { ...base, target: 'general' }).text;
      for (const target of ['chatgpt', 'gemini', 'claude']) {
        assert.equal(buildPrompt(t, { ...base, target }).text, common, `${id} ${target}`);
        assert.equal(isCanvaMode(t, { ...base, target }), false);
      }
    }
  }
});

test('F06：メール・連絡アプリでは Canva 向けにならない', () => {
  const t = getTask('F06');
  const mail = { ...minimalValues(t), medium: 'mail', target: 'canva' };
  assert.equal(isCanvaMode(t, mail), false);
  assert.equal(cleanValues(t, mail).target, '');
  assert.equal(buildPrompt(t, mail).text, buildPrompt(t, { ...mail, target: 'general' }).text);
  const delivery = getFields(t).find((f) => f.id === 'delivery');
  assert.ok(isVisible(delivery, mail));
  assert.equal(isCanvaMode(t, { ...mail, medium: 'letter' }), true);
});

test('F08：Canva向けでは「使うソフト」を隠すが、値は消さず、共通の出力も変えない', () => {
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

// ---------------------------------------------------------------- v1.3 の型

test('v1.3 の型：冒頭で完成デザインを求め、所定の順序で並ぶ（F05・F06・F08）', () => {
  const order = ['サイズ・形式', 'デザイン', '紙面に入れる内容', 'レイアウト', 'してほしくないこと'];
  for (const id of ['F05', 'F06', 'F08']) {
    const s = canva(id, { medium: 'letter' }).text;
    const first = s.split('\n')[0];
    assert.match(first, /完成した(紙面)?(デザイン|スライド資料)を作ってください/, id);
    assert.ok(!first.startsWith('■'), '冒頭は見出しではなく文で始まる');
    const pos = order.map((h) => s.indexOf(`■ ${h}\n`));
    assert.ok(pos.every((p) => p > 0), `${id}: ${pos}`);
    assert.deepEqual([...pos].sort((a, b) => a - b), pos, `${id}：順序が違う`);
    assert.ok(s.trimEnd().split('\n').pop().startsWith('・'), '禁止事項が最後にまとまっている');
  }
});

test('テストH：Canva向けは長すぎず、入れ子・Markdownがない', () => {
  for (const id of CANVA_TASK_IDS) {
    for (const extra of [{}, { level: 'detailed' }]) {
      const t = getTask(id);
      const r = buildCanvaPrompt(t, { ...fullValues(t), target: 'canva', medium: 'letter', ...extra });
      const s = r.text;
      assert.ok(s.length <= 1500, `${id}：${s.length}字`);
      for (const line of s.split('\n')) {
        assert.ok(!/^[\s　]+\S/.test(line), `${id}：字下げした入れ子がある「${line}」`);
        assert.ok(!/^(－|-|\*|#|>|\d+\.)\s?/.test(line), `${id}：入れ子・Markdown記法「${line}」`);
      }
      assert.ok(!/\*\*|__|`/.test(s), `${id}：Markdown記法`);
      assert.ok(!s.includes('【'), `${id}：共通版の見出し形式を流用していない`);
      assert.ok(!/undefined|null|NaN|\[object|\{[a-zA-Z_]+\}/.test(s), id);
    }
  }
});

test('教師向けの注意・Canvaのヒントは依頼文に混ぜない', () => {
  for (const id of CANVA_TASK_IDS) {
    const r = canva(id, { medium: 'letter' });
    assert.ok(!/教師が確認|先生が確認/.test(r.text), id);
    assert.ok(!r.text.includes(CANVA_TIP), id);
    assert.ok(!r.text.includes('不安定'), id);
    for (const n of r.notes) assert.ok(!r.text.includes(n), id);
    assert.match(r.text, /この依頼文の文章(そのもの)?を(紙面|画像の中)に/, id);
    assert.ok(!/全機能|必ず編集でき|保証します/.test(r.text + r.notes.join('')), id);
  }
  assert.match(CANVA_TIP, /既存のテンプレート/);
});

// ---------------------------------------------------------------- テストA〜F

test('テストA：F05・A4縦1ページ・記事1本・ポップ・10月・写真枠なし', () => {
  const s = canva('F05', {
    articles: [{ heading: '後期が始まりました', body: '新しい係が決まりました。\n係ごとに目標を立てています。' }],
    paper: 'A4縦', pages: '1枚', designStyle: 'pop', month: '10', mono: false, photoSlots: '0',
  }).text;
  assert.match(s.split('\n')[0], /学級通信（中学校2年）の完成した紙面デザインを作ってください。レイアウト案の説明ではなく、印刷してそのまま保護者に配布できる完成デザイン/);
  assert.match(section(s, 'サイズ・形式'), /A4縦・1ページです。読者は保護者です。/);
  assert.match(section(s, 'デザイン'), /デザインはポップ・元気で、明るい配色と躍動感で/);
  assert.match(section(s, 'デザイン'), /紙面の想定時期は10月です。季節感は控えめにしてください。/);
  assert.match(section(s, '紙面に入れる内容'), /・見出し「後期が始まりました」/);
  assert.match(section(s, '紙面に入れる内容'), /・「後期が始まりました」：新しい係が決まりました。係ごとに目標を立てています。/);
  assert.ok(!s.includes('写真枠：'), '写真枠を指定していないのに入っている');
  assert.match(section(s, '文章の書き方'), /上の材料だけを使って敬体（です・ます）で温かく/);
  assert.match(section(s, 'レイアウト'), /可能な限り後から個別に編集しやすい形/);
  for (const w of ['運動会', '体育祭', 'ハロウィン', '紅葉', '行事']) assert.ok(!s.includes(w), w);
});

test('テストB：F05・モノクロ・フォーマル・記入欄', () => {
  const s = canva('F05', { mono: true, designStyle: 'formal', title: '' }).text;
  assert.match(section(s, 'デザイン'), /デザインはフォーマル・端正にしてください。モノクロ印刷で使うため白黒で読みやすくし、罫線と余白で整然と区切って/);
  assert.ok(!s.includes('整然とした構成にし、装飾は控えめ'), 'カラー用の表現が混ざっている');
  const content = section(s, '紙面に入れる内容');
  assert.match(content, /記入欄として残す部分（後から書き込めるように）：\n・通信名（「（通信名）」）\n・号数（第○号）\n・発行日（○月○日）\n・学年・学級名、担任名/);
  assert.match(content, /固定で入れる文字（このとおりに入れてください）：\n・見出し「合唱コンクールに向けて」/);
  // 白黒で、デザイン指定なしの場合も白黒の指示が出る
  assert.match(canva('F05', { mono: true }).text, /モノクロ印刷で使うため、白黒で読みやすくし、濃淡や線・囲みで情報を整理/);
  // 通信名を入力すれば固定文言になる
  const titled = canva('F05', { title: 'かがやき' }).text;
  assert.match(titled, /・通信名「かがやき」/);
  assert.ok(!titled.includes('（通信名）'));
});

test('テストC：F05・体育祭・10月で、行事の結果を勝手に足さない', () => {
  const s = canva('F05', { month: '10', events: [ev('体育祭', 'after')] }).text;
  assert.match(s, /「体育祭」は実施後の振り返りとして扱います。当日の様子や結果は書き加えず、「（ここに当日の様子を入力）」の記入欄にしてください。/);
  assert.match(s, /紙面の想定時期は10月です。季節感は控えめにしてください。この時期は行事の実施日ではありません。/);
  assert.match(s, /・ここに挙げていない行事を足さない/);
  assert.ok(!/優勝|団結|盛り上が|頑張|成功|\d+月\d+日/.test(s), '結果や日付を書き足している');
  assert.ok(!/運動会|体育大会/.test(s), '関連名称が混入');
});

test('テストD：F05・独自行事名「青葉祭（文化祭）」が正しく出る', () => {
  const s = canva('F05', { events: [ev('文化祭', 'prep', '青葉祭')] }).text;
  assert.match(s, /行事名は「青葉祭」を使用してください。文化祭にあたる行事です。/);
  assert.match(s, /「青葉祭」は事前のお知らせとして扱います。/);
  assert.ok(!/学校祭|学園祭/.test(s));
  const only = canva('F05', { events: [{ key: 'custom:1', base: '', custom: '若葉フェスティバル', stage: 'after' }] }).text;
  assert.match(only, /「若葉フェスティバル」は学校独自の行事名です。表記はこのまま使ってください。/);
  const motif = canva('F05', { events: [ev('文化祭', 'motif', '青葉祭')] }).text;
  assert.match(section(motif, 'デザイン'), /「青葉祭」は、その行事を連想させる一般的な飾りのモチーフとしてだけ使い、本文では触れないでください。/);
});

test('テストE：F08・A4掲示物・ナチュラル・季節モチーフ', () => {
  const s = canva('F08', {
    kind: '掲示物・ポスター', size: 'A4縦', designStyle: 'natural', motifs: ['どんぐり', '紅葉'], month: '10', period: '中旬', seasonReflect: 'design',
  }).text;
  assert.match(s.split('\n')[0], /掲示物・ポスターの完成したデザインを作ってください。レイアウト案の説明ではなく、そのまま掲示できる完成デザイン/);
  assert.match(section(s, 'サイズ・形式'), /A4縦・1ページです。掲示して、離れた場所から見ます。見る人は児童生徒です。/);
  assert.match(section(s, 'デザイン'), /デザインはナチュラル・自然で、植物などの自然のモチーフと落ち着いた自然な色で/);
  assert.match(section(s, 'デザイン'), /季節の飾りとして、紅葉・どんぐりを控えめに使ってください。/);
  assert.match(section(s, 'デザイン'), /紙面の想定時期は10月中旬です。季節感は配色や飾りにだけ反映してください（盛りすぎない程度に）。/);
  assert.match(section(s, '紙面に入れる内容'), /固定で入れる文字（このとおりに入れてください）：\n・廊下は右側を歩こう。/);
  assert.match(section(s, 'レイアウト'), /離れた場所からでも読める/);
  assert.match(s, /色だけで情報を区別せず/);
  // スライドも引き続き使える
  const slide = canva('F08', { kind: 'スライド（授業・説明会）', size: 'スライド16:9', slideCount: '5枚' }).text;
  assert.match(slide, /完成したスライド資料を作ってください/);
  assert.match(slide, /スライド（16:9）・5枚です。教室などで投影して見せます。/);
});

test('テストF：F06・お知らせ文書・丁寧な文面・装飾控えめ', () => {
  const r = canva('F06', { medium: 'letter', tone: 'polite', requests: '参加票を提出してください。' });
  const s = r.text;
  assert.match(s.split('\n')[0], /お知らせ文書の完成した紙面デザインを作ってください。印刷やPDFで配布する学校の正式な文書なので、装飾は控えめにし、丁寧で読みやすい配置を重視/);
  assert.match(section(s, 'デザイン'), /イラストや飾りは使わないか、ごく小さくしてください。/);
  assert.match(section(s, 'デザイン'), /日時・場所・持ち物・期限は、罫線や囲みで本文と分けて見つけやすく/);
  assert.match(section(s, '紙面に入れる内容'), /・伝える事実「11月8日（金）の校外学習は、雨天の場合11日（月）に延期します。お弁当と水筒が必要です。」/);
  assert.match(section(s, '紙面に入れる内容'), /記入欄として残す部分：\n・発行日\n・発信者（学校名・担任名など）\n・問い合わせ先\n・切り取り線つきの返信欄/);
  assert.match(section(s, '文章の書き方'), /保護者に向けた丁寧な敬語で書いてください。前文は短く一文程度にしてください。/);
  assert.match(canva('F06', { medium: 'letter', month: '12', seasonReflect: 'none' }).text, /時候のあいさつは入れず/);
  assert.match(r.notes.join(), /発信の手順/);
});

test('F07（任意対応）：画像生成の指示として、主題・画風・比率・色・文字を反映', () => {
  const s = canva('F07', { color: 'lineart', aspect: '正方形（1:1）', background: 'white', textMode: 'none', style: 'やわらかい水彩風' }).text;
  assert.match(s.split('\n')[0], /教材用のイラスト画像を1枚生成してください。主題は「落ち葉のある校庭と秋の樹木」です。/);
  assert.match(s, /絵柄はやわらかい水彩風、比率は正方形（1:1）です。背景は白/);
  assert.match(s, /ぬりえ用線画/);
  assert.match(s, /文字・数字・記号は一切入れないでください。/);
  assert.ok(!s.includes('■ 季節・行事'), '季節・行事の指定がなければ節ごと出さない');
  assert.ok(!s.includes('個別に編集しやすい'), 'F07は編集可能を必須にしない');
});

test('Canva向け：月を選んだだけで行事・モチーフを追加しない', () => {
  for (const id of CANVA_TASK_IDS) {
    const s = canva(id, { month: '10', medium: 'letter' }).text;
    for (const w of ['運動会', '体育祭', 'ハロウィン', '紅葉', 'どんぐり', '季節の飾りとして', '行事名は']) {
      assert.ok(!s.includes(w), `${id}: ${w}`);
    }
  }
});

test('デザインテイスト8種すべてに、Canva向けの自然文（カラー／モノクロ）がある', () => {
  for (const d of DESIGN_STYLES) {
    assert.ok(d.canva && d.canvaMono, d.value);
    const color = canva('F08', { designStyle: d.value, mono: false }).text;
    const mono = canva('F08', { designStyle: d.value, mono: true }).text;
    assert.match(color, new RegExp(`デザインは${d.label}で、`));
    assert.match(mono, new RegExp(`デザインは${d.label}にしてください。モノクロ印刷で使うため白黒で読みやすくし`));
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
