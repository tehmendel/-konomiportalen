import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatKr } from '../lib/format'

const COLORS = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#d95926']

const LABELS = {
  bank: 'Bankinnskudd',
  investment: 'Verdipapirer',
  property: 'Bolig',
  vehicle: 'Kjøretøy',
  pension: 'Pensjon',
  other_asset: 'Annen eiendel',
}

const POSITIVE_CATEGORIES = ['bank', 'investment', 'property', 'vehicle', 'pension', 'other_asset']

export default function Wealth() {
  const { household } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household?.id) return
    setLoading(true)
    supabase.rpc('household_net_worth', { p_household_id: household.id }).then(({ data }) => {
      setRows(data || [])
      setLoading(false)
    })
  }, [household?.id])

  const byCategory = Object.fromEntries(rows.map((r) => [r.category, Number(r.total_amount)]))
  const bank = byCategory.bank || 0
  const investment = byCategory.investment || 0
  const property = byCategory.property || 0
  const vehicle = byCategory.vehicle || 0
  const pension = byCategory.pension || 0
  const otherAsset = byCategory.other_asset || 0
  const loan = byCategory.loan || 0
  const otherDebt = byCategory.other_debt || 0
  const debt = loan + otherDebt

  const netWorth = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
  const positiveTotal = bank + investment + property + vehicle + pension + otherAsset

  const distribution = POSITIVE_CATEGORIES
    .map((cat, i) => ({ key: cat, label: LABELS[cat], value: byCategory[cat] || 0, color: COLORS[i] }))
    .filter((d) => d.value > 0)

  const statCards = [
    { label: 'Bankinnskudd', value: bank, icon: '💰' },
    { label: 'Verdipapirer', value: investment, icon: '📈' },
    { label: 'Bolig', value: property, icon: '🏠' },
    { label: 'Gjeld', value: -debt, icon: '🏦' },
    { label: 'Pensjon/annet', value: pension + vehicle + otherAsset, icon: '📦' },
  ]

  return (
    <div className="stack">
      <div className="page-title">Formue</div>

      {loading ? (
        <div className="card card-pad empty-state">Laster…</div>
      ) : (
        <>
          <div className="card card-pad" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
            <div className="stat-label">Din totale formue</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 40, marginTop: 'var(--space-2)' }}>
              {formatKr(netWorth)}
            </div>
          </div>

          <div className="two-col" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {statCards.map((s) => (
              <div key={s.label} className="card card-pad">
                <div className="row" style={{ marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
                <div className={s.value < 0 ? 'amount-negative' : ''} style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600 }}>
                  {s.value < 0 ? '−' : ''}{formatKr(Math.abs(s.value))}
                </div>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div className="section-title">Formuefordeling</div>
            {distribution.length === 0 ? (
              <div className="empty-state">Registrer kontosaldo eller eiendeler under «Kontoer» for å se fordelingen.</div>
            ) : (
              <>
                <div className="row" style={{ height: 16, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-3)', gap: 0 }}>
                  {distribution.map((d) => (
                    <div key={d.key} style={{ width: `${(d.value / positiveTotal) * 100}%`, background: d.color, height: '100%' }} title={d.label} />
                  ))}
                </div>
                <div className="row flex-wrap">
                  {distribution.map((d) => (
                    <div key={d.key} className="row" style={{ gap: 6, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, display: 'inline-block' }} />
                      <span className="text-secondary">{d.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
