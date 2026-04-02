import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { FileSignature, Send, Clock, CheckCircle, XCircle, AlertCircle, Upload, ExternalLink } from 'lucide-react'

interface Props {
  applicationId: string
  applicantName: string
  applicantEmail: string
}

const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  pending:  { label: 'Pending',  color: '#f59e0b', icon: Clock },
  sent:     { label: 'Sent',     color: '#3b82f6', icon: Send },
  signed:   { label: 'Signed',   color: '#10b981', icon: CheckCircle },
  declined: { label: 'Declined', color: '#ef4444', icon: XCircle },
  expired:  { label: 'Expired',  color: '#94a3b8', icon: AlertCircle },
}

const DOCUMENT_TEMPLATES = [
  'Offer Letter',
  'Employment Contract',
  'Confidentiality Agreement (NDA)',
  'Background Check Consent',
  'Employee Handbook Acknowledgement',
  'Tax Declaration Form',
  'Bank Details Form',
  'Other',
]

export default function ESignature({ applicationId, applicantName, applicantEmail }: Props) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [documentName, setDocumentName] = useState('')
  const [customName, setCustomName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['signature-requests', applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('signature_requests')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
      return data || []
    }
  })

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `signature-docs/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setUploadedUrl(publicUrl)
      setUploadedFileName(file.name)
      toast.success('Document uploaded!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const sendRequest = useMutation({
    mutationFn: async () => {
      const finalName = documentName === 'Other' ? customName : documentName
      if (!finalName) throw new Error('Please select a document type')

      // Create signature request record
      const { error } = await supabase.from('signature_requests').insert({
        application_id: applicationId,
        document_name: finalName,
        document_url: uploadedUrl || null,
        status: 'sent',
        requested_by: profile?.user_id,
        recipient_email: applicantEmail,
        recipient_name: applicantName,
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      if (error) throw error

      // Also add the document to the applicant's Documents tab so they can see it in their portal
      if (uploadedUrl) {
        await supabase.from('documents').insert({
          application_id: applicationId,
          name: finalName,
          type: 'offer',
          status: 'uploaded',
          file_url: uploadedUrl,
          uploaded_by: 'hr'
        })
      }

      // NOTE: When Adobe Sign is connected, this is where you would call:
      // const adobeResponse = await sendAdobeSignRequest({ documentUrl: uploadedUrl, recipientEmail: applicantEmail, recipientName: applicantName })
      // Then update the record with adobeResponse.agreementId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests', applicationId] })
      toast.success(`Signature request sent! Document is now visible in ${applicantName}'s portal.`)
      setShowRequestForm(false)
      setDocumentName('')
      setCustomName('')
      setUploadedUrl('')
      setUploadedFileName('')
    },
    onError: (err: any) => toast.error(err.message)
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const updates: any = { status }
      if (status === 'signed') updates.signed_at = new Date().toISOString()
      const { error } = await supabase.from('signature_requests').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests', applicationId] })
      toast.success('Status updated')
    }
  })

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('signature_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests', applicationId] })
      toast.success('Request deleted')
    }
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileSignature size={18} color="var(--blue-400)" />
          <h4 style={{ fontWeight: '600', fontSize: '0.9375rem' }}>E-Signature Requests</h4>
        </div>
        <button onClick={() => setShowRequestForm(!showRequestForm)} className="btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem' }}>
          <FileSignature size={14} /> Request Signature
        </button>
      </div>

      {/* Adobe Sign notice */}
      <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <AlertCircle size={15} color="var(--blue-400)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Adobe Sign integration is ready to connect. Contact IT to provide API credentials to enable automatic e-signature sending and tracking.
        </span>
      </div>

      {/* Request Form */}
      {showRequestForm && (
        <div style={{ background: 'var(--navy-700)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h4 style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '1rem' }}>New Signature Request</h4>

          <div className="form-group">
            <label className="label">Document Type *</label>
            <select className="input" value={documentName} onChange={e => setDocumentName(e.target.value)}>
              <option value="">— Select document —</option>
              {DOCUMENT_TEMPLATES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {documentName === 'Other' && (
            <div className="form-group">
              <label className="label">Document Name *</label>
              <input className="input" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Enter document name" />
            </div>
          )}

          <div className="form-group">
            <label className="label">Upload Document (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ cursor: 'pointer' }} className="btn-secondary">
                <Upload size={14} /> {uploading ? 'Uploading...' : 'Choose File'}
                <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} disabled={uploading} />
              </label>
              {uploadedFileName && <span style={{ fontSize: '0.8125rem', color: '#10b981' }}>✓ {uploadedFileName}</span>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Supported: PDF, DOC, DOCX</div>
          </div>

          <div className="form-group">
            <label className="label">Recipient</label>
            <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.625rem 0.875rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {applicantName} — {applicantEmail}
            </div>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'var(--navy-800)', padding: '0.625rem 0.875rem', borderRadius: '6px', marginBottom: '1rem' }}>
            ⚡ Once Adobe Sign is connected, the document will be sent automatically via Adobe Sign for a legally binding e-signature. The request expires after 7 days.
          </div>

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="btn-secondary" onClick={() => setShowRequestForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending || !documentName || (documentName === 'Other' && !customName)}>
              {sendRequest.isPending ? <span className="spinner" /> : <><Send size={14} /> Send Request</>}
            </button>
          </div>
        </div>
      )}

      {/* Requests List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}><span className="spinner" /></div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--navy-900)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.875rem' }}>
          No signature requests yet. Click "Request Signature" to send a document for signing.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {requests.map((req: any) => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
            const Icon = config.icon
            return (
              <div key={req.id} style={{ background: 'var(--navy-700)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${config.color}18`, border: `1px solid ${config.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={config.color} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{req.document_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        Sent to {req.recipient_name} · {new Date(req.created_at).toLocaleDateString()}
                        {req.signed_at && ` · Signed ${new Date(req.signed_at).toLocaleDateString()}`}
                        {req.expires_at && req.status === 'sent' && ` · Expires ${new Date(req.expires_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ background: `${config.color}18`, border: `1px solid ${config.color}40`, color: config.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                      {config.label}
                    </span>

                    {/* Actions */}
                    {req.document_url && (
                      <a href={req.document_url} target="_blank" rel="noopener noreferrer"
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.5rem', color: 'var(--blue-400)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> View
                      </a>
                    )}

                    {/* Manual status update for demo purposes */}
                    {req.status === 'sent' && (
                      <button onClick={() => updateStatus.mutate({ id: req.id, status: 'signed' })}
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={12} /> Mark Signed
                      </button>
                    )}

                    <button onClick={() => { if (confirm('Delete this signature request?')) deleteRequest.mutate(req.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>
                      ×
                    </button>
                  </div>
                </div>

                {req.status === 'signed' && req.signed_document_url && (
                  <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid var(--border)' }}>
                    <a href={req.signed_document_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#10b981', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}>
                      <ExternalLink size={13} /> Download Signed Document
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
