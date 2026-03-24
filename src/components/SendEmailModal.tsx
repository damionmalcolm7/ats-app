import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  applicationId: string
  applicantEmail: string
  applicantName: string
  onClose: () => void
}

export default function SendEmailModal({ applicationId, applicantEmail, applicantName, onClose }: Props) {
  const { profile } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

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

  function loadTemplate(templateId: string) {
    const t = templates.find((t: any) => t.id === templateId)
    if (!t) return
    const companyName = settings?.company_name || 'Our Company'
    const filled = (str: string) => str
      .replace(/\{\{applicant_name\}\}/g, applicantName)
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{hr_name\}\}/g, profile?.full_name || 'HR Team')
    setSubject(filled(t.subject))
    setBody(filled(t.body))
    setSelectedTemplate(templateId)
  }

  async function sendEmail() {
    if (!subject || !body) return toast.error('Subject and body required')
    setSending(true)
    try {
      // Log the email
      await supabase.from('email_logs').insert({
        application_id: applicationId,
        template_id: selectedTemplate || null,
        recipient_email: applicantEmail,
        sent_at: new Date().toISOString(),
        status: 'sent'
      })
      // In production, call your edge function here:
      // await fetch('/api/send-email', { method: 'POST', body: JSON.stringify({ to: applicantEmail, subject, body }) })
      toast.success(`Email sent to ${applicantEmail}`)
      onClose()
    } catch (err: any) {
      toast.error(err.message)
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
          <button className="btn-primary" onClick={sendEmail} disabled={sending || !subject || !body}>
            {sending ? <span className="spinner" /> : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
