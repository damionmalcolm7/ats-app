import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Briefcase, LogOut, FileText } from 'lucide-react'

const statusColors: Record<string, string> = {
  applied: 'badge-blue', screening: 'badge-yellow', interview: 'badge-purple',
  assessment: 'badge-yellow', offer: 'badge-green', hired: 'badge-green', rejected: 'badge-red'
}

export default function ApplicantPortal() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data
    }
  })

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`*, job:jobs(title, department, location, location_type), applicant_details(full_name)`)
        .eq('applicant_id', profile?.user_id)
        .order('created_at', { ascending: false })
      if (error) throw error

      // Fetch documents, interviews and email logs for each application
      const enriched = await Promise.all((data || []).map(async (app) => {
        const [docsRes, interviewsRes, emailsRes] = await Promise.all([
          supabase.from('documents').select('*').eq('application_id', app.id).order('created_at', { ascending: false }),
          supabase.from('interviews').select('*').eq('application_id', app.id).eq('status', 'scheduled').order('scheduled_at', { ascending: true }),
          supabase.from('email_logs').select('*').eq('application_id', app.id).order('sent_at', { ascending: false })
        ])
        return { ...app, documents: docsRes.data || [], interviews: interviewsRes.data || [], emails: emailsRes.data || [] }
      }))

      return enriched as any[]
    },
    enabled: !!profile,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Browse jobs — keep session by opening in same tab
  function handleBrowseJobs() {
    navigate('/jobs')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {settings?.company_logo ? (
            <img src={settings.company_logo} alt={settings.company_name} style={{ maxHeight: '40px', maxWidth: '160px', objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ width: '36px', height: '36px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={18} color="white" />
              </div>
              <span style={{ fontWeight: '700' }}>{settings?.company_name || 'Applicant Portal'}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Welcome, {profile?.full_name}</span>
          <button className="btn-secondary" onClick={handleBrowseJobs} style={{ fontSize: '0.8125rem' }}>Browse Jobs</button>
          <button className="btn-secondary" onClick={handleSignOut} style={{ fontSize: '0.8125rem', padding: '0.5rem' }} title="Sign Out"><LogOut size={14} /></button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(1rem, 4vw, 2rem)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Application Tracker</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {applications.length} application{applications.length !== 1 ? 's' : ''} submitted
          </p>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
        ) : applications.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Briefcase size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', display: 'block' }} />
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>You haven't applied to any jobs yet.</p>
            <button className="btn-primary" onClick={handleBrowseJobs}>Browse Open Positions</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {applications.map(app => (
              <div key={app.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.0625rem', fontWeight: '600', marginBottom: '0.375rem' }}>{app.job?.title}</h2>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {app.job?.department} · {app.job?.location} · <span style={{ textTransform: 'capitalize' }}>{app.job?.location_type}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Applied {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge ${statusColors[app.status]}`} style={{ textTransform: 'capitalize', fontSize: '0.8125rem' }}>{app.status}</span>
                </div>

                {/* Pipeline progress */}
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem' }}>
                  {['Applied', 'Screening', 'Interview', 'Assessment', 'Offer', 'Hired'].map((stage, i) => {
                    const stages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired']
                    const currentIndex = stages.indexOf(app.status)
                    const isActive = i <= currentIndex && app.status !== 'rejected'
                    const isCurrent = stages[i] === app.status
                    return (
                      <span key={stage} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{
                          color: isCurrent ? '#10b981' : isActive ? '#10b981' : 'var(--text-muted)',
                          fontWeight: isCurrent ? '700' : isActive ? '600' : '400',
                          background: isCurrent ? 'rgba(16,185,129,0.1)' : 'transparent',
                          padding: isCurrent ? '0.125rem 0.5rem' : '0',
                          borderRadius: '4px'
                        }}>
                          {isActive ? '✓ ' : ''}{stage}
                        </span>
                        {i < 5 && <span style={{ margin: '0 0.375rem', color: 'var(--text-muted)' }}>→</span>}
                      </span>
                    )
                  })}
                  {app.status === 'rejected' && (
                    <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '500' }}>Not selected for this role</span>
                  )}
                </div>

                {/* Upcoming Interviews */}
                {app.interviews?.length > 0 && (
                  <div style={{ marginTop: '0.875rem', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--blue-400)', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      📅 Upcoming Interview{app.interviews.length > 1 ? 's' : ''}
                    </div>
                    {app.interviews.map((iv: any) => (
                      <div key={iv.id} style={{ marginBottom: '0.375rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {new Date(iv.scheduled_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {iv.format === 'video' ? '📹 Video Call' : iv.format === 'phone' ? '📞 Phone Call' : '🏢 In-Person'}
                          {iv.location_or_link && <span> · <a href={iv.location_or_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-400)' }}>{iv.location_or_link}</a></span>}
                        </div>
                        {iv.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{iv.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* All documents */}
                {app.documents?.length > 0 && (
                  <div style={{ marginTop: '0.875rem', background: 'var(--navy-700)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.625rem' }}>
                      Documents
                    </div>
                    {app.documents.map((doc: any) => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: 'var(--navy-800)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span style={{ fontWeight: '500' }}>{doc.name}</span>
                          {doc.required && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>*Required</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${doc.status === 'signed' ? 'badge-green' : doc.status === 'uploaded' ? 'badge-blue' : 'badge-yellow'}`} style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                            {doc.status}
                          </span>
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              style={{ background: 'var(--blue-500)', color: 'white', borderRadius: '5px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              ↓ Download
                            </a>
                          )}
                          {doc.status === 'pending' && !doc.file_url && (
                            <DocumentUploader doc={doc} applicationId={app.id} onUploaded={() => {}} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Email History */}
                {app.emails?.length > 0 && (
                  <div style={{ marginTop: '0.875rem', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.625rem' }}>
                      📧 Communication History
                    </div>
                    {app.emails.map((email: any) => (
                      <div key={email.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid rgba(30,48,96,0.3)' }}>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Email sent from {email.recipient_email ? 'HR Team' : 'System'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(email.sent_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentUploader({ doc, applicationId, onUploaded }: { doc: any, applicationId: string, onUploaded?: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(doc.status !== 'pending')

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const fileName = `docs/${applicationId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)
      await supabase.from('documents').update({ file_url: publicUrl, status: 'uploaded', uploaded_at: new Date().toISOString() }).eq('id', doc.id)
      setUploaded(true)
      if (onUploaded) onUploaded()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <FileText size={14} />
        {doc.name}
        {doc.required && <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: '600' }}>*Required</span>}
      </div>
      {uploaded ? (
        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Uploaded ✓</span>
      ) : (
        <label style={{ cursor: 'pointer' }}>
          <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
          <span className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {uploading ? <span className="spinner" /> : 'Upload File'}
          </span>
        </label>
      )}
    </div>
  )
}
