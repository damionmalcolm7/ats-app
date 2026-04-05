import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sendEmail as sendEmailViaEdge } from '../lib/email'
import { createAuditLog } from '../lib/audit'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  applicationId: string
  applicantEmail: string
  applicantName: string
  jobTitle?: string
  onClose: () => void
}

export default function SendEmailModal({ applicationId, applicantEmail, applicantName, jobTitle, onClose }: Props) {
  const { profile } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedSender, setSelectedSender] = useState(profile?.user_id || '')

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('email_templates').select('*').order('name')
      return data || []
    }
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data
    }
  })

  // Fetch all HR users for the From dropdown
  const { data: hrUsers = [] } = useQuery({
    queryKey: ['hr-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .in('role', ['hr', 'super_admin'])
        .order('full_name')
      return data || []
    }
  })

  const selectedSenderProfile = hrUsers.find((u: any) => u.user_id === selectedSender)

  function loadTemplate(templateId: string) {
    const t = templates.find((t: any) => t.id === templateId)
    if (!t) return
    const companyName = settings?.company_name || 'Our Company'
    const senderName = selectedSenderProfile?.full_name || profile?.full_name || 'HR Team'
    const filled = (str: string) => str
      .replace(/\{\{applicant_name\}\}/g, applicantName)
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{hr_name\}\}/g, senderName)
      .replace(/\{\{job_title\}\}/g, jobTitle || 'the position')
      .replace(/\{\{interview_date\}\}/g, 'to be confirmed — please check your portal')
    setSubject(filled(t.subject))
    setBody(filled(t.body))
    setSelectedTemplate(templateId)
  }

  async function sendEmail() {
    if (!subject || !body) return toast.error('Subject and body required')
    setSending(true)
    try {
      const senderName = selectedSenderProfile?.full_name || profile?.full_name || 'HR Team'
      const result = await sendEmailViaEdge({
        to: applicantEmail,
        subject,
        body,
        application_id: applicationId,
        applicant_name: applicantName,
        hr_name: senderName
      })
      if (!result.success) throw new Error(result.error || 'Failed to send email')
      toast.success(`Email sent from ${senderName}`)
      if (profile) {
        createAuditLog({
          user_id: profile.user_id,
          user_name: profile.full_name || 'Unknown',
          user_role: profile.role || 'unknown',
          action: 'SEND_EMAIL',
          entity_type: 'application',
          entity_id: applicationId,
          details: { to: applicantEmail, subject, applicant_name: applicantName }
        })
      }
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Send Email to {applicantName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem' }}>

          {/* From dropdown */}
          <div className="form-group">
            <label className="label">From (Sender)</label>
            <select className="input" value={selectedSender} onChange={e => {
              setSelectedSender(e.target.value)
              // Re-fill template with new sender name if template is selected
              if (selectedTemplate) loadTemplate(selectedTemplate)
            }}>
              <option value="">— Select Sender —</option>
              {hrUsers.map((u: any) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
            {selectedSenderProfile && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                  {selectedSenderProfile.full_name?.[0]?.toUpperCase()}
                </div>
                Email will show as from: <strong style={{ color: 'var(--text-secondary)' }}>{selectedSenderProfile.full_name}</strong>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="label">Use Template</label>
            <select className="input" value={selectedTemplate} onChange={e => loadTemplate(e.target.value)}>
              <option value="">— Select a template —</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">To</label>
            <input className="input" value={applicantEmail} disabled style={{ opacity: 0.6 }} />
          </div>

          <div className="form-group">
            <label className="label">Subject *</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
          </div>

          <div className="form-group">
            <label className="label">Message *</label>
            <textarea className="input" value={body} onChange={e => setBody(e.target.value)} placeholder="Email body..." style={{ minHeight: '180px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={sendEmail} disabled={sending || !subject || !body || !selectedSender}>
            {sending ? <span className="spinner" /> : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
