import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ padding: 32, width: 360 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Sett nytt passord</div>
        {done ? (
          <div style={{ fontSize: 14 }}>Passord oppdatert — sender deg videre…</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              className="form-input"
              type="password"
              required
              minLength={8}
              placeholder="Nytt passord (minst 8 tegn)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{ marginBottom: 12 }}
            />
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Lagrer…' : 'Lagre nytt passord'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
