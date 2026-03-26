import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Briefcase, Clock, DollarSign, Filter, LogOut, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const PARISHES = [
  'Clarendon', 'Hanover', 'Kingston', 'Manchester', 'Portland',
  'St. Andrew', 'St. Ann', 'St. Catherine', 'St. Elizabeth',
  'St. James', 'St. Mary', 'St. Thomas', 'Trelawny', 'Westmoreland'
]

const JOB_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'full-time', label: 'Full Time' },
  { value: 'internship', label: 'Internship' },
  { value: 'part-time', label: 'Part Time' },
  { value: 'remote', label: 'Remote' },
  { value: 'temporary', label: 'Temporary' },
]

export default function JobBoard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [employmentType, setEmploymentType] = useState('all')
  const [experienceLevel, setExperienceLevel] = useState('all')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false })
      if (error) throw error
      return data as any[]
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
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.department.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase())
    const matchLocation = locationFilter === 'all' || j.location === locationFilter
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
          {settings?.company_logo ? (
            <img src={settings.company_logo} alt={companyName} style={{ maxHeight: '44px', maxWidth: '200px', objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ width: '36px', height: '36px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={18} color="white" />
              </div>
              <span style={{ fontWeight: '700', fontSize: '1.125rem' }}>{companyName}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user ? (
            <>
              <button className="btn-secondary" onClick={() => navigate(profile?.role === 'applicant' ? '/portal' : '/dashboard')} style={{ fontSize: '0.8125rem' }}>
                {profile?.role === 'applicant' ? 'My Applications' : 'Dashboard'}
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '0.8125rem' }}>Sign In</button>
          )}
        </div>
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

          {/* Location filter - Jamaican parishes */}
          <select className="input" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ width: 'auto', minWidth: '180px' }}>
            <option value="all">Select Job Location</option>
            {PARISHES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Job type filter */}
          <select className="input" value={employmentType} onChange={e => setEmploymentType(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
            <option value="all">Select Job Type</option>
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Experience level filter */}
          <select className="input" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} style={{ width: 'auto', minWidth: '150px' }}>
            <option value="all">All Levels</option>
            <option value="entry">Entry</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </select>

          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {filtered.length} open position{filtered.length !== 1 ? 's' : ''}
          </span>
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><MapPin size={13} />{job.location}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Clock size={13} /><span style={{ textTransform: 'capitalize' }}>{job.employment_type}</span></span>
                      {(job.salary_min || job.salary_max) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <DollarSign size={13} />
                          {job.salary_min && job.salary_max
                            ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
                            : job.salary_min
                              ? `From $${job.salary_min.toLocaleString()}`
                              : `Up to $${job.salary_max?.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <span className={`badge ${job.experience_level === 'entry' ? 'badge-green' : job.experience_level === 'mid' ? 'badge-blue' : job.experience_level === 'senior' ? 'badge-purple' : 'badge-yellow'}`} style={{ textTransform: 'capitalize' }}>
                      {job.experience_level}
                    </span>
                    <button className="btn-primary" style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem' }}
                      onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}>
                      Apply Now
                    </button>
                  </div>
                </div>
                {job.required_skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.875rem' }}>
                    {job.required_skills.slice(0, 5).map((s: string) => (
                      <span key={s} style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', borderRadius: '5px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>{s}</span>
                    ))}
                    {job.required_skills.length > 5 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>+{job.required_skills.length - 5} more</span>
                    )}
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
