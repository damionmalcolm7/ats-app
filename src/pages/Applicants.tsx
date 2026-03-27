import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendStatusEmail } from '../lib/email'
import toast from 'react-hot-toast'
import { Search, Eye, ChevronDown, Zap, ThumbsUp, ThumbsDown, Filter } from 'lucide-react'
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
  const [minScore, setMinScore] = useState(0)
  const [showScreening, setShowScreening] = useState(false)
  const [shortlistThreshold, setShortlistThreshold] = useState(70)
  const [rejectThreshold, setRejectThreshold] = useState(40)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs(title, department, experience_level, required_skills)')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Fetch applicant details separately
      const enriched = await Promise.all((data || []).map(async (app) => {
        const { data: details } = await supabase
          .from('applicant_details')
          .select('*')
          .eq('application_id', app.id)
          .single()
        return { ...app, applicant_details: details }
      }))
      return enriched as any[]
    }
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('id, title')
      return data || []
    }
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, applicantEmail, applicantName, jobTitle }: { id: string, status: string, applicantEmail?: string, applicantName?: string, jobTitle?: string }) => {
      const { error } = await supabase.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      if (applicantEmail && applicantName && jobTitle) {
        await sendStatusEmail(status, applicantEmail, applicantName, jobTitle, id)
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); toast.success('Status updated') },
    onError: (err: any) => toast.error(err.message)
  })

  // Auto-shortlist: move all applicants above threshold to screening
  async function handleAutoShortlist() {
    const eligible = filtered.filter(a =>
      a.status === 'applied' &&
      a.match_score != null &&
      a.match_score >= shortlistThreshold
    )

    if (eligible.length === 0) {
      toast.error(`No applicants with ${shortlistThreshold}%+ match score in "Applied" status`)
      return
    }

    if (!confirm(`Move ${eligible.length} applicant${eligible.length !== 1 ? 's' : ''} with ${shortlistThreshold}%+ match to Screening? They will receive a shortlist email.`)) return

    setBulkProcessing(true)
    let success = 0
    try {
      for (const app of eligible) {
        await supabase.from('applications').update({ status: 'screening', updated_at: new Date().toISOString() }).eq('id', app.id)
        if (app.applicant_details?.email && app.applicant_details?.full_name && app.job?.title) {
          await sendStatusEmail('interview', app.applicant_details.email, app.applicant_details.full_name, app.job.title, app.id)
        }
        success++
      }
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success(`✅ ${success} applicant${success !== 1 ? 's' : ''} moved to Screening!`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  // Auto-reject: move all applicants below threshold to rejected
  async function handleAutoReject() {
    const eligible = filtered.filter(a =>
      a.status === 'applied' &&
      a.match_score != null &&
      a.match_score < rejectThreshold
    )

    if (eligible.length === 0) {
      toast.error(`No applicants with below ${rejectThreshold}% match score in "Applied" status`)
      return
    }

    if (!confirm(`Reject ${eligible.length} applicant${eligible.length !== 1 ? 's' : ''} with below ${rejectThreshold}% match score? They will receive a rejection email.`)) return

    setBulkProcessing(true)
    let success = 0
    try {
      for (const app of eligible) {
        await supabase.from('applications').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', app.id)
        if (app.applicant_details?.email && app.applicant_details?.full_name && app.job?.title) {
          await sendStatusEmail('rejected', app.applicant_details.email, app.applicant_details.full_name, app.job.title, app.id)
        }
        success++
      }
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success(`${success} applicant${success !== 1 ? 's' : ''} rejected`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  const filtered = applications.filter(a => {
    const name = a.applicant_details?.full_name || ''
    const email = a.applicant_details?.email || ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const matchJob = jobFilter === 'all' || a.job_id === jobFilter
    const matchScore = minScore === 0 || (a.match_score != null && a.match_score >= minScore)
    return matchSearch && matchStatus && matchJob && matchScore
  })

  // Stats for smart screening
  const appliedApps = applications.filter(a => a.status === 'applied' && a.match_score != null)
  const highMatch = appliedApps.filter(a => a.match_score >= shortlistThreshold).length
  const lowMatch = appliedApps.filter(a => a.match_score < rejectThreshold).length
  const midMatch = appliedApps.length - highMatch - lowMatch

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Applicants</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {applications.length} total · {filtered.length} showing
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowScreening(!showScreening)}
          style={{ background: showScreening ? 'var(--navy-700)' : 'var(--blue-500)', border: showScreening ? '1px solid var(--border)' : 'none' }}>
          <Zap size={15} /> Smart Screening
        </button>
      </div>

      {/* Smart Screening Panel */}
      {showScreening && (
        <div className="card" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(139,92,246,0.08) 100%)', border: '1px solid rgba(37,99,235,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Zap size={18} color="var(--blue-400)" />
            <h3 style={{ fontWeight: '600', fontSize: '1rem' }}>Smart Screening</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>— Automatically shortlist or reject based on match score</span>
          </div>

          {/* Score breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>{highMatch}</div>
              <div style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: '500' }}>High Match</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shortlistThreshold}%+ score</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f59e0b' }}>{midMatch}</div>
              <div style={{ fontSize: '0.8125rem', color: '#f59e0b', fontWeight: '500' }}>Medium Match</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rejectThreshold}% - {shortlistThreshold - 1}% score</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ef4444' }}>{lowMatch}</div>
              <div style={{ fontSize: '0.8125rem', color: '#ef4444', fontWeight: '500' }}>Low Match</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Below {rejectThreshold}% score</div>
            </div>
          </div>

          {/* Threshold controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
            {/* Shortlist threshold */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="label" style={{ margin: 0, color: '#10b981' }}>Auto-Shortlist Threshold</label>
                <span style={{ fontWeight: '700', color: '#10b981', fontSize: '1.125rem' }}>{shortlistThreshold}%</span>
              </div>
              <input
                type="range" min="50" max="100" step="5"
                value={shortlistThreshold}
                onChange={e => setShortlistThreshold(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>

            {/* Reject threshold */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="label" style={{ margin: 0, color: '#ef4444' }}>Auto-Reject Threshold</label>
                <span style={{ fontWeight: '700', color: '#ef4444', fontSize: '1.125rem' }}>{rejectThreshold}%</span>
              </div>
              <input
                type="range" min="10" max="60" step="5"
                value={rejectThreshold}
                onChange={e => setRejectThreshold(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ef4444' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>10%</span><span>35%</span><span>60%</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.875rem' }}>
            <button
              onClick={handleAutoShortlist}
              disabled={bulkProcessing || highMatch === 0}
              style={{ flex: 1, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: highMatch === 0 ? 0.5 : 1 }}>
              {bulkProcessing ? <span className="spinner" style={{ borderTopColor: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }} /> : <ThumbsUp size={16} />}
              Shortlist {highMatch} Applicant{highMatch !== 1 ? 's' : ''} ({shortlistThreshold}%+)
            </button>
            <button
              onClick={handleAutoReject}
              disabled={bulkProcessing || lowMatch === 0}
              style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: lowMatch === 0 ? 0.5 : 1 }}>
              {bulkProcessing ? <span className="spinner" style={{ borderTopColor: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} /> : <ThumbsDown size={16} />}
              Reject {lowMatch} Applicant{lowMatch !== 1 ? 's' : ''} (Below {rejectThreshold}%)
            </button>
          </div>

          <div style={{ marginTop: '0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            ⚠ Only applicants in <strong style={{ color: 'var(--text-secondary)' }}>Applied</strong> status with a match score will be affected. Emails are sent automatically.
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search applicants..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '150px' }}>
          <option value="all">All Stages</option>
          {['applied','screening','interview','assessment','offer','hired','rejected'].map(s => (
            <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select className="input" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{ width: '180px' }}>
          <option value="all">All Jobs</option>
          {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>

        {/* Match score filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.375rem 0.875rem' }}>
          <Filter size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Min Score:</span>
          <input
            type="range" min="0" max="100" step="10"
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--blue-500)' }}
          />
          <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: minScore > 0 ? 'var(--blue-400)' : 'var(--text-muted)', minWidth: '36px' }}>
            {minScore > 0 ? `${minScore}%+` : 'Any'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No applicants found matching your filters.
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
                {filtered
                  .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
                  .map(app => (
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
                          <div style={{ width: '60px', height: '7px', background: 'var(--navy-700)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${app.match_score}%`, height: '100%', background: app.match_score >= shortlistThreshold ? '#10b981' : app.match_score >= rejectThreshold ? '#f59e0b' : '#ef4444', borderRadius: '4px' }} />
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: app.match_score >= shortlistThreshold ? '#10b981' : app.match_score >= rejectThreshold ? '#f59e0b' : '#ef4444' }}>
                            {app.match_score}%
                          </span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <select
                        value={app.status}
                        onChange={e => statusMutation.mutate({ id: app.id, status: e.target.value, applicantEmail: app.applicant_details?.email, applicantName: app.applicant_details?.full_name, jobTitle: app.job?.title })}
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
                      <button onClick={() => navigate(`/dashboard/applicants/${app.id}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', padding: '0.25rem' }} title="View Profile">
                        <Eye size={15} />
                      </button>
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
