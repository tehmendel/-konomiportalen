import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Categories() {
  const { household } = useAuth()
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [newCategory, setNewCategory] = useState({ name: '', type: 'utgift' })
  const [newRule, setNewRule] = useState({ match_value: '', match_type: 'contains', category_id: '', transaction_type: '' })

  async function load() {
    const [{ data: cats }, { data: rls }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('categorization_rules').select('*, categories(name)').order('priority'),
    ])
    setCategories(cats || [])
    setRules(rls || [])
  }

  useEffect(() => { load() }, [household?.id])

  async function addCategory(e) {
    e.preventDefault()
    if (!newCategory.name.trim()) return
    await supabase.from('categories').insert({
      household_id: household.id,
      name: newCategory.name.trim(),
      type: newCategory.type,
    })
    setNewCategory({ name: '', type: 'utgift' })
    load()
  }

  async function addRule(e) {
    e.preventDefault()
    if (!newRule.match_value.trim() || !newRule.category_id) return
    await supabase.from('categorization_rules').insert({
      household_id: household.id,
      match_value: newRule.match_value.trim(),
      match_type: newRule.match_type,
      category_id: newRule.category_id,
      transaction_type: newRule.transaction_type || null,
      priority: rules.length,
      active: true,
    })
    setNewRule({ match_value: '', match_type: 'contains', category_id: '', transaction_type: '' })
    load()
  }

  async function removeRule(id) {
    await supabase.from('categorization_rules').delete().eq('id', id)
    load()
  }

  return (
    <div className="stack">
      <div className="page-title">Kategorier</div>
      <div className="two-col">
        <div className="stack">
          <div className="section-title">Kategorier</div>
          <div className="card">
            {categories.map((c) => (
              <div key={c.id} className="row-between" style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
                <span>{c.name}</span>
                <span className={`badge ${c.type === 'inntekt' ? 'badge-green' : 'badge-neutral'}`}>{c.type}</span>
              </div>
            ))}
          </div>
          <form onSubmit={addCategory} className="card card-pad row">
            <input className="form-input grow" placeholder="Ny kategori" value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
            <select className="form-select" style={{ width: 120, flexShrink: 0 }} value={newCategory.type}
              onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}>
              <option value="utgift">Utgift</option>
              <option value="inntekt">Inntekt</option>
            </select>
            <button className="btn btn-primary" type="submit">Legg til</button>
          </form>
        </div>

        <div className="stack">
          <div className="section-title">Kategoriseringsregler</div>
          <div className="card">
            {rules.length === 0 ? (
              <div className="empty-state">Ingen regler ennå.</div>
            ) : rules.map((r) => (
              <div key={r.id} className="row-between" style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="text-mono" style={{ fontSize: 13 }}>{r.match_value}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{r.categories?.name}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => removeRule(r.id)}>Fjern</button>
              </div>
            ))}
          </div>
          <form onSubmit={addRule} className="card card-pad stack">
            <input className="form-input" placeholder="F.eks. RIMI, BOLIGKREDITT, IMEDIATE" value={newRule.match_value}
              onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })} />
            <select className="form-select" value={newRule.category_id}
              onChange={(e) => setNewRule({ ...newRule, category_id: e.target.value })}>
              <option value="">Velg kategori…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn-primary" type="submit">Legg til regel</button>
          </form>
        </div>
      </div>
    </div>
  )
}
