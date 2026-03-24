import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Briefcase, LogOut, FileText, Calendar } from 'lucide-react'

const statusColors: Record<string, string> = {
  applied: 'badge-blue', screening: 'badge-yellow', interview: 'badge-purple',
  assessment: 'badge-yellow', offer: 'badge-green', hired: 'badge-green', rejected: 'badge-red'
}

export default function ApplicantPortal() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`*, job:jobs(title, department, location, location_type), applicant_details(full_name), documents(id, name, status, file_url, type)`)
        .eq('applicant_id', profile?.user_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as any[]
    },
    enabled: !!profile
  })

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={18} color="white" />
          </div>
          <span style={{ fontWeight: '700' }}>My Applications</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Welcome, {profile?.full_name}</span>
          <button className="btn-secondary" onClick={() => navigate('/jobs')} style={{ fontSize: '0.8125rem' }}>Browse Jobs</button>
          <button className="btn-secondary" onClick={handleSignOut} style={{ fontSize: '0.8125rem' }}><LogOut size={14} /></button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Application Tracker</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{applications.length} application{applications.length !== 1 ? 's' : ''} submitted</p>
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

                {/* Progress bar */}
                <div style={{ marginTop: '1rem' }}>
                  {['Applied', 'Screening', 'Interview', 'Assessment', 'Offer', 'Hired'].map((stage, i) => {
                    const stages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired']
                    const currentIndex = stages.indexOf(app.status)
                    const isActive = i <= currentIndex && app.status !== 'rejected'
                    return (
                      <span key={stage} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{ color: isActive ? '#10b981' : 'var(--text-muted)', fontWeight: isActive ? '600' : '400' }}>
                          {isActive ? '✓ ' : ''}{stage}
                        </span>
                        {i < 5 && <span style={{ margin: '0 0.375rem', color: 'var(--text-muted)' }}>→</span>}
                      </span>
                    )
                  })}
                  {app.status === 'rejected' && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '500', marginLeft: '0.5rem' }}>Not selected</span>}
                </div>

                {/* Pending documents */}
                {app.documents?.filter((d: any) => d.status === 'pending').length > 0 && (
                  <div style={{ marginTop: '0.875rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: '500', color: '#f59e0b', marginBottom: '0.5rem' }}>⚠ Documents Required</div>
                    {app.documents.filter((d: any) => d.status === 'pending').map((doc: any) => (
                      <DocumentUploader key={doc.id} doc={doc} applicationId={app.id} />
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

function DocumentUploader({ doc, applicationId }: { doc: any, applicationId: string }) {
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
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <FileText size={14} />{doc.name} {doc.required && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>*Required</span>}
      </div>
      {uploaded ? (
        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Uploaded</span>
      ) : (
        <label style={{ cursor: 'pointer' }}>
          <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
          <span className="btn-primary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {uploading ? <span className="spinner" /> : 'Upload'}
          </span>
        </label>
      )}
    </div>
  )
}

import { useState } from 'react'
