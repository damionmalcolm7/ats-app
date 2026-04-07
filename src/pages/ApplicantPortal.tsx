import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { notifyHRTeam } from '../lib/notifications'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Briefcase, LogOut, FileText, Calendar, Mail, MapPin, Clock, Building } from 'lucide-react'

const statusColors: Record<string, string> = {
  applied: 'badge-blue', screening: 'badge-yellow', interview: 'badge-purple',
  assessment: 'badge-yellow', offer: 'badge-green', hired: 'badge-green', rejected: 'badge-red'
}

export default function ApplicantPortal() {
  useEffect(() => {
  document.body.classList.add('applicant-page')
  return () => document.body.classList.remove('applicant-page')
}, [])
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)

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
    refetchInterval: 30000
  })

  const selectedApp = applications.find(a => a.id === selectedAppId) || applications[0]
  const allInterviews = applications.flatMap(a => (a.interviews || []).map((iv: any) => ({ ...iv, jobTitle: a.job?.title })))
    .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const STAGES = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired']
  const STAGE_LABELS = ['Applied', 'Screening', 'Interview', 'Assessment', 'Offer', 'Hired']

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          {settings?.company_logo ? (
            <img src="https://ljgjgaojkihpaykfewpa.supabase.co/storage/v1/object/public/avatars/Logo%20Text%20and%20Slogan%20to%20left.png" alt={settings.company_name} style={{ maxHeight: '40px', maxWidth: '160px', objectFit: 'contain' }} />
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
          <span className="welcome-full">Welcome, {profile?.full_name}</span>
          <span className="welcome-short">Hi, {profile?.full_name?.split(' ')[0]}!</span>
          <button className="btn-secondary" onClick={() => navigate('/jobs')} style={{ fontSize: '0.8125rem' }}>Browse Jobs</button>
          <button className="btn-secondary" onClick={handleSignOut} style={{ fontSize: '0.8125rem', padding: '0.5rem' }} title="Sign Out"><LogOut size={14} /></button>
        </div>
      </div>

      <div className='portal-grid' style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 2rem)', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

        {/* LEFT — Main Content */}
        <div>
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
              <button className="btn-primary" onClick={() => navigate('/jobs')}>Browse Open Positions</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {applications.map(app => (
                <div key={app.id} className="card"
                  style={{ cursor: 'pointer', border: selectedApp?.id === app.id ? '1px solid rgba(37,99,235,0.4)' : '1px solid var(--border)', transition: 'border-color 0.2s' }}
                  onClick={() => setSelectedAppId(app.id)}>

                  {/* Job header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.0625rem', fontWeight: '600', marginBottom: '0.375rem' }}>{app.job?.title}</h2>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <Building size={12} /> {app.job?.department}
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <MapPin size={12} /> {app.job?.location}
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ textTransform: 'capitalize' }}>{app.job?.location_type}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} /> Applied {new Date(app.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`badge ${statusColors[app.status]}`} style={{ textTransform: 'capitalize', fontSize: '0.8125rem' }}>{app.status}</span>
                  </div>

                  {/* Pipeline progress */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', marginBottom: '0.875rem' }}>
                    {STAGE_LABELS.map((stage, i) => {
                      const currentIndex = STAGES.indexOf(app.status)
                      const isActive = i <= currentIndex && app.status !== 'rejected'
                      const isCurrent = STAGES[i] === app.status
                      return (
                        <span key={stage} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem' }}>
                          <span style={{ color: isCurrent ? '#10b981' : isActive ? '#10b981' : 'var(--text-muted)', fontWeight: isCurrent ? '700' : isActive ? '600' : '400', background: isCurrent ? 'rgba(16,185,129,0.1)' : 'transparent', padding: isCurrent ? '0.125rem 0.5rem' : '0', borderRadius: '4px' }}>
                            {isActive ? '✓ ' : ''}{stage}
                          </span>
                          {i < 5 && <span style={{ margin: '0 0.375rem', color: 'var(--text-muted)' }}>→</span>}
                        </span>
                      )
                    })}
                    {app.status === 'rejected' && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '500' }}>Not selected for this role</span>}
                  </div>

                  {/* Documents */}
                  {app.documents?.length > 0 && (
                    <div style={{ background: 'var(--navy-700)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.625rem' }}>Documents</div>
                      {app.documents.map((doc: any) => (
                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: 'var(--navy-800)', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <FileText size={14} />
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
                    <EmailHistory emails={app.emails} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem', marginTop: '3.5rem' }}>

          {/* Application Summary */}
          {selectedApp && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--blue-400)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={15} /> Application Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Position</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{selectedApp.job?.title}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Department</div>
                  <div style={{ fontSize: '0.875rem' }}>{selectedApp.job?.department}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Location</div>
                  <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MapPin size={12} color="var(--text-muted)" />
                    {selectedApp.job?.location} · <span style={{ textTransform: 'capitalize' }}>{selectedApp.job?.location_type}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Applied</div>
                  <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} color="var(--text-muted)" />
                    {new Date(selectedApp.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Current Stage</div>
                  <span className={`badge ${statusColors[selectedApp.status]}`} style={{ textTransform: 'capitalize', fontSize: '0.8125rem' }}>{selectedApp.status}</span>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Interviews */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={15} color="var(--blue-400)" /> Upcoming Interviews
            </h3>
            {allInterviews.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '0.75rem 0' }}>No upcoming interviews scheduled</p>
            ) : allInterviews.map((iv: any) => (
              <div key={iv.id} style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--blue-400)', marginBottom: '0.375rem' }}>{iv.jobTitle}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                  {new Date(iv.scheduled_at).toLocaleDateString('en-JM', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                  {new Date(iv.scheduled_at).toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem', textTransform: 'capitalize' }}>
                  {iv.format === 'video' ? '📹 Video Call' : iv.format === 'phone' ? '📞 Phone Call' : '🏢 In-Person'}
                </div>
                {iv.location_or_link && (
                  <a href={iv.location_or_link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--blue-400)', display: 'block', marginTop: '0.25rem' }}>
                    {iv.location_or_link}
                  </a>
                )}
                {iv.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>{iv.notes}</div>}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '1rem' }}>Quick Actions</h3>
            <button className="btn-secondary" onClick={() => navigate('/jobs')} style={{ width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}>
              <Briefcase size={14} /> Browse More Jobs
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

function EmailHistory({ emails }: { emails: any[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? emails : emails.slice(0, 5)
  const hidden = emails.length - 5

  return (
    <div style={{ background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.875rem' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <Mail size={13} /> Communication History
      </div>
      {visible.map((email: any) => (
        <div key={email.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid rgba(30,48,96,0.3)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Email sent from HR Team</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(email.sent_at).toLocaleDateString()}</div>
        </div>
      ))}
      {!showAll && hidden > 0 && (
        <button onClick={() => setShowAll(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', fontSize: '0.8125rem', marginTop: '0.5rem', padding: 0 }}>
          + Show {hidden} more email{hidden !== 1 ? 's' : ''}
        </button>
      )}
      {showAll && hidden > 0 && (
        <button onClick={() => setShowAll(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.5rem', padding: 0 }}>
          Show less
        </button>
      )}
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
      await notifyHRTeam({
        type: 'document_uploaded',
        title: 'Document Uploaded',
        message: `An applicant has uploaded: ${doc.name}`,
        link: `/dashboard/applicants/${applicationId}`
      })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  return uploaded ? (
    <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Uploaded ✓</span>
  ) : (
    <label style={{ cursor: 'pointer' }}>
      <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
      <span className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {uploading ? <span className="spinner" /> : 'Upload File'}
      </span>
    </label>
  )
}
