import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase, Job } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { X, Plus, Trash2 } from 'lucide-react'

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
  const [form, setForm] = useState(emptyForm)
  const [skillInput, setSkillInput] = useState('')

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
    }
  }, [job])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        deadline: form.deadline || null,
        created_by: profile?.user_id
      }
      if (job) {
        const { error } = await supabase.from('jobs').update(payload).eq('id', job.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('jobs').insert(payload)
        if (error) throw error
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
    setForm({ ...form, required_skills: form.required_skills.filter(x => x !== s) })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{job ? 'Edit Job' : 'Create New Job'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Job Title *</label>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Developer" required />
            </div>
            <div className="form-group">
              <label className="label">Department *</label>
              <input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Engineering" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Location (Parish)</label>
              <select className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                <option value="">Select Parish</option>
                <option value="Clarendon">Clarendon</option>
                <option value="Hanover">Hanover</option>
                <option value="Kingston">Kingston</option>
                <option value="Manchester">Manchester</option>
                <option value="Portland">Portland</option>
                <option value="St. Andrew">St. Andrew</option>
                <option value="St. Ann">St. Ann</option>
                <option value="St. Catherine">St. Catherine</option>
                <option value="St. Elizabeth">St. Elizabeth</option>
                <option value="St. James">St. James</option>
                <option value="St. Mary">St. Mary</option>
                <option value="St. Thomas">St. Thomas</option>
                <option value="Trelawny">Trelawny</option>
                <option value="Westmoreland">Westmoreland</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Location Type</label>
              <select className="input" value={form.location_type} onChange={e => setForm({ ...form, location_type: e.target.value as any })}>
                <option value="contract">Contract</option>
                <option value="full-time">Full Time</option>
                <option value="internship">Internship</option>
                <option value="part-time">Part Time</option>
                <option value="remote">Remote</option>
                <option value="temporary">Temporary</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Employment Type</label>
              <select className="input" value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value as any })}>
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
              <select className="input" value={form.experience_level} onChange={e => setForm({ ...form, experience_level: e.target.value as any })}>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Min Salary (JMD)</label>
              <input className="input" type="number" value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} placeholder="e.g. 500000" />
            </div>
            <div className="form-group">
              <label className="label">Max Salary (JMD)</label>
              <input className="input" type="number" value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} placeholder="e.g. 800000" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Application Deadline</label>
              <input className="input" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Job Description *</label>
            <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the role, responsibilities, and requirements..." style={{ minHeight: '140px' }} required />
          </div>

          <div className="form-group">
            <label className="label">Required Skills</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input className="input" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add a skill and press Enter" />
              <button type="button" className="btn-secondary" onClick={addSkill} style={{ whiteSpace: 'nowrap' }}>
                <Plus size={15} /> Add
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {form.required_skills.map(skill => (
                <span key={skill} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(37,99,235,0.15)', color: '#3b82f6', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.8125rem' }}>
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', lineHeight: 1 }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

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
