import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Application } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Search, Filter, Eye, Mail, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const statusColors: Record<string, string> = {
  applied: 'badge-blue', screening: 'badge-yellow', interview: 'badge-purple',
  assessment: 'badge-yellow', offer: 'badge-green', hired: 'badge-green', rejected: 'badge-red'
}

export default function Applicants() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jobFilter, setJobFilter] = useState('all')

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`*, job:jobs(title, department), applicant_details(full_name, email, phone, skills, years_experience, resume_url)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as any[]
    }
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('id, title').eq('status', 'active')
      return data || []
    }
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); toast.success('Status updated') },
    onError: (err: any) => toast.error(err.message)
  })

  const filtered = applications.filter(a => {
    const name = a.applicant_details?.full_name || ''
    const email = a.applicant_details?.email || ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const matchJob = jobFilter === 'all' || a.job_id === jobFilter
    return matchSearch && matchStatus && matchJob
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Applicants</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {applications.length} total applicants
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search applicants..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
          <option value="all">All Stages</option>
          <option value="applied">Applied</option>
          <option value="screening">Screening</option>
          <option value="interview">Interview</option>
          <option value="assessment">Assessment</option>
          <option value="offer">Offer</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="input" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{ width: '200px' }}>
          <option value="all">All Jobs</option>
          {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No applicants found.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Applied For</th>
                  <th>Skills</th>
                  <th>Experience</th>
                  <th>Match Score</th>
                  <th>Stage</th>
                  <th>Applied</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(app => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '600', flexShrink: 0 }}>
                          {(app.applicant_details?.full_name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{app.applicant_details?.full_name || 'Unknown'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.applicant_details?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{app.job?.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.job?.department}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(app.applicant_details?.skills || []).slice(0, 3).map((s: string) => (
                          <span key={s} className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{s}</span>
                        ))}
                        {(app.applicant_details?.skills || []).length > 3 && (
                          <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>+{app.applicant_details.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {app.applicant_details?.years_experience ? `${app.applicant_details.years_experience} yrs` : '—'}
                    </td>
                    <td>
                      {app.match_score != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--navy-700)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${app.match_score}%`, height: '100%', background: app.match_score >= 70 ? '#10b981' : app.match_score >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '30px' }}>{app.match_score}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <select
                        value={app.status}
                        onChange={e => statusMutation.mutate({ id: app.id, status: e.target.value })}
                        className={`badge ${statusColors[app.status]}`}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', textTransform: 'capitalize' }}>
                        {['applied','screening','interview','assessment','offer','hired','rejected'].map(s => (
                          <option key={s} value={s} style={{ background: 'var(--navy-800)' }}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button onClick={() => navigate(`/dashboard/applicants/${app.id}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', padding: '0.25rem' }} title="View Profile">
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
