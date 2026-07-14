import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatKr } from '../lib/format'

const TYPES = [
  { value: 'fond', label: 'Fond' },
  { value: 'aksje', label: 'Aksje' },
  { value: 'etf', label: 'ETF' },
  { value: 'obligasjon', label: 'Obligasjon' },
  { value: 'krypto', label: 'Krypto' },
]

const emptyForm = { account_id: '', instrument_name: '', instrument_type: 'fond', quantity: '', avg_price: '', current_price: '' }

export default function Investments() {
  const { household, user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('alle')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: accs }, { data: hlds }] = await Promise.all([
      supabase.from('accounts').select('*').eq('account_type', 'investment'),
      supabase.from('holdings').select('*, accounts(display_name)').order('created_at', { ascending: true }),
    ])
    setAccounts(accs || [])
    setHoldings(hlds || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [household?.id])

  function startAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(h) {
    setForm({
      account_id: h.account_id,
      instrument_name: h.instrument_name,
      instrument_type: h.instrument_type,
      quantity: String(h.quantity),
      avg_price: String(h.avg_price),
      current_price: String(h.current_price),
    })
    setEditingId(h.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.account_id || !form.instrument_name.trim()) return
    setSaving(true)
    setError('')

    const payload = {
      account_id: form.account_id,
      instrument_name: form.instrument_name.trim(),
      instrument_type: form.instrument_type,
      quantity: Number(form.quantity) || 0,
      avg_price: Number(form.avg_price) || 0,
      current_price: Number(form.current_price) || 0,
    }

    const { error } = editingId
      ? await supabase.from('holdings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      : await supabase.from('holdings').insert({ ...payload, household_id: household.id, owner_id: user.id })

    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false)
    setForm(emptyForm)
    setEditingId(null)
    load()
  }

  async function remove(id) {
    if (!window.confirm('Fjerne denne beholdningen?')) return
    await supabase.from('holdings').delete().eq('id', id)
    load()
  }

  const filtered = filter === 'alle' ? holdings : holdings.filter((h) => h.instrument_type === filter)
  const totalValue = filtered.reduce((sum, h) => sum + Number(h.quantity) * Number(h.current_price), 0)
  const totalGain = filtered.reduce((sum, h) => sum + (Number(h.current_price) - Number(h.avg_price)) * Number(h.quantity), 0)

  return (
    <div className="stack">
      <div className="page-header">
        <div className="page-title">Investeringer</div>
        <button className="btn btn-primary btn-sm" onClick={showForm ? () => setShowForm(false) : startAdd}>
          {showForm ? 'Avbryt' : '+ Legg til'}
        </button>
      </div>

      {accounts.length === 0 && !showForm && (
        <div className="card card-pad" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Opprett en konto med type «Fond/aksjer» under Kontoer først, så kan du registrere beholdninger her.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card card-pad">
          <div className="form-group">
            <label className="form-label">Konto</label>
            <select className="form-select" required value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
              <option value="">Velg konto…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name} ({a.institution})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Navn på instrument</label>
            <input className="form-input" required placeholder="F.eks. DNB Global Indeks" value={form.instrument_name}
              onChange={(e) => setForm({ ...form, instrument_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.instrument_type} onChange={(e) => setForm({ ...form, instrument_type: e.target.value })}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="row">
            <div className="form-group grow">
              <label className="form-label">Antall</label>
              <input className="form-input" type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="form-group grow">
              <label className="form-label">Snittpris</label>
              <input className="form-input" type="number" step="any" value={form.avg_price} onChange={(e) => setForm({ ...form, avg_price: e.target.value })} />
            </div>
            <div className="form-group grow">
              <label className="form-label">Nåværende kurs</label>
              <input className="form-input" type="number" step="any" value={form.current_price} onChange={(e) => setForm({ ...form, current_price: e.target.value })} />
            </div>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>{saving ? 'Lagrer…' : 'Lagre'}</button>
        </form>
      )}

      <div className="row flex-wrap">
        {['alle', ...TYPES.map((t) => t.value)].map((v) => (
          <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : ''}`} onClick={() => setFilter(v)}>
            {v === 'alle' ? 'Alle' : TYPES.find((t) => t.value === v).label}
          </button>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="two-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <div className="card card-pad">
            <div className="stat-label">Total verdi</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>{formatKr(totalValue)}</div>
          </div>
          <div className="card card-pad">
            <div className="stat-label">Gevinst/tap</div>
            <div className={totalGain >= 0 ? 'amount-positive' : 'amount-negative'} style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>
              {totalGain >= 0 ? '+' : '−'}{formatKr(Math.abs(totalGain))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">Laster…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <div>Ingen beholdninger registrert ennå.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th className="text-right">Antall</th>
                  <th className="text-right">Snittpris</th>
                  <th className="text-right">Nåverdi</th>
                  <th className="text-right">Gevinst/tap</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const value = Number(h.quantity) * Number(h.current_price)
                  const gain = (Number(h.current_price) - Number(h.avg_price)) * Number(h.quantity)
                  return (
                    <tr key={h.id} className="list-row">
                      <td className="list-primary">
                        {h.instrument_name}
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{h.accounts?.display_name}</div>
                      </td>
                      <td data-label="Type"><span className="badge badge-neutral">{TYPES.find((t) => t.value === h.instrument_type)?.label}</span></td>
                      <td data-label="Antall" className="text-right text-mono">{h.quantity}</td>
                      <td data-label="Snittpris" className="text-right text-mono">{formatKr(h.avg_price)}</td>
                      <td data-label="Nåverdi" className="text-right text-mono">{formatKr(value)}</td>
                      <td data-label="Gevinst/tap" className="text-right">
                        <span className={gain >= 0 ? 'amount-positive' : 'amount-negative'}>{gain >= 0 ? '+' : '−'}{formatKr(Math.abs(gain))}</span>
                      </td>
                      <td data-label="">
                        <div className="row">
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(h)}>Rediger</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => remove(h.id)}>Fjern</button>
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
    </div>
  )
}
