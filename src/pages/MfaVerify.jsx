import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function MfaVerify() {
  const { refreshMfaLevel, signOut } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      const factor = factors.totp.find((f) => f.status === 'verified')
      if (!factor) throw new Error('Fant ingen registrert autentiserings-app')

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (verifyError) throw verifyError

      await refreshMfaLevel()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Feil kode — prøv igjen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Tofaktor-verifisering" subtitle="Åpne autentiserings-appen din og skriv inn 6-sifret kode.">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            className="form-input"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 700 }}
            autoFocus
          />
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || code.length !== 6} style={{ marginBottom: 'var(--space-2)' }}>
          {busy ? 'Sjekker…' : 'Bekreft'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>
          Logg ut
        </button>
      </form>
    </AuthShell>
  )
}
