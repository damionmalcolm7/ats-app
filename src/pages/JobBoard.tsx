import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Briefcase, Clock, DollarSign, Filter, LogOut, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const PARISHES = [
  'all', 'Clarendon', 'Hanover', 'Kingston', 'Manchester', 'Portland',
  'St. Andrew', 'St. Ann', 'St. Catherine', 'St. Elizabeth',
  'St. James', 'St. Mary', 'St. Thomas', 'Trelawny', 'Westmoreland'
]

const JOB_TYPES = [
  { value: 'all', label: 'All Types' },
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
  useEffect(() => {
  document.body.classList.add('applicant-page')
  return () => document.body.classList.remove('applicant-page')
}, [])
  const { theme } = useTheme()
  const LIGHT_LOGO = 'https://ljgjgaojkihpaykfewpa.supabase.co/storage/v1/object/public/avatars/Logo%20Text%20and%20Slogan%20to%20left.png'
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [employmentType, setEmploymentType] = useState('all')
  const [experienceLevel, setExperienceLevel] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('status', 'active').order('updated_at', { ascending: false })
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
      <div style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {settings?.company_logo ? (
            <img src={LIGHT_LOGO} alt={companyName} style={{ maxHeight: '36px', maxWidth: '140px', objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ width: '32px', height: '32px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={16} color="white" />
              </div>
              <span style={{ fontWeight: '700', fontSize: '1rem' }}>{companyName}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user ? (
            <button className="btn-secondary" onClick={() => navigate(profile?.role === 'applicant' ? '/portal' : '/dashboard')} style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
              {profile?.role === 'applicant' ? 'My Applications' : 'Dashboard'}
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>Sign In</button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)', padding: '2rem 1.25rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 'clamp(1.375rem, 5vw, 2rem)', fontWeight: '700', marginBottom: '0.5rem' }}>Join Our Team</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>Explore open positions at the {companyName}</p>
        <div style={{ maxWidth: '540px', margin: '0 auto', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..." style={{ paddingLeft: '2.5rem', height: '44px', fontSize: '0.9375rem' }} />
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem' }}>
        {/* Filter toggle button for mobile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {filtered.length} open position{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            className="btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={14} /> Filters {showFilters ? '▲' : '▼'}
          </button>
        </div>

        {/* Filters - collapsible on mobile */}
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.625rem', marginBottom: '1rem', padding: '0.875rem', background: 'var(--navy-900)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <select className="input" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ fontSize: '0.8125rem' }}>
              {PARISHES.map(p => <option key={p} value={p}>{p === 'all' ? 'All Locations' : p}</option>)}
            </select>
            <select className="input" value={employmentType} onChange={e => setEmploymentType(e.target.value)} style={{ fontSize: '0.8125rem' }}>
              {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="input" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} style={{ fontSize: '0.8125rem' }}>
              <option value="all">All Levels</option>
              <option value="entry">Entry</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
            <button className="btn-secondary" style={{ fontSize: '0.8125rem' }} onClick={() => { setLocationFilter('all'); setEmploymentType('all'); setExperienceLevel('all'); setSearch('') }}>
              Clear All
            </button>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Briefcase size={36} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
            <p>No open positions found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(job => (
              <div key={job.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', padding: '1rem' }}
                onClick={() => navigate(`/jobs/${job.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--blue-500)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.375rem', wordBreak: 'break-word' }}>{job.title}</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Briefcase size={12} />{job.department}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} />{job.location}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /><span style={{ textTransform: 'capitalize' }}>{job.employment_type}</span></span>
                      {(job.salary_min || job.salary_max) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <DollarSign size={12} />
                          {job.salary_min && job.salary_max
                            ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
                            : job.salary_min ? `From $${job.salary_min.toLocaleString()}`
                            : `Up to $${job.salary_max?.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Badge - hidden on very small screens, shown on larger */}
                  <span className={`badge ${job.experience_level === 'entry' ? 'badge-green' : job.experience_level === 'mid' ? 'badge-blue' : job.experience_level === 'senior' ? 'badge-purple' : 'badge-yellow'}`}
                    style={{ textTransform: 'capitalize', flexShrink: 0, fontSize: '0.75rem' }}>
                    {job.experience_level}
                  </span>
                </div>

                {job.required_skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.625rem' }}>
                    {job.required_skills.slice(0, 4).map((s: string) => (
                      <span key={s} style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', borderRadius: '5px', padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>{s}</span>
                    ))}
                    {job.required_skills.length > 4 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', alignSelf: 'center' }}>+{job.required_skills.length - 4}</span>}
                  </div>
                )}

                <div style={{ marginTop: '0.75rem' }}>
                  <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.625rem', fontSize: '0.9375rem' }}
                    onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}>
                    Apply Now
                  </button>
                </div>

                {job.deadline && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Deadline: {new Date(job.deadline).toLocaleDateString()}
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
