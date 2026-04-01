import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { Bell, X, Check, Trash2, CheckCheck } from 'lucide-react'

const TYPE_ICONS: Record<string, string> = {
  new_application: '📋',
  interview_scheduled: '📅',
  document_uploaded: '📄',
  review_submitted: '⭐',
  status_changed: '🔄',
  sla_alert: '⚠️'
}

const TYPE_COLORS: Record<string, string> = {
  new_application: '#2563eb',
  interview_scheduled: '#8b5cf6',
  document_uploaded: '#f59e0b',
  review_submitted: '#10b981',
  status_changed: '#06b6d4',
  sla_alert: '#ef4444'
}

export default function NotificationsPanel() {
  const { profile } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', profile?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile?.user_id)
        .order('created_at', { ascending: false })
        .limit(50)
      return data || []
    },
    enabled: !!profile?.user_id,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const unreadCount = notifications.filter((n: any) => !n.read).length

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', profile?.user_id] })
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', profile?.user_id).eq('read', false)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', profile?.user_id] })
  })

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', profile?.user_id] })
  })

  const clearAll = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').delete().eq('user_id', profile?.user_id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', profile?.user_id] })
  })

  function handleNotificationClick(notification: any) {
    if (!notification.read) markRead.mutate(notification.id)
    if (notification.link) {
      navigate(notification.link)
      setOpen(false)
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

  return (
    <div ref={panelRef} style={{ position: 'relative' }} className="tooltip-wrapper">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        style={{ position: 'relative', background: open ? 'var(--navy-700)' : 'none', border: 'none', cursor: 'pointer', color: open ? 'var(--blue-400)' : theme === 'light' ? '#1e293b' : 'var(--text-secondary)', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', transition: 'all 0.2s' }}>
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', borderRadius: '9999px', fontSize: '0.625rem', fontWeight: '700', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {!open && <span className="tooltip">Notifications</span>}

      {/* Panel */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '380px', maxHeight: '520px', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontWeight: '600', fontSize: '1rem' }}>Notifications</h3>
              {unreadCount > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', padding: '0.1rem 0.5rem' }}>{unreadCount}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {unreadCount > 0 && (
                <button onClick={() => markAllRead.mutate()} title="Mark all as read"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={() => { if (confirm('Clear all notifications?')) clearAll.mutate() }} title="Clear all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '6px' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Notifications list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '3rem 1.25rem', textAlign: 'center' }}>
                <Bell size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No notifications yet</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>You'll be notified when something needs your attention</p>
              </div>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id}
                  style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'rgba(37,99,235,0.04)', cursor: n.link ? 'pointer' : 'default', transition: 'background 0.15s' }}
                  onClick={() => handleNotificationClick(n)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--navy-700)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(37,99,235,0.04)' }}>

                  {/* Icon */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${TYPE_COLORS[n.type]}20`, border: `1px solid ${TYPE_COLORS[n.type]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                    {TYPE_ICONS[n.type] || '🔔'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ fontWeight: n.read ? '400' : '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{n.title}</div>
                      {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: '4px' }} />}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem', lineHeight: 1.5 }}>{n.message}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{formatTime(n.created_at)}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                    {!n.read && (
                      <button onClick={e => { e.stopPropagation(); markRead.mutate(n.id) }}
                        title="Mark as read"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', padding: '0.125rem' }}>
                        <Check size={13} />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); deleteNotification.mutate(n.id) }}
                      title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.125rem' }}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
