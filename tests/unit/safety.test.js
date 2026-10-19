import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanForSensitive, SAFETY_GUIDES, PII_NOTICE_BASE } from '../../src/safety/policy.js';
import { searchTasks, searchGuides } from '../../src/data/search.js';
import { TASKS } from '../../src/data/taskCatalog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('個人情報の可能性を検出する（種類だけを返す）', () => {
  const r = scanForSensitive({ a: '田中さんが欠席しました。連絡先 090-1234-5678、taro@example.com' });
  assert.ok(r.found);
  assert.ok(r.kinds.includes('電話番号'));
  assert.ok(r.kinds.includes('メールアドレス'));
  assert.ok(r.kinds.some((k) => k.startsWith('人の名前')));
  assert.ok(!r.kinds.join('').includes('田中'), '検出した文字列そのものは返さない');
  assert.ok(!r.kinds.includes('郵便番号・住所'), '電話番号を郵便番号と誤認しない');
  assert.ok(scanForSensitive({ a: '〒100-0001' }).kinds.includes('郵便番号・住所'));
});

test('配慮を要する情報の語を検出する', () => {
  assert.ok(scanForSensitive({ a: 'ADHDの診断がある生徒への配慮' }).kinds.includes('健康・障害・診断に関する情報'));
  assert.ok(scanForSensitive({ a: '家庭の事情で' }).kinds.includes('家庭の事情に関する情報'));
});

test('一般的な敬称表現は名前と誤認しにくい', () => {
  const r = scanForSensitive({ a: '保護者の皆様、お子さんと一緒に、みなさんでご参加ください。' });
  assert.ok(!r.kinds.some((k) => k.startsWith('人の名前')), r.kinds.join());
});

test('「検出なし＝個人情報なし」と表示しない', () => {
  assert.match(PII_NOTICE_BASE, /含まれていないとは限りません/);
});

test('検索：言い換え語で16フォームに届く', () => {
  const top = (q) => searchTasks(q)[0]?.id;
  assert.equal(top('おたより'), 'F05');
  assert.equal(top('学級通信を作りたい'), 'F05');
  assert.equal(top('イラスト'), 'F07');
  assert.equal(top('時間割'), 'F09');
  assert.equal(top('小テスト'), 'F02');
  assert.equal(top('保護者へのメール'), 'F06');
  assert.equal(top('議事録'), 'F12');
  assert.equal(top('ルーブリック'), 'F10');
  assert.equal(top('グーグルフォーム'), 'F13');
  assert.equal(top('クロームブック'), 'F14');
  assert.equal(top('やさしい日本語'), 'F03');
  assert.equal(top('運動会'), 'F11');
  assert.equal(top('レベル別'), 'F04');
  assert.equal(top('ポスター'), 'F08');
  assert.equal(top('校正'), 'F15');
  assert.equal(top('授業の流れ'), 'F01');
});

test('検索：E（AIに判断させない）は依頼文を作らず、確認項目を示す', () => {
  const g = searchGuides('いじめかどうか判断したい');
  assert.equal(g[0].class, 'E');
  assert.ok(g[0].checklist.length > 0);
  assert.equal(g[0].safePrompt, undefined);
  // いじめの検索で汎用フォームへ自動で振り分けない
  assert.ok(!searchTasks('いじめ').some((t) => t.id === 'F16' || t.id === 'F06'));
});

test('検索：D（個人情報）は個別の文章を作らず、一般的な観点の依頼文だけを示す', () => {
  const g = searchGuides('通知表の所見');
  assert.equal(g[0].class, 'D');
  assert.match(g[0].safePrompt, /特定の児童生徒については書かず/);
  assert.match(g[0].message, /個別の文章は作りません/);
});

test('検索：C（時間割の編成）は表の雛形と区別して案内する', () => {
  const g = searchGuides('時間割を組みたい');
  assert.equal(g[0].id, 'S-timetable-build');
  assert.equal(g[0].class, 'C');
  assert.deepEqual(g[0].alternatives, ['F09']);
});

test('安全案内の整合：Eは依頼文を持たず、Dの依頼文は個人情報を求めない', () => {
  for (const g of SAFETY_GUIDES) {
    if (g.class === 'E') assert.equal(g.safePrompt, undefined, g.id);
    if (g.safePrompt) assert.match(g.safePrompt, /個人情報も求めない|個人情報を求め|実在の人物の情報も求めない/, g.id);
    for (const id of g.alternatives || []) assert.ok(TASKS.some((t) => t.id === id), `${g.id} → ${id}`);
  }
});

// ---------- 静的な点検 ----------

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.') || name === 'tests' || name === 'test-results') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|html|css)$/.test(name)) out.push(p);
  }
  return out;
}

const shipped = walk(ROOT);

test('配信ファイルに外部通信・保存のコードがない', () => {
  const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/i, /document\.cookie/, /\.innerHTML\s*=/, /insertAdjacentHTML/, /eval\(/];
  for (const file of shipped) {
    const src = readFileSync(file, 'utf8');
    for (const re of banned) assert.ok(!re.test(src), `${file} に ${re}`);
  }
});

test('外部リソースを読み込まない（外部リンクは文科省ページとCanvaのトップのみ）', () => {
  for (const file of shipped) {
    const src = readFileSync(file, 'utf8');
    const urls = src.match(/https?:\/\/[^\s'"`)<]+/g) || [];
    const allowed = ['https://www.mext.go.jp/a_menu/other/mext_02412.html', 'https://www.canva.com/'];
    for (const u of urls) assert.ok(allowed.includes(u), `${file}: ${u}`);
  }
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.ok(!/<script[^>]+src="https?:/.test(html));
  assert.ok(!/<link[^>]+href="https?:/.test(html));
});

test('未検証の保証表現を使わない', () => {
  for (const file of shipped) {
    const src = readFileSync(file, 'utf8');
    for (const w of ['完全に安全', '匿名化済み', '文科省公認', '文部科学省公認', '安全を保証']) {
      assert.ok(!src.includes(w), `${file}: ${w}`);
    }
  }
});
