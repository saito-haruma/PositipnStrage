// ============================================================
// App.jsx — 機能追加・変更はすべてこのファイルだけでOK
//
// 構成:
//   [1] スタイル定数 (CSS-in-JS)
//   [2] 小さなUIパーツ (Btn, Badge, Tag, Overlay など)
//   [3] 機能コンポーネント
//        - PositionSearchInput  ← ポジション名サジェスト検索
//        - Navbar               ← タブ: 一覧 / 新規登録 / DBを更新
//        - DbUpdater            ← ★NEW: ExcelドラッグでDB更新
//        - DocImporter
//        - PositionForm
//        - PositionCard
//        - PositionDetail
//   [4] App (メインロジック・状態管理)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FIELDS, SECTIONS, emptyPosition, genId,
  STORAGE_KEY, API_KEY_STORAGE,
} from './lib/constants.js'
import {
  extractPositionFromDoc, extractTextFromPdf,
  fileToBase64, aiSearchPositions,
} from './lib/api.js'

// ─────────────────────────────────────────────
// [1] スタイル定数
// ─────────────────────────────────────────────
const G = {
  navy:       '#0F1E36',
  slate:      '#2C4770',
  teal:       '#19B8A6',
  tealLight:  '#E1F5EE',
  tealDark:   '#0F6E56',
  bg:         '#F0F4FA',
  card:       '#FFFFFF',
  border:     '#DDE8F5',
  muted:      '#8395A7',
  text:       '#1a2a3a',
  amber:      '#FFF8E7',
  amberBorder:'#FFD85C',
}
const css = {
  app:   { minHeight: '100vh', background: G.bg, fontFamily: "'Noto Sans JP', -apple-system, sans-serif", color: G.text },
  main:  { maxWidth: 900, margin: '0 auto', padding: '28px 20px' },
  nav:   { background: G.navy, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 6, height: 54, position: 'sticky', top: 0, zIndex: 100 },
  logo:  { color: G.teal, fontWeight: 700, fontSize: 15, marginRight: 12 },
  card:  { background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 10, cursor: 'pointer' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: G.slate, marginBottom: 6 },
  row:   { display: 'flex', alignItems: 'center', gap: 8 },
  empty: { textAlign: 'center', padding: '72px 20px', color: G.muted },
}

// ─────────────────────────────────────────────
// [2] 汎用UIパーツ
// ─────────────────────────────────────────────
const GLOBAL_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{-webkit-font-smoothing:antialiased}
input,textarea{font-family:inherit;border:1px solid ${G.border};border-radius:8px;padding:10px 14px;font-size:13px;outline:none;width:100%;background:#fff;color:${G.text};transition:border-color .15s}
input:focus,textarea:focus{border-color:${G.teal};box-shadow:0 0 0 3px rgba(25,184,166,.1)}
textarea{resize:vertical;line-height:1.7}
button{cursor:pointer;border:none;border-radius:8px;font-weight:600;font-family:inherit;transition:opacity .15s,transform .1s}
button:hover{opacity:.88}
button:active{transform:scale(.98)}
button:disabled{opacity:.45;cursor:not-allowed}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:${G.border};border-radius:3px}
@keyframes rec-spin{to{transform:rotate(360deg)}}
@keyframes rec-fadein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
`
function GlobalStyle() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = GLOBAL_CSS
    document.head.appendChild(el)
    return () => el.remove()
  }, [])
  return null
}

function Btn({ children, onClick, disabled, style, variant = 'primary' }) {
  const base = { padding: '9px 18px', fontSize: 13, whiteSpace: 'nowrap' }
  const variants = {
    primary:   { background: G.teal,  color: '#fff' },
    secondary: { background: G.slate, color: '#fff' },
    ghost:     { background: 'rgba(255,255,255,.08)', color: '#aab4c4' },
    muted:     { background: G.muted, color: '#fff' },
    outline:   { background: G.bg, color: G.slate, border: `1px solid ${G.border}` },
    danger:    { background: '#e74c3c', color: '#fff' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

function Badge({ children, color = 'teal' }) {
  const colors = {
    teal:  { bg: G.tealLight, text: G.tealDark,  border: '#5DCAA5' },
    gray:  { bg: '#F1EFE8',   text: '#5F5E5A',   border: '#B4B2A9' },
    blue:  { bg: '#E6F1FB',   text: '#185FA5',   border: '#85B7EB' },
    amber: { bg: G.amber,     text: '#7a5a00',   border: G.amberBorder },
    green: { bg: '#eafbf0',   text: '#1a6e3a',   border: '#6fcf97' },
    red:   { bg: '#fff0f0',   text: '#c0392b',   border: '#f5c6c6' },
    navy:  { bg: '#e8edf5',   text: G.navy,      border: '#b0bdd4' },
  }
  const c = colors[color] || colors.teal
  return (
    <span style={{ display:'inline-block', fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:5, background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>
      {children}
    </span>
  )
}

function Tag({ children }) {
  return (
    <span style={{ display:'inline-block', fontSize:11, padding:'2px 8px', borderRadius:4, background:G.tealLight, color:G.tealDark, border:`1px solid #5DCAA5`, fontFamily:'monospace', margin:'2px 2px 0 0' }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:G.teal, textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:`1px solid ${G.border}`, paddingBottom:5, marginBottom:12, marginTop:18 }}>
      {children}
    </div>
  )
}

function HighlightBox({ children, color = 'teal' }) {
  const styles = {
    teal:  { background: G.tealLight, border: `1px solid rgba(25,184,166,.4)`, color: G.tealDark },
    amber: { background: G.amber,     border: `1px solid ${G.amberBorder}`,    color: '#7a5a00'  },
  }
  return (
    <div style={{ borderRadius:8, padding:'12px 16px', fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap', ...styles[color] }}>
      {children}
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose?.()} style={{ position:'fixed', inset:0, background:'rgba(10,20,40,.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#F7F9FC', borderRadius:12, maxWidth:740, width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'30px 34px', boxShadow:'0 8px 40px rgba(10,20,40,.22)' }}>
        {children}
      </div>
    </div>
  )
}

function ProgressRing({ pct }) {
  return (
    <div style={{ position:'relative', width:44, height:44, flexShrink:0 }}>
      <svg viewBox="0 0 36 36" width={44} height={44}>
        <circle cx="18" cy="18" r="15" fill="none" stroke={G.border} strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={pct===100?G.teal:G.slate} strokeWidth="3" strokeDasharray={`${pct*0.942} 94.2`} strokeLinecap="round" transform="rotate(-90 18 18)" />
      </svg>
      <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:G.slate }}>{pct}%</span>
    </div>
  )
}

function Spinner({ size = 14, color = 'rgba(255,255,255,.3)', topColor = '#fff' }) {
  return (
    <span style={{ display:'inline-block', width:size, height:size, border:`2px solid ${color}`, borderTopColor:topColor, borderRadius:'50%', animation:'rec-spin .7s linear infinite' }} />
  )
}

// ─────────────────────────────────────────────
// [3] 機能コンポーネント
// ─────────────────────────────────────────────

// ── PositionSearchInput ──────────────────────
function PositionSearchInput({ value, onChange, dbPositions }) {
  const [query, setQuery]       = useState(value || '')
  const [suggestions, setSugs]  = useState([])
  const [showSugs, setShowSugs] = useState(false)
  const [selected, setSelected] = useState(null)
  const wrapRef = useRef()

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugs(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSugs([]); return }
    const q = query.toLowerCase()
    setSugs(dbPositions.filter(p =>
      p.positionName.toLowerCase().includes(q) ||
      p.internalName.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q)
    ).slice(0, 8))
  }, [query, dbPositions])

  const handleInput = (e) => { const v = e.target.value; setQuery(v); setSelected(null); onChange(v); setShowSugs(true) }
  const handleSelect = (pos) => { setQuery(pos.positionName); setSelected(pos); onChange(pos.positionName, pos); setShowSugs(false) }
  const statusColor = (s) => s === 'Active' ? 'green' : 'gray'

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <input
        type="text" value={query} onChange={handleInput}
        onFocus={() => query && setShowSugs(true)}
        placeholder="ポジション名を入力 or DBから検索して選択（自由入力も可）"
        style={{ fontSize:15, fontWeight:700, padding:'12px 16px' }}
      />
      {showSugs && suggestions.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'#fff', border:`1px solid ${G.border}`, borderTop:'none', borderRadius:'0 0 10px 10px', boxShadow:'0 8px 24px rgba(10,20,40,.12)', maxHeight:320, overflowY:'auto' }}>
          <div style={{ padding:'8px 14px 6px', fontSize:11, color:G.muted, fontWeight:600, borderBottom:`1px solid ${G.border}` }}>
            ポジションDB — {suggestions.length} 件マッチ
          </div>
          {suggestions.map((pos, i) => (
            <div key={pos.id} onClick={() => handleSelect(pos)}
              style={{ padding:'10px 14px', cursor:'pointer', borderBottom: i < suggestions.length-1 ? `1px solid ${G.border}` : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = G.tealLight}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:G.navy, lineHeight:1.4, marginBottom:3 }}>{pos.positionName}</div>
                  {pos.internalName && <div style={{ fontSize:11, color:G.muted, lineHeight:1.4 }}>（{pos.internalName}）</div>}
                  {pos.department   && <div style={{ fontSize:11, color:G.slate, marginTop:4 }}>{pos.department}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  <Badge color={statusColor(pos.status)}>{pos.status}</Badge>
                  {pos.salaryMin && pos.salaryMax && <span style={{ fontSize:10, color:G.muted }}>{pos.salaryMin}〜{pos.salaryMax}万</span>}
                </div>
              </div>
            </div>
          ))}
          <div onClick={() => setShowSugs(false)}
            style={{ padding:'10px 14px', cursor:'pointer', borderTop:`1px solid ${G.border}`, fontSize:12, color:G.muted, background:G.bg, borderRadius:'0 0 10px 10px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#e8edf5'}
            onMouseLeave={e => e.currentTarget.style.background = G.bg}
          >
            ✏️ 「{query}」をそのまま入力する
          </div>
        </div>
      )}
      {selected && (
        <div style={{ marginTop:8, padding:'8px 12px', background:G.tealLight, border:`1px solid #5DCAA5`, borderRadius:8, fontSize:12, color:G.tealDark, display:'flex', alignItems:'center', gap:8 }}>
          <span>✅ DBポジションから選択中</span>
          <span style={{ fontWeight:700 }}>ID: {selected.id}</span>
          <span>|</span>
          <span>{selected.department}</span>
          <Badge color={statusColor(selected.status)}>{selected.status}</Badge>
          <button onClick={() => { setSelected(null); setQuery(''); onChange('') }} style={{ marginLeft:'auto', background:'none', color:G.muted, fontSize:13, padding:'0 4px' }}>✕ 解除</button>
        </div>
      )}
    </div>
  )
}

// ── Navbar ──────────────────────────────────
function Navbar({ view, count, dbCount, apiKey, onList, onAdd, onDbUpdate, onSaveKey }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(apiKey || '')
  const save = () => { onSaveKey(draft.trim()); setEditing(false) }

  const tabs = [
    { id: 'list',     label: '一覧',      onClick: onList },
    { id: 'add',      label: '＋ 新規登録', onClick: onAdd },
    { id: 'dbupdate', label: '📥 DBを更新', onClick: onDbUpdate },
  ]

  return (
    <nav style={css.nav}>
      <span style={css.logo}>採用ポジション管理</span>
      {tabs.map(t => (
        <button key={t.id} onClick={t.onClick} style={{
          background: view === t.id ? 'rgba(25,184,166,.15)' : 'none',
          color: view === t.id ? G.teal : '#aab4c4',
          padding: '7px 16px', fontSize: 13, borderRadius: 8,
        }}>
          {t.label}
        </button>
      ))}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ color:G.muted, fontSize:12 }}>{count}件 / DB {dbCount}件</span>
        {editing ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <input type="password" value={draft} onChange={e => setDraft(e.target.value)}
              placeholder="sk-..." autoFocus
              onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') setEditing(false) }}
              style={{ width:200, height:32, fontSize:12, padding:'0 10px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', borderRadius:8 }}
            />
            <Btn onClick={save} style={{ padding:'5px 12px', fontSize:12 }}>保存</Btn>
            <Btn onClick={() => setEditing(false)} variant="ghost" style={{ padding:'5px 8px', fontSize:13 }}>✕</Btn>
          </div>
        ) : (
          <button onClick={() => { setDraft(apiKey||''); setEditing(true) }} style={{
            padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:8,
            background: apiKey ? 'rgba(25,184,166,.2)' : 'rgba(255,200,0,.15)',
            color: apiKey ? G.teal : '#ffc800',
            border: `1px solid ${apiKey ? 'rgba(25,184,166,.4)' : 'rgba(255,200,0,.3)'}`,
          }}>
            🔑 {apiKey ? 'AI機能ON' : 'APIキー未設定'}
          </button>
        )}
      </div>
    </nav>
  )
}

// ── DbUpdater ────────────────────────────────
// Excelファイルをドラッグするだけでpositions_db（インメモリ）を更新する
// ※ブラウザ上での処理なのでGitHub上のJSONは変わらない。
//   ページリロードすると元に戻るので、永続化したい場合はJSONをDLしてpublic/に上書き
function DbUpdater({ dbPositions, onUpdate }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus]     = useState(null)   // {type, msg}
  const [preview, setPreview]   = useState(null)   // {count, samples}
  const [pending, setPending]   = useState(null)   // 解析済みデータ（確認後に適用）
  const fileRef = useRef()

  const setInfo = (type, msg) => setStatus({ type, msg })

  // ExcelをJS側でパース（SheetJS / xlsx をCDNから動的ロード）
  const parseExcel = async (file) => {
    if (!window.XLSX) {
      setInfo('info', '⏳ Excelパーサーを読み込み中…')
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
    }

    const buf = await file.arrayBuffer()
    const wb  = window.XLSX.read(buf, { type: 'array' })

    // 「ポジション一覧」シートを優先、なければ最初のシート
    const sheetName = wb.SheetNames.includes('ポジション一覧') ? 'ポジション一覧' : wb.SheetNames[0]
    const ws   = wb.Sheets[sheetName]
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // ヘッダー行を探す（IDという列を含む行）
    let headerIdx = rows.findIndex(r => r.some(c => String(c).trim() === 'ID'))
    if (headerIdx < 0) throw new Error('「ID」列が見つかりませんでした。ヘッダー行を確認してください。')

    const header = rows[headerIdx].map(c => String(c).trim())
    const col = (name) => header.indexOf(name)

    const positions = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r[col('ID')]) continue
      positions.push({
        id:           String(r[col('ID')]),
        positionName: String(r[col('ポジション名')]     || ''),
        internalName: String(r[col('社内ポジション名')] || ''),
        department:   String(r[col('部署')]             || ''),
        status:       String(r[col('ステータス')]        || ''),
        priority:     String(r[col('優先度')]            || ''),
        salaryMin:    String(r[col('年収下限(万)')]      || ''),
        salaryMax:    String(r[col('年収上限(万)')]      || ''),
        location:     String(r[col('勤務地')]            || ''),
      })
    }
    return positions
  }

  const processFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'xlsm'].includes(ext)) {
      setInfo('err', '❌ Excel ファイル（.xlsx / .xls）のみ対応しています')
      return
    }
    setInfo('info', `📊 ${file.name} を解析中…`)
    setPending(null); setPreview(null)
    try {
      const parsed = await parseExcel(file)
      setPending(parsed)
      setPreview({
        count: parsed.length,
        samples: parsed.slice(0, 5),
        fileName: file.name,
      })
      setInfo('ok', `✅ ${parsed.length} 件を読み込みました。内容を確認して「DBを更新する」を押してください。`)
    } catch (e) {
      setInfo('err', `❌ 解析エラー: ${e.message}`)
    }
  }

  const applyUpdate = () => {
    if (!pending) return
    onUpdate(pending)
    setInfo('ok', `🎉 DBを ${pending.length} 件に更新しました！（このセッション中のみ有効）`)
    setPreview(null)
    setPending(null)
  }

  // JSONダウンロード（GitHubに上書きして永続化するため）
  const downloadJson = () => {
    if (!pending) return
    const blob = new Blob([JSON.stringify(pending, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'positions_db.json'; a.click()
  }

  const sc = {
    ok:   { bg:G.tealLight, color:G.tealDark, border:'#5DCAA5' },
    err:  { bg:'#fff0f0',   color:'#c0392b',  border:'#f5c6c6' },
    info: { bg:'#f0f4ff',   color:G.slate,    border:'#c5d0e8' },
  }

  return (
    <div>
      {/* ヘッダー説明 */}
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, marginBottom:20 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:G.navy, marginBottom:10 }}>📥 ポジションDBを更新</h3>
        <p style={{ fontSize:13, color:G.muted, lineHeight:1.7, marginBottom:16 }}>
          最新のExcelファイルをドラッグ＆ドロップするだけで、ポジション名サジェストのDBを更新できます。<br />
          現在のDB: <strong style={{ color:G.navy }}>{dbPositions.length} 件</strong>
        </p>

        {/* フロー説明 */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
          {['① Excelをドロップ', '② 内容を確認', '③ DBを更新する', '（任意）④ JSONをDLしてGitHubに上書き→永続化'].map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, padding:'4px 12px', borderRadius:20, background: i===3 ? G.bg : G.navy, color: i===3 ? G.muted : '#fff', border:`1px solid ${i===3 ? G.border : G.navy}` }}>{s}</span>
              {i < 3 && <span style={{ color:G.muted, fontSize:14 }}>→</span>}
            </div>
          ))}
        </div>

        {/* ドロップゾーン */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          style={{
            border: `2px dashed ${dragging ? G.teal : G.border}`,
            borderRadius: 10, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? G.tealLight : G.bg,
            transition: 'all .15s',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" style={{ display:'none' }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: dragging ? G.tealDark : G.slate, marginBottom: 6 }}>
            {dragging ? 'ここでドロップ！' : 'Excelファイルをここにドロップ'}
          </div>
          <div style={{ fontSize: 12, color: G.muted }}>または クリックしてファイルを選択 ／ .xlsx .xls .xlsm 対応</div>
        </div>

        {/* ステータス表示 */}
        {status && (
          <div style={{ marginTop:14, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:500, animation:'rec-fadein .25s ease', ...sc[status.type] }}>
            {status.msg}
          </div>
        )}
      </div>

      {/* プレビュー */}
      {preview && (
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, animation:'rec-fadein .25s ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h4 style={{ fontSize:14, fontWeight:700, color:G.navy }}>
              📋 読み込み内容の確認 — {preview.fileName}（{preview.count} 件）
            </h4>
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant="outline" onClick={downloadJson} style={{ fontSize:12, padding:'6px 14px' }}>
                ⬇️ JSONをダウンロード
              </Btn>
              <Btn onClick={applyUpdate} style={{ fontSize:13, padding:'8px 20px' }}>
                🔄 DBを更新する（{preview.count} 件）
              </Btn>
            </div>
          </div>

          {/* サンプルテーブル */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:G.bg }}>
                  {['ID','ポジション名','社内ポジション名','部署','ステータス','年収'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:G.muted, fontWeight:600, borderBottom:`1px solid ${G.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.samples.map((p, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${G.border}` }}>
                    <td style={{ padding:'8px 12px', color:G.muted, whiteSpace:'nowrap' }}>{p.id}</td>
                    <td style={{ padding:'8px 12px', color:G.navy, fontWeight:500, maxWidth:280 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.positionName}</div>
                    </td>
                    <td style={{ padding:'8px 12px', color:G.muted, maxWidth:220 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.internalName}</div>
                    </td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>{p.department}</td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                      <Badge color={p.status==='Active'?'green':'gray'}>{p.status}</Badge>
                    </td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap', color:G.muted }}>
                      {p.salaryMin && p.salaryMax ? `${p.salaryMin}〜${p.salaryMax}万` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10, fontSize:12, color:G.muted }}>
            ※ 上位5件を表示。「DBを更新する」を押すとこのセッション中のサジェストが最新になります。<br />
            永続化する場合は「JSONをダウンロード」→ GitHubの <code>public/positions_db.json</code> に上書きしてください。
          </div>
        </div>
      )}
    </div>
  )
}

// ── DocImporter ──────────────────────────────
const ACCEPTED_TYPES = {
  'application/pdf': { label: 'PDF',      icon: '📄' },
  'image/png':       { label: '画像',      icon: '🖼️' },
  'image/jpeg':      { label: '画像',      icon: '🖼️' },
  'image/webp':      { label: '画像',      icon: '🖼️' },
  'text/plain':      { label: 'テキスト',  icon: '📝' },
}

function DocImporter({ apiKey, onExtract }) {
  const [open, setOpen]         = useState(false)
  const [docText, setDocText]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState(null)
  const [dragging, setDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [pending, setPending]   = useState(null)
  const fileRef = useRef()

  const setInfo = (type, msg) => setStatus({ type, msg })

  const processFile = async (file) => {
    const meta = ACCEPTED_TYPES[file.type]
    if (!meta) { setInfo('err', '対応していないファイル形式です（PDF・画像・テキストのみ）'); return }
    setFileInfo({ name: file.name, ...meta })
    setDocText(''); setPending(null)
    setInfo('info', `${meta.icon} ${file.name} を読み込み中…`)
    try {
      let input
      if (file.type === 'application/pdf') {
        setInfo('info', '📄 PDFからテキストを抽出中…')
        const text = await extractTextFromPdf(file)
        const trimmed = text.slice(0, 8000)
        setDocText(trimmed); input = { type:'text', content:trimmed }
      } else if (file.type.startsWith('image/')) {
        const b64 = await fileToBase64(file)
        input = { type:'image', content:b64, mimeType:file.type }
        setDocText('[画像ファイル — AI解析で読み取ります]')
      } else {
        const text = (await file.text()).slice(0, 8000)
        setDocText(text); input = { type:'text', content:text }
      }
      setPending(input)
      setInfo('ok', `✅ 読み込み完了（${file.name}）`)
    } catch (e) { setInfo('err', `読み込みエラー: ${e.message}`) }
  }

  const handleExtract = async () => {
    const input = pending || (docText.trim() ? { type:'text', content:docText } : null)
    if (!input) return
    setLoading(true)
    setInfo('info', '🤖 GPT-4oで解析中…')
    try {
      const result = await extractPositionFromDoc(input, FIELDS, apiKey)
      onExtract(result)
      setInfo('ok', '✅ 自動入力完了！内容を確認・修正してください。')
    } catch (e) { setInfo('err', `エラー: ${e.message}`) }
    setLoading(false)
  }

  const sc = { ok:{bg:G.tealLight,color:G.tealDark,border:'#5DCAA5'}, err:{bg:'#fff0f0',color:'#c0392b',border:'#f5c6c6'}, info:{bg:'#f0f4ff',color:G.slate,border:'#c5d0e8'} }

  return (
    <div style={{ marginBottom:24 }}>
      <button onClick={() => setOpen(v => !v)} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, textAlign:'left', background:`linear-gradient(135deg, ${G.navy} 0%, ${G.slate} 100%)`, color:'#fff', padding:'12px 20px', fontSize:14, borderRadius: open ? '12px 12px 0 0' : 12 }}>
        <span>🤖 AIドキュメント自動入力</span>
        <span style={{ background:'rgba(25,184,166,.3)', color:G.teal, border:'1px solid rgba(25,184,166,.5)', fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:700 }}>GPT-4o</span>
        {!apiKey && <span style={{ background:'rgba(255,200,0,.2)', color:'#ffc800', border:'1px solid rgba(255,200,0,.4)', fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:600 }}>🔑 APIキー必要</span>}
        <span style={{ marginLeft:'auto', fontSize:11, opacity:.7 }}>{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div style={{ background:'#fff', border:`1px solid ${G.border}`, borderTop:'none', borderRadius:'0 0 12px 12px', padding:20 }}>
          {!apiKey && <div style={{ background:'#fffbe6', border:`1px solid ${G.amberBorder}`, borderRadius:8, padding:'10px 14px', fontSize:13, color:'#7a5a00', marginBottom:16 }}>🔑 AI自動入力にはOpenAI APIキーが必要です。ナビバー右上から設定してください。</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {['📄 PDF','🖼️ 画像（PNG/JPG/WebP）','📝 テキスト'].map(f => (
              <span key={f} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:G.tealLight, color:G.tealDark, border:'1px solid #5DCAA5', fontWeight:600 }}>{f}</span>
            ))}
            <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:'#f5f5f5', color:'#aaa', border:'1px solid #ddd', fontWeight:600, textDecoration:'line-through' }}>🎬 動画（非対応）</span>
          </div>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
            style={{ border:`2px dashed ${dragging?G.teal:G.border}`, borderRadius:8, padding:24, textAlign:'center', cursor:'pointer', background:dragging?G.tealLight:G.bg, marginBottom:14, transition:'all .15s' }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display:'none' }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
            {fileInfo ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                <span style={{ fontSize:24 }}>{fileInfo.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:G.navy }}>{fileInfo.name}</span>
                <Badge>{fileInfo.label}</Badge>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:28 }}>📂</span>
                <span style={{ fontSize:13, color:G.slate }}>ファイルをドロップ、またはクリックして選択</span>
                <span style={{ fontSize:11, color:G.muted }}>PDF・画像・テキスト対応</span>
              </div>
            )}
          </div>
          <div style={{ textAlign:'center', position:'relative', margin:'12px 0', fontSize:12, color:G.muted }}>
            <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:G.border }} />
            <span style={{ position:'relative', background:'#fff', padding:'0 12px' }}>または直接テキストを貼り付け</span>
          </div>
          <textarea value={docText} onChange={e => { setDocText(e.target.value); setPending(null); setFileInfo(null) }} placeholder={'例）\n■ MTG議事録\nポジション：シニアエンジニア\n必須：Python 3年以上\n年収：700〜900万円\n...'} rows={6} disabled={!!(fileInfo && docText.startsWith('[画像'))} />
          {status && <div style={{ marginTop:10, padding:'9px 14px', borderRadius:8, fontSize:13, fontWeight:500, ...sc[status.type] }}>{status.msg}</div>}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12 }}>
            <span style={{ fontSize:11, color:G.muted }}>💡 1回あたり約$0.03〜0.10（GPT-4o）/ AI検索は約$0.001（GPT-4o-mini）</span>
            <Btn onClick={handleExtract} disabled={loading || !apiKey || (!docText.trim() && !pending)}>
              {loading ? <span style={{ display:'flex', alignItems:'center', gap:8 }}><Spinner />解析中…</span> : '✨ 自動入力する'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PositionForm ─────────────────────────────
function PositionForm({ initialData, apiKey, dbPositions, onComplete, onCancel }) {
  const [data, setData]             = useState(initialData)
  const [activeSection, setSection] = useState(SECTIONS[0])
  const [extractMsg, setExtractMsg] = useState('')
  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }))

  const handleExtract = (extracted) => {
    setData(prev => { const next = {...prev}; Object.entries(extracted).forEach(([k,v]) => { if (v) next[k]=v }); return next })
    setExtractMsg('✅ 自動入力完了！内容を確認・修正してください。')
  }

  const handleTitleChange = (name, dbPos) => {
    set('title', name)
    if (dbPos) {
      setData(prev => ({
        ...prev, title: name, _dbId: dbPos.id, _dbInternalName: dbPos.internalName, _dbStatus: dbPos.status,
        salary:       dbPos.salaryMin && dbPos.salaryMax ? `${dbPos.salaryMin}〜${dbPos.salaryMax}万円` : prev.salary,
        deptStructure:dbPos.department ? dbPos.department + (prev.deptStructure ? '\n'+prev.deptStructure : '') : prev.deptStructure,
        workStyle:    dbPos.location || prev.workStyle,
      }))
    }
  }

  const filledCount   = FIELDS.filter(f => data[f.key]?.trim()).length
  const sectionFields = FIELDS.filter(f => f.section === activeSection)

  return (
    <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:28 }}>
      <DocImporter apiKey={apiKey} onExtract={handleExtract} />
      {extractMsg && <div style={{ background:G.tealLight, border:`1px solid #5DCAA5`, borderRadius:8, padding:'10px 14px', fontSize:13, color:G.tealDark, marginBottom:20 }}>{extractMsg}</div>}

      <div style={{ marginBottom:20 }}>
        <label style={{ ...css.label, display:'flex', alignItems:'center', gap:8 }}>
          ポジション名
          <span style={{ background:'#fee', color:'#c0392b', fontSize:10, padding:'2px 7px', borderRadius:4, fontWeight:600 }}>必須</span>
          <span style={{ background:G.tealLight, color:G.tealDark, fontSize:10, padding:'2px 7px', borderRadius:4, fontWeight:600 }}>DBから選択 or 自由入力</span>
        </label>
        <PositionSearchInput value={data.title||''} onChange={handleTitleChange} dbPositions={dbPositions} />
        {data._dbInternalName && <div style={{ marginTop:8, fontSize:12, color:G.muted }}>社内ポジション名：<span style={{ color:G.slate, fontWeight:600 }}>{data._dbInternalName}</span></div>}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div style={{ flex:1, height:6, background:G.border, borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', background:G.teal, borderRadius:3, width:`${(filledCount/FIELDS.length)*100}%`, transition:'width .3s' }} />
        </div>
        <span style={{ fontSize:12, color:G.muted, whiteSpace:'nowrap' }}>{filledCount} / {FIELDS.length} 項目入力済み</span>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20, paddingBottom:16, borderBottom:`1px solid ${G.border}` }}>
        {SECTIONS.map(sec => {
          const filled = FIELDS.filter(f => f.section===sec && data[f.key]?.trim()).length
          const isActive = activeSection===sec
          return (
            <button key={sec} onClick={() => setSection(sec)} style={{ padding:'6px 14px', fontSize:12, borderRadius:20, fontWeight:500, display:'flex', alignItems:'center', gap:5, background:isActive?G.navy:G.bg, color:isActive?'#fff':G.slate, border:`1px solid ${isActive?G.navy:G.border}` }}>
              {sec}
              {filled>0 && <span style={{ background:isActive?'rgba(255,255,255,.25)':G.teal, color:'#fff', fontSize:10, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>{filled}</span>}
            </button>
          )
        })}
      </div>

      <div>
        {sectionFields.map(f => (
          <div key={f.key} style={css.field}>
            <label style={css.label}>{f.label}{data[f.key]?.trim() && <span style={{ color:G.teal, fontSize:12, marginLeft:6, fontWeight:700 }}>✓</span>}</label>
            <textarea value={data[f.key]||''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} rows={f.rows} />
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:28, paddingTop:20, borderTop:`1px solid ${G.border}` }}>
        <Btn variant="outline" onClick={onCancel}>キャンセル</Btn>
        <Btn onClick={() => onComplete(data)} disabled={!data.title?.trim()}>💾 保存する</Btn>
      </div>
    </div>
  )
}

// ── PositionCard ─────────────────────────────
function PositionCard({ position, onClick, onDelete }) {
  const [hover, setHover] = useState(false)
  const skills = (position.skillsRequired||'').split(/[、,，\n]/).filter(Boolean).slice(0,4)
  const pct    = Math.round((FIELDS.filter(f => position[f.key]?.trim()).length / FIELDS.length) * 100)

  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...css.card, borderColor:hover?G.teal:G.border, boxShadow:hover?'0 2px 16px rgba(25,184,166,.12)':'none', transform:hover?'translateY(-1px)':'none', transition:'all .15s' }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:G.navy, marginBottom:4 }}>{position.title||'（タイトル未設定）'}</div>
          {position._dbInternalName && <div style={{ fontSize:11, color:G.muted, marginBottom:6 }}>（{position._dbInternalName}）</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
            {position.workStyle && <Badge color="teal">{position.workStyle}</Badge>}
            {position.salary    && <Badge color="gray">💰 {position.salary}</Badge>}
            {position._dbStatus && <Badge color={position._dbStatus==='Active'?'green':'gray'}>{position._dbStatus}</Badge>}
          </div>
          {position.mission && <p style={{ fontSize:12, color:G.muted, lineHeight:1.5, marginBottom:8 }}>{position.mission.slice(0,70)}{position.mission.length>70?'…':''}</p>}
          <div>{skills.map((sk,i) => <Tag key={i}>{sk.trim()}</Tag>)}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <ProgressRing pct={pct} />
          <button onClick={e => { e.stopPropagation(); onDelete(position.id) }} style={{ background:'none', color:'#c8d4e0', fontSize:15, padding:'2px 6px', borderRadius:4 }}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ── PositionDetail ───────────────────────────
function PositionDetail({ position, onClose, onEdit }) {
  if (!position) return null
  const skills    = (position.skillsRequired  ||'').split(/[、,，\n]/).filter(Boolean)
  const preferred = (position.skillsPreferred ||'').split(/[、,，\n]/).filter(Boolean)

  return (
    <Overlay onClose={onClose}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:24, paddingBottom:20, borderBottom:`1px solid ${G.border}` }}>
        <div>
          <h2 style={{ fontSize:21, fontWeight:800, color:G.navy, marginBottom:4 }}>{position.title||'（タイトル未設定）'}</h2>
          {position._dbInternalName && <div style={{ fontSize:13, color:G.muted, marginBottom:8 }}>（{position._dbInternalName}）</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {position.workStyle && <Badge color="teal">{position.workStyle}</Badge>}
            {position.salary    && <Badge color="gray">💰 {position.salary}</Badge>}
            {position._dbStatus && <Badge color={position._dbStatus==='Active'?'green':'gray'}>{position._dbStatus}</Badge>}
            {position._dbId     && <Badge color="navy">DB ID: {position._dbId}</Badge>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <Btn onClick={onEdit}>✏️ 編集</Btn>
          <Btn variant="muted" onClick={onClose}>閉じる</Btn>
        </div>
      </div>
      {SECTIONS.map(sec => {
        const secFields = FIELDS.filter(f => f.section===sec)
        if (!secFields.some(f => position[f.key]?.trim())) return null
        return (
          <div key={sec}>
            <SectionLabel>{sec}</SectionLabel>
            {secFields.map(f => {
              const val = position[f.key]; if (!val?.trim()) return null
              if (f.key==='skillsRequired')  return <div key={f.key} style={{ marginBottom:14 }}><div style={{ fontSize:12, fontWeight:700, color:G.slate, marginBottom:6 }}>{f.label}</div><div>{skills.map((s,i)=><Tag key={i}>{s.trim()}</Tag>)}</div></div>
              if (f.key==='skillsPreferred') return <div key={f.key} style={{ marginBottom:14 }}><div style={{ fontSize:12, fontWeight:700, color:G.slate, marginBottom:6 }}>{f.label}</div><div>{preferred.map((s,i)=><Tag key={i}>{s.trim()}</Tag>)}</div></div>
              const highlight = f.key==='interviewTips'?'amber':f.key==='selectionPoints'?'teal':null
              return (
                <div key={f.key} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:G.slate, marginBottom:6 }}>{f.label}</div>
                  {highlight ? <HighlightBox color={highlight}>{val}</HighlightBox> : <div style={{ fontSize:13, color:G.text, lineHeight:1.8, whiteSpace:'pre-wrap' }}>{val}</div>}
                </div>
              )
            })}
          </div>
        )
      })}
    </Overlay>
  )
}

// ─────────────────────────────────────────────
// [4] App — メインロジック
// ─────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey]           = useState(() => localStorage.getItem(API_KEY_STORAGE) || '')
  const [dbPositions, setDbPositions] = useState([])
  const [positions, setPositions]     = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') } catch { return [] } })
  const [view, setView]               = useState('list')
  const [editId, setEditId]           = useState(null)
  const [selected, setSelected]       = useState(null)
  const [searchQ, setSearchQ]         = useState('')
  const [aiResult, setAiResult]       = useState(null)
  const [searching, setSearching]     = useState(false)

  useEffect(() => {
    fetch('/positions_db.json').then(r => r.json()).then(setDbPositions).catch(() => {})
  }, [])

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)) }, [positions])

  const saveKey = (key) => { localStorage.setItem(API_KEY_STORAGE, key); setApiKey(key) }

  const savePosition = useCallback((data) => {
    const record = { ...data, id: editId||genId(), updatedAt: new Date().toISOString(), createdAt: data.createdAt||new Date().toISOString() }
    setPositions(prev => editId ? prev.map(p => p.id===editId ? record : p) : [record, ...prev])
    setEditId(null); setView('list')
  }, [editId])

  const deletePosition = (id) => { if (!confirm('このポジションを削除しますか？')) return; setPositions(prev => prev.filter(p => p.id!==id)) }
  const startEdit = (id) => { setEditId(id); setSelected(null); setView('edit') }
  const startAdd  = ()   => { setEditId(null); setView('add') }

  const doAiSearch = async () => {
    if (!searchQ.trim() || !positions.length || !apiKey) return
    setSearching(true); setAiResult(null)
    try { setAiResult(await aiSearchPositions(searchQ, positions, apiKey)) }
    catch { setAiResult({ ids:[], summary:'検索に失敗しました。' }) }
    setSearching(false)
  }

  const filtered = aiResult
    ? positions.filter(p => aiResult.ids.includes(p.id))
    : searchQ
    ? positions.filter(p => [...FIELDS.map(f=>p[f.key]||''), p.title||'', p._dbInternalName||''].join(' ').toLowerCase().includes(searchQ.toLowerCase()))
    : positions

  const editTarget  = editId ? positions.find(p => p.id===editId) : null
  const formInitial = editTarget ? { ...emptyPosition(), ...editTarget } : emptyPosition()

  return (
    <div style={css.app}>
      <GlobalStyle />
      <Navbar
        view={view} count={positions.length} dbCount={dbPositions.length} apiKey={apiKey}
        onList={() => setView('list')} onAdd={startAdd}
        onDbUpdate={() => setView('dbupdate')} onSaveKey={saveKey}
      />

      <main style={css.main}>

        {/* ── 一覧 ── */}
        {view === 'list' && (
          <>
            <div style={{ ...css.row, marginBottom:14 }}>
              <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setAiResult(null) }} onKeyDown={e => e.key==='Enter' && doAiSearch()} placeholder={apiKey ? '🔍 キーワード検索、またはAIへ質問（例：リモート可の求人は？）' : '🔍 キーワード検索'} />
              {apiKey ? (
                <Btn variant="secondary" onClick={doAiSearch} disabled={searching||!searchQ.trim()}>
                  {searching ? <span style={{ display:'flex', alignItems:'center', gap:6 }}><Spinner />検索中</span> : '🤖 AI検索'}
                </Btn>
              ) : (
                <span style={{ fontSize:12, color:G.muted, padding:'10px 14px', border:`1px dashed ${G.border}`, borderRadius:8, whiteSpace:'nowrap' }}>🤖 AI検索（要APIキー）</span>
              )}
              {(searchQ||aiResult) && <Btn variant="muted" onClick={() => { setSearchQ(''); setAiResult(null) }} style={{ padding:'9px 14px' }}>✕</Btn>}
            </div>
            {aiResult?.summary && <div style={{ background:G.tealLight, border:`1px solid rgba(25,184,166,.4)`, borderRadius:8, padding:'10px 16px', fontSize:13, color:G.tealDark, marginBottom:14 }}>🤖 {aiResult.summary}</div>}
            {positions.length===0 ? (
              <div style={css.empty}>
                <div style={{ fontSize:48, marginBottom:14 }}>📂</div>
                <div style={{ fontSize:16, fontWeight:700, color:G.slate, marginBottom:8 }}>ポジションがまだ登録されていません</div>
                <p style={{ fontSize:13, lineHeight:1.7, marginBottom:24 }}>「新規登録」からポジションを追加してください。<br />ポジションDBから選択、または議事録のAI自動入力が使えます。</p>
                <Btn onClick={startAdd}>＋ 最初のポジションを登録</Btn>
              </div>
            ) : filtered.length===0 ? (
              <div style={css.empty}><div style={{ fontSize:15 }}>該当するポジションが見つかりませんでした</div></div>
            ) : (
              <>
                <div style={{ fontSize:12, color:G.muted, marginBottom:10 }}>{filtered.length} 件</div>
                {filtered.map(p => <PositionCard key={p.id} position={p} onClick={() => setSelected(p)} onDelete={deletePosition} />)}
              </>
            )}
          </>
        )}

        {/* ── 新規登録 / 編集 ── */}
        {(view==='add'||view==='edit') && (
          <>
            <div style={{ ...css.row, justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:G.navy }}>{view==='edit' ? `✏️ 編集: ${editTarget?.title||'ポジション'}` : '＋ 新規ポジション登録'}</h2>
              <Btn variant="muted" onClick={() => { setView('list'); setEditId(null) }}>← 一覧に戻る</Btn>
            </div>
            <PositionForm key={editId||'new'} initialData={formInitial} apiKey={apiKey} dbPositions={dbPositions} onComplete={savePosition} onCancel={() => { setView('list'); setEditId(null) }} />
          </>
        )}

        {/* ── DBを更新 ── */}
        {view==='dbupdate' && (
          <>
            <div style={{ ...css.row, justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:G.navy }}>📥 ポジションDB更新</h2>
              <Btn variant="muted" onClick={() => setView('list')}>← 一覧に戻る</Btn>
            </div>
            <DbUpdater dbPositions={dbPositions} onUpdate={setDbPositions} />
          </>
        )}

      </main>

      {selected && <PositionDetail position={selected} onClose={() => setSelected(null)} onEdit={() => startEdit(selected.id)} />}
    </div>
  )
}
