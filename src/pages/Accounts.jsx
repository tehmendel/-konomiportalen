import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatKr } from '../lib/format'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Brukskonto' },
  { value: 'savings', label: 'Sparekonto' },
  { value: 'loan', label: 'Lån' },
  { value: 'card', label: 'Kredittkort' },
  { value: 'investment', label: 'Fond/aksjer' },
  { value: 'child', label: 'Barnekonto' },
]

const ASSET_CATEGORIES = [
  { value: 'property', label: 'Bolig', isLiability: false },
  { value: 'vehicle', label: 'Kjøretøy', isLiability: false },
  { value: 'pension', label: 'Pensjon', isLiability: false },
  { value: 'other_asset', label: 'Annen eiendel', isLiability: false },
  { value: 'other_debt', label: 'Annen gjeld', isLiability: true },
]

function AssetsCard() {
  const { household, user } = useAuth()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'property', value: '', visibility: 'personal' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('*, profiles:owner_id(full_name)').order('created_at', { ascending: true })
    setAssets(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [household?.id])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim() || form.value === '') return
    setSaving(true)
    setError('')
    const meta = ASSET_CATEGORIES.find((c) => c.value === form.category)
    const { error } = await supabase.from('assets').insert({
      household_id: household.id,
      owner_id: user.id,
      name: form.name.trim(),
      category: form.category,
      value: Number(form.value),
      is_liability: meta.isLiability,
      visibility: form.visibility,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ name: '', category: 'property', value: '', visibility: 'personal' })
    setShowForm(false)
    load()
  }

  async function saveValue(id) {
    const { error } = await supabase.from('assets').update({ value: Number(editValue), updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { setError(error.message); return }
    setEditingId(null)
    load()
  }

  async function remove(id) {
    if (!window.confirm('Fjerne denne eiendelen/gjelden?')) return
    await supabase.from('assets').delete().eq('id', id)
    load()
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div className="section-title">Eiendeler og gjeld</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Avbryt' : '+ Legg til'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card card-pad">
          <div className="form-group">
            <label className="form-label">Navn</label>
            <input className="form-input" required placeholder="F.eks. Boligen, Bilen, Studielån" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Verdi (kr)</label>
            <input className="form-input" required type="number" min="0" step="1" value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Synlighet i husstanden</label>
            <select className="form-select" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="personal">Personlig (kun i formuesummer)</option>
              <option value="shared">Felles (full detalj synlig for husstanden)</option>
            </select>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>{saving ? 'Lagrer…' : 'Lagre'}</button>
        </form>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">Laster…</div>
        ) : assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏡</div>
            <div>Ingen eiendeler eller gjeld registrert ennå.</div>
          </div>
        ) : assets.map((a) => {
          const meta = ASSET_CATEGORIES.find((c) => c.value === a.category)
          return (
            <div key={a.id} className="row-between" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{meta?.label} · {a.profiles?.full_name}</div>
              </div>
              <div className="row">
                {editingId === a.id ? (
                  <>
                    <input className="form-input" style={{ width: 130 }} type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                    <button className="btn btn-primary btn-sm" onClick={() => saveValue(a.id)}>Lagre</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Avbryt</button>
                  </>
                ) : (
                  <>
                    <span className={a.is_liability ? 'amount-negative' : 'amount-positive'} style={{ fontWeight: 600 }}>
                      {a.is_liability ? '−' : ''}{formatKr(a.value)}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(a.id); setEditValue(String(a.value)) }}>Rediger</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(a.id)}>Fjern</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Accounts() {
  const { household, user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ institution: '', account_type: 'checking', display_name: '', visibility: 'personal' })
  const [saving, setSaving] = useState(false)
  const [editingBalanceId, setEditingBalanceId] = useState(null)
  const [balanceValue, setBalanceValue] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*, profiles:owner_id(full_name)')
      .order('created_at', { ascending: true })
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [household?.id])

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('accounts').insert({
      household_id: household.id,
      owner_id: user.id,
      institution: form.institution.trim(),
      account_type: form.account_type,
      display_name: form.display_name.trim(),
      visibility: form.visibility,
      connection_type: 'manual',
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ institution: '', account_type: 'checking', display_name: '', visibility: 'personal' })
    setShowForm(false)
    load()
  }

  async function saveBalance(id) {
    const { error } = await supabase.from('accounts').update({ balance: balanceValue === '' ? null : Number(balanceValue) }).eq('id', id)
    if (error) { setError(error.message); return }
    setEditingBalanceId(null)
    load()
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div className="page-title">Kontoer</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Avbryt' : '+ Legg til'}
        </button>
      </div>

      <div className="card card-pad" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Automatisk bankkobling med BankID (Enable Banking) er under utprøving. Inntil videre legger du til kontoer
        manuelt her, importerer kontoutskrift under «Importer», og oppdaterer saldo selv innimellom.
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card card-pad">
          <div className="form-group">
            <label className="form-label">Bank/leverandør</label>
            <input className="form-input" required placeholder="F.eks. Rogaland Sparebank" value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Visningsnavn</label>
            <input className="form-input" required placeholder="F.eks. Brukskonto" value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
              {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Synlighet i husstanden</label>
            <select className="form-select" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="personal">Personlig (kun kategorisummer deles)</option>
              <option value="shared">Felles (full detalj synlig for husstanden)</option>
            </select>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>{saving ? 'Lagrer…' : 'Lagre konto'}</button>
        </form>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">Laster…</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div>Ingen kontoer lagt til ennå.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Konto</th>
                  <th>Bank</th>
                  <th>Type</th>
                  <th className="text-right">Saldo</th>
                  <th>Synlighet</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="list-row">
                    <td className="list-primary">{a.display_name}</td>
                    <td data-label="Bank" className="text-secondary">{a.institution}</td>
                    <td data-label="Type" className="text-secondary">{ACCOUNT_TYPES.find((t) => t.value === a.account_type)?.label || a.account_type}</td>
                    <td data-label="Saldo" className="text-right">
                      {editingBalanceId === a.id ? (
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <input className="form-input" style={{ width: 120 }} type="number" value={balanceValue}
                            onChange={(e) => setBalanceValue(e.target.value)} autoFocus />
                          <button className="btn btn-primary btn-sm" onClick={() => saveBalance(a.id)}>Lagre</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingBalanceId(a.id); setBalanceValue(a.balance != null ? String(a.balance) : '') }}>
                          {a.balance != null ? formatKr(a.balance) : 'Sett saldo'}
                        </button>
                      )}
                    </td>
                    <td data-label="Synlighet">
                      <span className={`badge ${a.visibility === 'shared' ? 'badge-accent' : 'badge-neutral'}`}>
                        {a.visibility === 'shared' ? 'Felles' : 'Personlig'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssetsCard />
    </div>
  )
}
