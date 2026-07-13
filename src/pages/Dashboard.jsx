import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatKr } from '../lib/format'

// Dark-mode categorical palette, fixed order (dataviz skill reference palette).
const COLORS = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926']

export default function Dashboard() {
  const { household, user } = useAuth()
  const [scope, setScope] = useState('household')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  useEffect(() => {
    if (!household?.id) return
    setLoading(true)

    if (scope === 'household') {
      supabase.rpc('household_category_totals', { p_household_id: household.id }).then(({ data }) => {
        setRows((data || []).filter((r) => r.year === year && r.month === month && r.type === 'utgift'))
        setLoading(false)
      })
    } else {
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      supabase
        .from('transactions')
        .select('amount, categories(name)')
        .eq('owner_id', user.id)
        .eq('type', 'utgift')
        .gte('date', from)
        .then(({ data }) => {
          const grouped = new Map()
          for (const t of data || []) {
            const name = t.categories?.name || 'Ukategorisert'
            grouped.set(name, (grouped.get(name) || 0) + Number(t.amount))
          }
          setRows(Array.from(grouped, ([category_name, total_amount]) => ({ category_name, total_amount })))
          setLoading(false)
        })
    }
  }, [household?.id, scope, user?.id])

  const chartData = useMemo(() =>
    rows
      .map((r) => ({ name: r.category_name || 'Ukategorisert', total: Number(r.total_amount) }))
      .sort((a, b) => b.total - a.total),
    [rows]
  )

  const sum = chartData.reduce((acc, r) => acc + r.total, 0)
  const monthLabel = now.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="page-title">Oversikt</div>
          <div className="page-sub" style={{ textTransform: 'capitalize' }}>{monthLabel}</div>
        </div>
        <div className="row" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 3 }}>
          <button
            className="btn btn-sm"
            style={{ border: 'none', background: scope === 'household' ? 'var(--surface-3)' : 'transparent' }}
            onClick={() => setScope('household')}
          >
            Husstand
          </button>
          <button
            className="btn btn-sm"
            style={{ border: 'none', background: scope === 'personal' ? 'var(--surface-3)' : 'transparent' }}
            onClick={() => setScope('personal')}
          >
            Meg
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="stat-label">Totalt forbruk denne måneden</div>
        <div className="stat-value">{formatKr(sum)}</div>
      </div>

      <div className="card card-pad" style={{ height: 380 }}>
        {loading ? (
          <div className="text-muted">Laster…</div>
        ) : chartData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div>Ingen transaksjoner denne måneden ennå.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }} barCategoryGap={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted)" fontSize={11} tickFormatter={(v) => `${v} kr`} />
              <YAxis type="category" dataKey="name" width={130} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v) => formatKr(v)}
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
