import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendStatusEmail } from '../lib/email'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'

const STAGES = [
  { id: 'applied',    label: 'Applied',    color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.2)' },
  { id: 'screening',  label: 'Screening',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)' },
  { id: 'interview',  label: 'Interview',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.2)' },
  { id: 'assessment', label: 'Assessment', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.2)' },
  { id: 'offer',      label: 'Offer',      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
  { id: 'hired',      label: 'Hired',      color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  { id: 'rejected',   label: 'Rejected',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
]

export default function Pipeline() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [jobFilter, setJobFilter] = useState('all')

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['pipeline-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs(title, department), applicant_details(full_name, email, skills, years_experience)')
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
    mutationFn: async ({ id, status, email, name, jobTitle }: any) => {
      const { error } = await supabase.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      if (email && name && jobTitle) {
        await sendStatusEmail(status, email, name, jobTitle, id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-applications'] })
      toast.success('Stage updated!')
    },
    onError: (err: any) => toast.error(err.message)
  })

  const filtered = applications.filter(a => jobFilter === 'all' || a.job_id === jobFilter)
  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.id] = filtered.filter(a => a.status === stage.id)
    return acc
  }, {} as Record<string, any[]>)

  function onDragStart(e: React.DragEvent, appId: string) {
    setDraggedId(appId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageId)
  }

  function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault()
    setDragOverStage(null)
    if (!draggedId) return
    const app = applications.find(a => a.id === draggedId)
    if (!app || app.status === stageId) return
    statusMutation.mutate({
      id: draggedId,
      status: stageId,
      email: app.applicant_details?.email,
      name: app.applicant_details?.full_name,
      jobTitle: app.job?.title
    })
    setDraggedId(null)
  }

  function onDragEnd() {
    setDraggedId(null)
    setDragOverStage(null)
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
      <span className="spinner" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {filtered.length} candidate{filtered.length !== 1 ? 's' : ''} · Drag cards to move between stages
          </p>
        </div>
        <select className="input" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{ width: '200px' }}>
          <option value="all">All Jobs</option>
          {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </div>

      {/* Stage summary bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexShrink: 0, flexWrap: 'wrap' }}>
        {STAGES.map(stage => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: stage.bg, border: `1px solid ${stage.border}`, borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }} />
            <span style={{ color: stage.color, fontWeight: '600' }}>{stage.label}</span>
            <span style={{ color: stage.color, fontWeight: '700' }}>{grouped[stage.id]?.length || 0}</span>
          </div>
        ))}
      </div>

      {/* Kanban Board - fills remaining height and scrolls horizontally */}
      <div style={{
        display: 'flex',
        gap: '0.625rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 1,
        paddingBottom: '0.5rem',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border) transparent'
      }}>
        {STAGES.map(stage => {
          const cards = grouped[stage.id] || []
          const isDragOver = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              onDragOver={e => onDragOver(e, stage.id)}
              onDrop={e => onDrop(e, stage.id)}
              onDragLeave={() => setDragOverStage(null)}
              style={{
                minWidth: '200px',
                width: '200px',
                display: 'flex',
                flexDirection: 'column',
                background: isDragOver ? stage.bg : 'var(--navy-900)',
                border: `1px solid ${isDragOver ? stage.color : 'var(--border)'}`,
                borderRadius: '10px',
                transition: 'all 0.2s',
                flexShrink: 0,
                overflow: 'hidden'
              }}>

              {/* Column header */}
              <div style={{ padding: '0.75rem 0.75rem 0.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{stage.label}</span>
                  </div>
                  <span style={{ background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color, borderRadius: '9999px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: '700' }}>
                    {cards.length}
                  </span>
                </div>
              </div>

              {/* Scrollable cards area */}
              <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', overflowY: 'auto', flex: 1 }}>
                {cards.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: '6px', marginTop: '0.25rem' }}>
                    Drop here
                  </div>
                )}
                {cards.map(app => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={e => onDragStart(e, app.id)}
                    onDragEnd={onDragEnd}
                    style={{
                      background: draggedId === app.id ? 'var(--navy-700)' : 'var(--navy-800)',
                      border: '1px solid var(--border)',
                      borderRadius: '7px',
                      padding: '0.625rem',
                      cursor: 'grab',
                      opacity: draggedId === app.id ? 0.5 : 1,
                      transition: 'all 0.15s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={e => { if (draggedId !== app.id) (e.currentTarget as HTMLElement).style.borderColor = stage.color }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>

                    {/* Avatar + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: stage.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                        {(app.applicant_details?.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.applicant_details?.full_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.job?.title}
                        </div>
                      </div>
                    </div>

                    {/* Match score bar */}
                    {app.match_score != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                        <div style={{ flex: 1, height: '3px', background: 'var(--navy-700)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${app.match_score}%`, height: '100%', background: app.match_score >= 70 ? '#10b981' : app.match_score >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>{app.match_score}%</span>
                      </div>
                    )}

                    {/* Skills */}
                    {app.applicant_details?.skills?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', marginBottom: '0.375rem' }}>
                        {app.applicant_details.skills.slice(0, 2).map((s: string) => (
                          <span key={s} style={{ background: 'rgba(37,99,235,0.12)', color: '#3b82f6', borderRadius: '3px', padding: '0.1rem 0.3rem', fontSize: '0.6rem' }}>{s}</span>
                        ))}
                        {app.applicant_details.skills.length > 2 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>+{app.applicant_details.skills.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Date + view button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => navigate(`/dashboard/applicants/${app.id}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', padding: '0.125rem', display: 'flex', alignItems: 'center' }}
                        title="View Profile">
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scroll hint */}
      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
        💡 Drag and drop cards to move candidates · Scroll right to see all stages · Status emails sent automatically
      </div>
    </div>
  )
}
