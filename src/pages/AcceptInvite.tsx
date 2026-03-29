import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', password: '', confirm_password: '' })
  const [done, setDone] = useState(false)

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_invites')
        .select('*')
        .eq('token', token)
        .eq('accepted', false)
        .single()
      if (error) throw new Error('This invite is invalid or has already been used.')
      if (new Date(data.expires_at) < new Date()) throw new Error('This invite has expired. Please ask your admin to send a new one.')
      return data
    }
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error('Please enter your full name')
      if (form.password.length < 8) throw new Error('Password must be at least 8 characters')
      if (form.password !== form.confirm_password) throw new Error('Passwords do not match')

      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password: form.password,
        options: { data: { full_name: form.full_name, role: invite.role } }
      })
      if (signUpError) throw signUpError

      const userId = authData.user?.id
      if (!userId) throw new Error('Failed to create account')

      // Set profile with correct role
      await supabase.from('profiles').upsert({
        user_id: userId,
        full_name: form.full_name,
        email: invite.email,
        role: invite.role
      }, { onConflict: 'user_id' })

      // Mark invite as accepted
      await supabase.from('hr_invites').update({ accepted: true }).eq('id', invite.id)
    },
    onSuccess: () => {
      setDone(true)
      toast.success('Account created successfully!')
    },
    onError: (err: any) => toast.error(err.message)
  })

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" />
    </div>
  )

  if (error || !invite) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '420px', textAlign: 'center', padding: '2.5rem' }}>
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem', display: 'block' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem' }}>Invalid Invite</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {(error as any)?.message || 'This invite link is invalid or has already been used.'}
        </p>
        <button className="btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '420px', textAlign: 'center', padding: '2.5rem' }}>
        <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem', display: 'block' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem' }}>Account Created!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Your account has been set up successfully. You can now log in to the HR dashboard.
        </p>
        <button className="btn-primary" onClick={() => navigate('/login')} style={{ width: '100%', justifyContent: 'center' }}>
          Go to Login
        </button>
      </div>
    </div>
  )

  const roleLabel = invite.role === 'super_admin' ? 'Super Admin' : 'HR Staff'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37,99,235,0.15)', border: '2px solid rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CheckCircle size={28} color="#3b82f6" />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.375rem' }}>You're Invited!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Set up your <strong style={{ color: 'var(--blue-400)' }}>{roleLabel}</strong> account for <strong style={{ color: 'var(--text-secondary)' }}>{invite.email}</strong>
          </p>
        </div>

        <div className="form-group">
          <label className="label">Full Name *</label>
          <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" autoFocus />
        </div>

        <div className="form-group">
          <label className="label">Email</label>
          <input className="input" value={invite.email} disabled style={{ opacity: 0.6 }} />
        </div>

        <div className="form-group">
          <label className="label">Password *</label>
          <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" />
        </div>

        <div className="form-group">
          <label className="label">Confirm Password *</label>
          <input className="input" type="password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })}
            placeholder="Repeat your password"
            onKeyDown={e => e.key === 'Enter' && acceptMutation.mutate()} />
        </div>

        <button className="btn-primary" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || !form.full_name || !form.password}
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }}>
          {acceptMutation.isPending ? <><span className="spinner" /> Setting up account...</> : 'Create My Account'}
        </button>
      </div>
    </div>
  )
}
