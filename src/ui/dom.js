// 小さなDOM補助。ユーザー入力は必ず textContent / value で扱い、innerHTML には入れない。

/**
 * h('div', {class:'x', onclick: fn, attrs...}, child1, child2...)
 * 子要素の文字列は TextNode として追加される。
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(props || {})) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'text') el.textContent = val;
    else if (key === 'dataset') Object.assign(el.dataset, val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2), val);
    else if (key === 'value') el.value = val;
    else if (key === 'checked' || key === 'selected' || key === 'disabled' || key === 'hidden' || key === 'open' || key === 'required') el[key] = Boolean(val);
    else el.setAttribute(key, val === true ? '' : String(val));
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

let uid = 0;
export function nextId(prefix = 'id') {
  uid += 1;
  return `${prefix}-${uid}`;
}
