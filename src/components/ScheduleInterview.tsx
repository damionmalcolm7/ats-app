import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendEmail } from '../lib/email'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  applicationId: string
  jobId: string
  existingInterview?: any
  onClose: () => void
  onSuccess: () => void
}

export default function ScheduleInterview({ applicationId, jobId, existingInterview, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    scheduled_at: '', format: 'video' as const,
    location_or_link: '', notes: '', interviewers: ''
  })

  useEffect(() => {
    if (existingInterview) {
      // Pre-fill form with existing interview data for rescheduling
      const dt = new Date(existingInterview.scheduled_at)
      const localDT = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setForm({
        scheduled_at: localDT,
        format: existingInterview.format,
        location_or_link: existingInterview.location_or_link || '',
        notes: existingInterview.notes || '',
        interviewers: (existingInterview.interviewers || []).join(', ')
      })
    }
  }, [existingInterview])

  const mutation = useMutation({
    mutationFn: async () => {
      if (existingInterview) {
        // Cancel old interview and create new one
        await supabase.from('interviews').update({ status: 'cancelled' }).eq('id', existingInterview.id)
      }

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
    onSuccess: async () => {
      // Send email notification
      try {
        const { data: appData } = await supabase
          .from('applications')
          .select('applicant_details(full_name, email), job:jobs(title)')
          .eq('id', applicationId)
          .single()

        const { data: settings } = await supabase
          .from('app_settings')
          .select('company_name, sender_name')
          .single()

        const details = Array.isArray(appData?.applicant_details) ? appData.applicant_details[0] : appData?.applicant_details
        const job = Array.isArray(appData?.job) ? appData.job[0] : appData?.job

        if (details?.email) {
          const interviewDate = new Date(form.scheduled_at).toLocaleString()
          const formatLabel = form.format === 'video' ? 'Video Call' : form.format === 'phone' ? 'Phone Call' : 'In-Person'
          const locationInfo = form.location_or_link ? `\nLocation/Link: ${form.location_or_link}` : ''
          const notesInfo = form.notes ? `\n\nAdditional Notes: ${form.notes}` : ''
          const isReschedule = !!existingInterview

          await sendEmail({
            to: details.email,
            subject: `${isReschedule ? 'Rescheduled: ' : ''}Interview Invitation - ${job?.title} at ${settings?.company_name || 'Our Company'}`,
            body: `Dear ${details.full_name},\n\n${isReschedule ? 'Your interview has been rescheduled. Please note the new details below.\n\n' : 'We are pleased to invite you for an interview for the '}${job?.title} position at ${settings?.company_name || 'Our Company'}.\n\nInterview Details:\nDate & Time: ${interviewDate}\nFormat: ${formatLabel}${locationInfo}${notesInfo}\n\nPlease confirm your availability by logging into your applicant portal.\n\nWe look forward to speaking with you!\n\nBest regards,\n${settings?.sender_name || settings?.company_name || 'HR Team'}`,
            application_id: applicationId
          })
        }
      } catch (e) {
        console.error('Failed to send interview email:', e)
      }

      toast.success(existingInterview ? 'Interview rescheduled & email sent!' : 'Interview scheduled & email sent!')
      onSuccess()
    },
    onError: (err: any) => toast.error(err.message)
  })

  const isReschedule = !!existingInterview

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            {isReschedule ? '🔄 Reschedule Interview' : 'Schedule Interview'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {isReschedule && (
          <div style={{ margin: '1rem 1.5rem 0', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8125rem', color: '#f59e0b' }}>
            ⚠ This will cancel the existing interview and schedule a new one. The applicant will receive an updated email.
          </div>
        )}

        <div style={{ padding: '1.25rem 1.5rem' }}>
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
            {mutation.isPending ? <span className="spinner" /> : isReschedule ? 'Confirm Reschedule' : 'Schedule Interview'}
          </button>
        </div>
      </div>
    </div>
  )
}
