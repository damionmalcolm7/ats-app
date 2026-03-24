import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, EmailTemplate } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, X, Eye } from 'lucide-react'

const DEFAULT_TEMPLATES = [
  { name: 'Application Received', trigger_event: 'application_received', subject: 'We received your application for {{job_title}}', body: 'Dear {{applicant_name}},\n\nThank you for applying for the {{job_title}} position at {{company_name}}. We have received your application and will review it shortly.\n\nWe will be in touch with next steps.\n\nBest regards,\n{{hr_name}}\n{{company_name}}' },
  { name: 'Shortlisted - Interview Invitation', trigger_event: 'shortlisted', subject: 'You\'ve been shortlisted for {{job_title}}', body: 'Dear {{applicant_name}},\n\nCongratulations! We are pleased to inform you that you have been shortlisted for the {{job_title}} position at {{company_name}}.\n\nWe would like to invite you for an interview on {{interview_date}}.\n\nPlease confirm your availability.\n\nBest regards,\n{{hr_name}}\n{{company_name}}' },
  { name: 'Rejection (Post-Application)', trigger_event: 'rejected_application', subject: 'Update on your application for {{job_title}}', body: 'Dear {{applicant_name}},\n\nThank you for your interest in the {{job_title}} position at {{company_name}}.\n\nAfter careful consideration, we regret to inform you that we will not be moving forward with your application at this time.\n\nWe appreciate the time you invested and wish you success in your job search.\n\nBest regards,\n{{hr_name}}\n{{company_name}}' },
  { name: 'Rejection (Post-Interview)', trigger_event: 'rejected_interview', subject: 'Update following your interview for {{job_title}}', body: 'Dear {{applicant_name}},\n\nThank you for taking the time to interview for the {{job_title}} position at {{company_name}}.\n\nAfter careful consideration, we have decided to move forward with another candidate.\n\nWe were impressed by your background and encourage you to apply for future openings.\n\nBest regards,\n{{hr_name}}\n{{company_name}}' },
  { name: 'Offer Letter Sent', trigger_event: 'offer_sent', subject: 'Job Offer - {{job_title}} at {{company_name}}', body: 'Dear {{applicant_name}},\n\nWe are delighted to offer you the position of {{job_title}} at {{company_name}}.\n\nPlease review the attached offer letter and sign at your earliest convenience.\n\nWe look forward to welcoming you to the team!\n\nBest regards,\n{{hr_name}}\n{{company_name}}' },
  { name: 'Document Upload Request', trigger_event: 'document_request', subject: 'Action Required: Documents needed for {{job_title}}', body: 'Dear {{applicant_name}},\n\nAs part of your application process for {{job_title}} at {{company_name}}, we require you to upload the following documents.\n\nPlease log in to your applicant portal to upload the requested documents.\n\nBest regards,\n{{hr_name}}\n{{company_name}}' },
]

export default function EmailTemplates() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_templates').select('*').order('name')
      if (error) throw error
      return data as EmailTemplate[]
    }
  })

  const seedMutation = useMutation({
    mutationFn: async () => {
      const payload = DEFAULT_TEMPLATES.map(t => ({ ...t, variables: ['applicant_name', 'job_title', 'company_name', 'hr_name', 'interview_date'], created_by: profile?.user_id }))
      const { error } = await supabase.from('email_templates').insert(payload)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-templates'] }); toast.success('Default templates created!') },
    onError: (err: any) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-templates'] }); toast.success('Template deleted') }
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Email Templates</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage automated and manual email templates</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {templates.length === 0 && (
            <button className="btn-secondary" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <span className="spinner" /> : 'Load Default Templates'}
            </button>
          )}
          <button className="btn-primary" onClick={() => { setEditTemplate(null); setShowForm(true) }}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{t.name}</div>
                  {t.trigger_event && (
                    <span className="badge badge-blue" style={{ marginTop: '0.375rem', fontSize: '0.7rem' }}>
                      Auto: {t.trigger_event.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => setPreviewTemplate(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}><Eye size={15} /></button>
                  <button onClick={() => { setEditTemplate(t); setShowForm(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}><Edit size={15} /></button>
                  <button onClick={() => { if (confirm('Delete template?')) deleteMutation.mutate(t.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={15} /></button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Subject:</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.subject}</div>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'var(--navy-900)', padding: '0.625rem', borderRadius: '6px', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden' }}>
                {t.body.substring(0, 120)}...
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <TemplateForm template={editTemplate} onClose={() => { setShowForm(false); setEditTemplate(null) }} onSuccess={() => { setShowForm(false); setEditTemplate(null); queryClient.invalidateQueries({ queryKey: ['email-templates'] }) }} />}
      {previewTemplate && (
        <div className="modal-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{previewTemplate.name}</h2>
              <button onClick={() => setPreviewTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div className="label">Subject</div>
                <div style={{ background: 'var(--navy-700)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem' }}>{previewTemplate.subject}</div>
              </div>
              <div>
                <div className="label">Body</div>
                <div style={{ background: 'var(--navy-700)', padding: '0.875rem', borderRadius: '8px', fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{previewTemplate.body}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateForm({ template, onClose, onSuccess }: { template: EmailTemplate | null, onClose: () => void, onSuccess: () => void }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    name: template?.name || '', subject: template?.subject || '',
    body: template?.body || '', trigger_event: template?.trigger_event || ''
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, variables: ['applicant_name', 'job_title', 'company_name', 'hr_name', 'interview_date'], created_by: profile?.user_id }
      if (template) {
        const { error } = await supabase.from('email_templates').update(payload).eq('id', template.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('email_templates').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => { toast.success(template ? 'Template updated!' : 'Template created!'); onSuccess() },
    onError: (err: any) => toast.error(err.message)
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '620px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{template ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: 'var(--blue-400)' }}>
            Available variables: <code>{'{{applicant_name}}'}</code> <code>{'{{job_title}}'}</code> <code>{'{{company_name}}'}</code> <code>{'{{hr_name}}'}</code> <code>{'{{interview_date}}'}</code>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Template Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Interview Invitation" required />
            </div>
            <div className="form-group">
              <label className="label">Trigger Event</label>
              <select className="input" value={form.trigger_event} onChange={e => setForm({ ...form, trigger_event: e.target.value })}>
                <option value="">Manual only</option>
                <option value="application_received">Application Received</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="rejected_application">Rejected (Application)</option>
                <option value="rejected_interview">Rejected (Interview)</option>
                <option value="offer_sent">Offer Sent</option>
                <option value="document_request">Document Request</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Subject *</label>
            <input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Email subject line" required />
          </div>
          <div className="form-group">
            <label className="label">Body *</label>
            <textarea className="input" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Email body content..." style={{ minHeight: '220px' }} required />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !form.subject || !form.body}>
            {mutation.isPending ? <span className="spinner" /> : (template ? 'Save Changes' : 'Create Template')}
          </button>
        </div>
      </div>
    </div>
  )
}
