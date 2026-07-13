import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

const copy = {
  login: { title: 'Logg inn', subtitle: 'Logg inn med e-post og passord.' },
  signup: { title: 'Opprett konto', subtitle: 'Registrer deg for å komme i gang.' },
  forgot: { title: 'Glemt passord', subtitle: 'Skriv inn e-posten din, så sender vi deg en lenke for å sette nytt passord.' },
}

export default function Login() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

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
    <AuthShell title={copy[mode].title} subtitle={copy[mode].subtitle}>
      {info ? (
        <div style={{ fontSize: 14, textAlign: 'center' }}>{info}</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              className="form-input"
              type="email"
              required
              placeholder="din@epost.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {mode !== 'forgot' && (
            <div className="form-group">
              <input
                className="form-input"
                type="password"
                required
                minLength={8}
                placeholder="Passord (minst 8 tegn)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginBottom: 'var(--space-3)' }}>
            {busy ? 'Vent…' : mode === 'login' ? 'Logg inn' : mode === 'signup' ? 'Opprett konto' : 'Send lenke'}
          </button>
        </form>
      )}

      <div className="row-between" style={{ marginTop: info ? 'var(--space-4)' : 0 }}>
        {mode === 'login' ? (
          <>
            <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => switchMode('signup')}>Opprett konto</button>
            <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => switchMode('forgot')}>Glemt passord?</button>
          </>
        ) : (
          <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => switchMode('login')}>← Tilbake til innlogging</button>
        )}
      </div>
    </AuthShell>
  )
}
