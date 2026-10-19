// ブラウザ操作による受け入れテスト（Playwright / Chromium、iPhone 13 相当の画面）。
// 使い方: npm i -D playwright && npm run test:e2e
//   既存のChromiumを使う場合: CHROMIUM_PATH=/path/to/chrome npm run test:e2e
// 結果のスクリーンショットは test-results/ に保存する。

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import { TASKS, getTask } from '../../src/data/taskCatalog.js';
import { getFields, isVisible, normalizeOptions } from '../../src/prompts/buildPrompt.js';
import { minimalValues } from '../fixtures.js';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-results');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

// ---------- 静的サーバー ----------
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    if (p.includes('..')) throw new Error('bad path');
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const SNAP = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/v1.0-prompts.json'), 'utf8'));

// ---------- 小さなテスト枠 ----------
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`ok   - ${name}`); } catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`FAIL - ${name}\n       ${e.message.split('\n').join('\n       ')}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

await mkdir(OUT, { recursive: true });
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOpts);
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const context = await browser.newContext({ ...iphone, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

const external = [];
const allRequests = [];
page.on('request', (r) => { allRequests.push(r.url()); if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:')) external.push(r.url()); });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
page.on('dialog', (d) => d.accept());

async function noHorizontalOverflow(label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert(r.sw <= r.w, `${label}: 横にはみ出しています（${r.sw} > ${r.w}）`);
}

async function fillForm(task, values) {
  for (const f of getFields(task)) {
    if (!f.required || !isVisible(f, values)) continue;
    const id = `${task.id}-${f.id}`;
    const v = values[f.id];
    switch (f.type) {
      case 'text': case 'textarea':
        await page.fill(`#${id}`, v); break;
      case 'select':
        await page.selectOption(`#${id}`, v); break;
      case 'radio': {
        const idx = normalizeOptions(f.options).findIndex((o) => o.value === v);
        await page.click(`label[for="${id}-${idx}"]`); break;
      }
      case 'checks': {
        const opts = normalizeOptions(f.options);
        for (let i = 0; i < opts.length; i += 1) {
          const want = v.includes(opts[i].value);
          const has = await page.isChecked(`#${id}-${i}`);
          if (want !== has) await page.click(`label[for="${id}-${i}"]`);
        }
        break;
      }
      case 'schoolGrade':
        await page.selectOption(`#${id}`, v.school);
        await page.selectOption(`#${id}-grade`, v.grade); break;
      case 'articles':
        for (let i = 0; i < v.length; i += 1) {
          if (i > 0 && !(await page.$(`#${id}-${i}-h`))) await page.click(`#wrap-${id} .btn-add`);
          await page.fill(i === 0 ? `#${id}` : `#${id}-${i}-h`, v[i].heading);
          await page.fill(`#${id}-${i}-b`, v[i].body);
        }
        break;
      default:
    }
  }
}

async function clearIfAny() {
  if (await page.isVisible('#clear')) await page.click('#clear');
}

async function readClipboard() {
  return page.evaluate(() => navigator.clipboard.readText());
}

// ---------- テスト ----------

await check('トップ：見出し・検索・よく使う困りごと（6〜8件）が表示される', async () => {
  await page.goto(`${ORIGIN}/`);
  await page.waitForSelector('.task-card');
  const title = await page.textContent('h1');
  assert(title.includes('困りごとを選んで') && title.includes('AIへの依頼文をコピーするだけ'), title);
  const n = await page.locator('.card-grid .task-card').count();
  assert(n >= 6 && n <= 8, `カード数 ${n}`);
  await noHorizontalOverflow('トップ');
  await page.screenshot({ path: join(OUT, '00-home.png'), fullPage: true });
});

await check('カテゴリで絞り込める', async () => {
  await page.click('.cat-chip[data-cat="design"]');
  const ids = await page.$$eval('#category-list .task-row', (els) => els.map((e) => e.dataset.task));
  assert(ids.join() === 'F07,F08', ids.join());
  await page.click('.cat-chip[data-cat="all"]');
});

await check('検索：「おたより」で学級通信が先頭に出る', async () => {
  await page.fill('#search', 'おたより');
  const first = await page.getAttribute('#home-dynamic .task-row >> nth=0', 'data-task');
  assert(first === 'F05', first);
});

await check('検索：「いじめ」は判断を促さず確認項目を示し、依頼文フォームへ自動で進まない', async () => {
  await page.fill('#search', 'いじめ');
  const cls = await page.getAttribute('.guide >> nth=0', 'data-class');
  assert(cls === 'E', cls);
  assert(await page.locator('.guide >> nth=0 >> .check-list li').count() > 0, '確認項目がない');
  assert(await page.locator('.guide >> nth=0 >> textarea').count() === 0, 'E案内に依頼文がある');
  assert(page.url().endsWith('/'), 'ページが遷移した');
  await page.screenshot({ path: join(OUT, '01-search-ijime.png'), fullPage: true });
});

await check('検索：「所見」は個人情報を入れない一般的な依頼文だけをコピーできる', async () => {
  await page.fill('#search', '通知表の所見');
  const cls = await page.getAttribute('.guide >> nth=0', 'data-class');
  assert(cls === 'D', cls);
  await page.click('.guide >> nth=0 >> .btn-copy');
  const clip = await readClipboard();
  assert(clip.includes('特定の児童生徒については書かず'), clip.slice(0, 80));
  await page.fill('#search', '');
});

for (const task of TASKS) {
  await check(`${task.id} ${task.title}：未入力で生成不可 → 入力 → 生成 → コピー`, async () => {
    await page.goto(`${ORIGIN}/#/f/${task.id}`);
    await page.waitForSelector(`#form-${task.id}`);
    await noHorizontalOverflow(`${task.id} フォーム`);
    // 未入力で押す
    await page.click('#generate');
    const summaryVisible = await page.isVisible('#error-summary');
    const values = minimalValues(task);
    const needsInput = getFields(task).some((f) => f.required && isVisible(f, values)
      && (['text', 'textarea', 'schoolGrade', 'articles'].includes(f.type) || (f.type === 'select' && !f.default)));
    if (needsInput) {
      assert(summaryVisible, 'エラー一覧が出ない');
      assert(!(await page.isVisible('#prompt-output')), '未入力なのに生成された');
      const errText = await page.textContent('#error-summary');
      assert(/入力が足りない項目/.test(errText), errText);
    }
    await fillForm(task, values);
    await page.click('#generate');
    await page.waitForSelector('#prompt-output', { state: 'visible' });
    assert(!(await page.isVisible('#error-summary')), '入力後もエラーが残る');
    const text = await page.inputValue('#prompt-output');
    for (const hd of ['目的', '対象', '条件・入力情報', '出力形式', '注意事項', '教師が確認する点']) assert(text.includes(`【${hd}】`), `【${hd}】がない`);
    assert(!/undefined|null|NaN|\{[a-zA-Z_]+\}/.test(text), '未定義の値がある');
    const v10 = SNAP[task.id].find((c) => c.kind === 'min' && c.level === 'standard').text;
    assert(text === v10, '追加設定なしの依頼文が v1.0 と一致しない（テストG）');
    await page.click('.output-toolbar .btn-copy');
    const clip = await readClipboard();
    assert(clip === text, 'クリップボードの内容が一致しない');
    assert((await page.textContent('#toast')).includes('コピーしました'), 'コピー成功表示がない');
    await noHorizontalOverflow(`${task.id} 出力`);
    await page.screenshot({ path: join(OUT, `${task.id}-output.png`), fullPage: true });
  });
}

await check('受け入れ2：F05 中学校・A4縦1枚・見出し2つ・写真枠1つ（画面操作）', async () => {
  await page.goto(`${ORIGIN}/#/f/F05`);
  // 前のテストの値が残っているのでクリアから
  await clearIfAny();
  await page.selectOption('#F05-schoolGrade', 'junior');
  await page.selectOption('#F05-schoolGrade-grade', '2');
  await page.fill('#F05-articles', '合唱コンクールに向けて');
  await page.fill('#F05-articles-0-b', '朝の練習が始まった');
  await page.click('.btn-add');
  await page.fill('#F05-articles-1-h', '衣替えのお知らせ');
  await page.selectOption('#F05-paper', 'A4縦');
  await page.click('label[for="F05-pages-0"]');
  await page.selectOption('#F05-photoSlots', '1');
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  for (const want of ['中学校2年の学級通信', 'A4縦・1枚', '見出し「合唱コンクールに向けて」', '見出し「衣替えのお知らせ」', '写真・イラストを後から入れる枠を1か所', '児童生徒の名前・エピソードは創作しない']) {
    assert(s.includes(want), `「${want}」がない`);
  }
});

await check('受け入れ3：F07 モノクロ・横長・文字なし（画面操作）', async () => {
  await page.goto(`${ORIGIN}/#/f/F07`);
  await clearIfAny();
  await page.selectOption('#F07-use', '学級通信・おたより');
  await page.fill('#F07-subject', '落ち葉のある校庭と秋の樹木');
  await page.click('label[for="F07-aspect-0"]');
  await page.click('label[for="F07-color-2"]');
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  assert(s.includes('横長（16:9）') && s.includes('白黒（モノクロ）') && s.includes('文字・数字・記号は画像内に入れない'), s);
  assert(await page.locator('img').count() === 0, '画像が生成・表示されている');
});

await check('受け入れ4：F09 月〜金・6時限・A4横・空欄（画面操作）', async () => {
  await page.goto(`${ORIGIN}/#/f/F09`);
  await clearIfAny();
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  assert(s.includes('曜日（月・火・水・木・金）') && s.includes('1時限〜6時限') && s.includes('A4横1枚') && s.includes('すべてのマスは空欄'), s);
  assert(s.includes('行わないでください') && !/編成してください/.test(s), '編成を依頼している');
  // 「入力した内容を入れる」に切り替えると、内容が必須になる
  await page.click('label[for="F09-fillMode-1"]');
  await page.click('#regenerate');
  assert(await page.isVisible('#error-summary'), '内容未入力でエラーにならない');
  await page.click('label[for="F09-fillMode-0"]');
});

await check('受け入れ5：F02 問題数・難易度・解答別紙（画面操作）', async () => {
  await page.goto(`${ORIGIN}/#/f/F02`);
  await clearIfAny();
  await page.selectOption('#F02-schoolGrade', 'elementary');
  await page.selectOption('#F02-schoolGrade-grade', '5');
  await page.fill('#F02-subject', '算数');
  await page.fill('#F02-unit', '分数のたし算');
  await page.fill('#F02-aim', '異分母の分数のたし算ができるか');
  await page.selectOption('#F02-questionCount', '8');
  await page.click('label[for="F02-difficulty-3"]');
  await page.click('label[for="F02-answerMode-0"]');
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  assert(s.includes('問題数：8問') && s.includes('難易度：基礎から発展へ段階的に') && s.includes('解答・解説（別紙）'), s);
});

await check('受け入れ8：用途を切り替えても入力が混線しない／クリアで消える', async () => {
  await page.goto(`${ORIGIN}/#/f/F01`);
  await clearIfAny();
  await page.fill('#F01-subject', '混線チェック用');
  await page.goto(`${ORIGIN}/#/f/F02`);
  await clearIfAny();
  assert((await page.inputValue('#F02-subject')) === '', 'F02にF01の値が入っている');
  await page.goto(`${ORIGIN}/#/f/F01`);
  assert((await page.inputValue('#F01-subject')) === '混線チェック用', '同じ用途に戻ると値が保持されていない');
  await page.fill('#F01-unit', 'テスト単元');
  await page.fill('#F01-goal', 'テストのねらい');
  await page.selectOption('#F01-schoolGrade', 'senior');
  await page.selectOption('#F01-schoolGrade-grade', '1');
  await page.click('#generate');
  await page.click('#clear');
  assert((await page.inputValue('#F01-subject')) === '', 'クリア後も値が残る');
  assert(!(await page.isVisible('#prompt-output')), 'クリア後も依頼文が残る');
});

await check('校種で学年の選択肢が変わる', async () => {
  await page.goto(`${ORIGIN}/#/f/F03`);
  await page.selectOption('#F03-schoolGrade', 'elementary');
  const e = await page.$$eval('#F03-schoolGrade-grade option', (o) => o.map((x) => x.textContent));
  await page.selectOption('#F03-schoolGrade', 'junior');
  const j = await page.$$eval('#F03-schoolGrade-grade option', (o) => o.map((x) => x.textContent));
  assert(e.includes('6年') && !j.includes('6年') && j.includes('3年'), `${e} / ${j}`);
});

await check('個人情報の可能性を警告する（ただし保証はしない）', async () => {
  await page.goto(`${ORIGIN}/#/f/F16`);
  await clearIfAny();
  await page.fill('#F16-want', '山田さんの欠席が続いているので連絡文を考えたい。電話は090-1111-2222');
  await page.fill('#F16-audience', '保護者');
  await page.fill('#F16-purpose', '連絡');
  await page.selectOption('#F16-output', '文章');
  await page.click('#generate');
  const w = await page.textContent('#pii-warning');
  assert(w.includes('電話番号') && w.includes('人の名前') && w.includes('含まれていないとは限りません'), w);
  assert(!w.includes('山田'), '検出文字列そのものを表示している');
  await page.screenshot({ path: join(OUT, 'pii-warning.png'), fullPage: false });
});

await check('資料を使う依頼では、工房にアップロードさせず確認を促す', async () => {
  await page.goto(`${ORIGIN}/#/f/F12`);
  await page.selectOption('#F12-docType', '会議の議事録');
  await page.fill('#F12-purpose', '学年会の共有');
  await page.click('#generate');
  assert(await page.isVisible('#reference-notice'), '資料の案内がない');
  assert(await page.locator('input[type=file]').count() === 0, 'ファイル入力がある');
});

await check('手で編集した依頼文をコピーでき、作り直し時は確認される', async () => {
  await page.fill('#prompt-output', '編集したテキスト');
  await page.click('.output-actions .btn-copy');
  assert((await readClipboard()) === '編集したテキスト', '編集内容がコピーされない');
  assert(await page.isVisible('.edited-note'), '編集の注意が出ない');
  let asked = false;
  page.once('dialog', () => { asked = true; });
  await page.click('#regenerate');
  assert(asked, '上書き確認が出ない');
});

await check('長い依頼文でもスマホ縦画面で崩れない', async () => {
  await page.goto(`${ORIGIN}/#/f/F15`);
  await page.selectOption('#F15-docUse', '保護者向けの文書');
  await page.fill('#F15-text', 'とても長い文章です。'.repeat(350));
  await page.click('#generate');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await noHorizontalOverflow('長文出力');
  const box = await page.locator('#prompt-output').boundingBox();
  assert(box.width <= 390, `出力欄の幅 ${box.width}`);
  await page.screenshot({ path: join(OUT, 'long-output.png'), fullPage: false });
});


// ---------------------------------------------------------------- v1.1
async function openPanel(task, panel) {
  const open = await page.getAttribute(`#panel-${task}-${panel}`, 'open');
  if (open === null) await page.click(`#panel-${task}-${panel} > summary`);
}

await check('v1.1 テストD・E・H：10月下旬／体育祭の振り返り＋修学旅行の事前案内＋青葉祭／ポップ×モノクロ（画面操作）', async () => {
  await page.goto(`${ORIGIN}/#/f/F05`);
  await clearIfAny();
  await page.selectOption('#F05-schoolGrade', 'junior');
  await page.selectOption('#F05-schoolGrade-grade', '2');
  await page.fill('#F05-articles', '2学期の後半に向けて');
  await openPanel('F05', 'time');
  assert(await page.isHidden('#wrap-F05-period'), '月が未指定なのに旬が表示される');
  await page.selectOption('#F05-month', '10');
  assert(await page.isVisible('#wrap-F05-period'), '月を選んでも旬が出ない');
  await page.click('label[for="F05-period-3"]');
  assert((await page.textContent('#panel-sum-F05-time')) === '10月下旬', 'パネルの要約が更新されない');
  await openPanel('F05', 'events');
  await page.fill('#F05-events', '体育祭');
  assert(await page.isVisible('#F05-events-ev-sports-01'), '体育祭の検索で運動会（関連名称）が出ない');
  await page.click('#F05-events-ev-sports-02');
  await page.fill('#F05-events', '');
  await page.click('#F05-events-tab-trip');
  await page.click('#F05-events-ev-trip-05');
  await page.selectOption('#F05-events-sel-0-stage', 'after');
  await page.selectOption('#F05-events-sel-1-stage', 'prep');
  await page.fill('#F05-events-custom', '青葉祭');
  await page.click('#F05-events-custom-add');
  assert((await page.textContent('#panel-sum-F05-events')) === '3件選択中', '件数の要約が違う');
  await openPanel('F05', 'season');
  assert(await page.isVisible('.motif-rec'), '10月のおすすめが表示されない');
  const pressed = await page.$$eval('.motif-rec .ev-chip[aria-pressed="true"], #wrap-F05-motifs input:checked', (els) => els.length);
  assert(pressed === 0, 'モチーフが自動で選ばれている');
  await openPanel('F05', 'design');
  await page.click('label[for="F05-designStyle-2"]');
  await noHorizontalOverflow('F05 追加設定を開いた状態');
  await page.screenshot({ path: join(OUT, 'v11-F05-extra.png'), fullPage: true });
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  for (const want of [
    '作成物の想定時期は10月下旬です',
    '－ 体育祭：実施後の振り返り',
    '－ 修学旅行：事前案内・準備',
    '－ 青葉祭（学校独自の行事）',
    '（ここに当日の様子を入力）',
    'ポップ・元気。モノクロ印刷のため、カラフルな色づかいは前提にせず',
    '敬体（です・ます）で、温かく落ち着いた文体',
  ]) assert(s.includes(want), `「${want}」がない`);
  for (const ng of ['運動会', 'ハロウィン', '紅葉', '明るい配色']) assert(!s.includes(ng), `「${ng}」が勝手に入っている（テストF）`);
});

await check('v1.1：選んだ行事に学校での名称を付けると「青葉祭（文化祭）」になる／個別に解除できる', async () => {
  await page.click('#F05-events-sel-0-remove');
  await page.click('#F05-events-sel-0-remove');
  await page.click('#F05-events-sel-0-remove');
  assert((await page.textContent('#panel-sum-F05-events')) === '未選択', '解除できない');
  await page.click('#F05-events-tab-culture');
  await page.click('#F05-events-ev-culture-01');
  await page.fill('#F05-events-sel-0-name', '青葉祭');
  assert((await page.textContent('.ev-preview')) === '青葉祭（文化祭）', 'プレビューが違う');
  await page.click('#regenerate');
  const s = await page.inputValue('#prompt-output');
  assert(s.includes('－ 青葉祭（文化祭）'), s.slice(0, 200));
});

await check('v1.1：クリアで行事・時期・テイストも消える', async () => {
  await page.click('#clear');
  assert((await page.textContent('#panel-sum-F05-events')) === '未選択', '行事が残る');
  assert((await page.textContent('#panel-sum-F05-time')) === '指定なし', '時期が残る');
  assert((await page.textContent('#panel-sum-F05-design')) === '指定なし', 'テイストが残る');
});

await check('v1.1：F06 はメールのとき季節の表現の項目を出さない／扱い方に「モチーフのみ」がない', async () => {
  await page.goto(`${ORIGIN}/#/f/F06`);
  await openPanel('F06', 'time');
  assert(await page.isVisible('#wrap-F06-seasonReflect'), '文書形式で季節の表現が出ない');
  await page.click('label[for="F06-medium-1"]');
  assert(await page.isHidden('#wrap-F06-seasonReflect'), 'メールでも季節の表現が出る');
  assert(await page.$('#panel-F06-design') === null && await page.$('#panel-F06-season') === null, 'F06にデザイン・モチーフがある');
  await openPanel('F06', 'events');
  await page.click('#F06-events-ev-culture-01');
  const opts = await page.$$eval('#F06-events-sel-0-stage option', (o) => o.map((x) => x.textContent));
  assert(!opts.some((o) => o.includes('モチーフ')), opts.join());
  await page.click('#F06-events-sel-0-remove');
  await page.click('label[for="F06-medium-0"]');
});

await check('v1.1：F07 は行事をモチーフとして扱い、扱い方の選択を出さない／反映方法に「文章」がない', async () => {
  await page.goto(`${ORIGIN}/#/f/F07`);
  await openPanel('F07', 'events');
  await page.click('#F07-events-ev-trip-01');
  assert(await page.$('#F07-events-sel-0-stage') === null, 'F07に扱い方の選択がある');
  await openPanel('F07', 'season');
  const labels = await page.$$eval('#wrap-F07-seasonReflect .chip-text', (els) => els.map((e) => e.textContent));
  assert(!labels.some((l) => l.includes('文章')), labels.join());
  await page.click('#F07-events-sel-0-remove');
});

await check('v1.1：F08 でもどの月・どの行事でも選べる（月と行事を固定しない）', async () => {
  await page.goto(`${ORIGIN}/#/f/F08`);
  await openPanel('F08', 'time');
  await page.selectOption('#F08-month', '2');
  await openPanel('F08', 'events');
  await page.click('#F08-events-tab-sports');
  await page.click('#F08-events-ev-sports-01'); // 2月の運動会
  await page.selectOption('#F08-kind', '掲示物・ポスター');
  await page.fill('#F08-content', '運動会のお知らせ');
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  assert(s.includes('2月') && s.includes('－ 運動会'), s.slice(0, 300));
  await page.click('#clear');
});


// ---------------------------------------------------------------- v1.2 Canva
await check('v1.2：出力先の初期値は「通常のAI向け」で、Canva向けに切り替えると専用の依頼文になる', async () => {
  await page.goto(`${ORIGIN}/#/f/F05`);
  await clearIfAny();
  assert(await page.isChecked('#F05-target-0'), '初期値が通常のAI向けでない');
  await fillForm(getTask('F05'), minimalValues(getTask('F05')));
  await page.click('#generate');
  const general = await page.inputValue('#prompt-output');
  assert(general.includes('【目的】'), '通常AI向けの依頼文でない');
  await page.fill('#prompt-output', '通常版を手で編集した文章');
  assert(await page.isVisible('#wrap-F05-delivery'), '通常AI向けで仕上がりの使い方が出ない');
  // Canva へ切り替え
  await page.click('label[for="F05-target-1"]');
  assert(await page.isHidden('#wrap-F05-delivery'), 'Canva向けで重複項目が隠れない');
  assert((await page.textContent('#generate')) === 'Canva AI向けの依頼文を作る', 'ボタン表示が変わらない');
  assert(await page.isVisible('#mode-switch-note'), '切り替え後の案内がない');
  assert(!(await page.$('#prompt-output')), '切り替えただけで、もう一方の依頼文が表示されている');
  await page.click('#generate');
  const cv = await page.inputValue('#prompt-output');
  assert(cv.includes('紙面デザインを作成してください') && cv.includes('■ 掲載する内容') && !cv.includes('【'), cv.slice(0, 200));
  assert((await page.getAttribute('#prompt-output', 'data-mode')) === 'canva');
  assert((await page.textContent('#canva-howto')).includes('Canva AIの入力欄に貼り付けてください'), '操作説明がない');
  // コピー
  await page.click('.output-toolbar .btn-copy');
  const clip = await readClipboard();
  assert(clip === cv, 'Canva向けの依頼文がコピーされない');
  const notes = await page.$$eval('#canva-notes li', (els) => els.map((e) => e.textContent));
  assert(notes.length >= 2 && notes.every((n) => !clip.includes(n)), '注意事項がコピー対象に混ざっている');
  // Canvaを開く
  const link = await page.$('#open-canva');
  assert((await link.getAttribute('href')) === 'https://www.canva.com/', 'リンク先が違う');
  assert((await link.getAttribute('target')) === '_blank' && (await link.getAttribute('rel')).includes('noopener'), 'リンク属性が不足');
  await noHorizontalOverflow('Canva出力');
  await page.screenshot({ path: join(OUT, 'v12-F05-canva.png'), fullPage: true });
  // 通常へ戻すと、手で編集した通常版がそのまま残っている
  await page.click('label[for="F05-target-0"]');
  assert((await page.inputValue('#prompt-output')) === '通常版を手で編集した文章', '通常版の手動編集が消えた');
  assert(await page.isVisible('.edited-note'), '編集済みの表示が消えた');
  await page.click('label[for="F05-target-1"]');
  assert((await page.inputValue('#prompt-output')) === cv, 'Canva版が保持されていない');
  await page.click('label[for="F05-target-0"]');
});

await check('v1.2：「Canvaを開く」は依頼文を含まないトップページを新しいタブで開く（スマホ）', async () => {
  await page.click('label[for="F05-target-1"]');
  // 実際には Canva へ接続しない（遷移先のURLだけを記録して中止する）
  const opened = [];
  await context.route('https://www.canva.com/**', (r) => { opened.push(r.request().url()); r.abort(); });
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.tap('#open-canva')]);
  for (let i = 0; i < 30 && !opened.length; i += 1) await page.waitForTimeout(100);
  assert(opened[0] === 'https://www.canva.com/', `開いたURL: ${opened.join(', ')}`);
  await popup.close();
  await context.unroute('https://www.canva.com/**');
  await page.tap('.output-toolbar .btn-copy');
  assert((await readClipboard()).includes('紙面デザインを作成してください'), 'タップでコピーできない');
  await page.click('label[for="F05-target-0"]');
});

await check('v1.2：F06 はお知らせ文書のときだけ Canva を選べ、メールでは通常のAI向けになる', async () => {
  await page.goto(`${ORIGIN}/#/f/F06`);
  await clearIfAny();
  assert(await page.isVisible('#wrap-F06-target'), '文書形式で出力先が出ない');
  await page.click('label[for="F06-target-1"]');
  assert(await page.isHidden('#wrap-F06-delivery') && await page.isHidden('#wrap-F06-variants'), 'Canva向けで重複項目が隠れない');
  await page.selectOption('#F06-purpose', '行事の案内');
  await page.fill('#F06-facts', '11月8日（金）に校外学習を行います。');
  await page.click('#generate');
  assert((await page.inputValue('#prompt-output')).includes('お知らせ文書のデザインを作成してください'), 'F06のCanva依頼文でない');
  await page.click('label[for="F06-medium-1"]');
  assert(await page.isHidden('#wrap-F06-target'), 'メールで出力先が出る');
  assert(await page.isVisible('#wrap-F06-delivery'), 'メールで仕上がりの使い方が隠れたまま');
  assert(!(await page.$('#open-canva')), 'メールでCanvaの操作が出る');
  assert((await page.textContent('#generate')) === '依頼文を作る');
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  assert(s.includes('【目的】') && s.includes('メール'), 'メールで通常AI向けにならない');
  await page.click('label[for="F06-medium-0"]');
});

await check('v1.2：F08 の「使うソフト」と矛盾しない（Canva向けでは隠し、戻すと元の値）', async () => {
  await page.goto(`${ORIGIN}/#/f/F08`);
  await clearIfAny();
  await page.selectOption('#F08-tool', 'PowerPoint');
  await page.click('label[for="F08-target-1"]');
  assert(await page.isHidden('#wrap-F08-tool'), 'Canva向けで使うソフトが出る');
  await page.click('label[for="F08-target-0"]');
  assert((await page.inputValue('#F08-tool')) === 'PowerPoint', '使うソフトの値が消えた');
});

await check('v1.2：F07 の Canva 向けは画像生成の指示になる', async () => {
  await page.goto(`${ORIGIN}/#/f/F07`);
  await clearIfAny();
  await page.selectOption('#F07-use', 'プリント・ワークシート');
  await page.fill('#F07-subject', 'どんぐりと落ち葉');
  await page.click('label[for="F07-target-1"]');
  assert(await page.isHidden('#wrap-F07-altPrompt'), 'Canva向けで重複項目が出る');
  await page.click('#generate');
  const s = await page.inputValue('#prompt-output');
  assert(s.startsWith('教材用のイラスト画像を1枚生成してください。') && s.includes('主題：どんぐりと落ち葉'), s.slice(0, 100));
  await page.click('label[for="F07-target-0"]');
});

await check('タップ領域：主要ボタン・選択肢は高さ44px以上', async () => {
  await page.goto(`${ORIGIN}/#/f/F05`);
  for (const p of ['time', 'events', 'season', 'design']) await openPanel('F05', p);
  await page.click('#F05-events-ev-sports-02');
  const small = await page.$$eval('button:not(.btn-link):not([hidden]), .chip-text, select, input[type=text], input[type=search], .task-card, .back-link, .panel-title', (els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: (e.textContent || e.id || e.tagName).trim().slice(0, 20), h: e.getBoundingClientRect().height }))
    .filter((x) => x.h < 43.5));
  assert(small.length === 0, JSON.stringify(small));
});

await check('v1.2：Canva向け出力のボタン・リンクも高さ44px以上', async () => {
  await page.goto(`${ORIGIN}/#/f/F05`);
  await clearIfAny();
  await fillForm(getTask('F05'), minimalValues(getTask('F05')));
  await page.click('label[for="F05-target-1"]');
  await page.click('#generate');
  const small = await page.$$eval('#output button, #output a, #wrap-F05-target .chip-text', (els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: e.textContent.trim().slice(0, 20), h: e.getBoundingClientRect().height }))
    .filter((x) => x.h < 43.5));
  assert(small.length === 0, JSON.stringify(small));
  await page.click('label[for="F05-target-0"]');
});

await check('フォーム部品にラベルが対応している', async () => {
  for (const t of TASKS) {
    await page.goto(`${ORIGIN}/#/f/${t.id}`);
    if (await page.$(`#panel-${t.id}-events`)) {
      for (const p of ['time', 'events', 'season', 'design']) if (await page.$(`#panel-${t.id}-${p}`)) await openPanel(t.id, p);
      if ((await page.getAttribute(`#${t.id}-events-ev-sports-02`, 'aria-pressed')) !== 'true') await page.click(`#${t.id}-events-ev-sports-02`);
    }
    const unlabeled = await page.$$eval('form input, form select, form textarea', (els) => els
      .filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label'))
      .map((e) => e.id || e.name));
    assert(unlabeled.length === 0, `${t.id}: ${unlabeled.join(',')}`);
  }
});

await check('キーボード操作：Tabで検索欄とカードに移動できる', async () => {
  await page.goto(`${ORIGIN}/`);
  await page.focus('#search');
  await page.keyboard.press('Tab');
  const tag = await page.evaluate(() => document.activeElement && document.activeElement.className);
  assert(/task-card|cat-chip|task-row/.test(tag), `フォーカス先: ${tag}`);
});

await check('通信点検：外部への通信がない／入力内容がURLに出ない', async () => {
  assert(external.length === 0, `外部通信: ${external.join(', ')}`);
  const leaked = allRequests.filter((u) => u.includes('%E5%B1%B1%E7%94%B0') || u.includes('090-1111'));
  assert(leaked.length === 0, `入力内容を含むリクエスト: ${leaked.join(', ')}`);
  const storage = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie }));
  assert(storage.ls === 0 && storage.ss === 0 && storage.cookie === '', JSON.stringify(storage));
});

await check('ページ内のJavaScriptエラーがない', async () => {
  assert(pageErrors.length === 0, pageErrors.join('\n'));
});

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);
console.log(`リクエスト総数: ${allRequests.length}（外部: ${external.length}）`);
process.exit(failed.length ? 1 : 0);
