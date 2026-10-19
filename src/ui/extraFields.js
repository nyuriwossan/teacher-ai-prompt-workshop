// v1.1：学校行事ピッカーと季節モチーフ選択の部品。
// 値はメモリ内の values にだけ書き込む。ユーザー入力は textContent / value でのみ扱う。

import { h, clear } from './dom.js';
import {
  EVENT_CATEGORIES, EVENTS, POPULAR_EVENT_NAMES, EVENT_STAGES, MAX_EVENTS,
  getEventByName, searchEvents, eventDisplayName,
} from '../data/schoolEvents.js';
import { MOTIF_GROUPS, recommendedMotifs } from '../data/seasonOptions.js';

/** 再描画後に、同じ id の要素へフォーカスを戻す */
function keepFocus(root, draw) {
  const active = document.activeElement;
  const id = active && root.contains(active) ? active.id : '';
  const caret = id && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  draw();
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret !== null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(caret, caret); } catch (_) { /* noop */ }
      }
    }
  }
}

// ---------------------------------------------------------------- 学校行事

export function renderEventsField(task, f, values, onChange, { base, hint, err, badgeEl }) {
  const stageOptions = f.stages ? EVENT_STAGES.filter((s) => s.value === '' || f.stages.includes(s.value)) : null;
  const list = () => {
    if (!Array.isArray(values[f.id])) values[f.id] = [];
    return values[f.id];
  };
  let tab = 'popular';
  let query = '';
  let notice = '';

  const root = h('fieldset', { class: 'fieldset ev', id: `${base}-group` });
  const selectedBox = h('div', { class: 'ev-selected' });
  const poolBox = h('div', { class: 'ev-pool-box' });
  const status = h('p', { class: 'hint ev-status', role: 'status', 'aria-live': 'polite' });

  const searchInput = h('input', {
    id: base, type: 'search', class: 'input', autocomplete: 'off', enterkeyhint: 'search',
    placeholder: '例：体育祭、遠足、参観', 'aria-describedby': `${base}-search-hint`,
  });
  searchInput.addEventListener('input', () => { query = searchInput.value; drawPool(); });

  const customInput = h('input', {
    id: `${base}-custom`, type: 'text', class: 'input', maxlength: '40', autocomplete: 'off',
    placeholder: '例：青葉祭、若葉フェスティバル',
  });
  const addCustom = () => {
    const name = customInput.value.replace(/\s+/g, ' ').trim();
    if (!name) { customInput.focus(); return; }
    if (list().length >= MAX_EVENTS) { notice = `選べる行事は${MAX_EVENTS}件までです。`; drawAll(); return; }
    // 候補と同じ名前なら候補として選ぶ
    const master = getEventByName(name);
    if (master) {
      if (!list().some((e) => e.key === master.id)) list().push(newEntry(master));
    } else if (!list().some((e) => !e.base && e.custom === name)) {
      list().push({ key: `custom:${Date.now()}`, base: '', custom: name, stage: defaultStage() });
    }
    customInput.value = '';
    notice = `「${name}」を追加しました。`;
    onChange(f.id);
    drawAll();
    customInput.focus();
  };
  customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } });
  const customBtn = h('button', { type: 'button', class: 'btn btn-secondary ev-add', id: `${base}-custom-add`, onclick: addCustom }, '追加');

  const tabs = h('div', { class: 'ev-tabs', role: 'group', 'aria-label': '行事の分類' });
  const tabDefs = [{ id: 'popular', label: 'よく使う' }, ...EVENT_CATEGORIES];
  const drawTabs = () => {
    clear(tabs);
    tabDefs.forEach((t) => tabs.append(h('button', {
      type: 'button', class: 'cat-chip ev-tab', id: `${base}-tab-${t.id}`, 'aria-pressed': String(tab === t.id && !query),
      onclick: () => { tab = t.id; query = ''; searchInput.value = ''; drawPool(); drawTabs(); },
    }, t.label)));
  };

  function defaultStage() {
    return '';
  }
  function newEntry(ev) {
    return { key: ev.id, base: ev.name, custom: '', stage: defaultStage() };
  }
  const isSelected = (ev) => list().some((e) => e.key === ev.id);

  const toggle = (ev) => {
    const arr = list();
    const i = arr.findIndex((e) => e.key === ev.id);
    if (i >= 0) { arr.splice(i, 1); notice = `「${ev.name}」の選択を解除しました。`; } else if (arr.length >= MAX_EVENTS) {
      notice = `選べる行事は${MAX_EVENTS}件までです。`;
    } else { arr.push(newEntry(ev)); notice = `「${ev.name}」を選びました。`; }
    onChange(f.id);
    keepFocus(root, drawAll);
  };

  const eventChip = (ev, via) => h('button', {
    type: 'button', class: 'ev-chip', id: `${base}-ev-${ev.id}`, 'aria-pressed': String(isSelected(ev)),
    dataset: { event: ev.name },
    onclick: () => toggle(ev),
  }, h('span', {}, ev.name), via ? h('span', { class: 'ev-via' }, `${via}の関連`) : null);

  function drawPool() {
    clear(poolBox);
    let items;
    if (query.trim()) {
      const res = searchEvents(query);
      if (!res.length) {
        poolBox.append(h('p', { class: 'hint' }, '候補が見つかりません。下の「学校独自の行事」から追加できます。'));
        drawTabs();
        return;
      }
      items = res.map((r) => eventChip(r.event, r.via));
      poolBox.append(h('p', { class: 'hint' }, `「${query.trim()}」の候補（関連する名称も表示しています）`));
    } else {
      const evs = tab === 'popular'
        ? POPULAR_EVENT_NAMES.map(getEventByName).filter(Boolean)
        : EVENTS.filter((e) => e.category === tab);
      items = evs.map((e) => eventChip(e, null));
    }
    poolBox.append(h('div', { class: 'ev-chips' }, items));
    drawTabs();
  }

  function drawSelected() {
    clear(selectedBox);
    const arr = list();
    if (!arr.length) {
      selectedBox.append(h('p', { class: 'hint ev-empty' }, 'まだ選んでいません。下の候補から選ぶか、学校独自の行事を追加してください。'));
      return;
    }
    selectedBox.append(h('p', { class: 'sublabel ev-selected-title' }, `選んだ行事（${arr.length}件）`));
    arr.forEach((e, i) => {
      const nameId = `${base}-sel-${i}-name`;
      const stageId = `${base}-sel-${i}-stage`;
      const title = e.base || e.custom || '（名称未入力）';
      const nameInput = h('input', {
        id: nameId, type: 'text', class: 'input', maxlength: '40', autocomplete: 'off',
        placeholder: e.base ? '例：青葉祭（空欄でもOK）' : '行事名',
        value: e.custom,
        oninput: (ev) => { e.custom = ev.target.value; preview.textContent = previewText(e); onChange(f.id); },
      });
      const preview = h('span', { class: 'ev-preview' }, previewText(e));
      const stageSel = stageOptions
        ? h('select', {
          id: stageId, class: 'input select',
          onchange: (ev) => { e.stage = ev.target.value; onChange(f.id); },
        }, stageOptions.map((s) => h('option', { value: s.value, selected: s.value === e.stage }, s.label)))
        : null;
      const remove = h('button', {
        type: 'button', class: 'btn btn-text ev-remove', id: `${base}-sel-${i}-remove`, 'aria-label': `${title}の選択を解除`,
        onclick: () => {
          arr.splice(i, 1);
          notice = `「${title}」の選択を解除しました。`;
          onChange(f.id);
          drawAll();
          const next = document.getElementById(`${base}-sel-${Math.max(0, i - 1)}-remove`) || searchInput;
          next.focus({ preventScroll: true });
        },
      }, '解除');
      selectedBox.append(h('div', { class: 'ev-item', dataset: { key: e.key } },
        h('div', { class: 'ev-item-head' },
          h('span', { class: 'ev-item-name' }, e.base ? e.base : '学校独自の行事'),
          remove),
        h('label', { class: 'sublabel', for: nameId }, e.base ? '学校での名称（任意）' : '行事名'),
        nameInput,
        h('p', { class: 'ev-preview-row' }, '依頼文での表記：', preview),
        stageSel ? h('label', { class: 'sublabel', for: stageId }, '扱い方') : null,
        stageSel));
    });
  }

  function previewText(e) {
    const custom = (e.custom || '').trim();
    return eventDisplayName({ base: e.base, custom }) || '（名称未入力）';
  }

  function drawAll() {
    drawSelected();
    drawPool();
    status.textContent = notice;
    notice = '';
  }

  root.append(
    h('legend', { class: 'label' }, h('span', { class: 'label-text' }, f.label), badgeEl),
  );
  if (hint) root.append(hint);
  root.append(
    err,
    selectedBox,
    status,
    h('div', { class: 'ev-finder' },
      h('label', { class: 'sublabel', for: base }, '行事を探す'),
      searchInput,
      h('p', { class: 'hint', id: `${base}-search-hint` }, '関連する名称（例：運動会と体育祭）も一緒に表示します。依頼文には選んだ名称だけが入ります。'),
      tabs,
      poolBox),
    h('div', { class: 'ev-custom' },
      h('label', { class: 'sublabel', for: `${base}-custom` }, '学校独自の行事を追加'),
      h('div', { class: 'ev-custom-row' }, customInput, customBtn)),
  );
  drawAll();
  return root;
}

// ---------------------------------------------------------------- 季節モチーフ

export function renderMotifsField(task, f, values, onChange, { base, hint, err }) {
  const root = h('fieldset', { class: 'fieldset motifs', id: `${base}-group` });
  const body = h('div', { class: 'motifs-body' });
  const list = () => {
    if (!Array.isArray(values[f.id])) values[f.id] = [];
    return values[f.id];
  };
  const setOn = (m, on) => {
    const cur = new Set(list());
    if (on) cur.add(m); else cur.delete(m);
    values[f.id] = MOTIF_GROUPS.flatMap((g) => g.items).filter((x) => cur.has(x));
    onChange(f.id);
  };

  function draw() {
    clear(body);
    const rec = recommendedMotifs(values.month);
    if (rec.length) {
      body.append(h('div', { class: 'motif-rec' },
        h('p', { class: 'sublabel' }, `${values.month}月に合いそうなモチーフ（自動では選ばれません。地域によって季節感は異なります）`),
        h('div', { class: 'ev-chips' }, rec.map((m) => h('button', {
          type: 'button', class: 'ev-chip', id: `${base}-rec-${m}`, 'aria-pressed': String(list().includes(m)),
          onclick: () => { setOn(m, !list().includes(m)); keepFocus(root, draw); },
        }, m)))));
    }
    MOTIF_GROUPS.forEach((g, gi) => {
      const chips = h('div', { class: 'chips chips-wrap' });
      g.items.forEach((m, i) => {
        const id = `${base}-${gi}-${i}`;
        const input = h('input', {
          type: 'checkbox', id, class: 'chip-input', value: m, checked: list().includes(m),
          onchange: () => { setOn(m, input.checked); keepFocus(root, draw); },
        });
        chips.append(h('label', { class: 'chip', for: id }, input, h('span', { class: 'chip-text' }, m)));
      });
      body.append(h('div', { class: 'motif-group field-checks' }, h('p', { class: 'sublabel' }, g.label), chips));
    });
  }

  root.append(h('legend', { class: 'label' }, h('span', { class: 'label-text' }, f.label)));
  if (hint) root.append(hint);
  root.append(err, body);
  draw();
  root.refresh = draw;
  return root;
}
