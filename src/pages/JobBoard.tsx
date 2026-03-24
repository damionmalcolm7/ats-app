import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, Job } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Briefcase, Clock, DollarSign, Filter } from 'lucide-react'

export default function JobBoard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [locationType, setLocationType] = useState('all')
  const [employmentType, setEmploymentType] = useState('all')
  const [experienceLevel, setExperienceLevel] = useState('all')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false })
      if (error) throw error
      return data as Job[]
    }
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data
    }
  })

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase()) || j.description.toLowerCase().includes(search.toLowerCase())
    const matchLocation = locationType === 'all' || j.location_type === locationType
    const matchEmployment = employmentType === 'all' || j.employment_type === employmentType
    const matchExperience = experienceLevel === 'all' || j.experience_level === experienceLevel
    return matchSearch && matchLocation && matchEmployment && matchExperience
  })

  const companyName = settings?.company_name || 'Our Company'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={18} color="white" />
          </div>
          <span style={{ fontWeight: '700', fontSize: '1.125rem' }}>{companyName}</span>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '0.8125rem' }}>Sign In</button>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)', padding: '3rem 2rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.75rem' }}>Join Our Team</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2rem' }}>Explore open positions at {companyName}</p>
        <div style={{ maxWidth: '540px', margin: '0 auto', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs by title, department, keyword..." style={{ paddingLeft: '2.75rem', height: '48px', fontSize: '0.9375rem' }} />
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={16} color="var(--text-muted)" />
          {[
            { label: 'Location', value: locationType, setter: setLocationType, options: [['all','All Locations'],['remote','Remote'],['hybrid','Hybrid'],['onsite','On-site']] },
            { label: 'Type', value: employmentType, setter: setEmploymentType, options: [['all','All Types'],['full-time','Full-time'],['part-time','Part-time'],['contract','Contract']] },
            { label: 'Level', value: experienceLevel, setter: setExperienceLevel, options: [['all','All Levels'],['entry','Entry'],['mid','Mid'],['senior','Senior'],['lead','Lead']] },
          ].map(f => (
            <select key={f.label} className="input" value={f.value} onChange={e => f.setter(e.target.value)} style={{ width: 'auto', minWidth: '140px' }}>
              {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{filtered.length} open position{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <Briefcase size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
            <p>No open positions found matching your criteria.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {filtered.map(job => (
              <div key={job.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.2s' }}
                onClick={() => navigate(`/jobs/${job.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--blue-500)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.0625rem', fontWeight: '600', marginBottom: '0.375rem' }}>{job.title}</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Briefcase size={13} />{job.department}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><MapPin size={13} />{job.location} · <span style={{ textTransform: 'capitalize' }}>{job.location_type}</span></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Clock size={13} /><span style={{ textTransform: 'capitalize' }}>{job.employment_type}</span></span>
                      {(job.salary_min || job.salary_max) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <DollarSign size={13} />
                          {job.salary_min && job.salary_max ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}` : job.salary_min ? `From $${job.salary_min.toLocaleString()}` : `Up to $${job.salary_max?.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <span className={`badge ${job.experience_level === 'entry' ? 'badge-green' : job.experience_level === 'mid' ? 'badge-blue' : job.experience_level === 'senior' ? 'badge-purple' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                      {job.experience_level}
                    </span>
                    <button className="btn-primary" style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem' }} onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}>
                      Apply Now
                    </button>
                  </div>
                </div>
                {job.required_skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.875rem' }}>
                    {job.required_skills.slice(0, 5).map(s => (
                      <span key={s} style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', borderRadius: '5px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>{s}</span>
                    ))}
                    {job.required_skills.length > 5 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>+{job.required_skills.length - 5} more</span>}
                  </div>
                )}
                {job.deadline && (
                  <div style={{ marginTop: '0.625rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Application deadline: {new Date(job.deadline).toLocaleDateString()}
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
