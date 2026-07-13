import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import { CameraIcon } from '../components/icons'

function HouseholdCard() {
  const { household, refreshHousehold } = useAuth()
  const isOwner = household?.role === 'owner'
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(household?.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function saveName(e) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setBusy(true)
    setError('')
    const { error } = await supabase.from('households').update({ name: nameInput.trim() }).eq('id', household.id)
    setBusy(false)
    if (error) { setError(error.message); return }
    await refreshHousehold()
    setEditingName(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${household.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('household-avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: pub } = supabase.storage.from('household-avatars').getPublicUrl(path)
      const { error: updateError } = await supabase
        .from('households')
        .update({ avatar_url: `${pub.publicUrl}?v=${Date.now()}` })
        .eq('id', household.id)
      if (updateError) throw updateError
      await refreshHousehold()
    } catch (err) {
      setError(err.message || 'Kunne ikke laste opp bilde')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="card card-pad">
      <div className="section-title">Husstand</div>
      <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ position: 'relative' }}>
          <Avatar src={household?.avatarUrl} name={household?.name} size="avatar-lg" />
          {isOwner && (
            <>
              <button
                className="btn btn-icon"
                style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--accent)', border: '2px solid var(--surface)' }}
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                title="Endre husstandsbilde"
              >
                <CameraIcon width={16} height={16} color="#fff" />
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </>
          )}
        </div>

        <div className="grow">
          {editingName ? (
            <form onSubmit={saveName} className="row">
              <input className="form-input grow" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
              <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>Lagre</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditingName(false); setNameInput(household.name) }}>Avbryt</button>
            </form>
          ) : (
            <div className="row-between">
              <div style={{ fontWeight: 700, fontSize: 17 }}>{household?.name}</div>
              {isOwner && <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(true)}>Endre navn</button>}
            </div>
          )}
        </div>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
    </div>
  )
}

function MembersCard() {
  const { household, members, profile, refreshHousehold } = useAuth()
  const isOwner = household?.role === 'owner'
  const [error, setError] = useState('')

  async function removeMember(userId, name) {
    if (!window.confirm(`Fjerne ${name} fra husstanden?`)) return
    setError('')
    const { error } = await supabase.rpc('remove_household_member', { p_household_id: household.id, p_user_id: userId })
    if (error) { setError(error.message); return }
    await refreshHousehold()
  }

  return (
    <div className="card">
      <div className="card-pad" style={{ paddingBottom: 0 }}>
        <div className="section-title">Medlemmer</div>
      </div>
      {members.map((m) => (
        <div key={m.user_id} className="row-between" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)' }}>
          <div className="row">
            <Avatar name={m.profiles?.full_name} size="avatar-sm" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {m.profiles?.full_name}{m.user_id === profile?.id ? ' (deg)' : ''}
              </div>
            </div>
          </div>
          <div className="row">
            <span className={`badge ${m.role === 'owner' ? 'badge-accent' : 'badge-neutral'}`}>
              {m.role === 'owner' ? 'Eier' : 'Medlem'}
            </span>
            {isOwner && m.user_id !== profile?.id && (
              <button className="btn btn-ghost btn-sm" onClick={() => removeMember(m.user_id, m.profiles?.full_name)}>Fjern</button>
            )}
          </div>
        </div>
      ))}
      {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: 'var(--space-3) var(--space-4)' }}>{error}</div>}
      <div className="card-pad" style={{ fontSize: 12, color: 'var(--muted)' }}>
        <strong>Eier</strong> kan endre husstandsinnstillinger og administrere medlemmer. <strong>Medlem</strong> har full tilgang
        til appen, men kan ikke endre husstandsnavn/bilde eller invitere/fjerne andre.
      </div>
    </div>
  )
}

function InviteCard() {
  const { household } = useAuth()
  const isOwner = household?.role === 'owner'
  const [invite, setInvite] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!isOwner) return null

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
    <div className="card card-pad">
      <div className="section-title">Inviter samboer</div>
      <form onSubmit={createInvite} className="row">
        <input className="form-input grow" type="email" placeholder="E-post (valgfritt)"
          value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Lager…' : 'Lag kode'}</button>
      </form>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      {invite && (
        <div style={{ fontSize: 13, marginTop: 'var(--space-3)' }}>
          Del denne koden — den brukes én gang og utløper om 7 dager:
          <div className="text-mono" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, marginTop: 6, wordBreak: 'break-all' }}>
            {invite}
          </div>
        </div>
      )}
    </div>
  )
}

function MfaSettings() {
  const { refreshMfaLevel } = useAuth()
  const [factors, setFactors] = useState([])
  const [enrolling, setEnrolling] = useState(null)
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
    <div className="card card-pad">
      <div className="section-title">Tofaktor-autentisering</div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>
        Legg til en autentiserings-app (f.eks. Google Authenticator, Authy) for ekstra sikkerhet ved innlogging.
      </div>

      {verifiedFactor && !enrolling && (
        <div className="row-between">
          <span className="badge badge-green">Aktivert</span>
          <button className="btn btn-ghost btn-sm" onClick={() => removeFactor(verifiedFactor.id)}>Fjern</button>
        </div>
      )}

      {!verifiedFactor && !enrolling && (
        <button className="btn btn-primary" onClick={startEnroll} disabled={busy}>
          {busy ? 'Starter…' : 'Aktiver tofaktor-autentisering'}
        </button>
      )}

      {enrolling && (
        <div>
          <div style={{ fontSize: 13, marginBottom: 'var(--space-2)' }}>Skann QR-koden med autentiserings-appen din:</div>
          <img src={enrolling.qrCode} alt="QR-kode for tofaktor-oppsett" style={{ background: '#fff', padding: 8, borderRadius: 8, marginBottom: 'var(--space-2)' }} />
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 'var(--space-3)' }}>
            Kan ikke skanne? Skriv inn manuelt: <span className="text-mono">{enrolling.secret}</span>
          </div>
          <form onSubmit={confirmEnroll} className="row">
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

      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
    </div>
  )
}

export default function Settings() {
  const { signOut } = useAuth()

  return (
    <div className="stack">
      <div className="page-title">Innstillinger</div>
      <HouseholdCard />
      <MembersCard />
      <InviteCard />
      <MfaSettings />
      <button className="btn btn-danger btn-block" onClick={signOut}>Logg ut</button>
    </div>
  )
}
