import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { matchAgainstRules } from '../lib/categorize'
import { formatDate } from '../lib/format'
import CategoryPicker from '../components/CategoryPicker'
import MergeVendorModal from '../components/MergeVendorModal'
import {
  RULE_SUGGESTION_MIN_CONFIDENCE,
  RULE_SUGGESTION_MIN_COUNT,
  VENDOR_CONFIDENCE_INCREMENT,
  VENDOR_CONFIDENCE_RESET_ON_OVERRIDE,
} from '../lib/constants'

function confidenceColor(c) {
  if (c >= 0.9) return 'var(--green)'
  if (c >= 0.7) return 'var(--yellow)'
  return 'var(--red)'
}

export default function Vendors() {
  const { household } = useAuth()
  const [vendors, setVendors] = useState([])
  const [rules, setRules] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [edits, setEdits] = useState({})
  const [mergeVendor, setMergeVendor] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: r }, { data: c }] = await Promise.all([
      supabase.from('vendors').select('*, categories(name, type)').order('transaction_count', { ascending: false }),
      supabase.from('categorization_rules').select('*').eq('active', true),
      supabase.from('categories').select('*').order('name'),
    ])
    setVendors(v || [])
    setRules(r || [])
    setCategories(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [household?.id])

  function setEdit(id, field, value) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }
  function getEdit(vendor, field) {
    return edits[vendor.id]?.[field] !== undefined ? edits[vendor.id][field] : vendor[field]
  }

  async function saveVendor(v) {
    setError('')
    const catId = edits[v.id]?.suggested_category_id !== undefined ? edits[v.id].suggested_category_id : v.suggested_category_id
    const { error } = await supabase.from('vendors').update({
      suggested_category_id: catId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', v.id)
    if (error) { setError(error.message); return }
    setEdits((prev) => { const n = { ...prev }; delete n[v.id]; return n })
    load()
  }

  async function toggleAutoApprove(v) {
    setError('')
    const { error } = await supabase.from('vendors').update({ auto_approve: !v.auto_approve, updated_at: new Date().toISOString() }).eq('id', v.id)
    if (error) { setError(error.message); return }
    load()
  }

  async function deleteVendor(v) {
    if (!window.confirm(`Slette leverandøren «${v.normalized_name}»? Neste transaksjon herfra må læres på nytt.`)) return
    await supabase.from('vendors').delete().eq('id', v.id)
    load()
  }

  async function createRuleFromVendor(v) {
    setError('')
    if (!v.suggested_category_id) return
    const { error } = await supabase.from('categorization_rules').insert({
      household_id: household.id,
      match_type: 'contains',
      match_value: v.normalized_name,
      category_id: v.suggested_category_id,
      priority: rules.length,
      active: true,
    })
    if (error) { setError(error.message); return }
    load()
  }

  async function dismissRuleSuggestion(v) {
    await supabase.from('vendors').update({ rule_suggestion_dismissed: true }).eq('id', v.id)
    load()
  }

  const filtered = vendors.filter((v) => v.normalized_name.toLowerCase().includes(search.toLowerCase()))

  // Leverandører med sterk, gjentatt tillit som ennå ikke er dekket av en
  // regel — kandidater til å bli en permanent regel i stedet for å måtte
  // slås opp i leverandørhistorikken (eller spørre AI) hver eneste import.
  const ruleSuggestions = useMemo(() => {
    return vendors.filter((v) => {
      if (v.rule_suggestion_dismissed) return false
      if (v.transaction_count < RULE_SUGGESTION_MIN_COUNT) return false
      if (Number(v.confidence) < RULE_SUGGESTION_MIN_CONFIDENCE) return false
      if (!v.suggested_category_id) return false
      const category = categories.find((c) => c.id === v.suggested_category_id)
      if (!category) return false
      return !matchAgainstRules(rules, v.normalized_name, category.type)
    })
  }, [vendors, rules, categories])

  if (loading) return <div className="stack"><div className="page-title">Leverandører</div><div className="text-muted">Laster…</div></div>

  return (
    <div className="stack">
      {mergeVendor && (
        <MergeVendorModal
          primary={mergeVendor}
          vendors={vendors}
          onClose={() => setMergeVendor(null)}
          onMerged={() => { setMergeVendor(null); load() }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Leverandører</div>
          <div className="page-sub">{vendors.length} leverandører · {vendors.filter((v) => v.auto_approve).length} med auto-godkjenning</div>
        </div>
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

      {ruleSuggestions.length > 0 && (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <div className="row">
            <span className="section-title" style={{ marginBottom: 0 }}>Regelforslag</span>
            <span className="badge badge-yellow">{ruleSuggestions.length}</span>
          </div>
          <div className="card">
            {ruleSuggestions.map((v) => (
              <div key={v.id} className="row-between" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.normalized_name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {v.categories?.name} · {v.transaction_count} transaksjoner · {(Number(v.confidence) * 100).toFixed(0)}% konfidens
                  </div>
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => createRuleFromVendor(v)}>Opprett regel</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => dismissRuleSuggestion(v)}>Avvis</button>
                </div>
              </div>
            ))}
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Leverandører med minst {RULE_SUGGESTION_MIN_COUNT} transaksjoner og {(RULE_SUGGESTION_MIN_CONFIDENCE * 100).toFixed(0)}%+ konfidens som ennå ikke er dekket av en regel.
          </div>
        </div>
      )}

      <input className="form-input" style={{ maxWidth: 320 }} placeholder="Søk leverandør…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏪</div>
            <div>Ingen leverandører lært ennå — de dukker opp automatisk etter hvert som du importerer og kategoriserer transaksjoner.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Leverandør</th>
                  <th>Kategori</th>
                  <th className="text-right">Transaksjoner</th>
                  <th>Sist sett</th>
                  <th>Konfidens</th>
                  <th>Auto-godkjenn</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const hasEdits = !!edits[v.id]
                  const confidence = Number(v.confidence)
                  return (
                    <tr key={v.id} className="list-row">
                      <td className="list-primary">{v.normalized_name}</td>
                      <td data-label="Kategori" style={{ minWidth: 180 }}>
                        <CategoryPicker
                          categories={categories}
                          value={getEdit(v, 'suggested_category_id') ?? ''}
                          onChange={(id) => setEdit(v.id, 'suggested_category_id', id)}
                        />
                      </td>
                      <td data-label="Transaksjoner" className="text-right text-mono">{v.transaction_count}</td>
                      <td data-label="Sist sett" className="text-muted" style={{ fontSize: 12 }}>{v.last_seen ? formatDate(v.last_seen) : '—'}</td>
                      <td data-label="Konfidens">
                        <div className="row" style={{ gap: 6 }}>
                          <div style={{ width: 48, height: 5, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${confidence * 100}%`, height: '100%', background: confidenceColor(confidence), borderRadius: 3 }} />
                          </div>
                          <span className="text-mono" style={{ fontSize: 12, color: confidenceColor(confidence) }}>{(confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td data-label="Auto-godkjenn">
                        <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={v.auto_approve || false} onChange={() => toggleAutoApprove(v)} />
                          <span className="text-muted" style={{ fontSize: 12 }}>{v.auto_approve ? 'Ja' : 'Nei'}</span>
                        </label>
                      </td>
                      <td data-label="">
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          {hasEdits && <button className="btn btn-primary btn-sm" onClick={() => saveVendor(v)}>Lagre</button>}
                          <button className="btn btn-ghost btn-sm" onClick={() => setMergeVendor(v)}>Slå sammen</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => deleteVendor(v)}>Slett</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text)' }}>Auto-godkjenn:</strong> når aktivert brukes leverandørens kategoriforslag automatisk ved import, uansett konfidens.
        Konfidensen øker med {(VENDOR_CONFIDENCE_INCREMENT * 100).toFixed(0)} prosentpoeng hver gang forslaget bekreftes riktig, og resettes til {(VENDOR_CONFIDENCE_RESET_ON_OVERRIDE * 100).toFixed(0)}% når det overstyres.
      </div>
    </div>
  )
}
