import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { createAuditLog } from '../lib/audit'
import { sendStatusEmail } from '../lib/email'
import toast from 'react-hot-toast'
import { Search, Eye, Zap, ThumbsUp, ThumbsDown, Filter, Mail, ChevronDown, Trash2, SlidersHorizontal, X as XIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const statusColors: Record<string, string> = {
  applied: 'badge-blue', screening: 'badge-yellow', interview: 'badge-purple',
  assessment: 'badge-yellow', offer: 'badge-green', hired: 'badge-green', rejected: 'badge-red'
}

const STATUSES = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected']

export default function Applicants() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jobFilter, setJobFilter] = useState('all')
  const [minScore, setMinScore] = useState(0)
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [locationFilter, setLocationFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [experienceFilter, setExperienceFilter] = useState('all')
  const [minScoreFilter, setMinScoreFilter] = useState(0)
  const [maxScoreFilter, setMaxScoreFilter] = useState(100)
  const [showScreening, setShowScreening] = useState(false)
  const [shortlistThreshold, setShortlistThreshold] = useState(70)
  const [rejectThreshold, setRejectThreshold] = useState(40)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Bulk action states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('')
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false)
  const [bulkEmailSubject, setBulkEmailSubject] = useState('')
  const [bulkEmailBody, setBulkEmailBody] = useState('')
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false)

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs(title, department, experience_level, required_skills)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const enriched = await Promise.all((data || []).map(async (app) => {
        const { data: details } = await supabase
          .from('applicant_details')
          .select('*')
          .eq('application_id', app.id)
          .single()
        return { ...app, applicant_details: details }
      }))

      // Detect duplicates — flag applicants with same email appearing more than once
      const emailCount: Record<string, number> = {}
      enriched.forEach(app => {
        const email = app.applicant_details?.email
        if (email) emailCount[email] = (emailCount[email] || 0) + 1
      })
      const withDuplicates = enriched.map(app => ({
        ...app,
        is_duplicate: emailCount[app.applicant_details?.email] > 1
      }))

      return withDuplicates as any[]
    }
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('id, title')
      return data || []
    }
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('email_templates').select('*').order('name')
      return data || []
    }
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, applicantEmail, applicantName, jobTitle }: any) => {
      const { error } = await supabase.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      if (applicantEmail && applicantName && jobTitle) {
        await sendStatusEmail(status, applicantEmail, applicantName, jobTitle, id)
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); toast.success('Status updated') },
    onError: (err: any) => toast.error(err.message)
  })

  // Bulk status change
  async function handleBulkStatusChange(newStatus: string) {
    if (!newStatus) return
    const selected = filtered.filter(a => selectedIds.includes(a.id))
    if (!confirm(`Change status of ${selected.length} applicant${selected.length !== 1 ? 's' : ''} to "${newStatus}"? Status emails will be sent automatically.`)) return

    setBulkProcessing(true)
    let success = 0
    try {
      for (const app of selected) {
        await supabase.from('applications').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', app.id)
        if (app.applicant_details?.email && app.applicant_details?.full_name && app.job?.title) {
          await sendStatusEmail(newStatus, app.applicant_details.email, app.applicant_details.full_name, app.job.title, app.id)
        }
        success++
      }
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success(`✅ ${success} applicant${success !== 1 ? 's' : ''} updated to ${newStatus}!`)
      setSelectedIds([])
      setShowBulkActions(false)
      setBulkStatus('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  // Bulk email
  async function handleBulkEmail() {
    if (!bulkEmailSubject || !bulkEmailBody) return toast.error('Subject and body required')
    const selected = filtered.filter(a => selectedIds.includes(a.id))
    setSendingBulkEmail(true)
    let success = 0
    try {
      for (const app of selected) {
        if (app.applicant_details?.email) {
          const { sendEmail } = await import('../lib/email')
          await sendEmail({
            to: app.applicant_details.email,
            subject: bulkEmailSubject.replace(/\{\{applicant_name\}\}/g, app.applicant_details.full_name || 'Applicant').replace(/\{\{job_title\}\}/g, app.job?.title || ''),
            body: bulkEmailBody.replace(/\{\{applicant_name\}\}/g, app.applicant_details.full_name || 'Applicant').replace(/\{\{job_title\}\}/g, app.job?.title || ''),
            application_id: app.id,
            applicant_name: app.applicant_details.full_name
          })
          success++
        }
      }
      toast.success(`✅ Email sent to ${success} applicant${success !== 1 ? 's' : ''}!`)
      setShowBulkEmailModal(false)
      setBulkEmailSubject('')
      setBulkEmailBody('')
      setSelectedIds([])
      setShowBulkActions(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSendingBulkEmail(false)
    }
  }

  // Bulk delete
  async function handleBulkDelete() {
    const selected = filtered.filter(a => selectedIds.includes(a.id))
    if (!confirm(`Delete ${selected.length} application${selected.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkProcessing(true)
    try {
      for (const app of selected) {
        await supabase.from('applications').delete().eq('id', app.id)
      }
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success(`${selected.length} application${selected.length !== 1 ? 's' : ''} deleted`)
      if (profile) {
      createAuditLog({
  user_id: profile.user_id,
  user_name: profile.full_name || 'Unknown',
  user_role: profile.role || 'unknown',
  action: 'DELETE_APPLICATIONS',
  details: { 
    count: selected.length,
    candidates: selected.map(a => `${a.applicant_details?.full_name || 'Unknown'} — ${a.job?.title || 'Unknown'}`)
  }
})
      }
      setSelectedIds([])
      setShowBulkActions(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  // Smart screening
  async function handleAutoShortlist() {
    const eligible = filtered.filter(a => a.status === 'applied' && a.match_score != null && a.match_score >= shortlistThreshold)
    if (eligible.length === 0) { toast.error(`No applicants with ${shortlistThreshold}%+ match score in "Applied" status`); return }
    if (!confirm(`Move ${eligible.length} applicant${eligible.length !== 1 ? 's' : ''} with ${shortlistThreshold}%+ match to Screening?`)) return
    setBulkProcessing(true)
    let success = 0
    try {
      for (const app of eligible) {
        await supabase.from('applications').update({ status: 'screening', updated_at: new Date().toISOString() }).eq('id', app.id)
        if (app.applicant_details?.email && app.applicant_details?.full_name && app.job?.title) {
          await sendStatusEmail('screening', app.applicant_details.email, app.applicant_details.full_name, app.job.title, app.id)
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

  async function handleAutoReject() {
    const eligible = filtered.filter(a => a.status === 'applied' && a.match_score != null && a.match_score < rejectThreshold)
    if (eligible.length === 0) { toast.error(`No applicants below ${rejectThreshold}% in "Applied" status`); return }
    if (!confirm(`Reject ${eligible.length} applicant${eligible.length !== 1 ? 's' : ''} below ${rejectThreshold}%?`)) return
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
    const matchDuplicate = !showDuplicatesOnly || a.is_duplicate
    const matchLocation = locationFilter === 'all' || a.applicant_details?.location === locationFilter
    const matchSource = sourceFilter === 'all' || a.source === sourceFilter
    const matchExperience = experienceFilter === 'all' || (() => {
      const yrs = a.applicant_details?.years_experience || 0
      if (experienceFilter === 'up1') return yrs <= 1
      if (experienceFilter === '1+') return yrs >= 1
      if (experienceFilter === '3+') return yrs >= 3
      if (experienceFilter === '5+') return yrs >= 5
      if (experienceFilter === '7+') return yrs >= 7
      return true
    })()
    const matchDate = dateFilter === 'all' || (() => {
      const appDate = new Date(a.created_at)
      const now = new Date()
      const diff = (now.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24)
      if (dateFilter === '30') return diff <= 30
      if (dateFilter === '90') return diff <= 90
      if (dateFilter === '365') return diff <= 365
      return true
    })()
    const matchScoreRange = (a.match_score == null) || (a.match_score >= minScoreFilter && a.match_score <= maxScoreFilter)
    return matchSearch && matchStatus && matchJob && matchScore && matchDuplicate && matchLocation && matchSource && matchExperience && matchDate && matchScoreRange
  })

  const activeAdvancedFilters = [
    locationFilter !== 'all',
    sourceFilter !== 'all',
    dateFilter !== 'all',
    experienceFilter !== 'all',
    minScoreFilter > 0 || maxScoreFilter < 100
  ].filter(Boolean).length

  const allSelected = filtered.length > 0 && filtered.every(a => selectedIds.includes(a.id))

  function toggleSelectAll() {
    if (allSelected) setSelectedIds([])
    else setSelectedIds(filtered.map(a => a.id))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const uniqueSources = [...new Set(applications.map(a => a.source).filter(Boolean))] as string[]
  const uniqueLocations = [...new Set(applications.map(a => a.applicant_details?.location).filter(Boolean))] as string[]

  const appliedApps = applications.filter(a => a.status === 'applied' && a.match_score != null)
  const highMatch = appliedApps.filter(a => a.match_score >= shortlistThreshold).length
  const lowMatch = appliedApps.filter(a => a.match_score < rejectThreshold).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Applicants</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {applications.length} total · {filtered.length} showing {selectedIds.length > 0 && `· ${selectedIds.length} selected`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowScreening(!showScreening)}
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
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#10b981' }}>{highMatch}</div>
              <div style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: '500' }}>High Match</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shortlistThreshold}%+ score</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f59e0b' }}>{appliedApps.length - highMatch - lowMatch}</div>
              <div style={{ fontSize: '0.8125rem', color: '#f59e0b', fontWeight: '500' }}>Medium Match</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rejectThreshold}% - {shortlistThreshold - 1}%</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ef4444' }}>{lowMatch}</div>
              <div style={{ fontSize: '0.8125rem', color: '#ef4444', fontWeight: '500' }}>Low Match</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Below {rejectThreshold}%</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="label" style={{ margin: 0, color: '#10b981' }}>Shortlist Threshold</label>
                <span style={{ fontWeight: '700', color: '#10b981' }}>{shortlistThreshold}%</span>
              </div>
              <input type="range" min="50" max="100" step="5" value={shortlistThreshold} onChange={e => setShortlistThreshold(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label className="label" style={{ margin: 0, color: '#ef4444' }}>Reject Threshold</label>
                <span style={{ fontWeight: '700', color: '#ef4444' }}>{rejectThreshold}%</span>
              </div>
              <input type="range" min="10" max="60" step="5" value={rejectThreshold} onChange={e => setRejectThreshold(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.875rem' }}>
            <button onClick={handleAutoShortlist} disabled={bulkProcessing || highMatch === 0}
              style={{ flex: 1, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: highMatch === 0 ? 0.5 : 1 }}>
              {bulkProcessing ? <span className="spinner" /> : <ThumbsUp size={16} />}
              Shortlist {highMatch} ({shortlistThreshold}%+)
            </button>
            <button onClick={handleAutoReject} disabled={bulkProcessing || lowMatch === 0}
              style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: lowMatch === 0 ? 0.5 : 1 }}>
              {bulkProcessing ? <span className="spinner" /> : <ThumbsDown size={16} />}
              Reject {lowMatch} (Below {rejectThreshold}%)
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontWeight: '600', color: 'var(--blue-400)', fontSize: '0.9375rem' }}>
            {selectedIds.length} applicant{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Bulk status change */}
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              <select className="input" value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem', width: 'auto' }}>
                <option value="">Move to stage...</option>
                {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <button className="btn-primary" onClick={() => handleBulkStatusChange(bulkStatus)} disabled={!bulkStatus || bulkProcessing}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
                {bulkProcessing ? <span className="spinner" /> : 'Apply'}
              </button>
            </div>
            {/* Bulk email */}
            <button onClick={() => setShowBulkEmailModal(true)} className="btn-secondary"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Mail size={14} /> Send Email
            </button>
            {/* Bulk delete */}
            <button onClick={handleBulkDelete} disabled={bulkProcessing}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Trash2 size={14} /> Delete
            </button>
            {/* Clear selection */}
            <button onClick={() => setSelectedIds([])} className="btn-secondary"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
              Clear
            </button>
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
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="input" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{ width: '180px' }}>
          <option value="all">All Jobs</option>
          {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.375rem 0.875rem' }}>
          <Filter size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Min Score:</span>
          <input type="range" min="0" max="100" step="10" value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ width: '80px', accentColor: 'var(--blue-500)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: minScore > 0 ? 'var(--blue-400)' : 'var(--text-muted)', minWidth: '36px' }}>
            {minScore > 0 ? `${minScore}%+` : 'Any'}
          </span>
        </div>
        <button
          onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
          style={{ background: showDuplicatesOnly ? 'rgba(245,158,11,0.15)' : 'var(--navy-800)', border: `1px solid ${showDuplicatesOnly ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, color: showDuplicatesOnly ? '#f59e0b' : 'var(--text-muted)', borderRadius: '8px', padding: '0.375rem 0.875rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: showDuplicatesOnly ? '600' : '400', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          ⚠ {showDuplicatesOnly ? 'Showing Duplicates' : 'Show Duplicates'} ({applications.filter(a => a.is_duplicate).length})
        </button>
        <button
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          style={{ background: activeAdvancedFilters > 0 ? 'rgba(37,99,235,0.15)' : 'var(--navy-800)', border: `1px solid ${activeAdvancedFilters > 0 ? 'rgba(37,99,235,0.4)' : 'var(--border)'}`, color: activeAdvancedFilters > 0 ? 'var(--blue-400)' : 'var(--text-muted)', borderRadius: '8px', padding: '0.375rem 0.875rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: activeAdvancedFilters > 0 ? '600' : '400', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <SlidersHorizontal size={14} /> More Filters {activeAdvancedFilters > 0 && `(${activeAdvancedFilters})`}
        </button>
      </div>

      {/* More Filters Panel */}
      {showMoreFilters && (
        <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem', border: '1px solid rgba(37,99,235,0.25)', background: 'rgba(37,99,235,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SlidersHorizontal size={16} color="var(--blue-400)" />
              <h3 style={{ fontWeight: '600', fontSize: '0.9375rem' }}>Advanced Filters</h3>
              {activeAdvancedFilters > 0 && <span style={{ background: 'var(--blue-500)', color: 'white', borderRadius: '9999px', fontSize: '0.7rem', padding: '0.1rem 0.5rem', fontWeight: '700' }}>{activeAdvancedFilters} active</span>}
            </div>
            {activeAdvancedFilters > 0 && (
              <button onClick={() => { setLocationFilter('all'); setSourceFilter('all'); setDateFilter('all'); setExperienceFilter('all'); setMinScoreFilter(0); setMaxScoreFilter(100) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <XIcon size={13} /> Clear all filters
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>

            {/* Location */}
            <div>
              <label className="label">Candidate Location</label>
              <select className="input" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                <option value="all">All Locations</option>
                {['Clarendon','Hanover','Kingston','Manchester','Portland','St. Andrew','St. Ann','St. Catherine','St. Elizabeth','St. James','St. Mary','St. Thomas','Trelawny','Westmoreland'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="label">Source</label>
              <select className="input" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                <option value="all">All Sources</option>
                {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Application Date */}
            <div>
              <label className="label">Application Date</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {[
                  { value: 'all', label: 'Any time' },
                  { value: '30', label: 'Last 30 days' },
                  { value: '90', label: 'Last 3 months' },
                  { value: '365', label: 'Last year' },
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <input type="radio" name="dateFilter" value={opt.value} checked={dateFilter === opt.value} onChange={() => setDateFilter(opt.value)} style={{ accentColor: 'var(--blue-500)' }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Years of Experience */}
            <div>
              <label className="label">Years of Experience</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {[
                  { value: 'all', label: 'Any' },
                  { value: 'up1', label: 'Up to 1' },
                  { value: '1+', label: '1+' },
                  { value: '3+', label: '3+' },
                  { value: '5+', label: '5+' },
                  { value: '7+', label: '7+' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setExperienceFilter(opt.value)}
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '500', transition: 'all 0.15s', background: experienceFilter === opt.value ? 'rgba(37,99,235,0.2)' : 'transparent', borderColor: experienceFilter === opt.value ? 'var(--blue-500)' : 'var(--border)', color: experienceFilter === opt.value ? 'var(--blue-400)' : 'var(--text-muted)' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Match Score Range */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label">Match Score Range: <strong style={{ color: 'var(--blue-400)' }}>{minScoreFilter}% — {maxScoreFilter}%</strong></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Min</span>
                <input type="range" min="0" max="100" step="5" value={minScoreFilter} onChange={e => setMinScoreFilter(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--blue-500)' }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Max</span>
                <input type="range" min="0" max="100" step="5" value={maxScoreFilter} onChange={e => setMaxScoreFilter(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--blue-500)' }} />
              </div>
            </div>

          </div>

          {/* Results count */}
          <div style={{ marginTop: '1rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> candidate{filtered.length !== 1 ? 's' : ''} match your filters
            </span>
            {filtered.length > 0 && (
              <button onClick={() => { setSelectedIds(filtered.map(a => a.id)); setShowMoreFilters(false) }}
                className="btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem' }}>
                Select All {filtered.length} Candidates
              </button>
            )}
          </div>
        </div>
      )}

      {/* Duplicate warning banner */}
      {applications.filter(a => a.is_duplicate).length > 0 && !showDuplicatesOnly && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#f59e0b' }}>
            <span>⚠</span>
            <span><strong>{applications.filter(a => a.is_duplicate).length}</strong> duplicate application{applications.filter(a => a.is_duplicate).length !== 1 ? 's' : ''} detected — same applicant has applied multiple times</span>
          </div>
          <button onClick={() => setShowDuplicatesOnly(true)}
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '600' }}>
            View Duplicates
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No applicants found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--blue-500)' }} />
                  </th>
                  <th style={{ whiteSpace: 'nowrap' }}>Applicant</th>
<th style={{ whiteSpace: 'nowrap' }}>Applied For</th>
<th style={{ whiteSpace: 'nowrap' }}>Skills</th>
<th style={{ whiteSpace: 'nowrap' }}>Experience</th>
<th style={{ whiteSpace: 'nowrap' }}>Match Score</th>
<th style={{ whiteSpace: 'nowrap' }}>Stage</th>
<th style={{ whiteSpace: 'nowrap' }}>Source</th>
<th style={{ whiteSpace: 'nowrap' }}>Applied</th>
<th style={{ whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
                  .map(app => (
                    <tr key={app.id} style={{ background: selectedIds.includes(app.id) ? 'rgba(37,99,235,0.06)' : 'transparent' }}>
                      <td>
                        <input type="checkbox" checked={selectedIds.includes(app.id)} onChange={() => toggleSelect(app.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--blue-500)' }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: app.is_duplicate ? '#f59e0b' : 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '600', flexShrink: 0 }}>
                            {(app.applicant_details?.full_name || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              {app.applicant_details?.full_name || 'Unknown'}
                              {app.is_duplicate && (
                                <span title="This applicant has multiple applications" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: '4px', padding: '0.1rem 0.375rem', fontSize: '0.65rem', fontWeight: '600' }}>
                                  ⚠ Duplicate
                                </span>
                              )}
                            </div>
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
                        <select value={app.status}
                          onChange={e => statusMutation.mutate({ id: app.id, status: e.target.value, applicantEmail: app.applicant_details?.email, applicantName: app.applicant_details?.full_name, jobTitle: app.job?.title })}
                          className={`badge ${statusColors[app.status]}`}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', textTransform: 'capitalize' }}>
                          {STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--navy-800)' }}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                        {app.source ? (
                          <span style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', borderRadius: '5px', padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>{app.source}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button onClick={() => navigate(`/dashboard/applicants/${app.id}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', padding: '0.25rem' }}>
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

      {/* Bulk Email Modal */}
      {showBulkEmailModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBulkEmailModal(false)}>
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Send Bulk Email</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Sending to {selectedIds.length} applicant{selectedIds.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowBulkEmailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {/* Template selector */}
              <div className="form-group">
                <label className="label">Use Template</label>
                <select className="input" onChange={e => {
                  const t = templates.find((t: any) => t.id === e.target.value)
                  if (t) { setBulkEmailSubject(t.subject); setBulkEmailBody(t.body) }
                }}>
                  <option value="">— Select a template —</option>
                  {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Subject *</label>
                <input className="input" value={bulkEmailSubject} onChange={e => setBulkEmailSubject(e.target.value)} placeholder="Email subject" />
              </div>
              <div className="form-group">
                <label className="label">Message *</label>
                <textarea className="input" value={bulkEmailBody} onChange={e => setBulkEmailBody(e.target.value)} placeholder="Email body... Use {{applicant_name}} and {{job_title}} for personalization" style={{ minHeight: '160px' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--navy-700)', padding: '0.625rem 0.875rem', borderRadius: '6px' }}>
                💡 Use <strong>{'{{applicant_name}}'}</strong> and <strong>{'{{job_title}}'}</strong> — they'll be replaced with each applicant's actual details
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn-secondary" onClick={() => setShowBulkEmailModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleBulkEmail} disabled={sendingBulkEmail || !bulkEmailSubject || !bulkEmailBody}>
                {sendingBulkEmail ? <><span className="spinner" /> Sending...</> : `Send to ${selectedIds.length} Applicant${selectedIds.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
