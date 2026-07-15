import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

// Platform-admin only: lists every user across every husstand (made visible
// by the admin_read_* RLS policies) so an admin can preview the app exactly
// as a given end user sees it — read-only, logged, no session is swapped.
export default function ImpersonateModal({ onClose, onStarted }) {
  const { realUser, startImpersonation } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startingId, setStartingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: memberRows } = await supabase
        .from('household_members')
        .select('user_id, role, household_id, households(name)')
      const userIds = [...new Set((memberRows || []).map((m) => m.user_id))]
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] }
      const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

      setRows(
        (memberRows || [])
          .filter((m) => m.user_id !== realUser?.id)
          .map((m) => ({
            userId: m.user_id,
            fullName: profileById[m.user_id]?.full_name || '(uten navn)',
            householdName: m.households?.name || '(uten husstand)',
            role: m.role,
          }))
      )
      setLoading(false)
    }
    load()
  }, [realUser?.id])

  async function handleStart(userId) {
    setStartingId(userId)
    setError('')
    try {
      await startImpersonation(userId)
      onStarted()
    } catch (err) {
      setError(err.message)
    }
    setStartingId(null)
  }

  const filtered = rows.filter((r) => `${r.fullName} ${r.householdName}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-title">Se som bruker</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Skrivebeskyttet forhåndsvisning — du forblir innlogget som deg selv, og handlingen logges.
        </div>

        <input className="form-input" placeholder="Søk navn eller husstand…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 'var(--space-3)' }} />

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

        <div className="stack" style={{ gap: 0, maxHeight: 360, overflowY: 'auto' }}>
          {loading ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Laster…</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Ingen andre brukere funnet.</div>
          ) : (
            filtered.map((r) => (
              <div key={r.userId} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 'var(--space-3)' }}>
                <div className="row" style={{ minWidth: 0 }}>
                  <Avatar name={r.fullName} size="avatar-sm" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fullName}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{r.householdName} · {r.role === 'owner' ? 'Eier' : 'Medlem'}</div>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" disabled={startingId === r.userId} onClick={() => handleStart(r.userId)}>
                  {startingId === r.userId ? 'Starter…' : 'Se som'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Lukk</button>
        </div>
      </div>
    </div>
  )
}
