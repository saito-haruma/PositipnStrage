// ============================================================
// App.jsx — 機能追加・変更はすべてこのファイルだけでOK
//
// 構成:
//   [1] スタイル定数
//   [2] 汎用UIパーツ (Btn, Badge, Tag, Overlay, Spinner …)
//   [3] 機能コンポーネント
//        - PositionSearchInput  ポジション名サジェスト
//        - Navbar               タブナビ
//        - GistSync             ★GitHub Gist連携（共有）
//        - DataPortal           ★CSV export / import
//        - DbUpdater            ExcelドラッグでDB更新
//        - DocImporter          AIドキュメント自動入力
//        - PositionForm         入力フォーム
//        - PositionCard         一覧カード
//        - PositionDetail       詳細モーダル
//   [4] App メインロジック
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FIELDS, SECTIONS, emptyPosition, genId,
  STORAGE_KEY, API_KEY_STORAGE,
  GIST_TOKEN_STORAGE, GIST_ID_STORAGE,
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
  app:   { minHeight:'100vh', background:G.bg, fontFamily:"'Noto Sans JP', -apple-system, sans-serif", color:G.text },
  main:  { maxWidth:900, margin:'0 auto', padding:'28px 20px' },
  nav:   { background:G.navy, padding:'0 24px', display:'flex', alignItems:'center', gap:6, height:54, position:'sticky', top:0, zIndex:100 },
  logo:  { color:G.teal, fontWeight:700, fontSize:15, marginRight:8 },
  card:  { background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:'16px 20px', marginBottom:10, cursor:'pointer' },
  field: { marginBottom:16 },
  label: { display:'block', fontSize:12, fontWeight:700, color:G.slate, marginBottom:6 },
  row:   { display:'flex', alignItems:'center', gap:8 },
  empty: { textAlign:'center', padding:'72px 20px', color:G.muted },
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

function Btn({ children, onClick, disabled, style, variant='primary' }) {
  const base = { padding:'9px 18px', fontSize:13, whiteSpace:'nowrap' }
  const variants = {
    primary:  { background:G.teal,    color:'#fff' },
    secondary:{ background:G.slate,   color:'#fff' },
    ghost:    { background:'rgba(255,255,255,.08)', color:'#aab4c4' },
    muted:    { background:G.muted,   color:'#fff' },
    outline:  { background:G.bg,      color:G.slate, border:`1px solid ${G.border}` },
    danger:   { background:'#e74c3c', color:'#fff' },
    navy:     { background:G.navy,    color:'#fff' },
  }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>
}

function Badge({ children, color='teal' }) {
  const colors = {
    teal:  { bg:G.tealLight, text:G.tealDark,  border:'#5DCAA5'  },
    gray:  { bg:'#F1EFE8',   text:'#5F5E5A',   border:'#B4B2A9'  },
    blue:  { bg:'#E6F1FB',   text:'#185FA5',   border:'#85B7EB'  },
    amber: { bg:G.amber,     text:'#7a5a00',   border:G.amberBorder },
    green: { bg:'#eafbf0',   text:'#1a6e3a',   border:'#6fcf97'  },
    red:   { bg:'#fff0f0',   text:'#c0392b',   border:'#f5c6c6'  },
    navy:  { bg:'#e8edf5',   text:G.navy,      border:'#b0bdd4'  },
    purple:{ bg:'#f3eeff',   text:'#6c3dbf',   border:'#c4a8f5'  },
  }
  const c = colors[color] || colors.teal
  return <span style={{ display:'inline-block', fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:5, background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>{children}</span>
}

function Tag({ children }) {
  return <span style={{ display:'inline-block', fontSize:11, padding:'2px 8px', borderRadius:4, background:G.tealLight, color:G.tealDark, border:`1px solid #5DCAA5`, fontFamily:'monospace', margin:'2px 2px 0 0' }}>{children}</span>
}

function SectionLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, color:G.teal, textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:`1px solid ${G.border}`, paddingBottom:5, marginBottom:12, marginTop:18 }}>{children}</div>
}

function HighlightBox({ children, color='teal' }) {
  const styles = {
    teal:  { background:G.tealLight, border:`1px solid rgba(25,184,166,.4)`, color:G.tealDark },
    amber: { background:G.amber,     border:`1px solid ${G.amberBorder}`,    color:'#7a5a00'  },
  }
  return <div style={{ borderRadius:8, padding:'12px 16px', fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap', ...styles[color] }}>{children}</div>
}

function Overlay({ children, onClose }) {
  return (
    <div onClick={e => e.target===e.currentTarget && onClose?.()} style={{ position:'fixed', inset:0, background:'rgba(10,20,40,.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#F7F9FC', borderRadius:12, maxWidth:740, width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'30px 34px', boxShadow:'0 8px 40px rgba(10,20,40,.22)' }}>{children}</div>
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

function Spinner({ size=14, color='rgba(255,255,255,.3)', topColor='#fff' }) {
  return <span style={{ display:'inline-block', width:size, height:size, border:`2px solid ${color}`, borderTopColor:topColor, borderRadius:'50%', animation:'rec-spin .7s linear infinite' }} />
}

function StatusBox({ status }) {
  if (!status) return null
  const sc = { ok:{bg:G.tealLight,color:G.tealDark,border:'#5DCAA5'}, err:{bg:'#fff0f0',color:'#c0392b',border:'#f5c6c6'}, info:{bg:'#f0f4ff',color:G.slate,border:'#c5d0e8'} }
  return <div style={{ padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:500, animation:'rec-fadein .2s ease', ...sc[status.type] }}>{status.msg}</div>
}

// ─────────────────────────────────────────────
// [3] 機能コンポーネント
// ─────────────────────────────────────────────

// ── CSV ユーティリティ（GistSync / DataPortal 共用）──────────
const CSV_ESCAPE = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, '\\n')
  return s.includes(',') || s.includes('"') || s.includes("'") ? `"${s.replace(/"/g, '""')}"` : s
}

const positionsToCsv = (positions) => {
  const COLS = ['id','title','_dbId','_dbInternalName','_dbStatus', ...FIELDS.map(f=>f.key), 'createdAt','updatedAt']
  const header = COLS.join(',')
  const rows   = positions.map(p => COLS.map(k => CSV_ESCAPE(p[k]??'')).join(','))
  return [header, ...rows].join('\r\n')
}

const csvToPositions = (csvText) => {
  const lines = csvText.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('データが空です')
  // ヘッダー解析
  const header = parseCsvLine(lines[0])
  const positions = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i])
    if (vals.length < 2) continue
    const obj = {}
    header.forEach((k, idx) => { obj[k] = (vals[idx] ?? '').replace(/\\n/g, '\n') })
    if (!obj.id) obj.id = genId()
    positions.push(obj)
  }
  return positions
}

const parseCsvLine = (line) => {
  const result = []; let cur = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c==='"' && line[i+1]==='"') { cur+='"'; i++ }
      else if (c==='"') { inQ=false }
      else cur+=c
    } else {
      if (c==='"') { inQ=true }
      else if (c===',') { result.push(cur); cur='' }
      else cur+=c
    }
  }
  result.push(cur)
  return result
}

// ── PositionSearchInput ──────────────────────
function PositionSearchInput({ value, onChange, dbPositions }) {
  const [query, setQuery]       = useState(value||'')
  const [suggestions, setSugs]  = useState([])
  const [showSugs, setShowSugs] = useState(false)
  const [selected, setSelected] = useState(null)
  const wrapRef = useRef()

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugs(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSugs([]); return }
    const q = query.toLowerCase()
    setSugs(dbPositions.filter(p => p.positionName.toLowerCase().includes(q) || p.internalName.toLowerCase().includes(q) || p.department.toLowerCase().includes(q)).slice(0,8))
  }, [query, dbPositions])

  const handleInput  = (e) => { const v=e.target.value; setQuery(v); setSelected(null); onChange(v); setShowSugs(true) }
  const handleSelect = (pos) => { setQuery(pos.positionName); setSelected(pos); onChange(pos.positionName, pos); setShowSugs(false) }
  const statusColor  = (s) => s==='Active'?'green':'gray'

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <input type="text" value={query} onChange={handleInput} onFocus={() => query && setShowSugs(true)}
        placeholder="ポジション名を入力 or DBから検索して選択（自由入力も可）"
        style={{ fontSize:15, fontWeight:700, padding:'12px 16px' }}
      />
      {showSugs && suggestions.length>0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'#fff', border:`1px solid ${G.border}`, borderTop:'none', borderRadius:'0 0 10px 10px', boxShadow:'0 8px 24px rgba(10,20,40,.12)', maxHeight:320, overflowY:'auto' }}>
          <div style={{ padding:'8px 14px 6px', fontSize:11, color:G.muted, fontWeight:600, borderBottom:`1px solid ${G.border}` }}>ポジションDB — {suggestions.length} 件マッチ</div>
          {suggestions.map((pos, i) => (
            <div key={pos.id} onClick={() => handleSelect(pos)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:i<suggestions.length-1?`1px solid ${G.border}`:'none' }}
              onMouseEnter={e => e.currentTarget.style.background=G.tealLight}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:G.navy, lineHeight:1.4, marginBottom:3 }}>{pos.positionName}</div>
                  {pos.internalName && <div style={{ fontSize:11, color:G.muted }}>{pos.internalName}</div>}
                  {pos.department   && <div style={{ fontSize:11, color:G.slate, marginTop:4 }}>{pos.department}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  <Badge color={statusColor(pos.status)}>{pos.status}</Badge>
                  {pos.salaryMin && pos.salaryMax && <span style={{ fontSize:10, color:G.muted }}>{pos.salaryMin}〜{pos.salaryMax}万</span>}
                </div>
              </div>
            </div>
          ))}
          <div onClick={() => setShowSugs(false)} style={{ padding:'10px 14px', cursor:'pointer', borderTop:`1px solid ${G.border}`, fontSize:12, color:G.muted, background:G.bg, borderRadius:'0 0 10px 10px' }}
            onMouseEnter={e => e.currentTarget.style.background='#e8edf5'}
            onMouseLeave={e => e.currentTarget.style.background=G.bg}
          >✏️ 「{query}」をそのまま入力する</div>
        </div>
      )}
      {selected && (
        <div style={{ marginTop:8, padding:'8px 12px', background:G.tealLight, border:`1px solid #5DCAA5`, borderRadius:8, fontSize:12, color:G.tealDark, display:'flex', alignItems:'center', gap:8 }}>
          <span>✅ DBポジションから選択中</span>
          <span style={{ fontWeight:700 }}>ID:{selected.id}</span>
          <span>{selected.department}</span>
          <Badge color={statusColor(selected.status)}>{selected.status}</Badge>
          <button onClick={() => { setSelected(null); setQuery(''); onChange('') }} style={{ marginLeft:'auto', background:'none', color:G.muted, fontSize:13, padding:'0 4px' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ── Navbar ──────────────────────────────────
function Navbar({ view, count, dbCount, gistLinked, apiKey, onList, onAdd, onDbUpdate, onGist, onData, onSaveKey }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(apiKey||'')
  const save = () => { onSaveKey(draft.trim()); setEditing(false) }

  const tabs = [
    { id:'list',     label:'一覧',        onClick:onList },
    { id:'add',      label:'＋ 新規登録',  onClick:onAdd },
    { id:'dbupdate', label:'📥 DBを更新',  onClick:onDbUpdate },
    { id:'gist',     label:`🔗 共有${gistLinked?' ✓':''}`, onClick:onGist },
    { id:'data',     label:'📦 データ管理', onClick:onData },
  ]

  return (
    <nav style={css.nav}>
      <span style={css.logo}>採用ポジション管理</span>
      {tabs.map(t => (
        <button key={t.id} onClick={t.onClick} style={{
          background: view===t.id ? 'rgba(25,184,166,.15)' : 'none',
          color: view===t.id ? G.teal : (t.id==='gist'&&gistLinked?'#7ecbb8':'#aab4c4'),
          padding:'7px 14px', fontSize:12, borderRadius:8,
        }}>{t.label}</button>
      ))}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ color:G.muted, fontSize:11 }}>{count}件 / DB{dbCount}件</span>
        {editing ? (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <input type="password" value={draft} onChange={e => setDraft(e.target.value)} placeholder="sk-..." autoFocus
              onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') setEditing(false) }}
              style={{ width:180, height:32, fontSize:12, padding:'0 10px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', borderRadius:8 }}
            />
            <Btn onClick={save} style={{ padding:'5px 12px', fontSize:12 }}>保存</Btn>
            <Btn onClick={() => setEditing(false)} variant="ghost" style={{ padding:'5px 8px' }}>✕</Btn>
          </div>
        ) : (
          <button onClick={() => { setDraft(apiKey||''); setEditing(true) }} style={{
            padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:8,
            background: apiKey?'rgba(25,184,166,.2)':'rgba(255,200,0,.15)',
            color: apiKey?G.teal:'#ffc800',
            border:`1px solid ${apiKey?'rgba(25,184,166,.4)':'rgba(255,200,0,.3)'}`,
          }}>🔑 {apiKey?'AI ON':'APIキー未設定'}</button>
        )}
      </div>
    </nav>
  )
}

// ── GistSync ─────────────────────────────────
// GitHub Gist を使ったチーム共有機能
// Token + Gist ID を設定するだけ。保存・読み込み・自動同期に対応。
function GistSync({ positions, onLoad }) {
  const [token,  setToken]  = useState(() => localStorage.getItem(GIST_TOKEN_STORAGE)||'')
  const [gistId, setGistId] = useState(() => localStorage.getItem(GIST_ID_STORAGE)||'')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [gistInfo, setGistInfo]   = useState(null)

  const setInfo = (type, msg) => setStatus({type, msg})

  const saveSettings = () => {
    localStorage.setItem(GIST_TOKEN_STORAGE, token.trim())
    localStorage.setItem(GIST_ID_STORAGE,    gistId.trim())
    setInfo('ok', '✅ 設定を保存しました')
  }

  const FILENAME = 'recruitment_positions.json'

  // Gistにアップロード（保存・上書き）
  const pushToGist = async () => {
    if (!token.trim()) { setInfo('err', 'GitHubトークンを入力してください'); return }
    setLoading(true)
    setInfo('info', '📤 Gistにアップロード中…')
    try {
      const body = {
        description: '採用ポジション管理データ',
        public: false,
        files: { [FILENAME]: { content: JSON.stringify(positions, null, 2) } },
      }
      const url    = gistId.trim() ? `https://api.github.com/gists/${gistId.trim()}` : 'https://api.github.com/gists'
      const method = gistId.trim() ? 'PATCH' : 'POST'
      const res  = await fetch(url, {
        method,
        headers: { Authorization:`Bearer ${token.trim()}`, 'Content-Type':'application/json', Accept:'application/vnd.github+json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e=await res.json(); throw new Error(e.message||`GitHub API error ${res.status}`) }
      const data = await res.json()
      if (!gistId.trim()) {
        setGistId(data.id)
        localStorage.setItem(GIST_ID_STORAGE, data.id)
      }
      setGistInfo({ id:data.id, url:data.html_url, updatedAt:data.updated_at })
      setInfo('ok', `✅ ${positions.length}件をGistに保存しました！ ID: ${data.id}`)
    } catch(e) { setInfo('err', `❌ ${e.message}`) }
    setLoading(false)
  }

  // Gistから読み込み
  const pullFromGist = async () => {
    if (!gistId.trim()) { setInfo('err', 'Gist IDを入力してください'); return }
    setLoading(true)
    setInfo('info', '📥 Gistから読み込み中…')
    try {
      const headers = token.trim() ? { Authorization:`Bearer ${token.trim()}`, Accept:'application/vnd.github+json' } : { Accept:'application/vnd.github+json' }
      const res  = await fetch(`https://api.github.com/gists/${gistId.trim()}`, { headers })
      if (!res.ok) { const e=await res.json(); throw new Error(e.message||`GitHub API error ${res.status}`) }
      const data = await res.json()
      const file = data.files[FILENAME]
      if (!file) throw new Error(`Gist内に "${FILENAME}" が見つかりません`)
      const loaded = JSON.parse(file.content)
      if (!Array.isArray(loaded)) throw new Error('データ形式が正しくありません')
      setGistInfo({ id:data.id, url:data.html_url, updatedAt:data.updated_at })
      onLoad(loaded)
      setInfo('ok', `✅ ${loaded.length}件を読み込みました（最終更新: ${new Date(data.updated_at).toLocaleString('ja-JP')}）`)
    } catch(e) { setInfo('err', `❌ ${e.message}`) }
    setLoading(false)
  }

  const isLinked = !!(token.trim() && gistId.trim())

  return (
    <div>
      {/* 設定カード */}
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:G.navy }}>🔗 GitHub Gist 連携設定</h3>
          {isLinked && <Badge color="green">接続済み</Badge>}
        </div>
        <p style={{ fontSize:13, color:G.muted, lineHeight:1.7, marginBottom:20 }}>
          GitHubのGistにデータを保存・共有できます。同じ<strong>Gist ID</strong>を使えば複数人・複数端末でデータを共有できます。<br />
          読み込みのみなら<strong>トークン不要</strong>（公開Gistのみ）。書き込みには<strong>Gistスコープ付きのトークン</strong>が必要です。
        </p>

        <div style={{ display:'grid', gap:14 }}>
          {/* Token */}
          <div>
            <label style={css.label}>
              GitHub Personal Access Token
              <span style={{ marginLeft:8, fontSize:10, color:G.muted, fontWeight:400 }}>
                （<a href="https://github.com/settings/tokens/new?scopes=gist" target="_blank" rel="noreferrer" style={{ color:G.teal }}>取得はこちら</a> — Gistスコープにチェック）
              </span>
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <input type={showToken?'text':'password'} value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
              <Btn variant="outline" onClick={() => setShowToken(v=>!v)} style={{ padding:'0 14px', whiteSpace:'nowrap' }}>{showToken?'隠す':'表示'}</Btn>
            </div>
          </div>

          {/* Gist ID */}
          <div>
            <label style={css.label}>
              Gist ID
              <span style={{ marginLeft:8, fontSize:10, color:G.muted, fontWeight:400 }}>（初回保存時に自動生成されます。共有する場合はここの値を共有してください）</span>
            </label>
            <input type="text" value={gistId} onChange={e => setGistId(e.target.value)} placeholder="例: a1b2c3d4e5f6g7h8i9j0..." />
          </div>

          <Btn onClick={saveSettings} variant="outline" style={{ alignSelf:'flex-start' }}>設定を保存</Btn>
        </div>
      </div>

      {/* 操作カード */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* アップロード */}
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:28, marginBottom:10 }}>📤</div>
          <h4 style={{ fontSize:14, fontWeight:700, color:G.navy, marginBottom:6 }}>Gistに保存</h4>
          <p style={{ fontSize:12, color:G.muted, lineHeight:1.6, marginBottom:16 }}>現在のデータ（{positions.length}件）をGistにアップロードします。チームに最新データを共有する時に使います。</p>
          <Btn onClick={pushToGist} disabled={loading || !token.trim()} style={{ width:'100%' }}>
            {loading ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner />保存中…</span> : '📤 Gistに保存する'}
          </Btn>
          {!token.trim() && <div style={{ fontSize:11, color:G.muted, marginTop:6 }}>※ トークンが必要です</div>}
        </div>

        {/* ダウンロード */}
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:28, marginBottom:10 }}>📥</div>
          <h4 style={{ fontSize:14, fontWeight:700, color:G.navy, marginBottom:6 }}>Gistから読み込み</h4>
          <p style={{ fontSize:12, color:G.muted, lineHeight:1.6, marginBottom:16 }}>GistからデータをロードしてこのブラウザのDBに反映します。共有されたGist IDを設定してから実行してください。</p>
          <Btn onClick={pullFromGist} disabled={loading || !gistId.trim()} variant="secondary" style={{ width:'100%' }}>
            {loading ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner />読み込み中…</span> : '📥 Gistから読み込む'}
          </Btn>
          {!gistId.trim() && <div style={{ fontSize:11, color:G.muted, marginTop:6 }}>※ Gist IDが必要です</div>}
        </div>
      </div>

      {/* ステータス */}
      {status && <div style={{ marginBottom:16 }}><StatusBox status={status} /></div>}

      {/* Gist情報 */}
      {gistInfo && (
        <div style={{ background:G.bg, border:`1px solid ${G.border}`, borderRadius:10, padding:'14px 18px', fontSize:13, animation:'rec-fadein .2s ease' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <span style={{ color:G.muted }}>Gist ID:</span>
            <code style={{ background:'#fff', padding:'2px 8px', borderRadius:4, fontSize:12, border:`1px solid ${G.border}` }}>{gistInfo.id}</code>
            <a href={gistInfo.url} target="_blank" rel="noreferrer" style={{ color:G.teal, fontSize:12 }}>GitHubで開く →</a>
            <span style={{ color:G.muted, fontSize:12, marginLeft:'auto' }}>最終更新: {new Date(gistInfo.updatedAt).toLocaleString('ja-JP')}</span>
          </div>
        </div>
      )}

      {/* 使い方ガイド */}
      <div style={{ background:G.bg, border:`1px solid ${G.border}`, borderRadius:10, padding:'16px 18px', marginTop:16, fontSize:12, color:G.muted, lineHeight:1.8 }}>
        <strong style={{ color:G.slate }}>共有の流れ</strong><br />
        ① トークンを設定 → 「Gistに保存」→ Gist IDが発行される<br />
        ② チームメンバーにGist IDを共有<br />
        ③ 受け取ったメンバーがGist IDを入力して「Gistから読み込む」
      </div>
    </div>
  )
}

// ── DataPortal ───────────────────────────────
// CSV export（全データDL） / import（CSVを読み込んで復元）
function DataPortal({ positions, onImport }) {
  const [status,   setStatus]   = useState(null)
  const [dragging, setDragging] = useState(false)
  const [preview,  setPreview]  = useState(null)
  const [pending,  setPending]  = useState(null)
  const fileRef = useRef()

  const setInfo = (type, msg) => setStatus({type, msg})

  // CSV ダウンロード
  const downloadCsv = () => {
    if (!positions.length) { setInfo('err', 'ダウンロードするデータがありません'); return }
    const csv  = positionsToCsv(positions)
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `recruitment_positions_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    setInfo('ok', `✅ ${positions.length}件をCSVでダウンロードしました`)
  }

  // CSV 読み込み
  const processFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv','tsv'].includes(ext)) { setInfo('err', 'CSVファイル（.csv）のみ対応しています'); return }
    setInfo('info', `📄 ${file.name} を読み込み中…`)
    setPending(null); setPreview(null)
    try {
      const text = await file.text()
      const parsed = csvToPositions(text)
      setPending(parsed)
      setPreview({ count:parsed.length, samples:parsed.slice(0,5), fileName:file.name })
      setInfo('ok', `✅ ${parsed.length}件を読み込みました。確認して「インポートする」を押してください。`)
    } catch(e) { setInfo('err', `❌ 読み込みエラー: ${e.message}`) }
  }

  const applyImport = () => {
    if (!pending) return
    onImport(pending)
    setInfo('ok', `🎉 ${pending.length}件をインポートしました！`)
    setPreview(null); setPending(null)
  }

  return (
    <div>
      {/* Export */}
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:G.navy, marginBottom:8 }}>📤 CSVエクスポート</h3>
        <p style={{ fontSize:13, color:G.muted, lineHeight:1.7, marginBottom:16 }}>
          登録済みポジションデータ（{positions.length}件）をCSVファイルとしてダウンロードします。<br />
          バックアップや別環境へのデータ移行に使えます。ダウンロードしたCSVをそのままインポートに使えます。
        </p>
        <Btn onClick={downloadCsv} disabled={!positions.length} style={{ fontSize:14 }}>
          ⬇️ CSVをダウンロード（{positions.length}件）
        </Btn>
      </div>

      {/* Import */}
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:G.navy, marginBottom:8 }}>📥 CSVインポート</h3>
        <p style={{ fontSize:13, color:G.muted, lineHeight:1.7, marginBottom:16 }}>
          以前ダウンロードしたCSVファイルをドラッグ＆ドロップして読み込みます。<br />
          <strong style={{ color:'#c0392b' }}>⚠️ 現在のデータは上書きされます。</strong>事前にCSVエクスポートをお勧めします。
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f=e.dataTransfer.files[0]; if(f) processFile(f) }}
          style={{ border:`2px dashed ${dragging?G.teal:G.border}`, borderRadius:10, padding:'32px 24px', textAlign:'center', cursor:'pointer', background:dragging?G.tealLight:G.bg, transition:'all .15s' }}
        >
          <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
          <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
          <div style={{ fontSize:14, fontWeight:700, color:dragging?G.tealDark:G.slate, marginBottom:4 }}>
            {dragging ? 'ここでドロップ！' : 'CSVファイルをここにドロップ'}
          </div>
          <div style={{ fontSize:12, color:G.muted }}>または クリックして選択 ／ .csv 対応</div>
        </div>
      </div>

      {/* ステータス */}
      {status && <div style={{ marginBottom:16 }}><StatusBox status={status} /></div>}

      {/* プレビュー */}
      {preview && (
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, animation:'rec-fadein .2s ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h4 style={{ fontSize:14, fontWeight:700, color:G.navy }}>📋 インポート確認 — {preview.fileName}（{preview.count}件）</h4>
            <Btn onClick={applyImport} variant="danger" style={{ fontSize:13 }}>
              ⚠️ インポートする（現在のデータを上書き）
            </Btn>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:G.bg }}>
                  {['ポジション名','社内ポジション名','年収','ステータス'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:G.muted, fontWeight:600, borderBottom:`1px solid ${G.border}`, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.samples.map((p, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${G.border}` }}>
                    <td style={{ padding:'8px 12px', color:G.navy, fontWeight:500, maxWidth:260 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title||'—'}</div>
                    </td>
                    <td style={{ padding:'8px 12px', color:G.muted, maxWidth:220 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p._dbInternalName||'—'}</div>
                    </td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap', color:G.muted }}>{p.salary||'—'}</td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                      {p._dbStatus ? <Badge color={p._dbStatus==='Active'?'green':'gray'}>{p._dbStatus}</Badge> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10, fontSize:12, color:G.muted }}>※ 上位5件を表示。残り{Math.max(0,preview.count-5)}件も含めてインポートされます。</div>
        </div>
      )}
    </div>
  )
}

// ── DbUpdater ────────────────────────────────
function DbUpdater({ dbPositions, onUpdate }) {
  const [dragging, setDragging] = useState(false)
  const [status,   setStatus]   = useState(null)
  const [preview,  setPreview]  = useState(null)
  const [pending,  setPending]  = useState(null)
  const fileRef = useRef()
  const setInfo = (type, msg) => setStatus({type, msg})

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
    const buf  = await file.arrayBuffer()
    const wb   = window.XLSX.read(buf, { type:'array' })
    const sheetName = wb.SheetNames.includes('ポジション一覧') ? 'ポジション一覧' : wb.SheetNames[0]
    const ws   = wb.Sheets[sheetName]
    const rows = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
    let headerIdx = rows.findIndex(r => r.some(c => String(c).trim()==='ID'))
    if (headerIdx<0) throw new Error('「ID」列が見つかりませんでした')
    const header = rows[headerIdx].map(c => String(c).trim())
    const col    = (name) => header.indexOf(name)
    const positions = []
    for (let i=headerIdx+1; i<rows.length; i++) {
      const r = rows[i]; if (!r[col('ID')]) continue
      positions.push({
        id:           String(r[col('ID')]),
        positionName: String(r[col('ポジション名')]     ||''),
        internalName: String(r[col('社内ポジション名')] ||''),
        department:   String(r[col('部署')]             ||''),
        status:       String(r[col('ステータス')]        ||''),
        priority:     String(r[col('優先度')]            ||''),
        salaryMin:    String(r[col('年収下限(万)')]      ||''),
        salaryMax:    String(r[col('年収上限(万)')]      ||''),
        location:     String(r[col('勤務地')]            ||''),
      })
    }
    return positions
  }

  const processFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx','xls','xlsm'].includes(ext)) { setInfo('err','❌ Excel ファイル（.xlsx/.xls）のみ対応'); return }
    setInfo('info', `📊 ${file.name} を解析中…`)
    setPending(null); setPreview(null)
    try {
      const parsed = await parseExcel(file)
      setPending(parsed)
      setPreview({ count:parsed.length, samples:parsed.slice(0,5), fileName:file.name })
      setInfo('ok', `✅ ${parsed.length}件を読み込みました。確認して「DBを更新する」を押してください。`)
    } catch(e) { setInfo('err', `❌ 解析エラー: ${e.message}`) }
  }

  const applyUpdate = () => {
    if (!pending) return
    onUpdate(pending)
    setInfo('ok', `🎉 DBを${pending.length}件に更新しました！`)
    setPreview(null); setPending(null)
  }

  const downloadJson = () => {
    if (!pending) return
    const blob = new Blob([JSON.stringify(pending, null, 2)], { type:'application/json' })
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob)
    a.download='positions_db.json'; a.click()
  }

  return (
    <div>
      <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:G.navy, marginBottom:8 }}>📥 ポジションDBを更新</h3>
        <p style={{ fontSize:13, color:G.muted, lineHeight:1.7, marginBottom:16 }}>
          最新のExcelファイルをドラッグするだけでポジション名サジェストのDBを更新できます。<br />
          現在のDB: <strong style={{ color:G.navy }}>{dbPositions.length}件</strong>
        </p>
        <div onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f=e.dataTransfer.files[0]; if(f) processFile(f) }}
          style={{ border:`2px dashed ${dragging?G.teal:G.border}`, borderRadius:10, padding:'36px 24px', textAlign:'center', cursor:'pointer', background:dragging?G.tealLight:G.bg, transition:'all .15s' }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" style={{ display:'none' }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
          <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:700, color:dragging?G.tealDark:G.slate, marginBottom:6 }}>{dragging?'ここでドロップ！':'Excelファイルをここにドロップ'}</div>
          <div style={{ fontSize:12, color:G.muted }}>クリックして選択も可 ／ .xlsx .xls .xlsm 対応</div>
        </div>
      </div>

      {status && <div style={{ marginBottom:16 }}><StatusBox status={status} /></div>}

      {preview && (
        <div style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:12, padding:24, animation:'rec-fadein .2s ease' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h4 style={{ fontSize:14, fontWeight:700, color:G.navy }}>📋 {preview.fileName}（{preview.count}件）</h4>
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant="outline" onClick={downloadJson} style={{ fontSize:12, padding:'6px 14px' }}>⬇️ JSONをDL（永続化用）</Btn>
              <Btn onClick={applyUpdate} style={{ fontSize:13 }}>🔄 DBを更新する（{preview.count}件）</Btn>
            </div>
          </div>
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
                {preview.samples.map((p,i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${G.border}` }}>
                    <td style={{ padding:'8px 12px', color:G.muted }}>{p.id}</td>
                    <td style={{ padding:'8px 12px', color:G.navy, fontWeight:500, maxWidth:240 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.positionName}</div></td>
                    <td style={{ padding:'8px 12px', color:G.muted, maxWidth:200 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.internalName}</div></td>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>{p.department}</td>
                    <td style={{ padding:'8px 12px' }}><Badge color={p.status==='Active'?'green':'gray'}>{p.status}</Badge></td>
                    <td style={{ padding:'8px 12px', color:G.muted }}>{p.salaryMin&&p.salaryMax?`${p.salaryMin}〜${p.salaryMax}万`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DocImporter ──────────────────────────────
const ACCEPTED_TYPES = {
  'application/pdf':{ label:'PDF',     icon:'📄' },
  'image/png':      { label:'画像',    icon:'🖼️' },
  'image/jpeg':     { label:'画像',    icon:'🖼️' },
  'image/webp':     { label:'画像',    icon:'🖼️' },
  'text/plain':     { label:'テキスト',icon:'📝' },
}

function DocImporter({ apiKey, onExtract }) {
  const [open,     setOpen]     = useState(false)
  const [docText,  setDocText]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [status,   setStatus]   = useState(null)
  const [dragging, setDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [pending,  setPending]  = useState(null)
  const fileRef = useRef()
  const setInfo = (type, msg) => setStatus({type, msg})

  const processFile = async (file) => {
    const meta = ACCEPTED_TYPES[file.type]
    if (!meta) { setInfo('err','対応していないファイル形式です（PDF・画像・テキストのみ）'); return }
    setFileInfo({ name:file.name, ...meta }); setDocText(''); setPending(null)
    setInfo('info', `${meta.icon} 読み込み中…`)
    try {
      let input
      if (file.type==='application/pdf') {
        setInfo('info','📄 PDFからテキスト抽出中…')
        const text = await extractTextFromPdf(file)
        const t = text.slice(0,8000); setDocText(t); input={type:'text',content:t}
      } else if (file.type.startsWith('image/')) {
        const b64 = await fileToBase64(file)
        input = {type:'image',content:b64,mimeType:file.type}; setDocText('[画像ファイル]')
      } else {
        const text = (await file.text()).slice(0,8000); setDocText(text); input={type:'text',content:text}
      }
      setPending(input); setInfo('ok',`✅ 読み込み完了（${file.name}）`)
    } catch(e) { setInfo('err',`読み込みエラー: ${e.message}`) }
  }

  const handleExtract = async () => {
    const input = pending||(docText.trim()?{type:'text',content:docText}:null)
    if (!input) return
    setLoading(true); setInfo('info','🤖 GPT-4oで解析中…')
    try { const r=await extractPositionFromDoc(input,FIELDS,apiKey); onExtract(r); setInfo('ok','✅ 自動入力完了！') }
    catch(e) { setInfo('err',`エラー: ${e.message}`) }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom:24 }}>
      <button onClick={() => setOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, textAlign:'left', background:`linear-gradient(135deg,${G.navy} 0%,${G.slate} 100%)`, color:'#fff', padding:'12px 20px', fontSize:14, borderRadius:open?'12px 12px 0 0':12 }}>
        <span>🤖 AIドキュメント自動入力</span>
        <span style={{ background:'rgba(25,184,166,.3)',color:G.teal,border:'1px solid rgba(25,184,166,.5)',fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:700 }}>GPT-4o</span>
        {!apiKey&&<span style={{ background:'rgba(255,200,0,.2)',color:'#ffc800',border:'1px solid rgba(255,200,0,.4)',fontSize:11,padding:'2px 8px',borderRadius:20 }}>🔑 APIキー必要</span>}
        <span style={{ marginLeft:'auto',fontSize:11,opacity:.7 }}>{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div style={{ background:'#fff',border:`1px solid ${G.border}`,borderTop:'none',borderRadius:'0 0 12px 12px',padding:20 }}>
          {!apiKey&&<div style={{ background:'#fffbe6',border:`1px solid ${G.amberBorder}`,borderRadius:8,padding:'10px 14px',fontSize:13,color:'#7a5a00',marginBottom:16 }}>🔑 AI自動入力にはAPIキーが必要です</div>}
          <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:14 }}>
            {['📄 PDF','🖼️ 画像','📝 テキスト'].map(f=><span key={f} style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:G.tealLight,color:G.tealDark,border:'1px solid #5DCAA5',fontWeight:600 }}>{f}</span>)}
            <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'#f5f5f5',color:'#aaa',border:'1px solid #ddd',fontWeight:600,textDecoration:'line-through' }}>🎬 動画（非対応）</span>
          </div>
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)processFile(f)}}
            style={{ border:`2px dashed ${dragging?G.teal:G.border}`,borderRadius:8,padding:24,textAlign:'center',cursor:'pointer',background:dragging?G.tealLight:G.bg,marginBottom:14,transition:'all .15s' }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" style={{ display:'none' }} onChange={e=>e.target.files[0]&&processFile(e.target.files[0])} />
            {fileInfo
              ? <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:10 }}><span style={{ fontSize:24 }}>{fileInfo.icon}</span><span style={{ fontSize:13,fontWeight:600,color:G.navy }}>{fileInfo.name}</span><Badge>{fileInfo.label}</Badge></div>
              : <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}><span style={{ fontSize:28 }}>📂</span><span style={{ fontSize:13,color:G.slate }}>ファイルをドロップ or クリック</span></div>
            }
          </div>
          <div style={{ textAlign:'center',position:'relative',margin:'12px 0',fontSize:12,color:G.muted }}>
            <div style={{ position:'absolute',top:'50%',left:0,right:0,height:1,background:G.border }} />
            <span style={{ position:'relative',background:'#fff',padding:'0 12px' }}>または直接テキストを貼り付け</span>
          </div>
          <textarea value={docText} onChange={e=>{setDocText(e.target.value);setPending(null);setFileInfo(null)}} placeholder={'例）\n■ MTG議事録\nポジション：シニアエンジニア\n必須：Python 3年以上\n...'} rows={6} />
          {status && <div style={{ marginTop:10 }}><StatusBox status={status} /></div>}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12 }}>
            <span style={{ fontSize:11,color:G.muted }}>💡 1回 約$0.03〜0.10（GPT-4o）</span>
            <Btn onClick={handleExtract} disabled={loading||!apiKey||(!docText.trim()&&!pending)}>
              {loading?<span style={{ display:'flex',alignItems:'center',gap:8 }}><Spinner/>解析中…</span>:'✨ 自動入力する'}
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
  const set = (key, val) => setData(prev => ({...prev,[key]:val}))

  const handleExtract = (extracted) => {
    setData(prev => { const next={...prev}; Object.entries(extracted).forEach(([k,v])=>{ if(v) next[k]=v }); return next })
    setExtractMsg('✅ 自動入力完了！内容を確認・修正してください。')
  }

  const handleTitleChange = (name, dbPos) => {
    set('title', name)
    if (dbPos) setData(prev => ({...prev, title:name, _dbId:dbPos.id, _dbInternalName:dbPos.internalName, _dbStatus:dbPos.status,
      salary:dbPos.salaryMin&&dbPos.salaryMax?`${dbPos.salaryMin}〜${dbPos.salaryMax}万円`:prev.salary,
      deptStructure:dbPos.department?(dbPos.department+(prev.deptStructure?'\n'+prev.deptStructure:'')):prev.deptStructure,
      workStyle:dbPos.location||prev.workStyle,
    }))
  }

  const filledCount   = FIELDS.filter(f => data[f.key]?.trim()).length
  const sectionFields = FIELDS.filter(f => f.section===activeSection)

  return (
    <div style={{ background:G.card,border:`1px solid ${G.border}`,borderRadius:12,padding:28 }}>
      <DocImporter apiKey={apiKey} onExtract={handleExtract} />
      {extractMsg && <div style={{ background:G.tealLight,border:`1px solid #5DCAA5`,borderRadius:8,padding:'10px 14px',fontSize:13,color:G.tealDark,marginBottom:20 }}>{extractMsg}</div>}
      <div style={{ marginBottom:20 }}>
        <label style={{ ...css.label,display:'flex',alignItems:'center',gap:8 }}>
          ポジション名
          <span style={{ background:'#fee',color:'#c0392b',fontSize:10,padding:'2px 7px',borderRadius:4,fontWeight:600 }}>必須</span>
          <span style={{ background:G.tealLight,color:G.tealDark,fontSize:10,padding:'2px 7px',borderRadius:4,fontWeight:600 }}>DBから選択 or 自由入力</span>
        </label>
        <PositionSearchInput value={data.title||''} onChange={handleTitleChange} dbPositions={dbPositions} />
        {data._dbInternalName && <div style={{ marginTop:8,fontSize:12,color:G.muted }}>社内ポジション名：<span style={{ color:G.slate,fontWeight:600 }}>{data._dbInternalName}</span></div>}
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20 }}>
        <div style={{ flex:1,height:6,background:G.border,borderRadius:3,overflow:'hidden' }}>
          <div style={{ height:'100%',background:G.teal,borderRadius:3,width:`${(filledCount/FIELDS.length)*100}%`,transition:'width .3s' }} />
        </div>
        <span style={{ fontSize:12,color:G.muted,whiteSpace:'nowrap' }}>{filledCount}/{FIELDS.length}項目入力済み</span>
      </div>
      <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${G.border}` }}>
        {SECTIONS.map(sec => {
          const filled = FIELDS.filter(f=>f.section===sec&&data[f.key]?.trim()).length
          const isActive = activeSection===sec
          return (
            <button key={sec} onClick={() => setSection(sec)} style={{ padding:'6px 14px',fontSize:12,borderRadius:20,fontWeight:500,display:'flex',alignItems:'center',gap:5,background:isActive?G.navy:G.bg,color:isActive?'#fff':G.slate,border:`1px solid ${isActive?G.navy:G.border}` }}>
              {sec}
              {filled>0&&<span style={{ background:isActive?'rgba(255,255,255,.25)':G.teal,color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:700 }}>{filled}</span>}
            </button>
          )
        })}
      </div>
      <div>
        {sectionFields.map(f => (
          <div key={f.key} style={css.field}>
            <label style={css.label}>{f.label}{data[f.key]?.trim()&&<span style={{ color:G.teal,fontSize:12,marginLeft:6,fontWeight:700 }}>✓</span>}</label>
            <textarea value={data[f.key]||''} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder} rows={f.rows} />
          </div>
        ))}
      </div>
      <div style={{ display:'flex',justifyContent:'flex-end',gap:10,marginTop:28,paddingTop:20,borderTop:`1px solid ${G.border}` }}>
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
  const pct    = Math.round((FIELDS.filter(f=>position[f.key]?.trim()).length/FIELDS.length)*100)
  return (
    <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ ...css.card,borderColor:hover?G.teal:G.border,boxShadow:hover?'0 2px 16px rgba(25,184,166,.12)':'none',transform:hover?'translateY(-1px)':'none',transition:'all .15s' }}
    >
      <div style={{ display:'flex',alignItems:'flex-start',gap:12 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:15,fontWeight:700,color:G.navy,marginBottom:4 }}>{position.title||'（タイトル未設定）'}</div>
          {position._dbInternalName&&<div style={{ fontSize:11,color:G.muted,marginBottom:6 }}>（{position._dbInternalName}）</div>}
          <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginBottom:8 }}>
            {position.workStyle&&<Badge color="teal">{position.workStyle}</Badge>}
            {position.salary   &&<Badge color="gray">💰 {position.salary}</Badge>}
            {position._dbStatus&&<Badge color={position._dbStatus==='Active'?'green':'gray'}>{position._dbStatus}</Badge>}
          </div>
          {position.mission&&<p style={{ fontSize:12,color:G.muted,lineHeight:1.5,marginBottom:8 }}>{position.mission.slice(0,70)}{position.mission.length>70?'…':''}</p>}
          <div>{skills.map((sk,i)=><Tag key={i}>{sk.trim()}</Tag>)}</div>
        </div>
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
          <ProgressRing pct={pct} />
          <button onClick={e=>{e.stopPropagation();onDelete(position.id)}} style={{ background:'none',color:'#c8d4e0',fontSize:15,padding:'2px 6px',borderRadius:4 }}>✕</button>
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
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${G.border}` }}>
        <div>
          <h2 style={{ fontSize:21,fontWeight:800,color:G.navy,marginBottom:4 }}>{position.title||'（タイトル未設定）'}</h2>
          {position._dbInternalName&&<div style={{ fontSize:13,color:G.muted,marginBottom:8 }}>（{position._dbInternalName}）</div>}
          <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
            {position.workStyle&&<Badge color="teal">{position.workStyle}</Badge>}
            {position.salary   &&<Badge color="gray">💰 {position.salary}</Badge>}
            {position._dbStatus&&<Badge color={position._dbStatus==='Active'?'green':'gray'}>{position._dbStatus}</Badge>}
            {position._dbId    &&<Badge color="navy">DB ID:{position._dbId}</Badge>}
          </div>
        </div>
        <div style={{ display:'flex',gap:8,flexShrink:0 }}>
          <Btn onClick={onEdit}>✏️ 編集</Btn>
          <Btn variant="muted" onClick={onClose}>閉じる</Btn>
        </div>
      </div>
      {SECTIONS.map(sec => {
        const secFields = FIELDS.filter(f=>f.section===sec)
        if (!secFields.some(f=>position[f.key]?.trim())) return null
        return (
          <div key={sec}>
            <SectionLabel>{sec}</SectionLabel>
            {secFields.map(f => {
              const val=position[f.key]; if (!val?.trim()) return null
              if (f.key==='skillsRequired')  return <div key={f.key} style={{ marginBottom:14 }}><div style={{ fontSize:12,fontWeight:700,color:G.slate,marginBottom:6 }}>{f.label}</div><div>{skills.map((s,i)=><Tag key={i}>{s.trim()}</Tag>)}</div></div>
              if (f.key==='skillsPreferred') return <div key={f.key} style={{ marginBottom:14 }}><div style={{ fontSize:12,fontWeight:700,color:G.slate,marginBottom:6 }}>{f.label}</div><div>{preferred.map((s,i)=><Tag key={i}>{s.trim()}</Tag>)}</div></div>
              const highlight=f.key==='interviewTips'?'amber':f.key==='selectionPoints'?'teal':null
              return (
                <div key={f.key} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:G.slate,marginBottom:6 }}>{f.label}</div>
                  {highlight?<HighlightBox color={highlight}>{val}</HighlightBox>:<div style={{ fontSize:13,color:G.text,lineHeight:1.8,whiteSpace:'pre-wrap' }}>{val}</div>}
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
  const [apiKey,      setApiKey]      = useState(() => localStorage.getItem(API_KEY_STORAGE)||'')
  const [dbPositions, setDbPositions] = useState([])
  const [positions,   setPositions]   = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') } catch { return [] } })
  const [view,        setView]        = useState('list')
  const [editId,      setEditId]      = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [searchQ,     setSearchQ]     = useState('')
  const [aiResult,    setAiResult]    = useState(null)
  const [searching,   setSearching]   = useState(false)

  const gistLinked = !!(localStorage.getItem(GIST_TOKEN_STORAGE) && localStorage.getItem(GIST_ID_STORAGE))

  useEffect(() => { fetch('/positions_db.json').then(r=>r.json()).then(setDbPositions).catch(()=>{}) }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)) }, [positions])

  const saveKey      = (key) => { localStorage.setItem(API_KEY_STORAGE, key); setApiKey(key) }
  const savePosition = useCallback((data) => {
    const record = { ...data, id:editId||genId(), updatedAt:new Date().toISOString(), createdAt:data.createdAt||new Date().toISOString() }
    setPositions(prev => editId ? prev.map(p=>p.id===editId?record:p) : [record,...prev])
    setEditId(null); setView('list')
  }, [editId])

  const deletePosition = (id) => { if (!confirm('削除しますか？')) return; setPositions(prev=>prev.filter(p=>p.id!==id)) }
  const startEdit = (id) => { setEditId(id); setSelected(null); setView('edit') }
  const startAdd  = ()   => { setEditId(null); setView('add') }

  const doAiSearch = async () => {
    if (!searchQ.trim()||!positions.length||!apiKey) return
    setSearching(true); setAiResult(null)
    try { setAiResult(await aiSearchPositions(searchQ, positions, apiKey)) }
    catch { setAiResult({ids:[],summary:'検索に失敗しました。'}) }
    setSearching(false)
  }

  const filtered = aiResult
    ? positions.filter(p=>aiResult.ids.includes(p.id))
    : searchQ
    ? positions.filter(p=>[...FIELDS.map(f=>p[f.key]||''),p.title||'',p._dbInternalName||''].join(' ').toLowerCase().includes(searchQ.toLowerCase()))
    : positions

  const editTarget  = editId ? positions.find(p=>p.id===editId) : null
  const formInitial = editTarget ? {...emptyPosition(),...editTarget} : emptyPosition()

  return (
    <div style={css.app}>
      <GlobalStyle />
      <Navbar
        view={view} count={positions.length} dbCount={dbPositions.length}
        gistLinked={gistLinked} apiKey={apiKey}
        onList={()=>setView('list')} onAdd={startAdd}
        onDbUpdate={()=>setView('dbupdate')}
        onGist={()=>setView('gist')}
        onData={()=>setView('data')}
        onSaveKey={saveKey}
      />

      <main style={css.main}>

        {/* 一覧 */}
        {view==='list' && (
          <>
            <div style={{ ...css.row,marginBottom:14 }}>
              <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);setAiResult(null)}} onKeyDown={e=>e.key==='Enter'&&doAiSearch()} placeholder={apiKey?'🔍 キーワード検索、またはAIへ質問':'🔍 キーワード検索'} />
              {apiKey
                ? <Btn variant="secondary" onClick={doAiSearch} disabled={searching||!searchQ.trim()}>{searching?<span style={{ display:'flex',alignItems:'center',gap:6 }}><Spinner/>検索中</span>:'🤖 AI検索'}</Btn>
                : <span style={{ fontSize:12,color:G.muted,padding:'10px 14px',border:`1px dashed ${G.border}`,borderRadius:8,whiteSpace:'nowrap' }}>🤖 AI検索（要APIキー）</span>
              }
              {(searchQ||aiResult)&&<Btn variant="muted" onClick={()=>{setSearchQ('');setAiResult(null)}} style={{ padding:'9px 14px' }}>✕</Btn>}
            </div>
            {aiResult?.summary&&<div style={{ background:G.tealLight,border:`1px solid rgba(25,184,166,.4)`,borderRadius:8,padding:'10px 16px',fontSize:13,color:G.tealDark,marginBottom:14 }}>🤖 {aiResult.summary}</div>}
            {positions.length===0
              ? <div style={css.empty}><div style={{ fontSize:48,marginBottom:14 }}>📂</div><div style={{ fontSize:16,fontWeight:700,color:G.slate,marginBottom:8 }}>ポジションがまだ登録されていません</div><p style={{ fontSize:13,lineHeight:1.7,marginBottom:24 }}>「新規登録」からポジションを追加してください</p><Btn onClick={startAdd}>＋ 最初のポジションを登録</Btn></div>
              : filtered.length===0
              ? <div style={css.empty}><div style={{ fontSize:15 }}>該当するポジションが見つかりませんでした</div></div>
              : <><div style={{ fontSize:12,color:G.muted,marginBottom:10 }}>{filtered.length}件</div>{filtered.map(p=><PositionCard key={p.id} position={p} onClick={()=>setSelected(p)} onDelete={deletePosition} />)}</>
            }
          </>
        )}

        {/* 新規登録 / 編集 */}
        {(view==='add'||view==='edit') && (
          <>
            <div style={{ ...css.row,justifyContent:'space-between',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:G.navy }}>{view==='edit'?`✏️ 編集: ${editTarget?.title||''}` :'＋ 新規ポジション登録'}</h2>
              <Btn variant="muted" onClick={()=>{setView('list');setEditId(null)}}>← 一覧に戻る</Btn>
            </div>
            <PositionForm key={editId||'new'} initialData={formInitial} apiKey={apiKey} dbPositions={dbPositions} onComplete={savePosition} onCancel={()=>{setView('list');setEditId(null)}} />
          </>
        )}

        {/* DBを更新 */}
        {view==='dbupdate' && (
          <>
            <div style={{ ...css.row,justifyContent:'space-between',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:G.navy }}>📥 ポジションDB更新</h2>
              <Btn variant="muted" onClick={()=>setView('list')}>← 一覧に戻る</Btn>
            </div>
            <DbUpdater dbPositions={dbPositions} onUpdate={setDbPositions} />
          </>
        )}

        {/* 共有（Gist） */}
        {view==='gist' && (
          <>
            <div style={{ ...css.row,justifyContent:'space-between',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:G.navy }}>🔗 GitHub Gist でデータ共有</h2>
              <Btn variant="muted" onClick={()=>setView('list')}>← 一覧に戻る</Btn>
            </div>
            <GistSync positions={positions} onLoad={(loaded)=>{setPositions(loaded);setView('list')}} />
          </>
        )}

        {/* データ管理（CSV） */}
        {view==='data' && (
          <>
            <div style={{ ...css.row,justifyContent:'space-between',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:G.navy }}>📦 データ管理（CSV）</h2>
              <Btn variant="muted" onClick={()=>setView('list')}>← 一覧に戻る</Btn>
            </div>
            <DataPortal positions={positions} onImport={(loaded)=>{setPositions(loaded);setView('list')}} />
          </>
        )}

      </main>

      {selected&&<PositionDetail position={selected} onClose={()=>setSelected(null)} onEdit={()=>startEdit(selected.id)} />}
    </div>
  )
}
