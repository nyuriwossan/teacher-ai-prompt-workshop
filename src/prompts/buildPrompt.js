// 共通のプロンプト組み立て：
//   必須入力の検証 → 値のサニタイズ → タスク固有テンプレート → 共通品質規則 → テキスト化
// 外部通信は一切行わない。

import { TEMPLATES } from './taskTemplates.js';
import {
  schoolLabel, formatSchoolGrade, learnerTerm, standardLessonMinutes, GRADES_BY_SCHOOL, LEVEL_OPTIONS,
} from '../data/formOptions.js';
import { getEventById, EVENT_STAGES, MAX_EVENTS } from '../data/schoolEvents.js';
import { ALL_MOTIFS } from '../data/seasonOptions.js';

export const REQUIRED_HEADINGS = ['目的', '対象', '条件・入力情報', '出力形式', '注意事項', '教師が確認する点'];

export const LEVEL_FIELD = {
  id: 'level', label: '依頼文の詳しさ', type: 'radio', group: 'output', default: 'standard', options: LEVEL_OPTIONS, required: true,
};

/** 文字列の選択肢を {value,label} にそろえる */
export function normalizeOptions(options = []) {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

/** タスクのフィールド一覧（共通の「依頼文の詳しさ」を出力設定の先頭に加える） */
export function getFields(task) {
  return [...task.fields, LEVEL_FIELD];
}

export function getField(task, id) {
  return getFields(task).find((f) => f.id === id) || null;
}

export function defaultValueFor(field) {
  switch (field.type) {
    case 'checks':
      return Array.isArray(field.default) ? [...field.default] : [];
    case 'events':
    case 'motifs':
      return [];
    case 'check':
      return Boolean(field.default);
    case 'schoolGrade':
      return { school: '', grade: '' };
    case 'articles':
      return [{ heading: '', body: '' }];
    default:
      return field.default !== undefined ? field.default : '';
  }
}

export function getDefaults(task) {
  const values = {};
  for (const f of getFields(task)) values[f.id] = defaultValueFor(f);
  return values;
}

export function isVisible(field, values) {
  if (!field.showIf) return true;
  const cur = values[field.showIf.field];
  if (Array.isArray(cur)) return cur.some((x) => field.showIf.in.includes(x));
  return field.showIf.in.includes(cur);
}

// ---------- サニタイズ ----------

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value, maxLength = 2000) {
  if (value === null || value === undefined) return '';
  let s = String(value).replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '');
  s = s.split('\n').map((line) => line.replace(/[ \t　]+$/g, '')).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/** 表示中の項目だけを取り出し、型をそろえて整える。非表示・空欄の項目は空にする */
export function cleanValues(task, raw = {}) {
  const out = {};
  const fields = getFields(task);
  // showIf は他の項目の値に依存するので、まず素の値で判定する
  for (const f of fields) {
    const visible = isVisible(f, raw);
    const v = raw[f.id];
    if (!visible) { out[f.id] = emptyFor(f); continue; }
    const options = f.options ? normalizeOptions(f.options) : null;
    switch (f.type) {
      case 'checks': {
        const arr = Array.isArray(v) ? v : [];
        const order = options.map((o) => o.value);
        out[f.id] = order.filter((x) => arr.includes(x));
        break;
      }
      case 'check':
        out[f.id] = Boolean(v);
        break;
      case 'events':
        out[f.id] = cleanEvents(f, v);
        break;
      case 'motifs': {
        const arr = Array.isArray(v) ? v : [];
        out[f.id] = ALL_MOTIFS.filter((m) => arr.includes(m));
        break;
      }
      case 'schoolGrade': {
        const school = v && typeof v === 'object' ? String(v.school || '') : '';
        const grades = GRADES_BY_SCHOOL[school] || [];
        const grade = v && grades.some((g) => g.value === v.grade) ? v.grade : '';
        out[f.id] = { school: GRADES_BY_SCHOOL[school] ? school : '', grade };
        break;
      }
      case 'articles': {
        const arr = Array.isArray(v) ? v : [];
        out[f.id] = arr
          .slice(0, f.max || 5)
          .map((a) => ({ heading: sanitizeText(a?.heading, 60), body: sanitizeText(a?.body, 800) }))
          .filter((a) => a.heading || a.body);
        break;
      }
      case 'select':
      case 'radio': {
        const s = v === undefined || v === null ? '' : String(v);
        out[f.id] = options.some((o) => o.value === s) ? s : '';
        break;
      }
      default:
        out[f.id] = sanitizeText(v, f.maxLength || 2000);
    }
  }
  return out;
}

/**
 * 学校行事の値を整える。マスタにない基本行事は捨て、学校独自の名称はサニタイズする。
 * 値の形：[{ key, base, custom, stage }]
 */
function cleanEvents(field, v) {
  const arr = Array.isArray(v) ? v : [];
  const allowedStages = field.stages ? ['', ...field.stages] : [''];
  const seen = new Set();
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const master = e.key && !String(e.key).startsWith('custom:') ? getEventById(e.key) : null;
    const base = master ? master.name : '';
    const custom = sanitizeText(e.custom, 40).replace(/\n/g, ' ');
    if (!base && !custom) continue;
    const key = master ? master.id : `custom:${custom}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const stage = field.stages && allowedStages.includes(e.stage) && EVENT_STAGES.some((s) => s.value === e.stage) ? e.stage : '';
    out.push({ key, base, custom, stage });
    if (out.length >= MAX_EVENTS) break;
  }
  return out;
}

function emptyFor(field) {
  switch (field.type) {
    case 'events': case 'motifs': return [];
    case 'checks': return [];
    case 'check': return false;
    case 'schoolGrade': return { school: '', grade: '' };
    case 'articles': return [];
    default: return '';
  }
}

// ---------- 検証 ----------

export function validate(task, raw) {
  const values = cleanValues(task, raw);
  const errors = [];
  for (const f of getFields(task)) {
    if (!f.required || !isVisible(f, raw)) continue;
    const v = values[f.id];
    let message = '';
    switch (f.type) {
      case 'schoolGrade':
        if (!v.school) message = '校種を選んでください。';
        else if (!v.grade) message = '学年を選んでください。';
        break;
      case 'checks': {
        const min = f.min || 1;
        if (v.length < min) message = min > 1 ? `${min}つ以上選んでください。` : '1つ以上選んでください。';
        break;
      }
      case 'articles':
        if (!v.length) message = '記事を1つ以上（見出しか内容メモ）書いてください。';
        break;
      case 'select':
      case 'radio':
        if (!v) message = '選んでください。';
        break;
      case 'check':
        break;
      default:
        if (!v) message = '入力してください。';
    }
    if (message) errors.push({ fieldId: f.id, label: f.label, message });
  }
  const tpl = TEMPLATES[task.id];
  if (tpl && typeof tpl.validate === 'function') {
    for (const e of tpl.validate(values) || []) errors.push(e);
  }
  return { ok: errors.length === 0, errors, values };
}

// ---------- テンプレート用の補助 ----------

const LEVEL_ORDER = { short: 0, standard: 1, detailed: 2 };

export function makeContext(task, values) {
  const level = values.level && LEVEL_ORDER[values.level] !== undefined ? values.level : 'standard';
  const rank = LEVEL_ORDER[level];
  const ctx = {
    task,
    level,
    /** 標準以上のときだけ入れる */
    std: (x) => (rank >= 1 ? x : null),
    /** 詳しくのときだけ入れる */
    det: (x) => (rank >= 2 ? x : null),
    /** 短くのときだけ入れる */
    short: (x) => (rank === 0 ? x : null),
    sg: (sg) => formatSchoolGrade(sg),
    schoolName: (sg) => schoolLabel(sg && sg.school),
    learner: (sg) => learnerTerm(sg),
    standardMinutes: (sg) => standardLessonMinutes(sg),
    /** 選択肢の値から表示名を得る */
    label(fieldId, value) {
      const f = getField(task, fieldId);
      if (!f || !f.options) return value || '';
      return normalizeOptions(f.options).find((o) => o.value === value)?.label || value || '';
    },
    list: (arr, sep = '、') => (Array.isArray(arr) ? arr.filter(Boolean).join(sep) : ''),
    /** 「ラベル：値」。値が空なら null。複数行の値は字下げして続ける */
    kv(label, value) {
      if (value === null || value === undefined) return null;
      const s = Array.isArray(value) ? value.filter(Boolean).join('、') : String(value).trim();
      if (!s) return null;
      const [first, ...rest] = s.split('\n');
      return [`${label}：${first}`, ...rest.map((l) => `　${l}`)].join('\n');
    },
    has: (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())),
  };
  return ctx;
}

// ---------- 共通品質規則 ----------

/** 資料を貼る・添付する設定か */
export function usesReference(values) {
  return values.source === 'attach' || values.reference === 'attach' || values.material === 'attach' || values.lastYear === true;
}

function commonCautions(ctx, task, values) {
  const items = [];
  if (ctx.level === 'short') {
    items.push('入力にない日時・場所・学校名・人名などの固有の事実は創作せず、必要な箇所は「（日時）」のような記入欄にしてください。');
    items.push('個人情報を尋ねず、確かでない内容は「要確認」と明記してください。');
  } else {
    items.push('入力にない日時・場所・学校名・人名などの固有の事実は創作しないでください。必要な箇所は「（日時）」「（場所）」のような記入欄として残してください。');
    items.push('児童生徒や保護者の個人情報を尋ねたり、実在の人物を特定できる内容を作ったりしないでください。');
    items.push('事実と提案・推測を区別し、確かでない内容は断定せず「要確認」と明記してください。');
  }
  if (usesReference(values)) {
    items.push('資料を受け取った場合は資料の内容を優先し、資料にない固有の情報を補って創作しないでください。');
  }
  return items;
}

function teacherCheckLead(ctx) {
  return ctx.level === 'short'
    ? '出力の最後に、使う前に教師が確認すべき点を短く挙げてください。'
    : '出力の最後に「使う前に教師が確認すること」として、次の点を含めて箇条書きで示してください。';
}

// ---------- テキスト化 ----------

function cleanItems(items) {
  return (items || [])
    .flat(Infinity)
    .filter((x) => x !== null && x !== undefined && x !== false)
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0);
}

function renderSection(section) {
  const items = cleanItems(section.items);
  if (!items.length) return '';
  const head = `【${section.h}】`;
  if (section.style === 'text') {
    return `${head}\n${items.join('\n')}`;
  }
  if (section.style === 'inline' && items.length === 1 && !items[0].includes('\n')) {
    return `${head}${items[0]}`;
  }
  const lines = items.map((it) => {
    const [first, ...rest] = it.split('\n');
    return [`・${first}`, ...rest.map((r) => (r.startsWith('　') ? r : `　${r}`))].join('\n');
  });
  return `${head}\n${lines.join('\n')}`;
}

/**
 * プロンプトを組み立てる。
 * @returns {{ok:boolean, errors:Array, text:string, values:object, sections:Array}}
 */
export function buildPrompt(task, raw) {
  const { ok, errors, values } = validate(task, raw);
  if (!ok) return { ok, errors, text: '', values, sections: [] };

  const tpl = TEMPLATES[task.id];
  if (!tpl) throw new Error(`テンプレートが未定義です: ${task.id}`);
  const ctx = makeContext(task, values);
  const out = tpl.build(values, ctx);

  const sections = out.sections.filter(Boolean).map((s) => ({ ...s, items: cleanItems(s.items) }));

  // 注意事項・教師が確認する点に共通規則を加える
  let cautions = sections.find((s) => s.h === '注意事項');
  if (!cautions) { cautions = { h: '注意事項', items: [] }; sections.push(cautions); }
  cautions.items = [...cautions.items, ...commonCautions(ctx, task, values)];

  let checks = sections.find((s) => s.h === '教師が確認する点');
  if (!checks) { checks = { h: '教師が確認する点', items: [] }; sections.push(checks); }
  // 教師確認は最後に置く
  sections.splice(sections.indexOf(checks), 1);
  sections.push(checks);
  const checkItems = [...checks.items];
  checks.style = 'text';
  checks.items = [teacherCheckLead(ctx), ...checkItems.map((c) => `・${c}`)];

  const body = sections.map(renderSection).filter(Boolean);
  const text = [out.role, ...body, out.closing].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  return { ok: true, errors: [], text, values, sections };
}

/** 生成結果に、空見出しや未定義値が残っていないかを点検する（テスト・開発用） */
export function findOutputProblems(text) {
  const problems = [];
  if (/undefined|null|NaN|\[object Object\]/.test(text)) problems.push('未定義の値が含まれています');
  if (/\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(text)) problems.push('置換されていないプレースホルダーがあります');
  if (/【[^】]+】\s*(\n\s*)*(【|$)/.test(text)) problems.push('空の見出しがあります');
  if (/：\s*$/m.test(text)) problems.push('値のない「ラベル：」があります');
  return problems;
}
