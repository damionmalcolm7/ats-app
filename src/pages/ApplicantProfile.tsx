import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendStatusEmail } from '../lib/email'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail, Phone, FileText, Star, Tag, Plus, X, Download, Calendar, Upload } from 'lucide-react'
import ScheduleInterview from '../components/ScheduleInterview'
import CandidateReviews from '../components/CandidateReviews'
import CandidateComments from '../components/CandidateComments'
import InterviewFeedback from '../components/InterviewFeedback'
import SendEmailModal from '../components/SendEmailModal'
import RequestDocument from '../components/RequestDocument'

export default function ApplicantProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState('')
  const [rating, setRating] = useState(0)
  const [showInterview, setShowInterview] = useState(false)
  const [rescheduleInterview, setRescheduleInterview] = useState<any>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [showDocRequest, setShowDocRequest] = useState(false)

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: async () => {
      // Fetch application with job and applicant details
      const { data: appData, error } = await supabase
        .from('applications')
        .select(`*, job:jobs(*), applicant_details(*)`)
        .eq('id', id)
        .single()
      if (error) throw error

      // Separately fetch the applicant profile
      if (appData?.applicant_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', appData.applicant_id)
          .single()
        return { ...appData, profile: profileData } as any
      }
      return appData as any
    }
  })

  const { data: interviews = [] } = useQuery({
    queryKey: ['interviews', id],
    queryFn: async () => {
      const { data } = await supabase.from('interviews').select('*').eq('application_id', id).order('scheduled_at')
      return data || []
    }
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('application_id', id)
      return data || []
    }
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', id],
    queryFn: async () => {
      const { data } = await supabase.from('tags').select('*').eq('application_id', id)
      return data || []
    }
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', id],
    queryFn: async () => {
      const { data } = await supabase.from('application_notes').select('*, author:profiles(full_name)').eq('application_id', id).order('created_at', { ascending: false })
      return data || []
    }
  })

  const { data: answers = [] } = useQuery({
    queryKey: ['answers', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('application_answers')
        .select('*, question:job_questions(question, question_type)')
        .eq('application_id', id)
      return data || []
    }
  })

  const { data: ratingData } = useQuery({
    queryKey: ['rating', id],
    queryFn: async () => {
      const { data } = await supabase.from('ratings').select('score').eq('application_id', id).single()
      if (data) setRating(data.score)
      return data
    }
  })

  const addTagMutation = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase.from('tags').insert({ application_id: id, label, color: '#2563eb' })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags', id] }); setTagInput('') }
  })

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', tagId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags', id] })
  })

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('application_notes').insert({ application_id: id, content })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes', id] }); setNote('') }
  })

  const ratingMutation = useMutation({
    mutationFn: async (score: number) => {
      await supabase.from('ratings').upsert({ application_id: id, score }, { onConflict: 'application_id' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rating', id] })
  })

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error

      // Fetch fresh applicant details to ensure we have the email
      const { data: details } = await supabase
        .from('applicant_details')
        .select('full_name, email')
        .eq('application_id', id)
        .single()

      const { data: jobData } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', app?.job_id)
        .single()

      const email = details?.email
      const name = details?.full_name
      const jobTitle = jobData?.title || app?.job?.title

      console.log('Sending email to:', email, 'name:', name, 'job:', jobTitle, 'status:', status)

      if (email && name && jobTitle) {
        const result = await sendStatusEmail(status, email, name, jobTitle, id!)
        console.log('Email result:', result)
      } else {
        console.log('Missing data - email:', email, 'name:', name, 'job:', jobTitle)
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['application', id] }); toast.success('Status updated & email sent') },
    onError: (err: any) => toast.error(err.message)
  })

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center' }}><span className="spinner" /></div>
  if (!app) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Application not found</div>

  const details = app.applicant_details
  const tabs = ['overview', 'resume', 'interviews', 'documents', 'notes', 'reviews', 'discussion']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/dashboard/applicants')} className="btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '700' }}>{details?.full_name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Applied for: <strong style={{ color: 'var(--text-secondary)' }}>{app.job?.title}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => setShowEmail(true)}><Mail size={15} /> Email</button>
          <button className="btn-secondary" onClick={() => setShowInterview(true)}><Calendar size={15} /> Schedule Interview</button>
          <button className="btn-secondary" onClick={() => setShowDocRequest(true)}><FileText size={15} /> Request Doc</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem' }}>
        {/* Left sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Profile card */}
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', margin: '0 auto 0.75rem' }}>
                {details?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ fontWeight: '600', fontSize: '1rem' }}>{details?.full_name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{details?.years_experience ? `${details.years_experience} years experience` : 'Experience N/A'}</div>
            </div>

            {/* Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {details?.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}><Mail size={14} />{details.email}</div>}
              {details?.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}><Phone size={14} />{details.phone}</div>}
            </div>

            {/* Status */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="label">Application Stage</label>
              <select className="input" value={app.status} onChange={e => statusMutation.mutate(e.target.value)}>
                {['applied','screening','interview','assessment','offer','hired','rejected'].map(s => (
                  <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>
                ))}
              </select>
            </div>

            {/* Rating */}
            <div>
              <label className="label">Rating</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => { setRating(n); ratingMutation.mutate(n) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: n <= rating ? '#f59e0b' : 'var(--text-muted)', fontSize: '1.25rem' }}>★</button>
                ))}
              </div>
            </div>
          </div>

          {/* Match score */}
          {app.match_score != null && (
            <div className="card" style={{ padding: '1rem' }}>
              <label className="label">Job Match Score</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ flex: 1, height: '8px', background: 'var(--navy-700)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${app.match_score}%`, height: '100%', background: app.match_score >= 70 ? '#10b981' : '#f59e0b', borderRadius: '4px' }} />
                </div>
                <span style={{ fontWeight: '700', color: app.match_score >= 70 ? '#10b981' : '#f59e0b' }}>{app.match_score}%</span>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="card" style={{ padding: '1rem' }}>
            <label className="label">Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.625rem' }}>
              {tags.map((t: any) => (
                <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(37,99,235,0.15)', color: '#3b82f6', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                  {t.label}
                  <button onClick={() => removeTagMutation.mutate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', lineHeight: 1 }}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tagInput.trim() && addTagMutation.mutate(tagInput.trim())}
                placeholder="Add tag..." style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }} />
              <button className="btn-secondary" style={{ padding: '0.375rem 0.625rem' }} onClick={() => tagInput.trim() && addTagMutation.mutate(tagInput.trim())}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Skills */}
          <div className="card" style={{ padding: '1rem' }}>
            <label className="label">Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
              {(details?.skills || []).map((s: string) => (
                <span key={s} className="badge badge-blue" style={{ fontSize: '0.75rem' }}>{s}</span>
              ))}
              {(!details?.skills || details.skills.length === 0) && <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No skills listed</span>}
            </div>
          </div>
        </div>

        {/* Right content */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--navy-900)', borderRadius: '10px', padding: '0.25rem', width: 'fit-content' }}>
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', textTransform: 'capitalize', background: activeTab === tab ? 'var(--blue-500)' : 'transparent', color: activeTab === tab ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontWeight: '600', marginBottom: '0.875rem' }}>Cover Letter</h3>
                {app.cover_letter ? (
                  <CoverLetter text={app.cover_letter} />
                ) : (
                  <em style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No cover letter provided</em>
                )}
              </div>
              {answers.length > 0 && (
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '0.875rem' }}>Screening Questions & Answers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {answers.map((a: any) => (
                      <div key={a.id} style={{ padding: '0.75rem', background: 'var(--navy-700)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{a.question?.question}</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: '500', color: a.answer === 'Yes' ? '#10b981' : a.answer === 'No' ? '#ef4444' : 'var(--text-primary)' }}>
                          {a.answer || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {details?.work_history?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '0.875rem' }}>Work History</h3>
                  {details.work_history.map((w: any, i: number) => (
                    <div key={i} style={{ marginBottom: '0.875rem', paddingBottom: '0.875rem', borderBottom: i < details.work_history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontWeight: '500' }}>{w.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{w.company} · {w.duration}</div>
                    </div>
                  ))}
                </div>
              )}
              {details?.education?.length > 0 && (
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '0.875rem' }}>Education</h3>
                  {details.education.map((e: any, i: number) => (
                    <div key={i} style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: '500' }}>{e.degree}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{e.institution} · {e.year}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resume tab */}
          {activeTab === 'resume' && (
            <div className="card">
              <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Resume</h3>
              {details?.resume_url ? (
                <div>
                  <a href={details.resume_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
                    <Download size={15} /> Download Resume
                  </a>
                  <iframe src={details.resume_url} style={{ width: '100%', height: '600px', border: 'none', borderRadius: '8px', background: 'white' }} title="Resume" />
                </div>
              ) : <p style={{ color: 'var(--text-muted)' }}>No resume uploaded</p>}
            </div>
          )}

          {/* Interviews tab */}
          {activeTab === 'interviews' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: '600' }}>Interviews</h3>
                <button className="btn-primary" onClick={() => { setRescheduleInterview(null); setShowInterview(true) }}><Plus size={15} /> Schedule New</button>
              </div>
              {interviews.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No interviews scheduled</p>
              ) : interviews.map((iv: any) => (
                <div key={iv.id} style={{ padding: '0.875rem', background: 'var(--navy-700)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{iv.format} Interview</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                        {new Date(iv.scheduled_at).toLocaleString()}
                      </div>
                      {iv.location_or_link && <div style={{ color: 'var(--blue-400)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{iv.location_or_link}</div>}
                      {iv.notes && <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{iv.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <span className={`badge ${iv.status === 'scheduled' ? 'badge-blue' : iv.status === 'completed' ? 'badge-green' : 'badge-red'}`} style={{ textTransform: 'capitalize' }}>
                        {iv.status}
                      </span>
                      {iv.status === 'scheduled' && (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => { setRescheduleInterview(iv); setShowInterview(true) }}
                            style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: '#3b82f6', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={12} /> Reschedule
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Cancel this interview? The applicant will be notified.')) {
                                await supabase.from('interviews').update({ status: 'cancelled' }).eq('id', iv.id)
                                queryClient.invalidateQueries({ queryKey: ['interviews', id] })
                                toast.success('Interview cancelled')
                              }
                            }}
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interview Feedback */}
                  <div style={{ marginTop: '0.875rem', borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Interview Feedback
                    </div>
                    <InterviewFeedback interviewId={iv.id} applicationId={id!} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Documents tab */}
          {activeTab === 'documents' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: '600' }}>Documents</h3>
                <button className="btn-primary" onClick={() => setShowDocRequest(true)}><Plus size={15} /> Request Document</button>
              </div>
              {documents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No documents requested yet</p>
              ) : documents.map((doc: any) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--navy-700)', borderRadius: '8px', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileText size={18} color="var(--text-secondary)" />
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{doc.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{doc.type}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${doc.status === 'signed' ? 'badge-green' : doc.status === 'uploaded' ? 'badge-blue' : doc.status === 'declined' ? 'badge-red' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                      {doc.status}
                    </span>
                    {doc.status === 'pending' && (
                      <HRDocUploader doc={doc} onUploaded={() => queryClient.invalidateQueries({ queryKey: ['documents', id] })} />
                    )}
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                        <Download size={12} />
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm(`Delete "${doc.name}"?`)) {
                          await supabase.from('documents').delete().eq('id', doc.id)
                          queryClient.invalidateQueries({ queryKey: ['documents', id] })
                          toast.success('Document deleted')
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}
                      title="Delete document">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes tab */}
          {activeTab === 'notes' && (
            <div className="card">
              <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Private Notes (HR Only)</h3>
              <div style={{ marginBottom: '1rem' }}>
                <textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a private note about this applicant..." style={{ minHeight: '80px', marginBottom: '0.5rem' }} />
                <button className="btn-primary" onClick={() => note.trim() && addNoteMutation.mutate(note.trim())} disabled={addNoteMutation.isPending || !note.trim()}>
                  {addNoteMutation.isPending ? <span className="spinner" /> : 'Add Note'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {notes.map((n: any) => (
                  <div key={n.id} style={{ padding: '0.875rem', background: 'var(--navy-700)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>{n.content}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {n.author?.full_name} · {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No notes yet</p>}
              </div>
            </div>
          )}

          {/* Discussion tab */}
          {activeTab === 'discussion' && (
            <div className="card">
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: '600' }}>Team Discussion</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Collaborate with your team about this candidate in real time</p>
              </div>
              <CandidateComments applicationId={id!} />
            </div>
          )}

          {/* Reviews tab */}
          {activeTab === 'reviews' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontWeight: '600' }}>Team Reviews</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Collaborative candidate evaluation from the hiring team</p>
                </div>
              </div>
              <CandidateReviews applicationId={id!} />
            </div>
          )}
        </div>
      </div>

      {showInterview && <ScheduleInterview applicationId={id!} jobId={app.job_id} existingInterview={rescheduleInterview} onClose={() => { setShowInterview(false); setRescheduleInterview(null) }} onSuccess={() => { setShowInterview(false); setRescheduleInterview(null); queryClient.invalidateQueries({ queryKey: ['interviews', id] }) }} />}
      {showEmail && <SendEmailModal applicationId={id!} applicantEmail={details?.email} applicantName={details?.full_name} jobTitle={app?.job?.title} onClose={() => setShowEmail(false)} />}
      {showDocRequest && <RequestDocument applicationId={id!} onClose={() => setShowDocRequest(false)} onSuccess={() => { setShowDocRequest(false); queryClient.invalidateQueries({ queryKey: ['documents', id] }) }} />}
    </div>
  )
}

function CoverLetter({ text }: { text: string }) {
  // Split on common letter keywords to create paragraphs
  const formatted = text
    .replace(/Dear /g, '\n\nDear ')
    .replace(/RE:/g, '\n\nRE:')
    .replace(/Sincerely,/g, '\n\nSincerely,')
    .replace(/Regards,/g, '\n\nRegards,')
    .replace(/Thank you,/g, '\n\nThank you,')

  const paragraphs = formatted.split('\n').filter(s => s.trim())

  return (
    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
      {paragraphs.map((para, i) => (
        <p key={i} style={{ marginBottom: '0.75rem' }}>{para.trim()}</p>
      ))}
    </div>
  )
}

function HRDocUploader({ doc, onUploaded }: { doc: any, onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const fileName = `docs/${doc.application_id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)
      await supabase.from('documents').update({
        file_url: publicUrl,
        status: 'uploaded',
        uploaded_at: new Date().toISOString()
      }).eq('id', doc.id)
      onUploaded()
      toast.success('Document uploaded!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <label style={{ cursor: 'pointer' }}>
      <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
      <span className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {uploading ? <span className="spinner" /> : <><Upload size={12} /> Upload</>}
      </span>
    </label>
  )
}
