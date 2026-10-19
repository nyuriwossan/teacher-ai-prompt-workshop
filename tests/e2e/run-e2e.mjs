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
        await page.fill(`#${id}`, v[0].heading);
        await page.fill(`#${id}-0-b`, v[0].body); break;
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

await check('タップ領域：主要ボタン・選択肢は高さ44px以上', async () => {
  await page.goto(`${ORIGIN}/#/f/F05`);
  const small = await page.$$eval('button:not(.btn-link):not([hidden]), .chip-text, select, input[type=text], .task-card, .back-link', (els) => els
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: (e.textContent || e.id || e.tagName).trim().slice(0, 20), h: e.getBoundingClientRect().height }))
    .filter((x) => x.h < 43.5));
  assert(small.length === 0, JSON.stringify(small));
});

await check('フォーム部品にラベルが対応している', async () => {
  for (const t of TASKS) {
    await page.goto(`${ORIGIN}/#/f/${t.id}`);
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
