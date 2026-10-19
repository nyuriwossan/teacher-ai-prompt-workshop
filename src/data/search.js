// 困りごと検索。正式に実装した16フォームと、安全案内（SAFETY_GUIDES）の言い換え語だけを対象にする。

import { TASKS } from './taskCatalog.js';
import { SAFETY_GUIDES } from '../safety/policy.js';

/** 全角・半角、カタカナ・ひらがな、大文字・小文字の違いをならす */
export function normalize(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s、。・,.!?！？「」『』（）()〜~ー－\-／/]+/g, '');
}

function scoreTerms(q, terms, weight) {
  let score = 0;
  for (const raw of terms) {
    const t = normalize(raw);
    if (!t) continue;
    if (t.length >= 2 && q.includes(t)) score += weight * Math.min(t.length, 6);
    else if (q.length >= 2 && t.includes(q)) score += weight * Math.min(q.length, 6) * 0.8;
  }
  return score;
}

export function searchTasks(query) {
  const q = normalize(query);
  if (!q) return [];
  return TASKS
    .map((t) => ({
      task: t,
      score: scoreTerms(q, [t.title], 3) + scoreTerms(q, t.keywords, 2) + scoreTerms(q, [t.short], 1),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.task);
}

export function searchGuides(query) {
  const q = normalize(query);
  if (!q) return [];
  return SAFETY_GUIDES
    .map((g) => ({ guide: g, score: scoreTerms(q, g.keywords, 2) + scoreTerms(q, [g.title], 1) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.guide);
}
