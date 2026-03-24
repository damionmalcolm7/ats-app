import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Briefcase, Clock, DollarSign, Upload, X, Plus } from 'lucide-react'

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', cover_letter: '', years_experience: '', skills: [] as string[], skillInput: '' })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [workHistory, setWorkHistory] = useState([{ title: '', company: '', duration: '' }])
  const [education, setEducation] = useState([{ degree: '', institution: '', year: '' }])

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single()
      if (error) throw error
      return data
    }
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const { data } = await supabase.from('app_settings').select('*').single(); return data }
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      setUploading(true)
      let resumeUrl = ''

      // Upload resume
      if (resumeFile) {
        const fileName = `${Date.now()}-${resumeFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage.from('resumes').upload(fileName, resumeFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(fileName)
        resumeUrl = publicUrl
      }

      // Create a guest user entry or use existing
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: Math.random().toString(36).slice(-10) + 'A1!',
        options: { data: { full_name: form.full_name, role: 'applicant' } }
      })

      let applicantId = authData?.user?.id
      if (!applicantId) {
        // Try to get existing profile by email
        const { data: existingProfile } = await supabase.from('profiles').select('user_id').eq('email', form.email).single()
        applicantId = existingProfile?.user_id
      }

      if (!applicantId) throw new Error('Could not create applicant account')

      // Ensure profile exists
      await supabase.from('profiles').upsert({ user_id: applicantId, full_name: form.full_name, email: form.email, role: 'applicant' }, { onConflict: 'user_id' })

      // Create application
      const { data: appData, error: appError } = await supabase.from('applications').insert({
        job_id: id, applicant_id: applicantId, cover_letter: form.cover_letter, status: 'applied'
      }).select().single()
      if (appError) throw appError

      // Calculate match score
      const jobSkills = job?.required_skills || []
      const applicantSkills = form.skills.map(s => s.toLowerCase())
      const matchScore = jobSkills.length > 0
        ? Math.round((jobSkills.filter((s: string) => applicantSkills.includes(s.toLowerCase())).length / jobSkills.length) * 100)
        : 0

      // Update match score
      await supabase.from('applications').update({ match_score: matchScore }).eq('id', appData.id)

      // Save applicant details
      const { error: detailsError } = await supabase.from('applicant_details').insert({
        application_id: appData.id, full_name: form.full_name, email: form.email, phone: form.phone,
        skills: form.skills, years_experience: Number(form.years_experience) || null,
        education: education.filter(e => e.degree), work_history: workHistory.filter(w => w.title),
        resume_url: resumeUrl
      })
      if (detailsError) throw detailsError
    },
    onSuccess: () => { setSubmitted(true); toast.success('Application submitted!') },
    onError: (err: any) => toast.error(err.message || 'Submission failed'),
    onSettled: () => setUploading(false)
  })

  function addSkill() {
    const s = form.skillInput.trim()
    if (s && !form.skills.includes(s)) setForm({ ...form, skills: [...form.skills, s], skillInput: '' })
  }

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--navy-950)', minHeight: '100vh' }}><span className="spinner" /></div>
  if (!job) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', minHeight: '100vh', background: 'var(--navy-950)' }}>Job not found</div>

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: '480px', textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem' }}>Application Submitted!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Thank you for applying for <strong>{job.title}</strong>. We'll review your application and be in touch shortly.</p>
        <button className="btn-primary" onClick={() => navigate('/jobs')}>View More Jobs</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)' }}>
      {/* Nav */}
      <div style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn-secondary" onClick={() => navigate('/jobs')} style={{ padding: '0.375rem 0.75rem' }}><ArrowLeft size={16} /></button>
        <span style={{ fontWeight: '700' }}>{settings?.company_name || 'Careers'}</span>
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '2rem' }}>
        {!showForm ? (
          <>
            {/* Job details */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem' }}>{job.title}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Briefcase size={15} />{job.department}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><MapPin size={15} />{job.location} · <span style={{ textTransform: 'capitalize' }}>{job.location_type}</span></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Clock size={15} /><span style={{ textTransform: 'capitalize' }}>{job.employment_type}</span></span>
                {(job.salary_min || job.salary_max) && <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><DollarSign size={15} />{job.salary_min?.toLocaleString()} - {job.salary_max?.toLocaleString()}</span>}
              </div>
              <button className="btn-primary" onClick={() => setShowForm(true)} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Apply for This Position</button>
            </div>

            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Job Description</h2>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: '0.9375rem' }}>{job.description}</div>
            </div>

            {job.required_skills?.length > 0 && (
              <div className="card">
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Required Skills</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {job.required_skills.map((s: string) => (
                    <span key={s} style={{ background: 'rgba(37,99,235,0.15)', color: '#3b82f6', borderRadius: '8px', padding: '0.375rem 0.875rem', fontSize: '0.875rem', fontWeight: '500' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Apply for {job.title}</h2>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>← Back to Job</button>
            </div>

            {/* Personal info */}
            <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Smith" required />
              </div>
              <div className="form-group">
                <label className="label">Email Address *</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@email.com" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Phone Number</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (876) 555-0100" />
              </div>
              <div className="form-group">
                <label className="label">Years of Experience</label>
                <input className="input" type="number" min="0" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} placeholder="e.g. 3" />
              </div>
            </div>

            {/* Resume upload */}
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="label">Resume (PDF or DOCX) *</label>
              <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setResumeFile(f) }}>
                <input type="file" accept=".pdf,.docx,.doc" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => setResumeFile(e.target.files?.[0] || null)} />
                <Upload size={24} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                {resumeFile ? (
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--blue-400)' }}>{resumeFile.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Drop your resume here or <span style={{ color: 'var(--blue-400)' }}>click to browse</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>PDF or DOCX, max 10MB</div>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="form-group">
              <label className="label">Your Skills</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input className="input" value={form.skillInput} onChange={e => setForm({ ...form, skillInput: e.target.value })} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} placeholder="Add a skill and press Enter" />
                <button type="button" className="btn-secondary" onClick={addSkill}><Plus size={15} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {form.skills.map(s => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(37,99,235,0.15)', color: '#3b82f6', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.8125rem' }}>
                    {s}<button onClick={() => setForm({ ...form, skills: form.skills.filter(x => x !== s) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Work History */}
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label className="label" style={{ margin: 0 }}>Work History</label>
                <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => setWorkHistory([...workHistory, { title: '', company: '', duration: '' }])}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {workHistory.map((w, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input className="input" value={w.title} onChange={e => { const n = [...workHistory]; n[i].title = e.target.value; setWorkHistory(n) }} placeholder="Job Title" />
                  <input className="input" value={w.company} onChange={e => { const n = [...workHistory]; n[i].company = e.target.value; setWorkHistory(n) }} placeholder="Company" />
                  <input className="input" value={w.duration} onChange={e => { const n = [...workHistory]; n[i].duration = e.target.value; setWorkHistory(n) }} placeholder="e.g. 2020 - 2022" />
                  {workHistory.length > 1 && <button onClick={() => setWorkHistory(workHistory.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><X size={16} /></button>}
                </div>
              ))}
            </div>

            {/* Education */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label className="label" style={{ margin: 0 }}>Education</label>
                <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => setEducation([...education, { degree: '', institution: '', year: '' }])}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {education.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input className="input" value={e.degree} onChange={ev => { const n = [...education]; n[i].degree = ev.target.value; setEducation(n) }} placeholder="Degree / Certificate" />
                  <input className="input" value={e.institution} onChange={ev => { const n = [...education]; n[i].institution = ev.target.value; setEducation(n) }} placeholder="Institution" />
                  <input className="input" value={e.year} onChange={ev => { const n = [...education]; n[i].year = ev.target.value; setEducation(n) }} placeholder="Year" />
                  {education.length > 1 && <button onClick={() => setEducation(education.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><X size={16} /></button>}
                </div>
              ))}
            </div>

            {/* Cover letter */}
            <div className="form-group">
              <label className="label">Cover Letter</label>
              <textarea className="input" value={form.cover_letter} onChange={e => setForm({ ...form, cover_letter: e.target.value })} placeholder="Tell us why you're a great fit for this role..." style={{ minHeight: '140px' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !form.full_name || !form.email} style={{ padding: '0.75rem 2rem' }}>
                {submitMutation.isPending ? <><span className="spinner" /> Submitting...</> : 'Submit Application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
