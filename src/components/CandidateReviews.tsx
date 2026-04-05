import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { createAuditLog } from '../lib/audit'
import toast from 'react-hot-toast'
import { Edit, Trash2, CheckCircle, XCircle, HelpCircle, ThumbsUp, ThumbsDown } from 'lucide-react'

interface Props {
  applicationId: string
}

const RECOMMENDATIONS = [
  { value: 'strong_yes', label: 'Strong Yes', color: '#10b981', icon: '🌟' },
  { value: 'yes', label: 'Yes', color: '#3b82f6', icon: '👍' },
  { value: 'maybe', label: 'Maybe', color: '#f59e0b', icon: '🤔' },
  { value: 'no', label: 'No', color: '#ef4444', icon: '👎' },
  { value: 'strong_no', label: 'Strong No', color: '#dc2626', icon: '🚫' },
]

export default function CandidateReviews({ applicationId }: Props) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [recommendation, setRecommendation] = useState('')
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_reviews')
        .select('*, reviewer:profiles!candidate_reviews_reviewer_id_fkey(full_name, role)')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
      return data || []
    }
  })

  // Check if current user already reviewed
  const myReview = reviews.find((r: any) => r.reviewer_id === profile?.user_id)

  // Load my review into form
  function startEdit() {
    if (myReview) {
      setRating(myReview.rating || 0)
      setRecommendation(myReview.recommendation || '')
      setComment(myReview.comment || '')
    }
    setEditing(true)
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!rating) throw new Error('Please give a star rating')
      if (!recommendation) throw new Error('Please select a recommendation')

      const payload = {
        application_id: applicationId,
        reviewer_id: profile?.user_id,
        rating,
        recommendation,
        comment,
        updated_at: new Date().toISOString()
      }

      if (myReview) {
        const { error } = await supabase.from('candidate_reviews').update(payload).eq('id', myReview.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('candidate_reviews').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', applicationId] })
      toast.success(myReview ? 'Review updated!' : 'Review submitted!')
      setEditing(false)
      if (!myReview) { setRating(0); setRecommendation(''); setComment('') }
    },
    onError: (err: any) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('candidate_reviews').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', applicationId] })
      toast.success('Review deleted')
      setRating(0); setRecommendation(''); setComment(''); setEditing(false)
    }
  })

  // Calculate aggregate stats
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null

  const recCounts = RECOMMENDATIONS.reduce((acc: any, r) => {
    acc[r.value] = reviews.filter((rev: any) => rev.recommendation === r.value).length
    return acc
  }, {})

  const getRecLabel = (val: string) => RECOMMENDATIONS.find(r => r.value === val)

  return (
    <div>
      {/* Aggregate summary */}
      {reviews.length > 0 && (
        <div style={{ background: 'var(--navy-900)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{avgRating}</div>
                <div style={{ display: 'flex', gap: '0.125rem', marginTop: '0.25rem' }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ fontSize: '1rem', color: n <= Math.round(Number(avgRating)) ? '#f59e0b' : 'var(--navy-700)' }}>★</span>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ width: '1px', height: '50px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {RECOMMENDATIONS.map(rec => recCounts[rec.value] > 0 && (
                  <span key={rec.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: `${rec.color}18`, border: `1px solid ${rec.color}40`, color: rec.color, borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    {rec.icon} {rec.label} ({recCounts[rec.value]})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My review form */}
      {(!myReview || editing) && (
        <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h4 style={{ fontWeight: '600', fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {myReview ? '✏️ Edit Your Review' : '✍️ Submit Your Review'}
          </h4>

          {/* Star rating */}
          <div className="form-group">
            <label className="label">Your Rating *</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(n)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.75rem', color: n <= (hoverRating || rating) ? '#f59e0b' : 'var(--navy-700)', transition: 'color 0.1s', lineHeight: 1 }}>
                  ★
                </button>
              ))}
              {rating > 0 && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '0.5rem' }}>
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                </span>
              )}
            </div>
          </div>

          {/* Recommendation */}
          <div className="form-group">
            <label className="label">Recommendation *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {RECOMMENDATIONS.map(rec => (
                <button key={rec.value} type="button"
                  onClick={() => setRecommendation(rec.value)}
                  style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', border: `1px solid`, fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500', transition: 'all 0.15s', background: recommendation === rec.value ? `${rec.color}20` : 'transparent', borderColor: recommendation === rec.value ? rec.color : 'var(--border)', color: recommendation === rec.value ? rec.color : 'var(--text-muted)' }}>
                  {rec.icon} {rec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="form-group">
            <label className="label">Comments</label>
            <textarea className="input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your thoughts on this candidate... What stood out? Any concerns?" style={{ minHeight: '100px' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            {editing && (
              <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            )}
            <button className="btn-primary" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <span className="spinner" /> : myReview ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}

      {/* My existing review */}
      {myReview && !editing && (
        <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700' }}>
                {profile?.full_name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>Your Review</span>
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button onClick={startEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', padding: '0.25rem' }}><Edit size={14} /></button>
              <button onClick={() => { if (confirm('Delete your review?')) deleteMutation.mutate(myReview.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}><Trash2 size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: myReview.comment ? '0.625rem' : 0 }}>
            <div style={{ display: 'flex', gap: '0.125rem' }}>
              {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '1rem', color: n <= myReview.rating ? '#f59e0b' : 'var(--navy-700)' }}>★</span>)}
            </div>
            {myReview.recommendation && (() => {
              const rec = getRecLabel(myReview.recommendation)
              return rec ? <span style={{ background: `${rec.color}18`, border: `1px solid ${rec.color}40`, color: rec.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.8125rem', fontWeight: '500' }}>{rec.icon} {rec.label}</span> : null
            })()}
          </div>
          {myReview.comment && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{myReview.comment}</p>}
        </div>
      )}

      {/* All reviews from other team members */}
      {reviews.filter((r: any) => r.reviewer_id !== profile?.user_id).length > 0 && (
        <div>
          <h4 style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Team Reviews ({reviews.filter((r: any) => r.reviewer_id !== profile?.user_id).length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reviews.filter((r: any) => r.reviewer_id !== profile?.user_id).map((review: any) => {
              const rec = getRecLabel(review.recommendation)
              return (
                <div key={review.id} style={{ background: 'var(--navy-700)', borderRadius: '10px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '700', flexShrink: 0 }}>
                        {review.reviewer?.full_name?.[0]?.toUpperCase() || 'H'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{review.reviewer?.full_name || 'HR Team'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{review.reviewer?.role?.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(review.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: review.comment ? '0.625rem' : 0 }}>
                    <div style={{ display: 'flex', gap: '0.125rem' }}>
                      {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '1rem', color: n <= review.rating ? '#f59e0b' : 'var(--navy-700)' }}>★</span>)}
                    </div>
                    {rec && <span style={{ background: `${rec.color}18`, border: `1px solid ${rec.color}40`, color: rec.color, borderRadius: '6px', padding: '0.2rem 0.625rem', fontSize: '0.8125rem', fontWeight: '500' }}>{rec.icon} {rec.label}</span>}
                  </div>
                  {review.comment && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{review.comment}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {reviews.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', background: 'var(--navy-900)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.875rem' }}>
          No reviews yet. Be the first to review this candidate.
        </div>
      )}
    </div>
  )
}
