import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setError(err.message || 'Kunne ikke sette nytt passord')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Sett nytt passord">
      {done ? (
        <div style={{ fontSize: 14, textAlign: 'center' }}>Passord oppdatert — sender deg videre…</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              className="form-input"
              type="password"
              required
              minLength={8}
              placeholder="Nytt passord (minst 8 tegn)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Lagrer…' : 'Lagre nytt passord'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
