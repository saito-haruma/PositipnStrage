// ============================================================
// constants.js — フィールド定義のみ。基本的に触らない。
// 項目を追加したい場合のみここを編集する。
// ============================================================

export const FIELDS = [
  {
    key: 'deptStructure',
    label: '部門構造',
    placeholder: '例：営業本部 > エンタープライズ営業部 > 第1グループ（5名体制）\n組織の階層・規模・チーム構成を記載',
    rows: 3,
    section: '組織・ポジション情報',
  },
  {
    key: 'jobDesc',
    label: '職務内容と特徴',
    placeholder: '主な業務内容、担当範囲、このポジションならではの特徴を記載',
    rows: 5,
    section: '組織・ポジション情報',
  },
  {
    key: 'skillsRequired',
    label: 'スキル（必須）',
    placeholder: '例：Python 3年以上、プロジェクトマネジメント経験、英語ビジネスレベルなど',
    rows: 3,
    section: 'スキル要件',
  },
  {
    key: 'skillsPreferred',
    label: 'スキル（尚可）',
    placeholder: '例：AWS資格、SaaS業界経験、マネジメント経験など',
    rows: 3,
    section: 'スキル要件',
  },
  {
    key: 'persona',
    label: 'ペルソナ',
    placeholder: '求める人物像・マインドセット・行動特性など\n例：自走できる人、0→1フェーズが得意な人など',
    rows: 4,
    section: '人物像',
  },
  {
    key: 'currentMemberBg',
    label: '現在所属されている方のバックグラウンド（具体的ペルソナ）',
    placeholder: '例：前職はコンサルファーム出身、平均年齢32歳、出身業界はSaaS・コンサルが多い など',
    rows: 4,
    section: '人物像',
  },
  {
    key: 'mission',
    label: 'ミッション（期待する活躍）',
    placeholder: '入社後に期待する役割・成果・中長期での活躍イメージ',
    rows: 4,
    section: '役割・課題',
  },
  {
    key: 'challenge',
    label: '課題（部門の抱えている問題）',
    placeholder: '現在の部門課題、このポジションで解決してほしい問題など',
    rows: 4,
    section: '役割・課題',
  },
  {
    key: 'appeal',
    label: '求人の魅力・特徴・候補者へのアピールポイント',
    placeholder: '候補者に伝えたい魅力、競合他社との差別化ポイント、働く環境の特徴など',
    rows: 4,
    section: '募集条件・アピール',
  },
  {
    key: 'salary',
    label: '年収レンジ',
    placeholder: '例：600〜900万円',
    rows: 1,
    section: '募集条件・アピール',
  },
  {
    key: 'workStyle',
    label: '勤務スタイル',
    placeholder: '例：フルリモート可、週3出社など',
    rows: 1,
    section: '募集条件・アピール',
  },
  {
    key: 'interviewTips',
    label: '面接のポイント・注意点',
    placeholder: '面接で重視すること、NG例、面接官の特徴など',
    rows: 4,
    section: '選考・面接',
  },
  {
    key: 'selectionPoints',
    label: '選考ポイント・判断基準',
    placeholder: 'スクリーニング基準、合否判断の軸、過去に落ちた候補者のパターンなど',
    rows: 4,
    section: '選考・面接',
  },
  {
    key: 'memo',
    label: '備考・メモ',
    placeholder: 'クライアント企業の特徴、カルチャー、その他共有事項など',
    rows: 3,
    section: 'その他',
  },
]

export const SECTIONS = [...new Set(FIELDS.map(f => f.section))]

export const emptyPosition = () => ({
  title: '',
  ...Object.fromEntries(FIELDS.map(f => [f.key, ''])),
})

export const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

export const STORAGE_KEY = 'rec_positions_v3'
export const API_KEY_STORAGE = 'rec_openai_key'
