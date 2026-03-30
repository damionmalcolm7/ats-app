import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Edit, Trash2 } from 'lucide-react'

interface Props {
  interviewId: string
  applicationId: string
}

const RECOMMENDATIONS = [
  { value: 'proceed', label: 'Proceed', color: '#10b981', icon: '✅' },
  { value: 'hold', label: 'Hold', color: '#f59e0b', icon: '⏸️' },
  { value: 'reject', label: 'Reject', color: '#ef4444', icon: '❌' },
]

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

const CRITERIA = [
  { key: 'technical_skills', label: 'Technical Skills' },
  { key: 'communication', label: 'Communication' },
  { key: 'culture_fit', label: 'Culture Fit' },
]

function StarRating({ value, onChange, size = 20 }: { value: number, onChange?: (v: number) => void, size?: number }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: '0.125rem' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n)}
          style={{ fontSize: `${size}px`, color: n <= (hover || value) ? '#f59e0b' : 'var(--navy-700)', cursor: onChange ? 'pointer' : 'default', transition: 'color 0.1s', lineHeight: 1 }}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function InterviewFeedback({ interviewId, applicationId }: Props) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    overall_rating: 0,
    technical_skills: 0,
    communication: 0,
    culture_fit: 0,
    strengths: '',
    weaknesses: '',
    recommendation: '',
    comments: ''
  })

  const { data: feedbackList = [], isLoading } = useQuery({
    queryKey: ['interview-feedback', interviewId],
    queryFn: async () => {
      const { data } = await supabase
        .from('interview_feedback')
        .select('*, reviewer:profiles!interview_feedback_reviewer_id_fkey(full_name, job_title, role)')
        .eq('interview_id', interviewId)
        .order('created_at', { ascending: false })
      return data || []
    }
  })

  const myFeedback = feedbackList.find((f: any) => f.reviewer_id === profile?.user_id)

  function startEdit() {
    if (myFeedback) {
      setForm({
        overall_rating: myFeedback.overall_rating || 0,
        technical_skills: myFeedback.technical_skills || 0,
        communication: myFeedback.communication || 0,
        culture_fit: myFeedback.culture_fit || 0,
        strengths: myFeedback.strengths || '',
        weaknesses: myFeedback.weaknesses || '',
        recommendation: myFeedback.recommendation || '',
        comments: myFeedback.comments || ''
      })
    }
    setEditing(true)
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.overall_rating) throw new Error('Please give an overall rating')
      if (!form.recommendation) throw new Error('Please select a recommendation')

      const payload = {
        interview_id: interviewId,
        application_id: applicationId,
        reviewer_id: profile?.user_id,
        ...form,
        updated_at: new Date().toISOString()
      }

      if (myFeedback) {
        const { error } = await supabase.from('interview_feedback').update(payload).eq('id', myFeedback.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('interview_feedback').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-feedback', interviewId] })
      toast.success(myFeedback ? 'Feedback updated!' : 'Feedback submitted!')
      setEditing(false)
      if (!myFeedback) setForm({ overall_rating: 0, technical_skills: 0, communication: 0, culture_fit: 0, strengths: '', weaknesses: '', recommendation: '', comments: '' })
    },
    onError: (err: any) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('interview_feedback').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-feedback', interviewId] })
      toast.success('Feedback deleted')
      setEditing(false)
      setForm({ overall_rating: 0, technical_skills: 0, communication: 0, culture_fit: 0, strengths: '', weaknesses: '', recommendation: '', comments: '' })
    }
  })

  // Average scores
  const avgOverall = feedbackList.length > 0
    ? (feedbackList.reduce((s: number, f: any) => s + (f.overall_rating || 0), 0) / feedbackList.length).toFixed(1)
    : null

  const recCounts = RECOMMENDATIONS.reduce((acc: any, r) => {
    acc[r.value] = feedbackList.filter((f: any) => f.recommendation === r.value).length
    return acc
  }, {})

  return (
    <div>
      {/* Summary */}
      {feedbackList.length > 0 && (
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1 }}>{avgOverall}</div>
              <StarRating value={Math.round(Number(avgOverall))} size={14} />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{feedbackList.length} review{feedbackList.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ width: '1px', height: '50px', background: 'var(--border)' }} />
            {/* Criteria averages */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {CRITERIA.map(c => {
                const avg = feedbackList.filter((f: any) => f[c.key]).reduce((s: number, f: any) => s + f[c.key], 0) / (feedbackList.filter((f: any) => f[c.key]).length || 1)
                return (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '120px' }}>{c.label}</span>
                    <div style={{ flex: 1, height: '6px', background: 'var(--navy-700)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(avg / 5) * 100}%`, height: '100%', background: avg >= 4 ? '#10b981' : avg >= 3 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '20px' }}>{avg.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ width: '1px', height: '50px', background: 'var(--border)' }} />
            {/* Recommendations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {RECOMMENDATIONS.map(r => recCounts[r.value] > 0 && (
                <span key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                  <span>{r.icon}</span>
                  <span style={{ color: r.color, fontWeight: '500' }}>{r.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}>({recCounts[r.value]})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My feedback form */}
      {(!myFeedback || editing) && (
        <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h4 style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
            {myFeedback ? '✏️ Edit Your Feedback' : '📝 Submit Interview Feedback'}
          </h4>

          {/* Overall rating */}
          <div className="form-group">
            <label className="label">Overall Rating *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <StarRating value={form.overall_rating} onChange={v => setForm({ ...form, overall_rating: v })} size={28} />
              {form.overall_rating > 0 && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{RATING_LABELS[form.overall_rating]}</span>}
            </div>
          </div>

          {/* Criteria ratings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {CRITERIA.map(c => (
              <div key={c.key} className="form-group" style={{ margin: 0 }}>
                <label className="label" style={{ fontSize: '0.8125rem' }}>{c.label}</label>
                <StarRating value={(form as any)[c.key]} onChange={v => setForm({ ...form, [c.key]: v })} size={20} />
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="form-group">
            <label className="label">Recommendation *</label>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {RECOMMENDATIONS.map(r => (
                <button key={r.value} type="button" onClick={() => setForm({ ...form, recommendation: r.value })}
                  style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem', transition: 'all 0.15s', background: form.recommendation === r.value ? `${r.color}20` : 'transparent', borderColor: form.recommendation === r.value ? r.color : 'var(--border)', color: form.recommendation === r.value ? r.color : 'var(--text-muted)' }}>
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="label">Strengths</label>
              <textarea className="input" value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} placeholder="What stood out positively..." style={{ minHeight: '80px' }} />
            </div>
            <div className="form-group">
              <label className="label">Areas for Improvement</label>
              <textarea className="input" value={form.weaknesses} onChange={e => setForm({ ...form, weaknesses: e.target.value })} placeholder="Areas of concern..." style={{ minHeight: '80px' }} />
            </div>
          </div>

          {/* Comments */}
          <div className="form-group">
            <label className="label">Additional Comments</label>
            <textarea className="input" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} placeholder="Any other observations..." style={{ minHeight: '80px' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            {editing && <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>}
            <button className="btn-primary" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <span className="spinner" /> : myFeedback ? 'Update Feedback' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}

      {/* My submitted feedback */}
      {myFeedback && !editing && (
        <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700' }}>
                {profile?.full_name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>Your Feedback</span>
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button onClick={startEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)' }}><Edit size={14} /></button>
              <button onClick={() => { if (confirm('Delete your feedback?')) deleteMutation.mutate(myFeedback.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <StarRating value={myFeedback.overall_rating} size={18} />
            {myFeedback.recommendation && (() => {
              const rec = RECOMMENDATIONS.find(r => r.value === myFeedback.recommendation)
              return rec ? <span style={{ background: `${rec.color}18`, border: `1px solid ${rec.color}40`, color: rec.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.8125rem', fontWeight: '500' }}>{rec.icon} {rec.label}</span> : null
            })()}
          </div>
          {myFeedback.strengths && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.625rem' }}><strong style={{ color: '#10b981' }}>Strengths:</strong> {myFeedback.strengths}</p>}
          {myFeedback.weaknesses && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}><strong style={{ color: '#ef4444' }}>Areas for Improvement:</strong> {myFeedback.weaknesses}</p>}
          {myFeedback.comments && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{myFeedback.comments}</p>}
        </div>
      )}

      {/* Team feedback */}
      {feedbackList.filter((f: any) => f.reviewer_id !== profile?.user_id).length > 0 && (
        <div>
          <h4 style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Team Feedback ({feedbackList.filter((f: any) => f.reviewer_id !== profile?.user_id).length})
          </h4>
          {feedbackList.filter((f: any) => f.reviewer_id !== profile?.user_id).map((f: any) => {
            const rec = RECOMMENDATIONS.find(r => r.value === f.recommendation)
            return (
              <div key={f.id} style={{ background: 'var(--navy-700)', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '700' }}>
                      {f.reviewer?.full_name?.[0]?.toUpperCase() || 'H'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{f.reviewer?.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.reviewer?.job_title || f.reviewer?.role?.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <StarRating value={f.overall_rating} size={16} />
                  {rec && <span style={{ background: `${rec.color}18`, border: `1px solid ${rec.color}40`, color: rec.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.8125rem', fontWeight: '500' }}>{rec.icon} {rec.label}</span>}
                </div>
                {/* Criteria scores */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {CRITERIA.map(c => f[c.key] > 0 && (
                    <div key={c.key} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.label}: <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{'★'.repeat(f[c.key])}{'☆'.repeat(5 - f[c.key])}</span>
                    </div>
                  ))}
                </div>
                {f.strengths && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0' }}><strong style={{ color: '#10b981' }}>Strengths:</strong> {f.strengths}</p>}
                {f.weaknesses && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0' }}><strong style={{ color: '#ef4444' }}>Areas for Improvement:</strong> {f.weaknesses}</p>}
                {f.comments && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0' }}>{f.comments}</p>}
              </div>
            )
          })}
        </div>
      )}

      {feedbackList.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', background: 'var(--navy-900)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.875rem' }}>
          No feedback submitted yet. Be the first to review this interview.
        </div>
      )}
    </div>
  )
}
