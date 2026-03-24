import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props { applicationId: string; onClose: () => void; onSuccess: () => void }

export default function RequestDocument({ applicationId, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ name: '', type: 'id', required: true })

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('documents').insert({
        application_id: applicationId, name: form.name, type: form.type,
        required: form.required, status: 'pending'
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Document requested'); onSuccess() },
    onError: (err: any) => toast.error(err.message)
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Request Document</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div className="form-group">
            <label className="label">Document Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Government-issued ID" required />
          </div>
          <div className="form-group">
            <label className="label">Document Type</label>
            <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="id">Government ID</option>
              <option value="certificate">Certificate</option>
              <option value="reference">Reference Letter</option>
              <option value="contract">Contract</option>
              <option value="nda">NDA</option>
              <option value="offer_letter">Offer Letter</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="required" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} />
            <label htmlFor="required" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Required document</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
            {mutation.isPending ? <span className="spinner" /> : 'Request Document'}
          </button>
        </div>
      </div>
    </div>
  )
}
