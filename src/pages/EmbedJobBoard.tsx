import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { MapPin, Briefcase, Clock, DollarSign, Search, Filter } from 'lucide-react'

const PARISHES = ['all', 'Clarendon', 'Hanover', 'Kingston', 'Manchester', 'Portland', 'St. Andrew', 'St. Ann', 'St. Catherine', 'St. Elizabeth', 'St. James', 'St. Mary', 'St. Thomas', 'Trelawny', 'Westmoreland']
const JOB_TYPES = ['all', 'contract', 'full-time', 'internship', 'part-time', 'remote', 'temporary']

export default function EmbedJobBoard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data
    }
  })

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false })
      if (error) throw error
      return data as any[]
    }
  })

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
    const matchLocation = locationFilter === 'all' || j.location === locationFilter
    const matchType = typeFilter === 'all' || j.employment_type === typeFilter
    return matchSearch && matchLocation && matchType
  })

  const appUrl = window.location.origin

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#1B3A6B', padding: '0.875rem 1.5rem' }}>
        <h2 style={{ color: 'white', fontWeight: '700', fontSize: '1.125rem', margin: 0 }}>Current Vacancies</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', margin: '0.125rem 0 0' }}>{filtered.length} open position{filtered.length !== 1 ? 's' : ''} available</p>
      </div>

      {/* Search & Filters */}
      <div style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs..."
            style={{ width: '100%', padding: '0.5rem 0.625rem 0.5rem 2rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box', color: '#1e293b', background: 'white' }}
          />
        </div>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          style={{ padding: '0.5rem 0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8125rem', background: 'white', color: '#1e293b', outline: 'none', minWidth: '150px' }}>
          {PARISHES.map(p => <option key={p} value={p} style={{ color: '#1e293b' }}>{p === 'all' ? 'All Locations' : p}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '0.5rem 0.625rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8125rem', background: 'white', color: '#1e293b', outline: 'none', minWidth: '140px' }}>
          {JOB_TYPES.map(t => <option key={t} value={t} style={{ color: '#1e293b' }}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {/* Jobs List */}
      <div style={{ padding: '1rem 1.5rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading positions...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <Briefcase size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
            <p>No open positions found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(job => (
              <div key={job.id}
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onClick={() => window.open(`${appUrl}/jobs/${job.id}`, '_blank')}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: '600', color: '#1e293b' }}>{job.title}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8125rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Briefcase size={12} />{job.department}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={12} />{job.location}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /><span style={{ textTransform: 'capitalize' }}>{job.employment_type}</span></span>
                      {(job.salary_min || job.salary_max) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <DollarSign size={12} />
                          {job.salary_min && job.salary_max ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}` : job.salary_min ? `From $${job.salary_min.toLocaleString()}` : `Up to $${job.salary_max?.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    {job.required_skills?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                        {job.required_skills.slice(0, 4).map((s: string) => (
                          <span key={s} style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '4px', padding: '0.125rem 0.5rem', fontSize: '0.75rem' }}>{s}</span>
                        ))}
                        {job.required_skills.length > 4 && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>+{job.required_skills.length - 4} more</span>}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); window.open(`${appUrl}/jobs/${job.id}`, '_blank') }}
                    style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Apply Now
                  </button>
                </div>
                {job.deadline && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Deadline: {new Date(job.deadline).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.75rem', borderTop: '1px solid #e2e8f0', background: 'white', marginTop: '0.5rem' }}>
        Powered by {settings?.company_name || 'ATS'} Recruitment Hub
      </div>
    </div>
  )
}
