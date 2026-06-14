// ============================================================
// api.js — API呼び出しのみ。基本的に触らない。
// OpenAI API (GPT-4o / GPT-4o-mini) + PDF/画像テキスト抽出
// ============================================================

// PDF テキスト抽出（pdf.js を CDN から動的ロード）
export async function extractTextFromPdf(file) {
  if (!window._pdfjsLib) {
    const mod = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs')
    mod.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'
    window._pdfjsLib = mod
  }
  const buf = await file.arrayBuffer()
  const pdf = await window._pdfjsLib.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text.trim()
}

// ファイル → base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ドキュメント解析 → ポジションデータ抽出
// input: { type: 'text'|'image', content: string, mimeType?: string }
// fields: FIELDS配列
export async function extractPositionFromDoc(input, fields, apiKey) {
  const fieldDesc = fields
    .map(f => `- ${f.key}（${f.label}）`)
    .join('\n')

  const system = `あなたは採用コンサルタントのアシスタントです。
提供されたドキュメント（議事録・JD・求人票・画像など）から以下のフィールドの情報を抽出し、JSONのみで返答してください。
フィールドに情報がない場合は空文字列にしてください。titleにはポジション名を入れてください。日本語で出力してください。

フィールド:
${fieldDesc}`

  const userContent = input.type === 'image'
    ? [
        { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.content}` } },
        { type: 'text', text: 'この画像から採用ポジション情報を抽出してください。' },
      ]
    : `以下のドキュメントから情報を抽出してください:\n\n${input.content}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  return JSON.parse(data.choices?.[0]?.message?.content || '{}')
}

// AI検索
export async function aiSearchPositions(query, positions, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `採用ポジション一覧:\n${JSON.stringify(positions.map(p => ({ id: p.id, title: p.title, jobDesc: p.jobDesc, skills: p.skillsRequired })))}\n\n質問:「${query}」\n\nJSONのみ返答: {"ids":["id1"],"summary":"要約150文字以内"}`,
      }],
    }),
  })
  if (!res.ok) throw new Error('検索失敗')
  const data = await res.json()
  return JSON.parse(data.choices?.[0]?.message?.content || '{"ids":[],"summary":""}')
}
