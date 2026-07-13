import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function Onboarding() {
  const { user, refreshHousehold } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('create')
  const [fullName, setFullName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.rpc('create_household', {
        household_name: householdName.trim(),
        p_full_name: fullName.trim(),
      })
      if (error) throw error
      await refreshHousehold()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Kunne ikke opprette husstand')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.rpc('accept_household_invite', {
        p_token: inviteToken.trim(),
        p_full_name: fullName.trim(),
      })
      if (error) throw error
      await refreshHousehold()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Ugyldig eller utløpt invitasjon')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={`Velkommen, ${user?.email}`} subtitle="Opprett en ny husstand, eller bli med i en du er invitert til.">
      <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
        <button className={`btn ${mode === 'create' ? 'btn-primary' : ''}`} style={{ flex: 1 }} onClick={() => setMode('create')}>
          Opprett husstand
        </button>
        <button className={`btn ${mode === 'join' ? 'btn-primary' : ''}`} style={{ flex: 1 }} onClick={() => setMode('join')}>
          Bli med
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Ditt navn</label>
            <input className="form-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Navn på husstanden</label>
            <input className="form-input" required placeholder="F.eks. Familien Bøe" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Oppretter…' : 'Opprett'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label className="form-label">Ditt navn</label>
            <input className="form-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Invitasjonskode</label>
            <input className="form-input" required value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Blir med…' : 'Bli med'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
