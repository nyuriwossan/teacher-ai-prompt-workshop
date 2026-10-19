// クリップボードへのコピー。外部には送らない。
// navigator.clipboard が使えない環境（古いiOS、非HTTPSなど）では選択＋execCommandで代替する。

export async function copyText(text, fallbackEl) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // 下の代替手段へ
  }
  return legacyCopy(text, fallbackEl);
}

function legacyCopy(text, fallbackEl) {
  let el = fallbackEl;
  let temp = null;
  if (!el) {
    temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.className = 'visually-hidden';
    document.body.appendChild(temp);
    el = temp;
  }
  const prevReadOnly = el.readOnly;
  el.readOnly = true; // iOSでキーボードを出さない
  el.focus({ preventScroll: true });
  el.select();
  try { el.setSelectionRange(0, el.value.length); } catch (_) { /* noop */ }
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  el.readOnly = prevReadOnly;
  if (temp) temp.remove();
  return ok;
}
