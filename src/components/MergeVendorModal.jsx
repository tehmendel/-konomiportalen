import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { VENDOR_CONFIDENCE_MAX } from '../lib/constants'

// Absorbs a duplicate vendor (e.g. two slightly different normalized names
// for the same merchant) into the primary — combining their learned stats
// and deleting the duplicate. Transactions aren't linked to vendors directly
// in this schema, so there's nothing to re-point, unlike a typical merge.
export default function MergeVendorModal({ primary, vendors, onClose, onMerged }) {
  const [absorbId, setAbsorbId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const others = vendors.filter((v) => v.id !== primary.id)
  const absorb = vendors.find((v) => v.id === absorbId)

  async function doMerge() {
    if (!absorbId || !absorb) return
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.from('vendors').update({
      transaction_count: primary.transaction_count + absorb.transaction_count,
      confidence: Math.min(VENDOR_CONFIDENCE_MAX, Math.max(Number(primary.confidence), Number(absorb.confidence))),
      last_seen: (primary.last_seen || '') > (absorb.last_seen || '') ? primary.last_seen : absorb.last_seen,
      auto_approve: primary.auto_approve || absorb.auto_approve,
      updated_at: new Date().toISOString(),
    }).eq('id', primary.id)
    if (updateError) { setError(updateError.message); setSaving(false); return }

    const { error: deleteError } = await supabase.from('vendors').delete().eq('id', absorbId)
    setSaving(false)
    if (deleteError) { setError(deleteError.message); return }
    onMerged()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-title">Slå sammen leverandører</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Bruk dette når to leverandørrader egentlig er samme butikk/tjeneste (f.eks. ulik skrivemåte fra banken).
        </div>

        <div className="form-group">
          <label className="form-label">Behold (primær)</label>
          <div className="card card-pad" style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{primary.normalized_name}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>{primary.transaction_count} transaksjoner</div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Slå sammen inn i primær (slettes etterpå)</label>
          <select className="form-select" value={absorbId} onChange={(e) => setAbsorbId(e.target.value)}>
            <option value="">Velg leverandør å slette…</option>
            {others.map((v) => <option key={v.id} value={v.id}>{v.normalized_name} ({v.transaction_count} transaksjoner)</option>)}
          </select>
        </div>

        {absorb && (
          <div className="card card-pad" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Resultat: «{primary.normalized_name}» får <strong style={{ color: 'var(--text)' }}>{primary.transaction_count + absorb.transaction_count} transaksjoner</strong>.
            «{absorb.normalized_name}» slettes.
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Avbryt</button>
          <button className="btn btn-primary" disabled={!absorbId || saving} onClick={doMerge}>
            {saving ? 'Slår sammen…' : 'Slå sammen og slett duplikat'}
          </button>
        </div>
      </div>
    </div>
  )
}
