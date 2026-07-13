import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else if (mode === 'signup') {
        await signUp(email.trim(), password)
        setInfo('Konto opprettet — sjekk e-posten din for å bekrefte adressen før du logger inn.')
      } else if (mode === 'forgot') {
        await requestPasswordReset(email.trim())
        setInfo('Har du en konto med denne adressen, har vi sendt deg en lenke for å sette nytt passord.')
      }
    } catch (err) {
      setError(err.message || 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ padding: 32, width: 360 }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Økonomiportalen</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
          {mode === 'login' && 'Logg inn med e-post og passord.'}
          {mode === 'signup' && 'Opprett en ny konto.'}
          {mode === 'forgot' && 'Skriv inn e-posten din, så sender vi deg en lenke for å sette nytt passord.'}
        </div>

        {info ? (
          <div style={{ fontSize: 14, marginBottom: 16 }}>{info}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              className="form-input"
              type="email"
              required
              placeholder="din@epost.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            {mode !== 'forgot' && (
              <input
                className="form-input"
                type="password"
                required
                minLength={8}
                placeholder="Passord (minst 8 tegn)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginBottom: 12 }}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            )}
            {error && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginBottom: 12 }}>
              {busy ? 'Vent…' : mode === 'login' ? 'Logg inn' : mode === 'signup' ? 'Opprett konto' : 'Send lenke'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          {mode === 'login' ? (
            <>
              <button className="btn" style={{ padding: '4px 8px' }} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Opprett konto</button>
              <button className="btn" style={{ padding: '4px 8px' }} onClick={() => { setMode('forgot'); setError(''); setInfo('') }}>Glemt passord?</button>
            </>
          ) : (
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => { setMode('login'); setError(''); setInfo('') }}>← Tilbake til innlogging</button>
          )}
        </div>
      </div>
    </div>
  )
}
