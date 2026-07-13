import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Brukskonto' },
  { value: 'savings', label: 'Sparekonto' },
  { value: 'loan', label: 'Lån' },
  { value: 'card', label: 'Kredittkort' },
  { value: 'investment', label: 'Fond/aksjer' },
  { value: 'child', label: 'Barnekonto' },
]

export default function Accounts() {
  const { household, user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ institution: '', account_type: 'checking', display_name: '', visibility: 'personal' })
  const [saving, setSaving] = useState(false)
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
        manuelt her og importerer kontoutskrift under «Importer».
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
                  <th>Eier</th>
                  <th>Synlighet</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="list-row">
                    <td className="list-primary">{a.display_name}</td>
                    <td data-label="Bank" className="text-secondary">{a.institution}</td>
                    <td data-label="Type" className="text-secondary">{ACCOUNT_TYPES.find((t) => t.value === a.account_type)?.label || a.account_type}</td>
                    <td data-label="Eier" className="text-muted">{a.profiles?.full_name || '—'}</td>
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
    </div>
  )
}
