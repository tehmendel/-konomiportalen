import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ padding: 32, width: 360 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Tofaktor-verifisering</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
          Åpne autentiserings-appen din og skriv inn 6-sifret kode.
        </div>
        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ marginBottom: 12, textAlign: 'center', fontSize: 20, letterSpacing: 4 }}
            autoFocus
          />
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6} style={{ width: '100%', marginBottom: 8 }}>
            {busy ? 'Sjekker…' : 'Bekreft'}
          </button>
          <button type="button" className="btn" style={{ width: '100%' }} onClick={signOut}>
            Logg ut
          </button>
        </form>
      </div>
    </div>
  )
}
