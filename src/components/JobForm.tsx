import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Plus } from 'lucide-react'
import RichTextEditor from './RichTextEditor'
import JobQuestionsManager, { JobQuestion } from './JobQuestionsManager'

interface Job {
  id: string
  title: string
  department: string
  location: string
  location_type: 'remote' | 'hybrid' | 'onsite'
  employment_type: 'full-time' | 'part-time' | 'contract'
  salary_min?: number
  salary_max?: number
  description: string
  required_skills: string[]
  experience_level: 'entry' | 'mid' | 'senior' | 'lead'
  deadline?: string
  status: 'draft' | 'active' | 'paused' | 'closed'
  created_by: string
  created_at: string
}

interface Props {
  job: Job | null
  onClose: () => void
  onSuccess: () => void
}

const emptyForm: any = {
  title: '', department: '', location: '', location_type: 'hybrid',
  employment_type: 'full-time', salary_min: '', salary_max: '',
  description: '', required_skills: [] as string[], experience_level: 'mid',
  deadline: '', status: 'draft'
}

export default function JobForm({ job, onClose, onSuccess }: Props) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [skillInput, setSkillInput] = useState('')
  const [activeTab, setActiveTab] = useState('details')
  const [questions, setQuestions] = useState<JobQuestion[]>([])

  useEffect(() => {
    if (job) {
      setForm({
        title: job.title, department: job.department, location: job.location,
        location_type: job.location_type, employment_type: job.employment_type,
        salary_min: job.salary_min?.toString() || '', salary_max: job.salary_max?.toString() || '',
        description: job.description, required_skills: job.required_skills || [],
        experience_level: job.experience_level, deadline: job.deadline?.split('T')[0] || '',
        status: job.status
      })
      // Load existing questions
      supabase.from('job_questions').select('*').eq('job_id', job.id).order('order_index').then(({ data }) => {
        if (data) setQuestions(data.map(q => ({ ...q, options: q.options || [] })))
      })
    }
  }, [job])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        deadline: form.deadline || null,
        created_by: profile?.user_id,
        updated_at: new Date().toISOString()
      }

      let jobId = job?.id
      if (job) {
        const { error } = await supabase.from('jobs').update(payload).eq('id', job.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('jobs').insert(payload).select().single()
        if (error) throw error
        jobId = data.id
      }

      // Save questions
      if (jobId) {
        await supabase.from('job_questions').delete().eq('job_id', jobId)
        const validQuestions = questions.filter(q => q.question.trim())
        if (validQuestions.length > 0) {
          const { error: qError } = await supabase.from('job_questions').insert(
            validQuestions.map((q, i) => ({
              job_id: jobId,
              question: q.question,
              question_type: q.question_type,
              options: q.options || [],
              required: q.required,
              order_index: i
            }))
          )
          if (qError) throw qError
        }
      }
    },
    onSuccess: () => { toast.success(job ? 'Job updated!' : 'Job created!'); onSuccess() },
    onError: (err: any) => toast.error(err.message || 'Failed to save job')
  })

  function addSkill() {
    const s = skillInput.trim()
    if (s && !form.required_skills.includes(s)) {
      setForm({ ...form, required_skills: [...form.required_skills, s] })
      setSkillInput('')
    }
  }

  function removeSkill(s: string) {
    setForm({ ...form, required_skills: form.required_skills.filter((x: string) => x !== s) })
  }

  const tabs = [
    { id: 'details', label: 'Job Details' },
    { id: 'questions', label: `Screening Questions${questions.length > 0 ? ` (${questions.length})` : ''}` }
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '700px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{job ? 'Edit Job' : 'Create New Job'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1.5rem', background: 'var(--navy-900)', borderBottom: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: activeTab === t.id ? '2px solid var(--blue-500)' : '2px solid transparent', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>

          {/* Questions Tab */}
          {activeTab === 'questions' && (
            <JobQuestionsManager questions={questions} onChange={setQuestions} />
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Job Title *</label>
                  <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Developer" required />
                </div>
                <div className="form-group">
                  <label className="label">Department *</label>
                  <input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Engineering" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Location (Parish)</label>
                  <select className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                    <option value="">Select Parish</option>
                    {['Clarendon','Hanover','Kingston','Manchester','Portland','St. Andrew','St. Ann','St. Catherine','St. Elizabeth','St. James','St. Mary','St. Thomas','Trelawny','Westmoreland'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Location Type</label>
                  <select className="input" value={form.location_type} onChange={e => setForm({ ...form, location_type: e.target.value })}>
                    <option value="onsite">On-site</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Employment Type</label>
                  <select className="input" value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })}>
                    <option value="contract">Contract</option>
                    <option value="full-time">Full Time</option>
                    <option value="internship">Internship</option>
                    <option value="part-time">Part Time</option>
                    <option value="remote">Remote</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Experience Level</label>
                  <select className="input" value={form.experience_level} onChange={e => setForm({ ...form, experience_level: e.target.value })}>
                    <option value="entry">Entry</option>
                    <option value="mid">Mid</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Min Salary (JMD)</label>
                  <input className="input" type="number" value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} placeholder="e.g. 500000" />
                </div>
                <div className="form-group">
                  <label className="label">Max Salary (JMD)</label>
                  <input className="input" type="number" value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} placeholder="e.g. 800000" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Application Deadline</label>
                  <input className="input" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Job Description *</label>
                <RichTextEditor value={form.description} onChange={val => setForm({ ...form, description: val })} placeholder="Describe the role, responsibilities, and requirements..." minHeight="200px" />
              </div>

              <div className="form-group">
                <label className="label">Required Skills</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input className="input" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    placeholder="Add a skill and press Enter" />
                  <button type="button" className="btn-secondary" onClick={addSkill}><Plus size={15} /> Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {form.required_skills.map((skill: string) => (
                    <span key={skill} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(37,99,235,0.15)', color: '#3b82f6', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.8125rem' }}>
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', lineHeight: 1 }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.title || !form.department}>
            {mutation.isPending ? <span className="spinner" /> : (job ? 'Save Changes' : 'Create Job')}
          </button>
        </div>
      </div>
    </div>
  )
}
