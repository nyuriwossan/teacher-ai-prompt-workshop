// 先生のAI依頼文工房：画面の組み立てと画面遷移。
// 入力内容はこのページのメモリ内だけに保持し、サーバー送信・ブラウザへの保存はしない。

import { h, clear, appendChildren } from './ui/dom.js';

/** null を文字列化しない append */
const add = (el, ...xs) => appendChildren(el, xs);
import { renderField, setFieldError, focusField } from './ui/fields.js';
import { copyText } from './ui/clipboard.js';
import { APP_NAME } from './data/formOptions.js';
import { TASKS, CATEGORIES, POPULAR_TASK_IDS, getTask, categoryLabel } from './data/taskCatalog.js';
import { searchTasks, searchGuides } from './data/search.js';
import {
  buildPrompt, validate, getDefaults, getFields, isVisible, cleanValues, usesReference,
} from './prompts/buildPrompt.js';
import {
  scanForSensitive, PII_NOTICE_BASE, WORKFLOW_LABELS, SENSITIVITY_LABELS, REVIEW_LABELS, GUIDE_CLASS_LABEL,
} from './safety/policy.js';

const state = {
  values: new Map(), // taskId -> 入力値
  outputs: new Map(), // taskId -> { text, edited }
  query: '',
  category: 'all',
};

const main = document.getElementById('main');
const toastEl = document.getElementById('toast');

function valuesFor(task) {
  if (!state.values.has(task.id)) state.values.set(task.id, getDefaults(task));
  return state.values.get(task.id);
}

// ---------------------------------------------------------------- トースト

let toastTimer = null;
function toast(message, kind = 'ok') {
  toastEl.textContent = message;
  toastEl.className = `toast toast-${kind} is-visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2600);
}

// ---------------------------------------------------------------- 共通部品

function taskBadges(task) {
  const labels = [WORKFLOW_LABELS[task.workflow], SENSITIVITY_LABELS[task.sensitivity], REVIEW_LABELS[task.review]].filter(Boolean);
  if (!labels.length) return null;
  return h('span', { class: 'tags' }, labels.map((l) => h('span', { class: 'tag tag-caution' }, l)));
}

function taskCard(task) {
  return h('a', { class: 'task-card', href: `#/f/${task.id}`, dataset: { task: task.id } },
    h('span', { class: 'task-icon', 'aria-hidden': 'true' }, task.icon),
    h('span', { class: 'task-body' },
      h('span', { class: 'task-title' }, task.title),
      h('span', { class: 'task-short' }, task.short)));
}

function taskRow(task) {
  return h('li', {},
    h('a', { class: 'task-row', href: `#/f/${task.id}`, dataset: { task: task.id } },
      h('span', { class: 'task-icon', 'aria-hidden': 'true' }, task.icon),
      h('span', { class: 'task-body' },
        h('span', { class: 'task-title' }, task.title),
        h('span', { class: 'task-short' }, task.short),
        taskBadges(task)),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
}

function copyButton(getText, label = '全文をコピー', cls = 'btn btn-primary btn-copy', fallbackEl = null) {
  const btn = h('button', { type: 'button', class: cls }, label);
  btn.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    const ok = await copyText(text, typeof fallbackEl === 'function' ? fallbackEl() : fallbackEl);
    if (ok) {
      btn.textContent = 'コピーしました ✓';
      btn.classList.add('is-done');
      toast('コピーしました。利用が認められたAIに貼り付けてください。');
      setTimeout(() => { btn.textContent = label; btn.classList.remove('is-done'); }, 2200);
    } else {
      toast('自動でコピーできませんでした。テキストを長押しして選択し、コピーしてください。', 'error');
    }
  });
  return btn;
}

// ---------------------------------------------------------------- ホーム

function renderHome() {
  document.title = `${APP_NAME}｜困りごとを選んで、AIへの依頼文をコピーするだけ`;
  const searchInput = h('input', {
    id: 'search', class: 'input search-input', type: 'search', enterkeyhint: 'search', autocomplete: 'off',
    placeholder: '例：おたより、イラスト、時間割、小テスト', value: state.query,
    'aria-describedby': 'search-hint',
  });
  const dynamic = h('div', { id: 'home-dynamic', 'aria-live': 'polite' });
  searchInput.addEventListener('input', () => { state.query = searchInput.value; renderHomeDynamic(dynamic); });

  add(main, 
    h('section', { class: 'hero' },
      h('h1', { class: 'hero-title', tabindex: '-1', id: 'page-title' }, '困りごとを選んで、', h('br', { class: 'br-sp' }), 'AIへの依頼文をコピーするだけ'),
      h('p', { class: 'hero-lead' }, '短いフォームに答えると、ChatGPT・Claude・Gemini などにそのまま貼れる依頼文ができます。登録は不要です。入力した内容は、このページの中で依頼文に組み立てるだけで、どこにも送信しません。'),
      h('ol', { class: 'steps', 'aria-label': '使い方' },
        h('li', {}, h('span', { class: 'step-no' }, '1'), '困りごとを選ぶ'),
        h('li', {}, h('span', { class: 'step-no' }, '2'), '数項目に答える'),
        h('li', {}, h('span', { class: 'step-no' }, '3'), 'コピーしてAIへ'))),
    h('section', { class: 'search-box', role: 'search' },
      h('label', { class: 'search-label', for: 'search' }, '何を作りたいですか？'),
      searchInput,
      h('p', { class: 'hint', id: 'search-hint' }, '思いついた言葉で探せます。')),
    dynamic,
    h('section', { class: 'card safety-brief', 'aria-labelledby': 'safety-brief-title' },
      h('h2', { id: 'safety-brief-title', class: 'section-title' }, '使う前に'),
      h('ul', { class: 'plain-list' },
        h('li', {}, '児童生徒・保護者の名前、成績、健康、家庭の事情などの個人情報は入力しないでください。'),
        h('li', {}, '資料や教科書の文章をAIに渡すときは、著作権と学校・自治体のルールを確認してください。'),
        h('li', {}, 'AIの答えは下書きです。事実や内容は、必ず先生が確認してから使ってください。')),
      h('a', { href: '#/about', class: 'link' }, '使い方と安全についてくわしく')),
  );
  renderHomeDynamic(dynamic);
}

function renderHomeDynamic(container) {
  clear(container);
  const q = state.query.trim();
  if (q) {
    renderSearchResults(container, q);
    return;
  }
  add(container, 
    h('section', { class: 'section', 'aria-labelledby': 'popular-title' },
      h('h2', { class: 'section-title', id: 'popular-title' }, 'よく使う困りごと'),
      h('div', { class: 'card-grid' }, POPULAR_TASK_IDS.map((id) => taskCard(getTask(id))))),
  );
  const list = h('ul', { class: 'task-list', id: 'category-list' });
  const chips = h('div', { class: 'cat-chips', role: 'group', 'aria-label': 'カテゴリ' });
  const cats = [{ id: 'all', label: 'すべて' }, ...CATEGORIES];
  const drawList = () => {
    clear(list);
    const tasks = state.category === 'all' ? TASKS : TASKS.filter((t) => t.categories.includes(state.category));
    tasks.forEach((t) => add(list, taskRow(t)));
  };
  cats.forEach((c) => {
    const b = h('button', {
      type: 'button', class: 'cat-chip', 'aria-pressed': String(state.category === c.id), dataset: { cat: c.id },
      onclick: () => {
        state.category = c.id;
        chips.querySelectorAll('.cat-chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === c.id)));
        drawList();
      },
    }, c.label);
    add(chips, b);
  });
  drawList();
  add(container, 
    h('section', { class: 'section', 'aria-labelledby': 'cat-title' },
      h('h2', { class: 'section-title', id: 'cat-title' }, 'カテゴリから探す'),
      chips, list),
  );
}

function renderSearchResults(container, q) {
  const guides = searchGuides(q);
  const tasks = searchTasks(q);
  const section = h('section', { class: 'section', 'aria-labelledby': 'result-title' },
    h('h2', { class: 'section-title', id: 'result-title' }, `「${q}」の検索結果`));
  if (guides.length) {
    add(section, h('div', { class: 'guides' }, guides.slice(0, 3).map(guideCard)));
  }
  if (tasks.length) {
    add(section, h('h3', { class: 'sub-title' }, '依頼文を作れるフォーム'), h('ul', { class: 'task-list' }, tasks.map(taskRow)));
  }
  if (!tasks.length && !guides.length) {
    add(section, h('p', { class: 'empty' }, 'ぴったりのフォームが見つかりませんでした。'));
  }
  if (!tasks.some((t) => t.id === 'F16')) {
    add(section, h('p', { class: 'hint' }, '見つからないときは、自由な困りごとのフォームで依頼文に整えられます。'),
      h('ul', { class: 'task-list' }, taskRow(getTask('F16'))));
  }
  add(container, section);
}

function guideCard(g) {
  const card = h('article', { class: `guide guide-${g.class}`, dataset: { guide: g.id, class: g.class } },
    h('p', { class: 'guide-class' }, GUIDE_CLASS_LABEL[g.class]),
    h('h3', { class: 'guide-title' }, g.title),
    h('p', { class: 'guide-message' }, g.message));
  if (g.checklist) {
    add(card, h('p', { class: 'guide-sub' }, '判断のために確認すること'),
      h('ul', { class: 'check-list' }, g.checklist.map((c) => h('li', {}, c))));
  }
  if (g.safePrompt) {
    const pre = h('textarea', { class: 'input textarea safe-prompt', readonly: true, rows: '5', 'aria-label': '一般的な観点を聞く依頼文' });
    pre.value = g.safePrompt;
    add(card, 
      h('p', { class: 'guide-sub' }, '個人情報を含まない「一般的な観点」をAIに聞く依頼文'),
      pre,
      copyButton(() => g.safePrompt, 'この依頼文をコピー', 'btn btn-secondary btn-copy', pre),
    );
  }
  if (g.alternatives && g.alternatives.length) {
    add(card, h('p', { class: 'guide-sub' }, g.alternativeNote),
      h('ul', { class: 'task-list task-list-compact' }, g.alternatives.map((id) => taskRow(getTask(id)))));
  }
  return card;
}

// ---------------------------------------------------------------- フォーム画面


function renderTask(task) {
  document.title = `${task.title}｜${APP_NAME}`;
  const values = valuesFor(task);
  const fields = getFields(task);
  const groups = { basic: [], advanced: [], output: [] };
  fields.forEach((f) => groups[f.group || 'basic'].push(f));

  const fieldEls = new Map();
  let attempted = false;

  const onChange = (changedId) => {
    // 表示条件の更新
    for (const f of fields) {
      const el = fieldEls.get(f.id);
      if (el) el.hidden = !isVisible(f, values);
    }
    if (attempted) refreshErrors(false);
    if (state.outputs.has(task.id)) markStale();
    void changedId;
  };

  const errorSummary = h('div', { class: 'error-summary', role: 'alert', hidden: true, tabindex: '-1', id: 'error-summary' });

  const refreshErrors = (showSummary) => {
    const { errors } = validate(task, values);
    const byField = new Map(errors.map((e) => [e.fieldId, e.message]));
    for (const f of fields) setFieldError(task, f, byField.get(f.id) || '');
    clear(errorSummary);
    if (!errors.length) { errorSummary.hidden = true; return errors; }
    if (showSummary) {
      add(errorSummary, 
        h('p', { class: 'error-summary-title' }, `入力が足りない項目が${errors.length}つあります`),
        h('ul', {}, errors.map((e) => h('li', {},
          h('button', { type: 'button', class: 'btn-link', onclick: () => focusField(task, e.fieldId) }, `${e.label}：${e.message}`)))),
      );
      errorSummary.hidden = false;
    } else if (!errorSummary.hidden) {
      add(errorSummary, h('p', { class: 'error-summary-title' }, `入力が足りない項目が${errors.length}つあります`),
        h('ul', {}, errors.map((e) => h('li', {},
          h('button', { type: 'button', class: 'btn-link', onclick: () => focusField(task, e.fieldId) }, `${e.label}：${e.message}`)))));
    }
    return errors;
  };

  const makeFieldBlock = (list) => list.map((f) => {
    const el = renderField(task, f, values, onChange);
    el.hidden = !isVisible(f, values);
    fieldEls.set(f.id, el);
    return el;
  });

  const output = h('section', { class: 'output', id: 'output', 'aria-labelledby': 'output-title', hidden: true });

  const form = h('form', { class: 'task-form', novalidate: true, id: `form-${task.id}` },
    errorSummary,
    h('section', { class: 'form-section' },
      h('h2', { class: 'form-section-title' }, h('span', { class: 'num' }, '1'), '基本の入力'),
      makeFieldBlock(groups.basic)),
    groups.advanced.length
      ? h('details', { class: 'form-section details' },
        h('summary', { class: 'form-section-title summary' }, h('span', { class: 'num' }, '2'), '詳しく設定する', h('span', { class: 'summary-note' }, '任意')),
        h('div', { class: 'details-body' }, makeFieldBlock(groups.advanced)))
      : null,
    h('section', { class: 'form-section' },
      h('h2', { class: 'form-section-title' }, h('span', { class: 'num' }, groups.advanced.length ? '3' : '2'), '出力の設定'),
      makeFieldBlock(groups.output)),
    h('div', { class: 'form-actions' },
      h('button', { type: 'submit', class: 'btn btn-primary btn-large', id: 'generate' }, '依頼文を作る'),
      h('p', { class: 'hint center' }, 'この工房はAIを呼び出しません。依頼文を作るだけです。')),
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    attempted = true;
    const errors = refreshErrors(true);
    if (errors.length) {
      errorSummary.focus();
      errorSummary.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    generate(true);
  });

  let staleNote = null;
  const markStale = () => { if (staleNote) staleNote.hidden = false; };

  const generate = (scroll) => {
    const result = buildPrompt(task, values);
    if (!result.ok) return;
    state.outputs.set(task.id, { text: result.text, edited: false });
    drawOutput(scroll);
  };

  const drawOutput = (scroll) => {
    const out = state.outputs.get(task.id);
    clear(output);
    if (!out) { output.hidden = true; return; }
    output.hidden = false;
    const cleaned = cleanValues(task, values);
    const textFields = fields.filter((f) => ['text', 'textarea', 'articles'].includes(f.type));
    const scan = scanForSensitive(textFields.map((f) => cleaned[f.id]));

    const area = h('textarea', {
      id: 'prompt-output', class: 'input textarea prompt-output', rows: '14', spellcheck: 'false',
      'aria-label': '生成した依頼文（編集できます）', 'aria-describedby': 'output-help',
    });
    area.value = out.text;
    const count = h('span', { class: 'char-count', id: 'char-count' }, `${out.text.length.toLocaleString()}字`);
    const editedNote = h('p', { class: 'hint edited-note', hidden: !out.edited }, '手で直した内容は、「条件を反映して作り直す」を押すと上書きされます。');
    area.addEventListener('input', () => {
      out.text = area.value;
      out.edited = true;
      editedNote.hidden = false;
      count.textContent = `${area.value.length.toLocaleString()}字`;
      autosize(area);
    });
    staleNote = h('p', { class: 'notice notice-info stale-note', hidden: true }, '入力が変わりました。「条件を反映して作り直す」を押すと、依頼文に反映されます。');

    const regen = h('button', { type: 'button', class: 'btn btn-secondary', id: 'regenerate' }, '条件を反映して作り直す');
    regen.addEventListener('click', () => {
      attempted = true;
      const errors = refreshErrors(true);
      if (errors.length) { errorSummary.focus(); errorSummary.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      if (out.edited && !window.confirm('手で直した内容は上書きされます。作り直しますか？')) return;
      generate(false);
      toast('依頼文を作り直しました。');
      document.getElementById('prompt-output')?.focus({ preventScroll: true });
    });
    const clearBtn = h('button', { type: 'button', class: 'btn btn-danger-ghost', id: 'clear' }, '入力をクリア');
    clearBtn.addEventListener('click', () => clearTask(task));

    add(output, 
      h('h2', { class: 'output-title', id: 'output-title', tabindex: '-1' }, 'AIへの依頼文ができました'),
      scan.found
        ? h('div', { class: 'notice notice-warn', role: 'status', id: 'pii-warning' },
          h('p', { class: 'notice-title' }, '個人情報などが含まれている可能性があります'),
          h('p', {}, `入力内容に次のような情報が含まれているかもしれません：${scan.kinds.join('、')}。コピーする前に、該当する部分を削除するか、一般的な表現に書き換えてください。`),
          h('p', { class: 'small' }, PII_NOTICE_BASE))
        : null,
      usesReference(cleaned)
        ? h('div', { class: 'notice notice-info', id: 'reference-notice' },
          h('p', { class: 'notice-title' }, '資料を使う依頼文です'),
          h('p', {}, 'AIに貼り付けたあと、この依頼文の下に資料を貼り付けるか、ファイルを添付してください。資料はこの工房には入力しません。資料をAIに渡してよいか（個人情報・著作権・学校や自治体のルール）を先に確認してください。'))
        : null,
      task.review !== 'normal'
        ? h('div', { class: 'notice notice-info' },
          h('p', {}, task.id === 'F10'
            ? 'できあがるのは評価基準の「案」です。個々の児童生徒の評価や評定は、先生が判断してください。'
            : '安全・引率・実施の可否などは、AIの答えではなく学校の規程と管理職の判断に従ってください。'))
        : null,
      staleNote,
      h('div', { class: 'output-toolbar' }, copyButton(() => area.value, '全文をコピー', 'btn btn-primary btn-copy btn-large', area), count),
      h('p', { class: 'hint', id: 'output-help' }, '内容はここで直接直せます。'),
      area,
      editedNote,
      h('div', { class: 'output-actions' },
        copyButton(() => area.value, '全文をコピー', 'btn btn-primary btn-copy', area),
        regen, clearBtn),
      h('div', { class: 'card next-steps' },
        h('h3', { class: 'sub-title' }, '次にすること'),
        h('ol', { class: 'plain-list numbered' },
          h('li', {}, '貼り付ける前に、児童生徒・保護者の名前や個別の事情が入っていないか、もう一度確認します。'),
          h('li', {}, 'コピーした依頼文を、学校・自治体で利用が認められたAI（ChatGPT・Claude・Gemini・Copilot など）に貼り付けます。'),
          h('li', {}, '返ってきた答えは下書きです。事実・数値・表現を先生が確認してから使います。'))),
    );
    requestAnimationFrame(() => autosize(area));
    if (scroll) {
      output.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setTimeout(() => document.getElementById('output-title')?.focus({ preventScroll: true }), 300);
    }
  };

  const catNames = task.categories.map(categoryLabel).join('・');
  add(main, 
    h('nav', { class: 'crumb', 'aria-label': 'パンくず' }, h('a', { href: '#/', class: 'back-link' }, '‹ 困りごとの一覧へ')),
    h('header', { class: 'task-header' },
      h('p', { class: 'task-cat' }, catNames),
      h('h1', { class: 'task-heading', id: 'page-title', tabindex: '-1' }, h('span', { class: 'task-icon', 'aria-hidden': 'true' }, task.icon), task.title),
      h('div', { class: 'scope' },
        h('p', {}, h('strong', {}, 'できること：'), task.scope.can),
        h('p', {}, h('strong', {}, '気をつけること：'), task.scope.cannot)),
      task.sensitivity !== 'generic'
        ? h('p', { class: 'notice notice-caution' }, '児童生徒・保護者の名前や、個別の事情（成績・健康・家庭のことなど）は入力しないでください。')
        : null),
    form,
    output,
  );

  if (state.outputs.has(task.id)) drawOutput(false);
}

function clearTask(task) {
  if (!window.confirm('この用途で入力した内容と、作った依頼文を消去します。よろしいですか？')) return;
  state.values.delete(task.id);
  state.outputs.delete(task.id);
  render();
  toast('入力内容を消去しました。');
}

function autosize(area) {
  area.style.height = 'auto';
  area.style.height = `${Math.min(area.scrollHeight + 4, 4000)}px`;
}

// ---------------------------------------------------------------- 使い方

function renderAbout() {
  document.title = `使い方と安全について｜${APP_NAME}`;
  add(main, 
    h('nav', { class: 'crumb', 'aria-label': 'パンくず' }, h('a', { href: '#/', class: 'back-link' }, '‹ 困りごとの一覧へ')),
    h('article', { class: 'about' },
      h('h1', { id: 'page-title', tabindex: '-1' }, '使い方と安全について'),
      h('h2', {}, 'この工房でできること'),
      h('p', {}, 'この工房は、先生の「困りごと」に合わせた短いフォームから、生成AIに渡す依頼文（プロンプト）を作るツールです。工房自身はAIを呼び出さず、文章・画像・ファイルも作りません。作った依頼文をコピーして、学校・自治体で利用が認められたAIに貼り付けて使います。'),
      h('h2', {}, '使い方'),
      h('ol', { class: 'plain-list numbered' },
        h('li', {}, 'トップで困りごとを選ぶか、思いついた言葉で検索します。'),
        h('li', {}, '「基本の入力」に答えます。必要なら「詳しく設定する」「出力の設定」も選びます。'),
        h('li', {}, '「依頼文を作る」を押し、内容を確認して「全文をコピー」を押します。'),
        h('li', {}, 'AIに貼り付けます。資料を使う依頼文の場合は、その下に資料を貼り付けるか添付します。')),
      h('h2', {}, '個人情報について'),
      h('ul', { class: 'plain-list' },
        h('li', {}, '児童生徒・保護者の氏名、成績、出欠、健康、障害、家庭の事情、個別の相談記録などは入力しないでください。'),
        h('li', {}, '入力欄には、個人情報が含まれている可能性を知らせる簡単な確認があります。ただし、表示されなくても個人情報が含まれていないとは限りません。'),
        h('li', {}, '名前を「Aさん」に変えるなどの置き換えでも、出来事の組み合わせから本人が分かることがあります。'),
        h('li', {}, '学校で認められたAIを使う場合でも、資料をAIに入れてよいかは所属校・自治体の規程を優先してください。')),
      h('h2', {}, '資料と著作権について'),
      h('p', {}, '教科書・市販教材・他者の文章や画像をAIに渡したり、AIの出力を配布・公開したりするときは、著作権と学校のルールを確認してください。この工房には資料をアップロードする機能はありません。'),
      h('h2', {}, 'AIの答えの扱い'),
      h('p', {}, 'AIの答えには誤りや偏りが含まれることがあります。依頼文には「教師が確認する点」を出すよう組み込んでいますが、最終的な確認と判断は先生が行ってください。評価・評定、いじめの判断、安全や健康の判断、支援の要否などは、AIに判断させないでください。'),
      h('h2', {}, 'この工房で扱わないこと'),
      h('p', {}, '時間割の編成や成績の集計などの専用の処理、通知表所見・個別の指導計画などの個人情報を伴う文書、いじめ・安全・医療などの判断は、依頼文フォームとしては用意していません。検索すると、代わりに確認すべきことを案内します。'),
      h('h2', {}, 'データの扱い'),
      h('ul', { class: 'plain-list' },
        h('li', {}, '入力内容は、このページを開いている間だけブラウザのメモリに置かれます。サーバーへの送信、ブラウザのストレージへの保存はしません。'),
        h('li', {}, 'アクセス解析・広告・外部フォント・外部ライブラリは使っていません。'),
        h('li', {}, '「入力をクリア」を押すと、その用途の入力内容が消えます。ページを閉じると、すべて消えます。')),
      h('p', {}, h('button', { type: 'button', class: 'btn btn-danger-ghost', id: 'clear-all', onclick: clearAll }, 'すべての入力内容を消去')),
      h('h2', {}, '参考'),
      h('p', {}, '学校での生成AIの利用については、文部科学省の資料や、所属する自治体・学校のガイドラインを確認してください。この工房は、それらのルールへの適合を保証するものではありません。'),
      h('p', {}, h('a', { href: 'https://www.mext.go.jp/a_menu/other/mext_02412.html', class: 'link', target: '_blank', rel: 'noopener noreferrer' }, '文部科学省「生成AIの利用について」（外部サイト）')),
      h('p', { class: 'small muted' }, '困りごとの分類は、公開資料をもとにした調査を参考に、この工房の設計のために整理したものです。全国の需要を測った統計ではありません。'),
    ),
  );
}

function clearAll() {
  if (!window.confirm('すべての用途の入力内容と依頼文を消去します。よろしいですか？')) return;
  state.values.clear();
  state.outputs.clear();
  state.query = '';
  toast('すべての入力内容を消去しました。');
}

// ---------------------------------------------------------------- ルーティング

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const m = hash.match(/^\/f\/(F\d{2})$/);
  if (m && getTask(m[1])) return { name: 'task', task: getTask(m[1]) };
  if (hash === '/about') return { name: 'about' };
  return { name: 'home' };
}

let lastRoute = '';
function render() {
  const route = parseRoute();
  clear(main);
  if (route.name === 'task') renderTask(route.task);
  else if (route.name === 'about') renderAbout();
  else renderHome();
  const key = location.hash;
  if (key !== lastRoute) {
    window.scrollTo(0, 0);
    const title = document.getElementById('page-title');
    if (title && lastRoute !== '') title.focus({ preventScroll: true });
  }
  lastRoute = key;
}

window.addEventListener('hashchange', render);
render();
