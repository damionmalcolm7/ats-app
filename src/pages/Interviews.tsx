import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Calendar, List, Trash2, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Interviews() {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [monthOffset, setMonthOffset] = useState(0)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ['all-interviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select(`*, application:applications(id, applicant_details(full_name, email)), job:jobs(title)`)
        .order('scheduled_at', { ascending: true })
      if (error) throw error
      return data as any[]
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('interviews').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-interviews'] }); toast.success('Updated') }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('interviews').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-interviews'] }); toast.success('Deleted') }
  })

  // Calendar logic
  const today = new Date()
  const displayMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = displayMonth.getDay()
  const monthName = displayMonth.toLocaleString('default', { month: 'long', year: 'numeric' })

  const interviewsByDay: Record<number, any[]> = {}
  interviews.forEach(iv => {
    const d = new Date(iv.scheduled_at)
    if (d.getMonth() === displayMonth.getMonth() && d.getFullYear() === displayMonth.getFullYear()) {
      const day = d.getDate()
      if (!interviewsByDay[day]) interviewsByDay[day] = []
      interviewsByDay[day].push(iv)
    }
  })

  const upcoming = interviews.filter(iv => new Date(iv.scheduled_at) >= new Date() && iv.status === 'scheduled')
  const past = interviews.filter(iv => new Date(iv.scheduled_at) < new Date() || iv.status !== 'scheduled')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Interviews</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{upcoming.length} upcoming</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--navy-900)', borderRadius: '8px', padding: '0.25rem', gap: '0.25rem' }}>
          <button onClick={() => setView('list')} style={{ padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', background: view === 'list' ? 'var(--blue-500)' : 'transparent', color: view === 'list' ? 'white' : 'var(--text-muted)' }}>
            <List size={14} />
          </button>
          <button onClick={() => setView('calendar')} style={{ padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', background: view === 'calendar' ? 'var(--blue-500)' : 'transparent', color: view === 'calendar' ? 'white' : 'var(--text-muted)' }}>
            <Calendar size={14} />
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {upcoming.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Upcoming</h3>
              {upcoming.map(iv => <InterviewCard key={iv.id} iv={iv} onUpdate={updateMutation.mutate} onDelete={deleteMutation.mutate} navigate={navigate} />)}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Past</h3>
              {past.map(iv => <InterviewCard key={iv.id} iv={iv} onUpdate={updateMutation.mutate} onDelete={deleteMutation.mutate} navigate={navigate} />)}
            </div>
          )}
          {interviews.length === 0 && !isLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No interviews scheduled yet.</div>
          )}
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem' }} onClick={() => setMonthOffset(m => m - 1)}>‹</button>
            <h3 style={{ fontWeight: '600' }}>{monthName}</h3>
            <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem' }} onClick={() => setMonthOffset(m => m + 1)}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.5rem' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', padding: '0.375rem' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} style={{ minHeight: '80px' }} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayInterviews = interviewsByDay[day] || []
              const isToday = today.getDate() === day && today.getMonth() === displayMonth.getMonth() && today.getFullYear() === displayMonth.getFullYear()
              return (
                <div key={day} style={{ minHeight: '80px', padding: '0.375rem', background: isToday ? 'rgba(37,99,235,0.1)' : 'var(--navy-900)', borderRadius: '6px', border: isToday ? '1px solid var(--blue-500)' : '1px solid transparent' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: isToday ? '700' : '400', color: isToday ? 'var(--blue-400)' : 'var(--text-secondary)', marginBottom: '0.25rem' }}>{day}</div>
                  {dayInterviews.map(iv => (
                    <div key={iv.id} style={{ background: 'var(--blue-500)', borderRadius: '4px', padding: '0.125rem 0.375rem', fontSize: '0.7rem', marginBottom: '0.125rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      onClick={() => navigate(`/dashboard/applicants/${iv.application_id}`)}>
                      {iv.application?.applicant_details?.full_name?.split(' ')[0]}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function InterviewCard({ iv, onUpdate, onDelete, navigate }: any) {
  const isPast = new Date(iv.scheduled_at) < new Date()
  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '0.625rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '600', flexShrink: 0 }}>
            {iv.application?.applicant_details?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <div style={{ fontWeight: '500', cursor: 'pointer', color: 'var(--blue-400)' }} onClick={() => navigate(`/dashboard/applicants/${iv.application_id}`)}>
              {iv.application?.applicant_details?.full_name || 'Applicant'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{iv.job?.title}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {new Date(iv.scheduled_at).toLocaleString()} · <span style={{ textTransform: 'capitalize' }}>{iv.format}</span>
            </div>
            {iv.location_or_link && <div style={{ fontSize: '0.8125rem', color: 'var(--blue-400)', marginTop: '0.125rem' }}>{iv.location_or_link}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${iv.status === 'scheduled' ? 'badge-blue' : iv.status === 'completed' ? 'badge-green' : 'badge-red'}`} style={{ textTransform: 'capitalize' }}>{iv.status}</span>
          {iv.status === 'scheduled' && <button onClick={() => onUpdate({ id: iv.id, status: 'completed' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }} title="Mark completed"><CheckCircle size={16} /></button>}
          {iv.status === 'cancelled' && <button onClick={() => { if (confirm('Delete this cancelled interview?')) onDelete(iv.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Delete interview"><Trash2 size={15} /></button>}
        </div>
      </div>
    </div>
  )
}
