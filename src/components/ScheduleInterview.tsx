import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  applicationId: string
  jobId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ScheduleInterview({ applicationId, jobId, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    scheduled_at: '', format: 'video' as const,
    location_or_link: '', notes: '', interviewers: ''
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('interviews').insert({
        application_id: applicationId,
        job_id: jobId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        format: form.format,
        location_or_link: form.location_or_link,
        notes: form.notes,
        interviewers: form.interviewers.split(',').map(s => s.trim()).filter(Boolean),
        status: 'scheduled'
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Interview scheduled!'); onSuccess() },
    onError: (err: any) => toast.error(err.message)
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Schedule Interview</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div className="form-group">
            <label className="label">Date & Time *</label>
            <input className="input" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Format</label>
              <select className="input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value as any })}>
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="in-person">In-person</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Location / Link</label>
              <input className="input" value={form.location_or_link} onChange={e => setForm({ ...form, location_or_link: e.target.value })} placeholder="Zoom link or address" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Interviewers (comma separated)</label>
            <input className="input" value={form.interviewers} onChange={e => setForm({ ...form, interviewers: e.target.value })} placeholder="Jane Smith, John Doe" />
          </div>
          <div className="form-group">
            <label className="label">Notes for Applicant</label>
            <textarea className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any special instructions..." style={{ minHeight: '80px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.scheduled_at}>
            {mutation.isPending ? <span className="spinner" /> : 'Schedule Interview'}
          </button>
        </div>
      </div>
    </div>
  )
}
