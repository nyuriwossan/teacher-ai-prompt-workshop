// フォーム項目の描画。値は呼び出し元の values オブジェクトに直接書き込む（メモリ内のみ）。

import { h, clear, appendChildren } from './dom.js';
import { normalizeOptions } from '../prompts/buildPrompt.js';
import { SCHOOL_TYPES, GRADES_BY_SCHOOL } from '../data/formOptions.js';

function badge(required) {
  return h('span', { class: required ? 'badge badge-required' : 'badge badge-optional' }, required ? '必須' : '任意');
}

function describedBy(...ids) {
  return ids.filter(Boolean).join(' ') || null;
}

/**
 * @param {object} task
 * @param {object} f フィールド定義
 * @param {object} values このタスクの値（書き換える）
 * @param {(id:string)=>void} onChange
 */
export function renderField(task, f, values, onChange) {
  const base = `${task.id}-${f.id}`;
  const hintId = f.hint ? `${base}-hint` : null;
  const errId = `${base}-err`;
  const wrap = h('div', { class: `field field-${f.type}`, id: `wrap-${base}`, dataset: { field: f.id } });
  const hint = f.hint ? h('p', { class: 'hint', id: hintId }, f.hint) : null;
  const err = h('p', { class: 'field-error', id: errId, hidden: true });
  const set = (val) => { values[f.id] = val; onChange(f.id); };
  const add = (...xs) => appendChildren(wrap, xs); // null を文字列化しない
  const showBadge = f.group !== 'output';

  switch (f.type) {
    case 'text':
    case 'textarea': {
      const isArea = f.type === 'textarea';
      const listId = f.datalist ? `${base}-list` : null;
      const counter = isArea && f.maxLength ? h('span', { class: 'counter', 'aria-hidden': 'true' }) : null;
      const updateCounter = () => { if (counter) counter.textContent = `${(values[f.id] || '').length} / ${f.maxLength}`; };
      const input = h(isArea ? 'textarea' : 'input', {
        id: base,
        name: f.id,
        class: isArea ? 'input textarea' : 'input',
        type: isArea ? null : 'text',
        rows: isArea ? String(f.rows || 3) : null,
        maxlength: f.maxLength ? String(f.maxLength) : null,
        placeholder: f.placeholder || null,
        list: listId,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        'aria-required': f.required ? 'true' : null,
        'aria-describedby': describedBy(hintId, errId),
        value: values[f.id] || '',
        oninput: (e) => { values[f.id] = e.target.value; updateCounter(); onChange(f.id); },
      });
      updateCounter();
      add(
        h('label', { class: 'label', for: base }, h('span', { class: 'label-text' }, f.label), showBadge ? badge(f.required) : null),
        hint, err, input,
        counter ? h('div', { class: 'counter-row' }, counter) : null,
        listId ? h('datalist', { id: listId }, f.datalist.map((d) => h('option', { value: d }))) : null,
      );
      break;
    }

    case 'select': {
      const opts = normalizeOptions(f.options);
      const sel = h('select', {
        id: base, name: f.id, class: 'input select',
        'aria-required': f.required ? 'true' : null,
        'aria-describedby': describedBy(hintId, errId),
        onchange: (e) => set(e.target.value),
      }, opts.map((o) => h('option', { value: o.value, selected: o.value === values[f.id] }, o.label)));
      add(
        h('label', { class: 'label', for: base }, h('span', { class: 'label-text' }, f.label), showBadge ? badge(f.required) : null),
        hint, err, sel,
      );
      break;
    }

    case 'radio':
    case 'checks': {
      const isRadio = f.type === 'radio';
      const opts = normalizeOptions(f.options);
      const group = h('div', { class: `chips${opts.length > 4 ? ' chips-wrap' : ''}` });
      opts.forEach((o, i) => {
        const id = `${base}-${i}`;
        const checked = isRadio ? values[f.id] === o.value : (values[f.id] || []).includes(o.value);
        const input = h('input', {
          type: isRadio ? 'radio' : 'checkbox',
          id, name: base, value: o.value, class: 'chip-input', checked,
          onchange: () => {
            if (isRadio) set(o.value);
            else {
              const cur = new Set(values[f.id] || []);
              if (input.checked) cur.add(o.value); else cur.delete(o.value);
              set(opts.map((x) => x.value).filter((v) => cur.has(v)));
            }
          },
        });
        group.append(h('label', { class: 'chip', for: id }, input, h('span', { class: 'chip-text' }, o.label), o.hint ? h('span', { class: 'chip-hint' }, o.hint) : null));
      });
      add(h('fieldset', {
        class: 'fieldset',
        'aria-describedby': describedBy(hintId, errId),
        'aria-required': f.required ? 'true' : null,
        id: base,
        tabindex: '-1',
      },
      h('legend', { class: 'label' }, h('span', { class: 'label-text' }, f.label), showBadge ? badge(f.required) : null),
      hint, err, group));
      break;
    }

    case 'check': {
      const input = h('input', {
        type: 'checkbox', id: base, name: f.id, class: 'check-input', checked: Boolean(values[f.id]),
        'aria-describedby': describedBy(hintId),
        onchange: (e) => set(e.target.checked),
      });
      add(h('label', { class: 'check', for: base }, input, h('span', { class: 'check-text' }, f.label)), hint);
      break;
    }

    case 'schoolGrade': {
      const cur = values[f.id] || { school: '', grade: '' };
      const gradeSel = h('select', {
        id: `${base}-grade`, class: 'input select', 'aria-describedby': errId,
        onchange: (e) => { values[f.id] = { ...values[f.id], grade: e.target.value }; onChange(f.id); },
      });
      const fillGrades = (school, selected) => {
        clear(gradeSel);
        gradeSel.append(h('option', { value: '' }, school ? '学年を選ぶ' : '先に校種を選ぶ'));
        for (const g of GRADES_BY_SCHOOL[school] || []) gradeSel.append(h('option', { value: g.value, selected: g.value === selected }, g.label));
        gradeSel.disabled = !school;
      };
      const schoolSel = h('select', {
        id: base, class: 'input select', 'aria-describedby': errId,
        onchange: (e) => {
          const school = e.target.value;
          const prev = values[f.id] || {};
          const keep = (GRADES_BY_SCHOOL[school] || []).some((g) => g.value === prev.grade) ? prev.grade : '';
          values[f.id] = { school, grade: keep };
          fillGrades(school, keep);
          onChange(f.id);
        },
      }, h('option', { value: '' }, '校種を選ぶ'), SCHOOL_TYPES.map((s) => h('option', { value: s.value, selected: s.value === cur.school }, s.label)));
      fillGrades(cur.school, cur.grade);
      add(h('fieldset', { class: 'fieldset', 'aria-required': 'true' },
        h('legend', { class: 'label' }, h('span', { class: 'label-text' }, f.label), badge(f.required)),
        hint, err,
        h('div', { class: 'pair' },
          h('div', { class: 'pair-item' }, h('label', { class: 'sublabel', for: base }, '校種'), schoolSel),
          h('div', { class: 'pair-item' }, h('label', { class: 'sublabel', for: `${base}-grade` }, '学年'), gradeSel))));
      break;
    }

    case 'articles': {
      const list = h('div', { class: 'articles' });
      const addBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-add' }, '＋ 記事を追加');
      const draw = (focusIndex = -1) => {
        clear(list);
        const arr = values[f.id] && values[f.id].length ? values[f.id] : [{ heading: '', body: '' }];
        values[f.id] = arr;
        arr.forEach((a, i) => {
          const hid = `${base}-${i}-h`;
          const bid = `${base}-${i}-b`;
          const remove = arr.length > 1
            ? h('button', {
              type: 'button', class: 'btn btn-text btn-remove', 'aria-label': `記事${i + 1}を削除`,
              onclick: () => { arr.splice(i, 1); draw(Math.max(0, i - 1)); onChange(f.id); },
            }, '削除')
            : null;
          const headInput = h('input', {
            id: i === 0 ? base : hid, class: 'input', type: 'text', maxlength: '60', autocomplete: 'off',
            placeholder: i === 0 ? '例：合唱コンクールに向けて' : '見出し',
            value: a.heading, 'aria-describedby': describedBy(hintId, errId),
            oninput: (e) => { a.heading = e.target.value; onChange(f.id); },
          });
          const bodyInput = h('textarea', {
            id: bid, class: 'input textarea', rows: '3', maxlength: '800', autocomplete: 'off',
            placeholder: i === 0 ? '例：朝の練習が始まりました。パートごとに声をそろえています。（名前は書かない）' : '内容メモ（箇条書きでもOK）',
            value: a.body,
            oninput: (e) => { a.body = e.target.value; onChange(f.id); },
          });
          list.append(h('div', { class: 'article' },
            h('div', { class: 'article-head' }, h('span', { class: 'article-no' }, `記事${i + 1}`), remove),
            h('label', { class: 'sublabel', for: i === 0 ? base : hid }, '見出し'), headInput,
            h('label', { class: 'sublabel', for: bid }, '内容メモ'), bodyInput));
          if (i === focusIndex) setTimeout(() => headInput.focus(), 0);
        });
        addBtn.hidden = arr.length >= (f.max || 5);
      };
      addBtn.addEventListener('click', () => {
        values[f.id].push({ heading: '', body: '' });
        draw(values[f.id].length - 1);
        onChange(f.id);
      });
      draw();
      add(h('fieldset', { class: 'fieldset', 'aria-required': 'true' },
        h('legend', { class: 'label' }, h('span', { class: 'label-text' }, f.label), badge(f.required)),
        hint, err, list, addBtn));
      break;
    }

    default:
      add(h('p', {}, `未対応の項目: ${f.type}`));
  }
  return wrap;
}

/** エラー表示の設定・解除 */
export function setFieldError(task, f, message) {
  const base = `${task.id}-${f.id}`;
  const wrap = document.getElementById(`wrap-${base}`);
  const err = document.getElementById(`${base}-err`);
  if (!wrap || !err) return;
  if (message) {
    err.textContent = message;
    err.hidden = false;
    wrap.classList.add('has-error');
  } else {
    err.textContent = '';
    err.hidden = true;
    wrap.classList.remove('has-error');
  }
  wrap.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio') return;
    if (message) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  });
}

/** エラーのある項目にフォーカスを移す */
export function focusField(task, fieldId) {
  const base = `${task.id}-${fieldId}`;
  const wrap = document.getElementById(`wrap-${base}`);
  if (!wrap) return;
  const details = wrap.closest('details');
  if (details) details.open = true;
  const target = wrap.querySelector('input:not([type=hidden]), select, textarea') || wrap;
  wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => target.focus({ preventScroll: true }), 50);
}
