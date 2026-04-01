import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Send, Reply, Edit, Trash2, AtSign } from 'lucide-react'
import { createNotification } from '../lib/notifications'

interface Props {
  applicationId: string
}

export default function CandidateComments({ applicationId }: Props) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_comments')
        .select('*, author:profiles(full_name, job_title, role)')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true })
      return data || []
    },
    refetchInterval: 15000 // Auto refresh every 15 seconds
  })

  const { data: hrUsers = [] } = useQuery({
    queryKey: ['hr-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, job_title')
        .in('role', ['hr', 'super_admin'])
        .order('full_name')
      return data || []
    }
  })

  // Top-level comments
  const topLevelComments = comments.filter((c: any) => !c.parent_id)
  // Replies grouped by parent
  const getReplies = (parentId: string) => comments.filter((c: any) => c.parent_id === parentId)

  const addComment = useMutation({
    mutationFn: async ({ content, parentId }: { content: string, parentId?: string }) => {
      if (!content.trim()) throw new Error('Comment cannot be empty')
      const { error } = await supabase.from('candidate_comments').insert({
        application_id: applicationId,
        author_id: profile?.user_id,
        content: content.trim(),
        parent_id: parentId || null
      })
      if (error) throw error

      // Detect @mentions and send notifications
      const mentionRegex = /@([\w\s]+?)(?=\s@|\s*$|\s[^@])/g
      const mentions = [...content.matchAll(mentionRegex)].map(m => m[1].trim())
      if (mentions.length > 0) {
        for (const mentionName of mentions) {
          const mentionedUser = hrUsers.find((u: any) =>
            u.full_name.toLowerCase() === mentionName.toLowerCase()
          )
          if (mentionedUser && mentionedUser.user_id !== profile?.user_id) {
            await createNotification({
              user_id: mentionedUser.user_id,
              type: 'review_submitted',
              title: `${profile?.full_name} mentioned you`,
              message: `"${content.trim().substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
              link: `/dashboard/applicants/${applicationId}`
            })
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', applicationId] })
      setNewComment('')
      setReplyingTo(null)
    },
    onError: (err: any) => toast.error(err.message)
  })

  const editComment = useMutation({
    mutationFn: async ({ id, content }: { id: string, content: string }) => {
      const { error } = await supabase.from('candidate_comments')
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', applicationId] })
      setEditingId(null)
      toast.success('Comment updated')
    },
    onError: (err: any) => toast.error(err.message)
  })

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('candidate_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', applicationId] })
      toast.success('Comment deleted')
    }
  })

  function handleMention(user: any) {
    const textarea = inputRef.current
    if (!textarea) return
    const val = textarea.value
    const atIndex = val.lastIndexOf('@')
    const newVal = val.substring(0, atIndex) + `@${user.full_name} ` + val.substring(textarea.selectionStart)
    setNewComment(newVal)
    setShowMentions(false)
    setMentionSearch('')
    textarea.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent, content: string, parentId?: string) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      addComment.mutate({ content, parentId })
    }
    if (e.key === '@') {
      setShowMentions(true)
      setMentionSearch('')
    }
  }

  function handleInputChange(val: string) {
    setNewComment(val)
    const atIndex = val.lastIndexOf('@')
    if (atIndex !== -1 && atIndex === val.length - 1) {
      setShowMentions(true)
      setMentionSearch('')
    } else if (atIndex !== -1 && val.slice(atIndex + 1).match(/^\w+$/)) {
      setShowMentions(true)
      setMentionSearch(val.slice(atIndex + 1))
    } else {
      setShowMentions(false)
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString()
  }

  function renderContent(content: string) {
    // Highlight @mentions
    return content.replace(/@(\w[\w\s]*)/g, (match) => {
      return `<span style="color:#3b82f6;font-weight:600;">${match}</span>`
    })
  }

  const filteredMentions = hrUsers.filter((u: any) =>
    u.full_name.toLowerCase().includes(mentionSearch.toLowerCase()) &&
    u.user_id !== profile?.user_id
  )

  const CommentCard = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => {
    const isOwn = comment.author_id === profile?.user_id
    const replies = getReplies(comment.id)
    const [showReplyInput, setShowReplyInput] = useState(false)
    const [replyContent, setReplyContent] = useState('')

    return (
      <div style={{ marginLeft: isReply ? '2.5rem' : 0, marginBottom: isReply ? '0.5rem' : '1rem' }}>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          {/* Avatar */}
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isOwn ? 'var(--blue-500)' : '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: '700', color: 'white', flexShrink: 0 }}>
            {comment.author?.full_name?.[0]?.toUpperCase() || 'H'}
          </div>

          {/* Comment bubble */}
          <div style={{ flex: 1 }}>
            <div style={{ background: isOwn ? 'rgba(37,99,235,0.08)' : 'var(--navy-700)', border: `1px solid ${isOwn ? 'rgba(37,99,235,0.2)' : 'var(--border)'}`, borderRadius: isReply ? '0 10px 10px 10px' : '10px', padding: '0.75rem 0.875rem' }}>
              {/* Author + time */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{comment.author?.full_name || 'HR Team'}</span>
                  {comment.author?.job_title && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comment.author.job_title}</span>
                  )}
                  {isOwn && <span style={{ fontSize: '0.7rem', background: 'rgba(37,99,235,0.15)', color: 'var(--blue-400)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>You</span>}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatTime(comment.created_at)}
                  {comment.updated_at !== comment.created_at && ' (edited)'}
                </span>
              </div>

              {/* Content */}
              {editingId === comment.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="input"
                    style={{ minHeight: '60px', fontSize: '0.875rem', marginBottom: '0.5rem' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => editComment.mutate({ id: comment.id, content: editContent })}>
                      Save
                    </button>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}
                  dangerouslySetInnerHTML={{ __html: renderContent(comment.content) }} />
              )}
            </div>

            {/* Actions */}
            {editingId !== comment.id && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                {!isReply && (
                  <button onClick={() => setShowReplyInput(!showReplyInput)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.375rem', borderRadius: '4px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-700)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <Reply size={12} /> Reply {replies.length > 0 && `(${replies.length})`}
                  </button>
                )}
                {isOwn && (
                  <>
                    <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.375rem', borderRadius: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-700)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <Edit size={12} /> Edit
                    </button>
                    <button onClick={() => { if (confirm('Delete this comment?')) deleteComment.mutate(comment.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.375rem', borderRadius: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Reply input */}
            {showReplyInput && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                  {profile?.full_name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <textarea
                    ref={replyRef}
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        addComment.mutate({ content: replyContent, parentId: comment.id })
                        setReplyContent('')
                        setShowReplyInput(false)
                      }
                    }}
                    placeholder={`Reply to ${comment.author?.full_name}... (Ctrl+Enter to send)`}
                    className="input"
                    style={{ minHeight: '60px', fontSize: '0.875rem', resize: 'none' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                    <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => { addComment.mutate({ content: replyContent, parentId: comment.id }); setReplyContent(''); setShowReplyInput(false) }}
                      disabled={!replyContent.trim()}>
                      <Send size={12} /> Reply
                    </button>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => { setShowReplyInput(false); setReplyContent('') }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Replies */}
            {replies.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                {replies.map((reply: any) => (
                  <CommentCard key={reply.id} comment={reply} isReply={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Comments list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}><span className="spinner" /></div>
      ) : topLevelComments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', background: 'var(--navy-900)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          No comments yet. Start the discussion!
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          {topLevelComments.map((comment: any) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* New comment input */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: '700', color: 'white', flexShrink: 0, marginTop: '0.25rem' }}>
          {profile?.full_name?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => handleKeyDown(e, newComment)}
            placeholder="Add a comment... Use @ to mention a colleague (Ctrl+Enter to send)"
            className="input"
            style={{ minHeight: '80px', fontSize: '0.875rem', resize: 'none', paddingRight: '2.5rem' }}
          />

          {/* @ mention button */}
          <button onClick={() => { setNewComment(prev => prev + '@'); inputRef.current?.focus(); setShowMentions(true) }}
            style={{ position: 'absolute', right: '0.5rem', top: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
            title="Mention someone">
            <AtSign size={16} />
          </button>

          {/* Mention dropdown */}
          {showMentions && filteredMentions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 100, maxHeight: '180px', overflowY: 'auto' }}>
              {filteredMentions.map((user: any) => (
                <div key={user.user_id} onClick={() => handleMention(user)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-700)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'white' }}>
                    {user.full_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{user.full_name}</div>
                    {user.job_title && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.job_title}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ctrl+Enter to send · @ to mention</span>
            <button className="btn-primary" onClick={() => addComment.mutate({ content: newComment })}
              disabled={!newComment.trim() || addComment.isPending}
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {addComment.isPending ? <span className="spinner" /> : <><Send size={14} /> Comment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
