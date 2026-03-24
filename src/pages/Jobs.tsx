import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Job } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, Copy, Eye, Search, Filter } from 'lucide-react'
import JobForm from '../components/JobForm'

const statusColors: Record<string, string> = {
  active: 'badge-green', draft: 'badge-gray', paused: 'badge-yellow', closed: 'badge-red'
}

export default function Jobs() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      let query = supabase.from('jobs').select('*').order('created_at', { ascending: false })
      if (profile?.role !== 'super_admin') query = query.eq('created_by', profile?.user_id)
      const { data, error } = await query
      if (error) throw error
      return data as Job[]
    },
    enabled: !!profile
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('jobs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job deleted') },
    onError: (err: any) => toast.error(err.message)
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('jobs').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Status updated') },
    onError: (err: any) => toast.error(err.message)
  })

  const duplicateMutation = useMutation({
    mutationFn: async (job: Job) => {
      const { id, created_at, ...rest } = job
      const { error } = await supabase.from('jobs').insert({ ...rest, title: `${job.title} (Copy)`, status: 'draft' })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job duplicated') },
    onError: (err: any) => toast.error(err.message)
  })

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Jobs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your job postings</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditJob(null); setShowForm(true) }}>
          <Plus size={16} /> Create Job
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <Briefcase size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)' }}>No jobs found. Create your first job posting.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(job => (
                  <tr key={job.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{job.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{job.experience_level} level</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{job.department}</td>
                    <td>
                      <div style={{ fontSize: '0.875rem' }}>{job.location}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{job.location_type}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{job.employment_type}</td>
                    <td>
                      <select
                        value={job.status}
                        onChange={e => statusMutation.mutate({ id: job.id, status: e.target.value })}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', outline: 'none' }}
                        className={`badge ${statusColors[job.status]}`}
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {job.deadline ? new Date(job.deadline).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button onClick={() => { setEditJob(job); setShowForm(true) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                          title="Edit">
                          <Edit size={15} />
                        </button>
                        <button onClick={() => duplicateMutation.mutate(job)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                          title="Duplicate">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => { if (confirm('Delete this job?')) deleteMutation.mutate(job.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}
                          title="Delete">
                          <Trash2 size={15} />
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

      {showForm && (
        <JobForm
          job={editJob}
          onClose={() => { setShowForm(false); setEditJob(null) }}
          onSuccess={() => { setShowForm(false); setEditJob(null); queryClient.invalidateQueries({ queryKey: ['jobs'] }) }}
        />
      )}
    </div>
  )
}

function Briefcase({ size, color, style }: any) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" style={style}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}
