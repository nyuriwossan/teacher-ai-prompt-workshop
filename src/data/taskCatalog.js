// 16系統の困りごとフォーム定義。
// フォームはデータで定義し、UI・検証・プロンプト生成は共通処理で行う。
//
// field.group: 'basic'（最初に見える）/ 'advanced'（「詳しく設定する」に折りたたみ）/ 'output'（出力の設定）
// field.type : text / textarea / select / radio / checks / check / schoolGrade / articles
// field.showIf: { field: 'id', in: [...] } 条件に合うときだけ表示・使用する
//
// 安全の別軸（指示書5章）:
//   workflow   : prompt_only / reference_needed / specialized_computation / human_decision_required
//   sensitivity: generic / caution / sensitive
//   review     : normal / heightened / expert_or_school_authority
// researchRefs は調査資料（再構築データ）の参照項目。仕様の根拠ではなく参考。

import {
  SUBJECT_SUGGESTIONS, ICT_SERVICE_SUGGESTIONS,
  DELIVERY_DOC, DELIVERY_TABLE, DELIVERY_PLAIN, PAPER_PRINT,
} from './formOptions.js';

export const CATEGORIES = [
  { id: 'lesson', label: '授業' },
  { id: 'material', label: '教材' },
  { id: 'document', label: '文書・連絡' },
  { id: 'design', label: 'デザイン・画像' },
  { id: 'table', label: '表・予定' },
  { id: 'assessment', label: '評価' },
  { id: 'admin', label: '行事・校務' },
  { id: 'ict', label: 'ICT・その他' },
];

/** トップに大きく出す「よく使う困りごと」 */
export const POPULAR_TASK_IDS = ['F01', 'F02', 'F05', 'F06', 'F07', 'F09', 'F15', 'F16'];

const sgField = (overrides = {}) => ({
  id: 'schoolGrade', label: '校種・学年', type: 'schoolGrade', required: true, group: 'basic', ...overrides,
});

const subjectField = (overrides = {}) => ({
  id: 'subject', label: '教科・領域', type: 'text', required: true, group: 'basic',
  placeholder: '例：国語、算数、理科、学級活動', datalist: SUBJECT_SUGGESTIONS, maxLength: 40, ...overrides,
});

const deliveryField = (options, def, overrides = {}) => ({
  id: 'delivery', label: '仕上がりの使い方', type: 'radio', group: 'output', options, default: def, ...overrides,
});

const paperField = (def = 'A4縦', overrides = {}) => ({
  id: 'paper', label: '用紙', type: 'select', group: 'output', options: PAPER_PRINT, default: def, ...overrides,
});

const monoField = (def = false, overrides = {}) => ({
  id: 'mono', label: 'モノクロ印刷で読みやすくする', type: 'check', group: 'output', default: def, ...overrides,
});

export const TASKS = [
  // ---------------------------------------------------------------- F01
  {
    id: 'F01',
    slug: 'lesson-flow',
    title: '授業の流れ・発問を考えたい',
    short: '時間配分つきの授業展開、導入、発問、振り返り',
    categories: ['lesson'],
    icon: '📘',
    keywords: ['授業案', '指導案', '授業展開', '展開', '流れ', '導入', '発問', '問い', '板書', '振り返り', 'めあて', '明日の授業', '授業準備', '単元計画', '学習活動'],
    scope: {
      can: '授業1時間分の流れ、導入・発問・想定反応・振り返りの案をAIに頼む依頼文を作ります。',
      cannot: '学級の個別の児童生徒に合わせた指導判断は、先生ご自身が行ってください。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP001', 'TP002', 'TP003', 'TP004', 'TP066', 'TP074'],
    fields: [
      sgField(),
      subjectField(),
      { id: 'unit', label: '単元・題材', type: 'text', required: true, group: 'basic', placeholder: '例：「走れメロス」、分数のわり算、てこのはたらき', maxLength: 80 },
      { id: 'goal', label: 'この時間のねらい（到達目標）', type: 'textarea', required: true, group: 'basic', placeholder: '例：登場人物の心情の変化を、本文の表現を根拠に説明できる。', maxLength: 400 },
      { id: 'duration', label: '授業時間', type: 'select', required: true, group: 'basic', default: 'standard',
        options: [
          { value: 'standard', label: '1単位時間（校種の標準）' },
          { value: '15分', label: '15分（短時間学習）' },
          { value: '20分', label: '20分' },
          { value: '45分', label: '45分' },
          { value: '50分', label: '50分' },
          { value: '65分', label: '65分' },
          { value: '90分（2コマ続き）', label: '90分（2コマ続き）' },
          { value: '100分（2コマ続き）', label: '100分（2コマ続き）' },
        ] },
      { id: 'style', label: '授業スタイル（いくつでも）', type: 'checks', group: 'basic',
        options: ['一斉指導が中心', 'ペア・グループ活動', '話し合い・討論', 'ICT（1人1台端末）を活用', '探究・課題解決型', '実験・観察・実習', '個別学習・自由進度'],
        hint: '選ばなければ、ねらいに合う形をAIに提案してもらいます。' },
      { id: 'position', label: '単元の中での位置', type: 'text', group: 'advanced', placeholder: '例：全6時間中の3時間目', maxLength: 60 },
      { id: 'classContext', label: '学級全体の様子（個人が特定できる内容は書かない）', type: 'textarea', group: 'advanced', placeholder: '例：話し合いは活発だが、根拠を挙げるのが苦手な生徒が多い。', maxLength: 400 },
      { id: 'resources', label: '使える教材・機器', type: 'text', group: 'advanced', placeholder: '例：教科書、1人1台端末、ホワイトボード', maxLength: 120 },
      { id: 'include', label: '追加で入れてほしいもの', type: 'checks', group: 'advanced',
        options: ['板書計画', '想定される反応と切り返し', '評価の観点と見取り方', 'ワークシートの案', 'つまずきへの手立て（一般的なもの）', '早く終わった人向けの発展課題'],
        default: ['想定される反応と切り返し'] },
      { id: 'proposals', label: '案の数', type: 'radio', group: 'output', options: ['1案', '2案', '3案'], default: '1案' },
      { id: 'planFormat', label: '書き方', type: 'radio', group: 'output',
        options: [
          { value: 'table', label: '表（時間・学習活動・留意点）' },
          { value: 'list', label: '箇条書き' },
          { value: 'prose', label: '文章で説明' },
        ], default: 'table' },
      deliveryField(DELIVERY_PLAIN, 'text'),
    ],
  },

  // ---------------------------------------------------------------- F02
  {
    id: 'F02',
    slug: 'worksheet-quiz',
    title: 'ワークシート・小テストを作りたい',
    short: '配布用の問題、解答・解説、難易度の調整',
    categories: ['material'],
    icon: '📝',
    keywords: ['ワークシート', 'プリント', '小テスト', 'テスト', '確認問題', '問題', '宿題', '復習', '練習問題', '穴埋め', '確認テスト', '家庭学習', 'ドリル'],
    scope: {
      can: '単元・ねらい・問題形式・問題数・難易度を指定して、問題と解答・解説をAIに作ってもらう依頼文を作ります。',
      cannot: '教科書や市販教材の問題をそのまま写すことは頼みません。正答の確認は必ず先生が行ってください。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP005', 'TP006', 'TP065', 'TP070', 'TP071', 'TP072'],
    fields: [
      { id: 'kind', label: '作りたいもの', type: 'radio', required: true, group: 'basic', default: '小テスト',
        options: ['小テスト', 'ワークシート', '授業中の確認問題', '宿題・家庭学習プリント', '復習プリント'] },
      sgField(),
      subjectField(),
      { id: 'unit', label: '単元・題材', type: 'text', required: true, group: 'basic', placeholder: '例：一次関数、漢字の部首、江戸時代の政治', maxLength: 80 },
      { id: 'aim', label: '何を確認・練習したいか', type: 'textarea', required: true, group: 'basic', placeholder: '例：変化の割合を求められるか、グラフから式を読み取れるか', maxLength: 400 },
      { id: 'questionTypes', label: '問題の形式（いくつでも）', type: 'checks', group: 'basic',
        options: ['選択式', '穴埋め', '一問一答', '○×', '並べ替え', '計算', '記述（短文）', '記述（長文）', '資料・図の読み取り'],
        hint: '選ばなければ、ねらいに合う形式をAIに選んでもらいます。' },
      { id: 'questionCount', label: '問題数', type: 'select', required: true, group: 'basic', default: '10',
        options: ['3', '5', '8', '10', '12', '15', '20', '30'].map((n) => ({ value: n, label: `${n}問` })) },
      { id: 'difficulty', label: '難易度', type: 'radio', required: true, group: 'basic', default: '標準',
        options: ['基礎中心', '標準', '発展を含む', '基礎から発展へ段階的に'] },
      { id: 'answerMode', label: '解答・解説', type: 'radio', required: true, group: 'basic', default: 'separate-explain',
        options: [
          { value: 'separate-explain', label: '解答と解説を別紙に' },
          { value: 'separate', label: '解答のみ別紙に' },
          { value: 'inline', label: '各問題の直後に解答' },
          { value: 'none', label: '解答はいらない' },
        ] },
      { id: 'timeLimit', label: '解答時間の目安', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '5分', '10分', '15分', '20分', '30分', '45分', '50分'] },
      { id: 'rangeNotes', label: '出題範囲・既習事項', type: 'textarea', group: 'advanced', placeholder: '例：教科書p.40〜52の内容まで。連立方程式は未習。', maxLength: 300 },
      { id: 'extras', label: '追加の指定', type: 'checks', group: 'advanced',
        options: ['配点をつける', 'ヒント欄をつける', '名前・日付の記入欄をつける', '自己採点欄をつける', 'ふりがなをつける'] },
      { id: 'avoid', label: '避けたいこと', type: 'text', group: 'advanced', placeholder: '例：ひっかけ問題、計算が煩雑すぎる数値', maxLength: 150 },
      paperField('A4縦'),
      monoField(true),
      deliveryField(DELIVERY_DOC, 'word'),
    ],
  },

  // ---------------------------------------------------------------- F03
  {
    id: 'F03',
    slug: 'explain-simply',
    title: '難しい内容を分かりやすくしたい',
    short: 'やさしい日本語、身近な例、たとえ、理解確認の問い',
    categories: ['lesson', 'material'],
    icon: '💡',
    keywords: ['分かりやすく', 'わかりやすく', '説明', 'やさしい日本語', '言い換え', 'たとえ', '比喩', '具体例', '例え話', '日本語指導', '難しい言葉', '語彙', 'かみくだく'],
    scope: {
      can: '学年に合わせた説明、身近な例や比喩、理解を確かめる問いをAIに作ってもらう依頼文を作ります。',
      cannot: '内容の正確さは教科書などで先生が確認してください。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP007', 'TP031', 'TP033', 'TP073'],
    fields: [
      sgField({ label: '対象の校種・学年' }),
      { id: 'topic', label: '説明したい内容', type: 'textarea', required: true, group: 'basic', placeholder: '例：光合成のしくみ／「比例」と「反比例」のちがい／三権分立', maxLength: 600 },
      { id: 'vocab', label: 'ことばの難しさ', type: 'radio', required: true, group: 'basic', default: 'grade',
        options: [
          { value: 'grade', label: '学年相応' },
          { value: 'lower', label: '1〜2学年下の語彙で' },
          { value: 'easy-ja', label: 'やさしい日本語（日本語を学んでいる人向け）' },
          { value: 'advanced', label: '少し発展的に' },
        ] },
      { id: 'methods', label: '説明のしかた（いくつでも）', type: 'checks', group: 'basic',
        options: ['身近な具体例', 'たとえ（比喩）', '図や絵にする案', '手順に分けて', '会話形式', 'クイズ形式', 'よくある誤解との比較'],
        default: ['身近な具体例', 'たとえ（比喩）'] },
      { id: 'scene', label: '使う場面', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '授業で口頭で説明する', 'プリントに載せる', 'スライドで見せる', '板書する', '家庭学習で読む'] },
      { id: 'length', label: '説明の長さ', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '1分程度で話せる長さ', '3分程度で話せる長さ', 'プリント半分程度', 'プリント1枚程度'] },
      { id: 'misconceptions', label: 'つまずきやすい点', type: 'textarea', group: 'advanced', placeholder: '例：「光合成」と「呼吸」を混同しやすい', maxLength: 300 },
      { id: 'furigana', label: '漢字にふりがなをつける', type: 'check', group: 'advanced', default: false },
      { id: 'checkQuestions', label: '理解を確かめる問いもつける', type: 'check', group: 'output', default: true },
      deliveryField(DELIVERY_PLAIN, 'text'),
    ],
  },

  // ---------------------------------------------------------------- F04
  {
    id: 'F04',
    slug: 'leveled-materials',
    title: '教材をレベル別にしたい',
    short: '同じ目標で、基礎・標準・発展などの複数版',
    categories: ['material'],
    icon: '🪜',
    keywords: ['レベル別', '難易度別', '段階別', '個別最適', '習熟度', '基礎', '発展', '補充', 'やさしい版', '読みやすく', '教材調整', '分量を減らす', '支援'],
    scope: {
      can: '同じ学習目標のまま、段階の違う教材を複数つくる依頼文を作ります。元教材は工房には入れず、利用が認められたAIに直接渡します。',
      cannot: '障害や診断名をもとに教材を決めたり、支援の要否を判定したりする依頼は作りません。',
    },
    workflow: 'reference_needed', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP008', 'TP029', 'TP098', 'TP099'],
    fields: [
      sgField(),
      subjectField(),
      { id: 'commonGoal', label: '全員に共通する学習目標', type: 'textarea', required: true, group: 'basic', placeholder: '例：説明文の段落の役割を理解し、要旨をまとめられる。', maxLength: 400 },
      { id: 'source', label: '元になる教材', type: 'radio', required: true, group: 'basic', default: 'attach',
        options: [
          { value: 'attach', label: 'ある（AIに貼る・添付する）' },
          { value: 'none', label: 'ない（新しく作る）' },
        ],
        hint: '元教材はこの工房には入力しません。著作物の場合は利用条件を確認してください。' },
      { id: 'levels', label: '作りたい段階（2つ以上）', type: 'checks', required: true, min: 2, group: 'basic',
        options: ['基礎', '標準', '発展', 'やさしい日本語版', '視覚的な手がかりを増やした版', '分量を減らした版', 'ヒントつき版'],
        default: ['基礎', '標準', '発展'] },
      { id: 'materialSummary', label: '教材の種類・内容の概要', type: 'text', group: 'advanced', placeholder: '例：説明文「〇〇」の読解ワークシート（問題5問）', maxLength: 150 },
      { id: 'considerations', label: '学級全体として配慮したいこと（個人が特定できる内容は書かない）', type: 'textarea', group: 'advanced', placeholder: '例：長い文章を読むのに時間がかかる人が一定数いる。', maxLength: 300 },
      { id: 'labelStyle', label: '段階の呼び方', type: 'radio', group: 'advanced', default: 'neutral',
        options: [
          { value: 'neutral', label: '序列を感じにくい名前（コースA・Bなど）' },
          { value: 'plain', label: '基礎・標準・発展のまま' },
        ] },
      paperField('A4縦'),
      monoField(true),
      deliveryField(DELIVERY_DOC, 'word'),
    ],
  },

  // ---------------------------------------------------------------- F05
  {
    id: 'F05',
    slug: 'class-newsletter',
    title: '学級通信・学年だよりを作りたい',
    short: '見出しと本文のそろった通信原稿、写真の仮枠',
    categories: ['document'],
    icon: '📰',
    keywords: ['学級通信', '学年だより', '学校だより', '通信', 'おたより', 'お便り', 'たより', 'だより', 'ニュースレター', '便り', '学年通信', '部活動だより'],
    scope: {
      can: '書きたい記事のメモから、見出しと本文の整った通信原稿をAIに作ってもらう依頼文を作ります。写真はWord等で後から入れる枠として頼みます。',
      cannot: 'この工房が通信のファイルやPDFを作るわけではありません。児童生徒の名前は入力しないでください。',
    },
    workflow: 'prompt_only', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP019', 'TP042', 'TP124'],
    fields: [
      { id: 'kind', label: '通信の種類', type: 'radio', required: true, group: 'basic', default: '学級通信',
        options: ['学級通信', '学年だより', '学校だより', '部活動だより'] },
      sgField({ label: '校種・学年（読者の学年）' }),
      { id: 'articles', label: '載せたい記事（見出しと内容メモ）', type: 'articles', required: true, group: 'basic', max: 5,
        hint: '1記事につき見出しと内容メモを書きます。児童生徒の名前や個別のできごとは書かないでください。' },
      { id: 'audience', label: 'おもな読者', type: 'radio', required: true, group: 'basic', default: 'parents',
        options: [
          { value: 'parents', label: '保護者' },
          { value: 'both', label: '児童生徒と保護者' },
          { value: 'students', label: '児童生徒' },
        ] },
      { id: 'title', label: '通信のタイトル', type: 'text', group: 'advanced', placeholder: '例：かがやき（空欄ならAIに案を出してもらいます）', maxLength: 40 },
      { id: 'season', label: '時期・季節', type: 'text', group: 'advanced', placeholder: '例：10月、2学期の後半', maxLength: 40 },
      { id: 'notices', label: '家庭への連絡・お願い', type: 'textarea', group: 'advanced', placeholder: '例：来週から衣替え移行期間です。上着に記名をお願いします。', maxLength: 400 },
      { id: 'tone', label: '文体', type: 'radio', group: 'advanced', default: 'warm',
        options: [
          { value: 'warm', label: '敬体で温かく' },
          { value: 'concise', label: '敬体で簡潔に' },
          { value: 'friendly', label: '親しみやすく（読者が児童生徒中心）' },
        ] },
      paperField('A4縦', { options: PAPER_PRINT.filter((p) => ['A4縦', 'A4横', 'B4縦', 'B4横', 'B5縦'].includes(p.value)) }),
      { id: 'pages', label: '枚数', type: 'radio', group: 'output', default: '1枚', options: ['1枚', '2枚（表裏）'] },
      { id: 'photoSlots', label: '写真・イラストを後から入れる枠', type: 'select', group: 'output', default: '0',
        options: [{ value: '0', label: 'なし' }, { value: '1', label: '1つ' }, { value: '2', label: '2つ' }, { value: '3', label: '3つ' }, { value: '4', label: '4つ' }] },
      monoField(true),
      deliveryField(DELIVERY_DOC, 'word'),
    ],
  },

  // ---------------------------------------------------------------- F06
  {
    id: 'F06',
    slug: 'parent-notice',
    title: '保護者向けのお知らせ・メールを作りたい',
    short: '丁寧な連絡文・案内文と件名',
    categories: ['document'],
    icon: '✉️',
    keywords: ['保護者', 'お知らせ', '案内', 'メール', '連絡', '連絡文', '配信', '手紙', '敬語', 'お願い', '依頼文', 'リマインド', '持ち物', '日程変更', '懇談', '面談案内', 'お礼'],
    scope: {
      can: '学級・学年などの保護者全体に送るお知らせやメールの文案をAIに頼む依頼文を作ります。',
      cannot: '特定の家庭への個別対応（欠席・成績・トラブル・苦情など）の文面は、個別の事情を入力せず、管理職と相談しながら進めてください。',
    },
    workflow: 'prompt_only', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP034', 'TP035', 'TP107', 'TP108', 'TP128'],
    fields: [
      { id: 'medium', label: '送る形', type: 'radio', required: true, group: 'basic', default: 'letter',
        options: [
          { value: 'letter', label: 'お知らせ文書（紙・配信）' },
          { value: 'mail', label: 'メール・連絡アプリ' },
        ] },
      { id: 'audience', label: '宛先', type: 'radio', required: true, group: 'basic', default: 'class',
        options: [
          { value: 'class', label: '学級の保護者' },
          { value: 'grade', label: '学年の保護者' },
          { value: 'school', label: '全校の保護者' },
          { value: 'individual', label: '特定の保護者（個別連絡）' },
        ] },
      { id: 'purpose', label: '連絡の目的', type: 'select', required: true, group: 'basic', default: '',
        options: [{ value: '', label: '選んでください' }, '行事の案内', '持ち物・提出物のお願い', '日程変更のお知らせ', '面談・懇談会の案内', '注意喚起・お願い', 'お礼', 'その他'] },
      { id: 'facts', label: '伝える事実', type: 'textarea', required: true, group: 'basic', placeholder: '例：11月8日（金）の校外学習は雨天の場合11日（月）に延期。お弁当と水筒が必要。', maxLength: 600,
        hint: '日時・場所・持ち物など、確定している事実だけを書きます。' },
      { id: 'requests', label: '保護者にお願いしたいこと', type: 'textarea', group: 'advanced', placeholder: '例：参加票を11月1日までに担任へ提出', maxLength: 300 },
      { id: 'contact', label: '問い合わせ先の書き方', type: 'text', group: 'advanced', placeholder: '例：「担任まで」（電話番号・個人名は書かない）', maxLength: 60 },
      { id: 'tone', label: '文体', type: 'radio', group: 'advanced', default: 'polite',
        options: [
          { value: 'polite', label: '丁寧（標準）' },
          { value: 'more-polite', label: 'より丁寧（おわびを含むなど）' },
          { value: 'concise', label: '簡潔に' },
        ] },
      { id: 'length', label: '分量', type: 'radio', group: 'output', default: 'standard',
        options: [
          { value: 'short', label: '短め' },
          { value: 'standard', label: '標準' },
          { value: 'long', label: '詳しめ' },
        ] },
      { id: 'variants', label: '文案の数', type: 'radio', group: 'output', default: '1案', options: ['1案', '2案（雰囲気違い）'] },
      { id: 'easyJapanese', label: 'やさしい日本語版も作る', type: 'check', group: 'output', default: false },
      deliveryField(DELIVERY_PLAIN, 'text'),
    ],
  },

  // ---------------------------------------------------------------- F07
  {
    id: 'F07',
    slug: 'illustration',
    title: '教材用イラスト・挿絵を作りたい',
    short: '画像生成AIに渡す、詳しい生成指示文',
    categories: ['design'],
    icon: '🎨',
    keywords: ['イラスト', '挿絵', 'さし絵', '画像', '絵', 'カット', '画像生成', 'イメージ', '図', 'クリップアート', '素材', 'アイコン', 'ぬりえ'],
    scope: {
      can: '画像生成AIに貼り付ける、用途・主題・画風・構図・色・避けるものを明記した指示文を作ります。',
      cannot: 'この工房が画像を描くわけではありません。実在の児童生徒の顔や容姿の再現は頼みません。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP028', 'TP132'],
    fields: [
      { id: 'use', label: '使う場所', type: 'select', required: true, group: 'basic', default: '',
        options: [{ value: '', label: '選んでください' }, '学級通信・おたより', 'プリント・ワークシート', '掲示物', 'スライド', 'カード・教具', '学習のめあてカード'] },
      { id: 'subject', label: '描きたいもの・場面', type: 'textarea', required: true, group: 'basic', placeholder: '例：落ち葉のある校庭と秋の樹木', maxLength: 300 },
      { id: 'style', label: '絵柄', type: 'select', required: true, group: 'basic', default: 'シンプルな線画',
        options: ['シンプルな線画', 'やわらかい水彩風', '明るいポップなイラスト', 'ピクトグラム風（記号的）', '切り絵・ちぎり絵風', '色鉛筆風', '写実的（実在しない風景や物）'] },
      { id: 'aspect', label: '縦横比', type: 'radio', required: true, group: 'basic', default: '横長（3:2）',
        options: ['横長（16:9）', '横長（3:2）', '正方形（1:1）', '縦長（2:3）', '縦長（9:16）'] },
      { id: 'color', label: '色', type: 'radio', required: true, group: 'basic', default: 'color',
        options: [
          { value: 'color', label: 'カラー' },
          { value: 'pale', label: '淡い色' },
          { value: 'mono', label: 'モノクロ（白黒）' },
          { value: 'lineart', label: 'ぬりえ用の線画' },
        ] },
      { id: 'background', label: '背景', type: 'radio', group: 'advanced', default: 'subtle',
        options: [
          { value: 'subtle', label: '控えめな背景' },
          { value: 'full', label: '背景まで描く' },
          { value: 'white', label: '白背景（切り抜きやすく）' },
          { value: 'transparent', label: '透明背景（対応していれば）' },
        ] },
      { id: 'people', label: '人物', type: 'radio', group: 'advanced', default: 'none',
        options: [
          { value: 'none', label: '人物は描かない' },
          { value: 'small', label: '小さく・後ろ姿など' },
          { value: 'generic', label: '特定の人物ではないデフォルメの子ども' },
        ] },
      { id: 'textMode', label: '画像内の文字', type: 'radio', group: 'advanced', default: 'none',
        options: [
          { value: 'none', label: '文字は入れない' },
          { value: 'some', label: '短い文字を入れる' },
        ] },
      { id: 'textContent', label: '入れる文字', type: 'text', group: 'advanced', placeholder: '例：あきのたより', maxLength: 30,
        showIf: { field: 'textMode', in: ['some'] } },
      { id: 'printSize', label: '掲載する大きさ', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '紙面に小さく配置', '紙面の4分の1程度', '紙面の半分程度', '全面・大きく'] },
      { id: 'avoid', label: '避けたいもの', type: 'textarea', group: 'advanced', placeholder: '例：怖い表情、細かすぎる装飾', maxLength: 200 },
      { id: 'variants', label: '出してほしい案の数', type: 'radio', group: 'output', default: '1案', options: ['1案', '2案', '4案'] },
      { id: 'altPrompt', label: '画像を作れないAIなら、画像生成AI用の指示文（日本語・英語）を書いてもらう', type: 'check', group: 'output', default: true },
    ],
  },

  // ---------------------------------------------------------------- F08
  {
    id: 'F08',
    slug: 'layout-design',
    title: '掲示物・スライド・プリントをデザインしたい',
    short: 'レイアウトや配色をAIに相談する指示文',
    categories: ['design', 'material'],
    icon: '🖼️',
    keywords: ['掲示物', 'ポスター', 'スライド', 'プレゼン', 'デザイン', 'レイアウト', '配置', '見た目', '掲示', 'めあて', 'しおり', 'チラシ', '配色', 'パワポ', 'PowerPoint', 'Canva'],
    scope: {
      can: '掲載内容と用紙・比率、雰囲気を指定して、構成・レイアウト・配色をAIに頼む依頼文を作ります。',
      cannot: '実在のロゴやキャラクターを使うデザインは頼みません。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP058', 'TP131', 'TP133'],
    fields: [
      { id: 'kind', label: '作りたいもの', type: 'select', required: true, group: 'basic', default: '',
        options: [{ value: '', label: '選んでください' }, '掲示物・ポスター', 'スライド（授業・説明会）', '配布プリント', '学習のめあて・ルールの掲示', 'カード・しおり', '案内チラシ'] },
      { id: 'content', label: '載せる内容', type: 'textarea', required: true, group: 'basic', placeholder: '例：「廊下は右側を歩こう」の呼びかけ。理由を2つ。', maxLength: 800 },
      { id: 'audience', label: '見る人', type: 'radio', required: true, group: 'basic', default: 'students',
        options: [
          { value: 'students', label: '児童生徒' },
          { value: 'parents', label: '保護者' },
          { value: 'staff', label: '教職員' },
          { value: 'visitors', label: '地域・来校者' },
        ] },
      { id: 'size', label: '用紙・比率', type: 'select', required: true, group: 'basic', default: 'A4縦',
        options: ['A4縦', 'A4横', 'A3縦', 'A3横', 'B4縦', 'B4横', 'スライド16:9', 'スライド4:3', 'はがき・カードサイズ'] },
      { id: 'mood', label: '雰囲気', type: 'checks', group: 'basic',
        options: ['落ち着いた', '明るく親しみやすい', '季節感', 'シンプルで読みやすい', '色覚の多様性に配慮', '遠くからでも読める'],
        default: ['シンプルで読みやすい'] },
      { id: 'grade', label: '対象の学年', type: 'text', group: 'advanced', placeholder: '例：小学3年', maxLength: 30, showIf: { field: 'audience', in: ['students'] } },
      { id: 'slideCount', label: 'スライドの枚数', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '1枚', '3枚', '5枚', '8枚', '10枚', '15枚'],
        showIf: { field: 'size', in: ['スライド16:9', 'スライド4:3'] } },
      { id: 'colors', label: '使いたい色', type: 'text', group: 'advanced', placeholder: '例：紺と黄色、学年カラーの緑', maxLength: 60 },
      { id: 'imageSlots', label: '写真・イラストを後から入れる枠', type: 'select', group: 'advanced', default: '0',
        options: [{ value: '0', label: 'なし' }, { value: '1', label: '1つ' }, { value: '2', label: '2つ' }, { value: '3', label: '3つ' }] },
      { id: 'tool', label: '作るときに使うソフト', type: 'select', group: 'output', default: '',
        options: [{ value: '', label: '指定しない' }, 'PowerPoint', 'Googleスライド', 'Canva', 'Word', 'Googleドキュメント', 'Keynote'] },
      monoField(false),
    ],
  },

  // ---------------------------------------------------------------- F09
  {
    id: 'F09',
    slug: 'table-template',
    title: '時間割表・当番表・予定表の形を作りたい',
    short: '配布・掲示用の表の雛形（空欄でもOK）',
    categories: ['table'],
    icon: '📅',
    keywords: ['時間割', '時間割表', '当番表', '当番', '掃除当番', '給食当番', '日直', '予定表', '週予定', '月予定', '行事予定', 'カレンダー', '係', '分担表', 'チェック表', '提出物', '表', '雛形', 'ひな形', 'テンプレート'],
    scope: {
      can: '時間割表・当番表・予定表などの「表の形（雛形）」をAIに作ってもらう依頼文を作ります。',
      cannot: '教科・先生・教室を条件に合わせて割り当てる「時間割の編成」はこのフォームでは扱いません（専用ツールや手作業での検算が必要です）。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP087', 'TP089', '（TP044の時間割編成とは別業務）'],
    fields: [
      { id: 'tableType', label: '表の種類', type: 'select', required: true, group: 'basic', default: '時間割表',
        options: ['時間割表', '週の予定表', '月の予定表', '当番表（掃除・給食・日直など）', '係・役割分担表', '提出物チェック表'] },
      { id: 'days', label: '曜日', type: 'checks', required: true, group: 'basic', min: 1,
        options: ['月', '火', '水', '木', '金', '土'], default: ['月', '火', '水', '木', '金'],
        showIf: { field: 'tableType', in: ['時間割表', '週の予定表', '当番表（掃除・給食・日直など）'] } },
      { id: 'periods', label: '時限（コマ）の数', type: 'select', required: true, group: 'basic', default: '6',
        options: ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => ({ value: n, label: `${n}時限` })),
        showIf: { field: 'tableType', in: ['時間割表', '週の予定表'] } },
      { id: 'groups', label: '班・グループの数', type: 'select', required: true, group: 'basic', default: '6',
        options: ['2', '3', '4', '5', '6', '7', '8', '9', '10'].map((n) => ({ value: n, label: `${n}班` })),
        showIf: { field: 'tableType', in: ['当番表（掃除・給食・日直など）', '係・役割分担表'] } },
      { id: 'duties', label: '当番・係の種類', type: 'text', group: 'basic', placeholder: '例：教室、廊下、黒板、配膳、牛乳', maxLength: 120,
        showIf: { field: 'tableType', in: ['当番表（掃除・給食・日直など）', '係・役割分担表'] } },
      { id: 'monthLayout', label: '月の予定表の形', type: 'radio', group: 'basic', default: 'calendar',
        options: [{ value: 'calendar', label: 'カレンダー型' }, { value: 'list', label: '日付の一覧型' }],
        showIf: { field: 'tableType', in: ['月の予定表'] } },
      { id: 'checkRows', label: '行の数（人数分など）', type: 'select', group: 'basic', default: '35',
        options: ['10', '20', '25', '30', '35', '40'].map((n) => ({ value: n, label: `${n}行` })),
        showIf: { field: 'tableType', in: ['提出物チェック表'] } },
      { id: 'fillMode', label: '表の中身', type: 'radio', required: true, group: 'basic', default: 'blank',
        options: [
          { value: 'blank', label: '空欄の雛形（あとで手書き・入力）' },
          { value: 'given', label: '自分で入力した内容を入れる' },
        ] },
      { id: 'contentText', label: '表に入れる内容', type: 'textarea', required: true, group: 'basic', maxLength: 1000,
        placeholder: '例：月1 国語、月2 算数…（入力した内容だけが表に入ります）',
        hint: '個人名は入れず、班番号や役割名で書くことをおすすめします。',
        showIf: { field: 'fillMode', in: ['given'] } },
      { id: 'extraRows', label: '入れたい行・欄', type: 'checks', group: 'advanced',
        options: ['時刻欄', '朝の会・朝学習', '給食', '昼休み', '清掃', '帰りの会', '放課後', '持ち物欄', 'メモ欄'],
        showIf: { field: 'tableType', in: ['時間割表', '週の予定表'] } },
      { id: 'titleText', label: '表のタイトル', type: 'text', group: 'advanced', placeholder: '例：2学期 時間割（空欄なら記入欄にします）', maxLength: 40 },
      { id: 'fontSize', label: '文字の大きさ', type: 'radio', group: 'advanced', default: 'normal',
        options: [{ value: 'normal', label: '標準（配布用）' }, { value: 'large', label: '大きめ（掲示用）' }] },
      paperField('A4横', { options: PAPER_PRINT.filter((p) => p.value !== '') }),
      monoField(true),
      deliveryField(DELIVERY_TABLE, 'excel'),
    ],
  },

  // ---------------------------------------------------------------- F10
  {
    id: 'F10',
    slug: 'rubric',
    title: 'ルーブリック・評価基準の案を作りたい',
    short: '観点・段階ごとの評価基準案と検討事項',
    categories: ['assessment'],
    icon: '📏',
    keywords: ['ルーブリック', '評価基準', '評価規準', '観点', '採点基準', '評価', '基準', 'パフォーマンス評価', '自己評価', 'チェックリスト', '作文の評価', 'レポート評価'],
    scope: {
      can: '評価したい活動と観点・段階数から、評価基準の「案」と先生が検討すべき事項をAIに頼む依頼文を作ります。',
      cannot: '個々の児童生徒の評価・評定や合否を決める依頼は作りません。児童生徒の作品や成績は入力しないでください。',
    },
    workflow: 'reference_needed', sensitivity: 'generic', review: 'heightened',
    researchRefs: ['TP012', 'TP015', 'TP085'],
    fields: [
      sgField(),
      subjectField(),
      { id: 'activity', label: '評価したい活動・課題', type: 'textarea', required: true, group: 'basic', placeholder: '例：意見文（400字）を書く活動', maxLength: 400 },
      { id: 'goal', label: '活動の目標', type: 'textarea', required: true, group: 'basic', placeholder: '例：根拠を明確にして、自分の考えを筋道立てて書く。', maxLength: 400 },
      { id: 'viewpoints', label: '観点（いくつでも）', type: 'checks', group: 'basic',
        options: ['知識・技能', '思考・判断・表現', '主体的に学習に取り組む態度'],
        default: ['思考・判断・表現'] },
      { id: 'customViewpoints', label: 'その他の観点・評価項目', type: 'text', group: 'basic', placeholder: '例：構成、根拠の示し方、表現の工夫', maxLength: 120 },
      { id: 'levels', label: '段階の数', type: 'radio', required: true, group: 'basic', default: '3',
        options: [
          { value: '3', label: '3段階（A・B・C）' },
          { value: '4', label: '4段階' },
          { value: '5', label: '5段階' },
        ] },
      { id: 'reference', label: '評価規準などの資料', type: 'radio', group: 'advanced', default: 'none',
        options: [
          { value: 'attach', label: '学校の評価規準・資料をAIに渡す' },
          { value: 'none', label: '渡さない（一般的な案でよい）' },
        ] },
      { id: 'extras', label: 'あわせて作るもの', type: 'checks', group: 'output',
        options: ['児童生徒向けのやさしい表現版', '自己評価チェックリスト', '「B」に届かない場合の手立て（一般的なもの）'] },
      deliveryField(DELIVERY_TABLE, 'word'),
    ],
  },

  // ---------------------------------------------------------------- F11
  {
    id: 'F11',
    slug: 'school-event',
    title: '学校行事の計画・司会台本を作りたい',
    short: '実施計画、時程、準備物、役割、台本の案',
    categories: ['admin'],
    icon: '🎪',
    keywords: ['行事', '学校行事', '運動会', '体育祭', '文化祭', '学習発表会', '合唱コンクール', '遠足', '校外学習', '修学旅行', '入学式', '卒業式', '集会', '司会', '台本', 'シナリオ', '時程', '段取り', '計画', '準備物', '役割分担'],
    scope: {
      can: '行事の実施計画、時程、準備物、役割、司会台本の案をAIに頼む依頼文を作ります。',
      cannot: '安全基準・引率体制・緊急時対応の可否はAIに判断させず、学校の規程と管理職の判断に従ってください。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'heightened',
    researchRefs: ['TP045', 'TP046', 'TP129'],
    fields: [
      { id: 'eventName', label: '行事名', type: 'text', required: true, group: 'basic', placeholder: '例：学年レクリエーション大会、合唱コンクール', maxLength: 60 },
      { id: 'participants', label: '対象・規模', type: 'text', required: true, group: 'basic', placeholder: '例：中学2年 4クラス 約130名', maxLength: 80 },
      { id: 'aim', label: '行事のねらい', type: 'textarea', required: true, group: 'basic', placeholder: '例：学級をこえた交流を通して、学年の一体感を高める。', maxLength: 400 },
      { id: 'timeframe', label: '時間・時程の枠', type: 'text', required: true, group: 'basic', placeholder: '例：5・6時間目（13:30〜15:20）', maxLength: 80 },
      { id: 'outputs', label: '作ってほしいもの（いくつでも）', type: 'checks', required: true, group: 'basic', min: 1,
        options: ['実施計画（概要）', '当日の時程表', '準備物リスト', '役割分担表', '司会台本', '事前指導の流れ', '準備のスケジュール', '振り返りアンケート案'],
        default: ['実施計画（概要）', '当日の時程表', '準備物リスト'] },
      { id: 'venue', label: '会場', type: 'text', group: 'advanced', placeholder: '例：体育館', maxLength: 60 },
      { id: 'staffing', label: '担当の体制（人名は書かない）', type: 'text', group: 'advanced', placeholder: '例：学年主任1名、担任4名、副担任2名', maxLength: 100 },
      { id: 'constraints', label: '制約・決まっていること', type: 'textarea', group: 'advanced', placeholder: '例：予算なし、雨天時は教室で実施、準備は前日の放課後のみ', maxLength: 400 },
      { id: 'mcReader', label: '司会台本を読む人', type: 'radio', group: 'advanced', default: 'students',
        options: [{ value: 'students', label: '児童生徒' }, { value: 'teacher', label: '教員' }],
        showIf: { field: 'outputs', in: ['司会台本'] } },
      { id: 'lastYear', label: '昨年度の資料・校内の手引きをAIに渡す', type: 'check', group: 'advanced', default: false },
      deliveryField(DELIVERY_DOC, 'word'),
    ],
  },

  // ---------------------------------------------------------------- F12
  {
    id: 'F12',
    slug: 'meeting-docs',
    title: '会議・校務文書を整理したい',
    short: '議題、議事録の構成、要点、決定事項と未決事項',
    categories: ['admin'],
    icon: '🗂️',
    keywords: ['会議', '職員会議', '学年会', '部会', '議事録', '議題', '要約', 'まとめ', '通知', '通達', '校務', '文書', '報告書', '起案', '提案文書', 'メモ', '整理', '短くしたい'],
    scope: {
      can: '議題案、議事録の構成、要点整理、決定事項と未決事項の区別をAIに頼む依頼文を作ります。会議メモや資料は工房に入れず、利用が認められたAIに直接渡します。',
      cannot: '個人が特定できる話題（児童生徒の事案、人事など）は入力せず、資料をAIに渡せるかは学校の規程を確認してください。',
    },
    workflow: 'reference_needed', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP038', 'TP039', 'TP040', 'TP115', 'TP116'],
    fields: [
      { id: 'docType', label: '文書の種類', type: 'select', required: true, group: 'basic', default: '',
        options: [{ value: '', label: '選んでください' }, '会議の議題・次第', '会議の議事録', '学年会・部会のメモ整理', '通知・通達の要約', '校務文書・提案文書の下書き', '報告書の構成'] },
      { id: 'purpose', label: '目的', type: 'text', required: true, group: 'basic', placeholder: '例：11月の学年会で決めたことを、欠席者にも分かるように共有したい', maxLength: 150 },
      { id: 'points', label: '要点（個人が特定できる内容は書かない）', type: 'textarea', group: 'basic', placeholder: '例：・期末テストの日程確認 ・学年集会の担当決め（未決）', maxLength: 1000,
        hint: '資料をAIに直接渡す場合は、空欄でもかまいません。' },
      { id: 'material', label: '会議メモ・資料', type: 'radio', required: true, group: 'basic', default: 'attach',
        options: [
          { value: 'attach', label: 'AIに貼る・添付する' },
          { value: 'none', label: 'なし（上の要点だけで作る）' },
        ] },
      { id: 'outputStyle', label: '仕上がりの形', type: 'radio', required: true, group: 'basic', default: 'list',
        options: [
          { value: 'list', label: '箇条書き' },
          { value: 'table', label: '表' },
          { value: 'document', label: '文書の形' },
        ] },
      { id: 'readers', label: '読む人', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '教職員全体', '学年の教員', '管理職', '分掌・部会のメンバー'] },
      { id: 'sections', label: '分けて示してほしいこと', type: 'checks', group: 'advanced',
        options: ['決定事項', '未決事項・継続審議', '担当と期限', '次回までの宿題', '確認が必要な点'],
        default: ['決定事項', '未決事項・継続審議', '担当と期限'] },
      { id: 'length', label: '分量', type: 'radio', group: 'output', default: 'standard',
        options: [{ value: 'short', label: 'A4半分程度' }, { value: 'standard', label: 'A4 1枚程度' }, { value: 'long', label: '必要なだけ' }] },
      deliveryField(DELIVERY_DOC, 'word'),
    ],
  },

  // ---------------------------------------------------------------- F13
  {
    id: 'F13',
    slug: 'survey',
    title: 'アンケート・Googleフォームの設問を作りたい',
    short: '目的別の設問と選択肢、負担や誘導表現の点検',
    categories: ['admin', 'ict'],
    icon: '📋',
    keywords: ['アンケート', 'Googleフォーム', 'グーグルフォーム', 'Forms', 'フォーム', '設問', '質問紙', '調査', '振り返りアンケート', '授業アンケート', '保護者アンケート', '学校評価'],
    scope: {
      can: '調査の目的・回答者・形式から、設問と選択肢をAIに作ってもらう依頼文を作ります。誘導表現や回答者の負担の点検も頼みます。',
      cannot: 'いじめ・家庭・健康などに関わる調査は、学校の正式な手順と管理職・専門職の判断に従ってください。',
    },
    workflow: 'prompt_only', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP056', 'TP094', 'TP114'],
    fields: [
      { id: 'purpose', label: '調査の目的', type: 'textarea', required: true, group: 'basic', placeholder: '例：2学期の授業で、話し合い活動が学びにつながったかを知りたい', maxLength: 400 },
      { id: 'respondent', label: '回答する人', type: 'radio', required: true, group: 'basic', default: 'students',
        options: [
          { value: 'students', label: '児童生徒' },
          { value: 'parents', label: '保護者' },
          { value: 'staff', label: '教職員' },
          { value: 'external', label: '地域・外部の方' },
        ] },
      { id: 'grade', label: '回答する児童生徒の学年', type: 'text', group: 'basic', placeholder: '例：小学5年', maxLength: 30,
        showIf: { field: 'respondent', in: ['students'] } },
      { id: 'formats', label: '回答形式（いくつでも）', type: 'checks', group: 'basic',
        options: ['ひとつ選ぶ', '複数選ぶ', '段階評価（4段階など）', '自由記述', 'はい・いいえ'],
        default: ['段階評価（4段階など）', '自由記述'] },
      { id: 'count', label: '設問数', type: 'select', required: true, group: 'basic', default: '8',
        options: ['3', '5', '8', '10', '15', '20'].map((n) => ({ value: n, label: `${n}問程度` })) },
      { id: 'anonymity', label: '記名の有無', type: 'radio', required: true, group: 'basic', default: 'anonymous',
        options: [
          { value: 'anonymous', label: '無記名' },
          { value: 'class', label: '学年・学級だけ聞く' },
          { value: 'named', label: '記名' },
        ] },
      { id: 'tool', label: '使うツール', type: 'select', group: 'advanced', default: 'Googleフォーム',
        options: ['Googleフォーム', 'Microsoft Forms', '紙のアンケート', { value: '', label: '指定しない' }] },
      { id: 'answerTime', label: '回答時間の目安', type: 'select', group: 'advanced', default: '',
        options: [{ value: '', label: '指定しない' }, '3分以内', '5分程度', '10分程度'] },
      { id: 'avoid', label: '聞かないこと・避けたいこと', type: 'text', group: 'advanced', placeholder: '例：家庭の経済状況、特定の教員の評価', maxLength: 150 },
    ],
  },

  // ---------------------------------------------------------------- F14
  {
    id: 'F14',
    slug: 'ict-help',
    title: 'ICT操作説明・トラブル対応を頼みたい',
    short: '操作手順、一般的なトラブルの切り分け',
    categories: ['ict'],
    icon: '💻',
    keywords: ['ICT', '端末', 'タブレット', 'Chromebook', 'クロームブック', 'iPad', 'パソコン', 'PC', 'Classroom', 'クラスルーム', 'Teams', 'ロイロ', '操作', '使い方', '手順', 'トラブル', '不具合', 'つながらない', 'エラー', 'ログインできない', 'プリンター', '電子黒板', 'プロジェクター', '操作説明'],
    scope: {
      can: 'やりたい操作や症状から、手順や一般的な切り分け方法をAIに頼む依頼文を作ります。',
      cannot: 'AIはメニュー名や最新の仕様を間違えることがあります。公式ヘルプや校内の情報担当で確認してください。パスワードやアカウント名は入力しないでください。',
    },
    workflow: 'prompt_only', sensitivity: 'generic', review: 'normal',
    researchRefs: ['TP054', 'TP055', 'TP135'],
    fields: [
      { id: 'mode', label: '困っていること', type: 'radio', required: true, group: 'basic', default: 'howto',
        options: [
          { value: 'howto', label: 'やり方を知りたい' },
          { value: 'trouble', label: 'トラブル・不具合を解決したい' },
          { value: 'manual', label: '人に配る操作手順書を作りたい' },
        ] },
      { id: 'service', label: '端末・サービス', type: 'text', required: true, group: 'basic', placeholder: '例：Chromebook、Google Classroom', datalist: ICT_SERVICE_SUGGESTIONS, maxLength: 80 },
      { id: 'detail', label: 'やりたいこと・起きていること', type: 'textarea', required: true, group: 'basic', placeholder: '例：Classroomで、提出された課題をまとめて返却したい', maxLength: 600 },
      { id: 'audience', label: '説明を読む人', type: 'radio', required: true, group: 'basic', default: 'self',
        options: [
          { value: 'self', label: '自分（教員）' },
          { value: 'students', label: '児童生徒' },
          { value: 'colleagues', label: '同僚の先生' },
          { value: 'parents', label: '保護者' },
        ] },
      { id: 'grade', label: '児童生徒の学年', type: 'text', group: 'advanced', placeholder: '例：小学2年', maxLength: 30, showIf: { field: 'audience', in: ['students'] } },
      { id: 'env', label: 'OS・ブラウザ・アプリの種類', type: 'text', group: 'advanced', placeholder: '例：ChromeOS、Chromeブラウザ', maxLength: 80 },
      { id: 'tried', label: 'すでに試したこと', type: 'textarea', group: 'advanced', placeholder: '例：再起動した、別の端末では問題なし', maxLength: 300, showIf: { field: 'mode', in: ['trouble'] } },
      { id: 'errorMsg', label: '表示されたメッセージ（アカウント名などは伏せる）', type: 'text', group: 'advanced', maxLength: 200, showIf: { field: 'mode', in: ['trouble'] } },
      { id: 'manualFormat', label: '手順書の形', type: 'radio', group: 'output', default: 'steps',
        options: [{ value: 'steps', label: '番号つきの手順' }, { value: 'onepage', label: 'A4 1枚の配布用' }, { value: 'slides', label: 'スライドで説明' }],
        showIf: { field: 'mode', in: ['manual'] } },
    ],
  },

  // ---------------------------------------------------------------- F15
  {
    id: 'F15',
    slug: 'proofread',
    title: '文書を校正・言い換えたい',
    short: '原意を守った改稿案、変更点、要確認箇所',
    categories: ['document'],
    icon: '✏️',
    keywords: ['校正', '推敲', '言い換え', '添削', '誤字', '脱字', '敬語', '表記ゆれ', 'やわらかく', '丁寧に', '短く', 'リライト', '書き直し', '文章チェック', '読みやすく'],
    scope: {
      can: '書いた原稿を、原意を守ったまま校正・言い換えしてもらう依頼文を作ります。原稿は依頼文の中に入ります。',
      cannot: '児童生徒の個別の評価（通知表所見など）や個人が特定できる内容の原稿は入力しないでください。',
    },
    workflow: 'prompt_only', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP041', 'TP035', 'TP084'],
    fields: [
      { id: 'docUse', label: '文書の用途', type: 'select', required: true, group: 'basic', default: '',
        options: [{ value: '', label: '選んでください' }, '保護者向けの文書', '学級通信・おたより', '校内の文書', '児童生徒向けの文書', 'メール', 'その他'] },
      { id: 'changes', label: '直したいこと（いくつでも）', type: 'checks', required: true, group: 'basic', min: 1,
        options: ['誤字脱字・表記ゆれ', '敬語・言葉づかい', '分かりやすく', '短く', 'やわらかい印象に', 'より丁寧に', 'やさしい日本語に', '構成を整える'],
        default: ['誤字脱字・表記ゆれ', '敬語・言葉づかい'] },
      { id: 'text', label: '原稿（個人が特定できる内容は入れない）', type: 'textarea', required: true, group: 'basic', rows: 8, maxLength: 4000,
        placeholder: 'ここに直したい文章を貼り付けます。' },
      { id: 'keep', label: '変えたくない語句・表現', type: 'text', group: 'advanced', placeholder: '例：行事名、決まり文句「よろしくお願いいたします」', maxLength: 150 },
      { id: 'lengthPref', label: '長さ', type: 'radio', group: 'advanced', default: 'same',
        options: [{ value: 'same', label: '同じくらい' }, { value: 'shorter', label: '短く' }, { value: 'free', label: '気にしない' }] },
      { id: 'outputStyle', label: '出してほしいもの', type: 'radio', group: 'output', default: 'revised-diff',
        options: [
          { value: 'revised-diff', label: '修正版と変更点の一覧' },
          { value: 'revised', label: '修正版だけ' },
          { value: 'comments', label: '指摘と修正案だけ（本文は直さない）' },
        ] },
    ],
  },

  // ---------------------------------------------------------------- F16
  {
    id: 'F16',
    slug: 'free-request',
    title: '自由な困りごとをAIへの依頼文にしたい',
    short: 'やりたいことを、構造化された依頼文に整える',
    categories: ['ict'],
    icon: '🧩',
    keywords: ['自由', 'その他', 'AIへの頼み方', '頼み方', 'プロンプト', '依頼文', '整えたい', 'どう頼めば', '分からない', 'なんでも', 'AIにどう頼めばいいか'],
    scope: {
      can: 'やりたいこと・対象・目的・希望する出力から、AIが動きやすい形の依頼文を作ります。',
      cannot: '個人情報を扱う依頼や、評価・安全・医療などの最終判断をAIに任せる依頼には使わないでください。',
    },
    workflow: 'prompt_only', sensitivity: 'caution', review: 'normal',
    researchRefs: ['TP059'],
    fields: [
      { id: 'want', label: 'AIにしてほしいこと', type: 'textarea', required: true, group: 'basic', placeholder: '例：給食の残食を減らすための、学級での呼びかけ案を考えてほしい', maxLength: 800 },
      { id: 'audience', label: '誰に向けたものか', type: 'text', required: true, group: 'basic', placeholder: '例：小学4年の学級全体', maxLength: 80 },
      { id: 'purpose', label: '何のためか', type: 'text', required: true, group: 'basic', placeholder: '例：押しつけにならずに、自分ごととして考えてもらうため', maxLength: 200 },
      { id: 'output', label: '希望する出力', type: 'select', required: true, group: 'basic', default: '',
        options: [{ value: '', label: '選んでください' }, '文章', '箇条書き', '表', '複数の案', '手順', '構成案・アウトライン', 'チェックリスト'] },
      { id: 'constraints', label: '条件・制約', type: 'textarea', group: 'advanced', placeholder: '例：朝の会の3分で話せる長さ、説教くさくしない', maxLength: 400 },
      { id: 'askFirst', label: '情報が足りなければ、作る前にAIから質問してもらう', type: 'check', group: 'advanced', default: true },
      deliveryField(DELIVERY_PLAIN, 'text'),
    ],
  },
];

export function getTask(id) {
  return TASKS.find((t) => t.id === id) || null;
}

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || '';
}
