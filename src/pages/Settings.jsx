import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function MfaSettings() {
  const { refreshMfaLevel } = useAuth()
  const [factors, setFactors] = useState([])
  const [enrolling, setEnrolling] = useState(null) // { factorId, qrCode, secret }
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors(data?.totp || [])
  }

  useEffect(() => { loadFactors() }, [])

  async function startEnroll() {
    setError('')
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error) throw error
      setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    } catch (err) {
      setError(err.message || 'Kunne ikke starte registrering')
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnroll(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (verifyError) throw verifyError
      setEnrolling(null)
      setCode('')
      await Promise.all([loadFactors(), refreshMfaLevel()])
    } catch (err) {
      setError(err.message || 'Feil kode — prøv igjen')
    } finally {
      setBusy(false)
    }
  }

  async function removeFactor(factorId) {
    if (!window.confirm('Fjerne denne autentiserings-appen? Du logger da inn kun med passord igjen.')) return
    await supabase.auth.mfa.unenroll({ factorId })
    await Promise.all([loadFactors(), refreshMfaLevel()])
  }

  const verifiedFactor = factors.find((f) => f.status === 'verified')

  return (
    <div className="card" style={{ padding: 16, maxWidth: 480, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Tofaktor-autentisering</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Legg til en autentiserings-app (f.eks. Google Authenticator, Authy) for ekstra sikkerhet ved innlogging.
      </div>

      {verifiedFactor && !enrolling && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>✓ Aktivert</span>
          <button className="btn" onClick={() => removeFactor(verifiedFactor.id)}>Fjern</button>
        </div>
      )}

      {!verifiedFactor && !enrolling && (
        <button className="btn btn-primary" onClick={startEnroll} disabled={busy}>
          {busy ? 'Starter…' : 'Aktiver tofaktor-autentisering'}
        </button>
      )}

      {enrolling && (
        <div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>Skann QR-koden med autentiserings-appen din:</div>
          <img src={enrolling.qrCode} alt="QR-kode for tofaktor-oppsett" style={{ background: '#fff', padding: 8, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            Kan ikke skanne? Skriv inn manuelt: <span className="text-mono">{enrolling.secret}</span>
          </div>
          <form onSubmit={confirmEnroll} style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              required
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Sjekker…' : 'Bekreft'}
            </button>
          </form>
        </div>
      )}

      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

export default function Settings() {
  const { household, members, profile } = useAuth()
  const [invite, setInvite] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createInvite(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('create_household_invite', {
      p_household_id: household.id,
      p_email: inviteEmail.trim() || null,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setInvite(data)
  }

  return (
    <div>
      <h2>Innstillinger</h2>

      <div className="card" style={{ padding: 16, marginBottom: 16, maxWidth: 480 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{household?.name}</div>
        <table>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.profiles?.full_name}{m.user_id === profile?.id ? ' (deg)' : ''}</td>
                <td className="text-muted">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, maxWidth: 480 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Inviter samboer</div>
        <form onSubmit={createInvite} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="form-input" type="email" placeholder="E-post (valgfritt, låser invitasjonen til denne adressen)"
            value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Lager…' : 'Lag kode'}</button>
        </form>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {invite && (
          <div style={{ fontSize: 13 }}>
            Del denne koden — den brukes én gang og utløper om 7 dager:
            <div className="text-mono" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 6, marginTop: 6, wordBreak: 'break-all' }}>
              {invite}
            </div>
          </div>
        )}
      </div>

      <MfaSettings />
    </div>
  )
}
