import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { notifyHRTeam } from '../lib/notifications'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Briefcase, Clock, DollarSign, Upload, X, Plus, CheckCircle, Loader } from 'lucide-react'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function parseResumeWithClaude(file: File): Promise<any> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const isPDF = file.type === 'application/pdf'

  let messageContent: any[]

  if (isPDF) {
    messageContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 }
      },
      {
        type: 'text',
        text: `Please extract the following information from this resume and return it as a JSON object only, with no other text:
{
  "full_name": "candidate full name",
  "email": "email address",
  "phone": "phone number",
  "years_experience": number (total years of work experience),
  "skills": ["skill1", "skill2", ...],
  "work_history": [{"title": "job title", "company": "company name", "duration": "period e.g. 2020-2022"}],
  "education": [{"degree": "degree name", "institution": "school name", "year": "graduation year"}],
  "summary": "brief professional summary if present"
}
Return ONLY the JSON object, no markdown, no explanation.`
      }
    ]
  } else {
    messageContent = [
      {
        type: 'text',
        text: `I have a resume file but cannot read it directly. Since this is a DOCX file I cannot parse it - return this exact JSON:
{"parse_error": "DOCX format - please upload PDF for automatic parsing"}`
      }
    ]
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: messageContent }]
    })
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Failed to parse resume')
  }

  const data = await response.json()
  const text = data.content[0]?.text || '{}'

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Could not read resume data. Please fill in the form manually.')
  }
}

export default function JobDetail() {
  useEffect(() => {
    document.body.classList.add('applicant-page')
    return () => document.body.classList.remove('applicant-page')
  }, [])

  const { id } = useParams()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', cover_letter: '',
    years_experience: '', skills: [] as string[], skillInput: ''
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [workHistory, setWorkHistory] = useState([{ title: '', company: '', duration: '' }])
  const [education, setEducation] = useState([{ degree: '', institution: '', year: '' }])
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(false)
  const [parseError, setParseError] = useState('')

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

  const { data: jobQuestions = [] } = useQuery({
    queryKey: ['job-questions', id],
    queryFn: async () => {
      const { data } = await supabase.from('job_questions').select('*').eq('job_id', id).order('order_index')
      return data || []
    },
    enabled: !!id
  })

  const { data: otherJobs = [] } = useQuery({
    queryKey: ['other-jobs', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, department, location, employment_type')
        .eq('status', 'active')
        .neq('id', id)
        .limit(6)
      return data || []
    },
    enabled: !!id
  })

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [source, setSource] = useState('')

  async function handleResumeUpload(file: File) {
    setResumeFile(file)
    setParsed(false)
    setParseError('')

    if (!file.type.includes('pdf')) {
      setParseError('For automatic form filling, please upload a PDF. You can still submit with a DOCX file.')
      return
    }

    setParsing(true)
    try {
      toast.loading('Reading your resume...', { id: 'parsing' })
      const parsedData = await parseResumeWithClaude(file)

      if (parsedData.parse_error) {
        setParseError(parsedData.parse_error)
        toast.error(parsedData.parse_error, { id: 'parsing' })
        return
      }

      setForm(prev => ({
        ...prev,
        full_name: parsedData.full_name || prev.full_name,
        email: parsedData.email || prev.email,
        phone: parsedData.phone || prev.phone,
        years_experience: parsedData.years_experience?.toString() || prev.years_experience,
        skills: parsedData.skills?.length ? parsedData.skills : prev.skills,
        cover_letter: parsedData.summary ? `${parsedData.summary}` : prev.cover_letter,
      }))

      if (parsedData.work_history?.length) {
        setWorkHistory(parsedData.work_history.map((w: any) => ({
          title: w.title || '', company: w.company || '', duration: w.duration || ''
        })))
      }

      if (parsedData.education?.length) {
        setEducation(parsedData.education.map((e: any) => ({
          degree: e.degree || '', institution: e.institution || '', year: e.year || ''
        })))
      }

      setParsed(true)
      toast.success('Resume parsed! Please review and confirm your details.', { id: 'parsing' })
    } catch (err: any) {
      setParseError(err.message || 'Could not parse resume automatically.')
      toast.error(err.message || 'Could not parse resume.', { id: 'parsing' })
    } finally {
      setParsing(false)
    }
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      let resumeUrl = ''
      if (resumeFile) {
        const fileName = `${Date.now()}-${resumeFile.name}`
        const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, resumeFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(fileName)
        resumeUrl = publicUrl
      }

      // Check if applicant already exists by email
      // Check if applicant already exists
      let applicantId: string | undefined

      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', form.email)
        .limit(1)

      if (existingProfiles && existingProfiles.length > 0) {
        // Existing applicant — reuse their account
        applicantId = existingProfiles[0].user_id
      } else {
        // New applicant — create account
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: Math.random().toString(36).slice(-10) + 'A1!',
          options: { data: { full_name: form.full_name, role: 'applicant' } }
        })
        if (signUpError) throw new Error(signUpError.message)
        applicantId = authData?.user?.id
      }

      if (!applicantId) throw new Error('Could not create applicant account')

     // Only create profile for new applicants
if (existingProfiles && existingProfiles.length === 0) {
  await supabase.from('profiles').upsert(
    { user_id: applicantId, full_name: form.full_name, email: form.email, role: 'applicant' },
    { onConflict: 'user_id' }
  )
}

      console.log('Inserting application with applicantId:', applicantId, 'job_id:', id)
      const { data: appData, error: appError } = await supabase.from('applications').insert({
        job_id: id, applicant_id: applicantId, cover_letter: form.cover_letter, status: 'applied', source: source || 'Direct'
      }).select().single()
      if (appError) throw appError

      const jobSkills = job?.required_skills || []
      const applicantSkills = form.skills.map((s: string) => s.toLowerCase())
      const matchScore = jobSkills.length > 0
        ? Math.round((jobSkills.filter((s: string) => applicantSkills.includes(s.toLowerCase())).length / jobSkills.length) * 100)
        : 0

      await supabase.from('applications').update({ match_score: matchScore }).eq('id', appData.id)

      if (jobQuestions.length > 0 && Object.keys(answers).length > 0) {
        const answersPayload = Object.entries(answers)
          .filter(([_, answer]) => answer.trim())
          .map(([questionId, answer]) => ({
            application_id: appData.id,
            question_id: questionId,
            answer
          }))
        if (answersPayload.length > 0) {
          await supabase.from('application_answers').insert(answersPayload)
        }
      }

      const { error: detailsError } = await supabase.from('applicant_details').insert({
        application_id: appData.id, full_name: form.full_name, email: form.email, phone: form.phone,
        skills: form.skills, years_experience: Number(form.years_experience) || null,
        education: education.filter(e => e.degree), work_history: workHistory.filter(w => w.title),
        resume_url: resumeUrl
      })
      if (detailsError) throw detailsError

      try {
        await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
      } catch (e) {}

      await notifyHRTeam({
        type: 'new_application',
        title: 'New Application Received',
        message: `${form.full_name} has applied for ${job?.title}`,
        link: `/dashboard/applicants/${appData.id}`
      })
    },
    onSuccess: () => { setSubmitted(true); toast.success('Application submitted!') },
    onError: (err: any) => toast.error(err.message || 'Submission failed'),
  })

  function addSkill() {
    const s = form.skillInput.trim()
    if (s && !form.skills.includes(s)) setForm({ ...form, skills: [...form.skills, s], skillInput: '' })
  }

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--navy-950)', minHeight: '100vh' }}><span className="spinner" /></div>
  if (!job) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', minHeight: '100vh', background: 'var(--navy-950)' }}>Job not found</div>

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '520px', textAlign: 'center', padding: '3rem' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 style={{ fontSize: '1.625rem', fontWeight: '700', marginBottom: '0.75rem' }}>Application Submitted</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.7, fontSize: '0.9375rem' }}>
          Thank you for applying for <strong style={{ color: 'var(--text-primary)' }}>{job.title}</strong> at {settings?.company_name || 'our company'}. Your application has been received and is currently under review.
        </p>
        <div style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: '10px', padding: '1.125rem 1.25rem', marginBottom: '2rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Next Steps
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>
            A confirmation has been sent to <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>. Please check your inbox for a link to set up your applicant portal where you can track your application status and respond to any document requests.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={() => navigate('/jobs')}>View More Jobs</button>
          <button className="btn-primary" onClick={() => navigate('/login')}>Go to Portal</button>
        </div>
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

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(1rem, 4vw, 2rem)' }}>
        {!showForm ? (
          <div className='job-detail-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
            <div>
              <>
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
                  <div className="job-description" dangerouslySetInnerHTML={{ __html: job.description }} />
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
            </div>

            {/* Sidebar - Other Jobs */}
            <div className='job-detail-sidebar' style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className='card' style={{ padding: '1.25rem' }}>
                <h3 style={{ fontWeight: '700', fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Other Opportunities</h3>
                {otherJobs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No other positions available</p>
                ) : otherJobs.map((j: any) => (
                  <a key={j.id} href={`/jobs/${j.id}`}
                    style={{ display: 'block', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.5rem', background: 'var(--navy-700)', textDecoration: 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-600)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy-700)')}>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{j.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.department} · {j.location}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: '0.125rem' }}>{j.employment_type}</div>
                  </a>
                ))}
                <a href="/jobs" style={{ display: 'block', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--blue-400)', textDecoration: 'none' }}>
                  View all positions →
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Apply for {job.title}</h2>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>← Back to Job</button>
            </div>

            {/* Resume Upload */}
            <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.375rem', fontSize: '0.9375rem' }}>
                📄 Upload Your Resume First
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                Upload a PDF resume and we'll automatically fill in your details using AI. Save time — just review and submit!
              </p>
              <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative', background: 'var(--navy-800)' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleResumeUpload(f) }}>
                <input type="file" accept=".pdf,.docx,.doc" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f) }} />
                {parsing ? (
                  <div>
                    <Loader size={28} color="var(--blue-400)" style={{ margin: '0 auto 0.5rem', display: 'block', animation: 'spin 1s linear infinite' }} />
                    <div style={{ color: 'var(--blue-400)', fontWeight: '500' }}>Reading your resume with AI...</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>This takes a few seconds</div>
                  </div>
                ) : parsed ? (
                  <div>
                    <CheckCircle size={28} color="#10b981" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                    <div style={{ color: '#10b981', fontWeight: '600' }}>Resume parsed successfully!</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{resumeFile?.name} — Review your details below</div>
                  </div>
                ) : resumeFile ? (
                  <div>
                    <Upload size={24} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                    <div style={{ fontWeight: '500', color: 'var(--blue-400)' }}>{resumeFile.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Drop your resume here or <span style={{ color: 'var(--blue-400)' }}>click to browse</span></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>PDF recommended for auto-fill · DOCX also accepted</div>
                  </div>
                )}
              </div>
              {parseError && (
                <div style={{ marginTop: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: '#f59e0b' }}>
                  ⚠ {parseError}
                </div>
              )}
            </div>

            {/* Personal info */}
            <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Personal Information {parsed && <span style={{ color: '#10b981', fontSize: '0.75rem', textTransform: 'none', fontWeight: '400' }}>✓ Auto-filled from resume</span>}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Smith" required />
              </div>
              <div className="form-group">
                <label className="label">Email Address *</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@email.com" required />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <div className="form-group">
                <label className="label">Phone Number</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (876) 555-0100" />
              </div>
              <div className="form-group">
                <label className="label">Years of Experience</label>
                <input className="input" type="number" min="0" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} placeholder="e.g. 3" />
              </div>
            </div>

            {/* Skills */}
            <div className="form-group">
              <label className="label">Your Skills {parsed && form.skills.length > 0 && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '400' }}>✓ Extracted from resume</span>}</label>
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
                <label className="label" style={{ margin: 0 }}>
                  Work History {parsed && workHistory[0]?.title && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '400' }}>✓ Extracted from resume</span>}
                </label>
                <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => setWorkHistory([...workHistory, { title: '', company: '', duration: '' }])}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {workHistory.map((w, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
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
                <label className="label" style={{ margin: 0 }}>
                  Education {parsed && education[0]?.degree && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '400' }}>✓ Extracted from resume</span>}
                </label>
                <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => setEducation([...education, { degree: '', institution: '', year: '' }])}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {education.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                  <input className="input" value={e.degree} onChange={ev => { const n = [...education]; n[i].degree = ev.target.value; setEducation(n) }} placeholder="Degree / Certificate" />
                  <input className="input" value={e.institution} onChange={ev => { const n = [...education]; n[i].institution = ev.target.value; setEducation(n) }} placeholder="Institution" />
                  <input className="input" value={e.year} onChange={ev => { const n = [...education]; n[i].year = ev.target.value; setEducation(n) }} placeholder="Year" />
                  {education.length > 1 && <button onClick={() => setEducation(education.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><X size={16} /></button>}
                </div>
              ))}
            </div>

            {/* Screening Questions */}
            {jobQuestions.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Screening Questions
                </h3>
                {jobQuestions.map((q: any) => (
                  <div key={q.id} className="form-group">
                    <label className="label">
                      {q.question}
                      {q.required && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>*</span>}
                    </label>
                    {q.question_type === 'yes_no' && (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {['Yes', 'No'].map(opt => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'text' && (
                      <input className="input" value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="Your answer..." />
                    )}
                    {q.question_type === 'number' && (
                      <input className="input" type="number" min="0" value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="Enter a number..." style={{ maxWidth: '200px' }} />
                    )}
                    {q.question_type === 'dropdown' && (
                      <select className="input" value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}>
                        <option value="">— Select an option —</option>
                        {(q.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                    {q.question_type === 'multiple_choice' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(q.options || []).map((opt: string) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Source */}
            <div className="form-group">
              <label className="label">How did you hear about us?</label>
              <select className="input" value={source} onChange={e => setSource(e.target.value)}>
                <option value="">— Select an option —</option>
                <option value="Company Website">Company Website</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Indeed">Indeed</option>
                <option value="Referral">Referral from someone</option>
                <option value="Job Fair">Job Fair</option>
                <option value="Newspaper">Newspaper / Print</option>
                <option value="Social Media">Social Media</option>
                <option value="University">University / Campus</option>
                <option value="Recruitment Agency">Recruitment Agency</option>
                <option value="Other">Other</option>
              </select>
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
