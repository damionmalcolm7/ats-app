import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Briefcase, ArrowLeft } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .single()

      if (profile?.role === 'applicant') navigate('/portal')
      else navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setForgotSent(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email')
    } finally {
      setForgotLoading(false)
    }
  }

  const logoSection = (
    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
      <div style={{ width: '56px', height: '56px', background: 'var(--blue-500)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
        <Briefcase size={28} color="white" />
      </div>
    </div>
  )

  // Forgot password view
  if (showForgot) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-950)', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {logoSection}
          <div className="card" style={{ padding: '2rem' }}>
            {!forgotSent ? (
              <>
                <button onClick={() => setShowForgot(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', marginBottom: '1.25rem', padding: 0 }}>
                  <ArrowLeft size={15} /> Back to login
                </button>
                <h1 style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.5rem' }}>Reset Password</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label className="label">Email Address</label>
                    <input
                      className="input"
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={forgotLoading} style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
                    {forgotLoading ? <span className="spinner" /> : 'Send Reset Link'}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem' }}>Check your email!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  We sent a password reset link to <strong>{forgotEmail}</strong>. Click the link in the email to set a new password.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                  Didn't receive it? Check your spam folder or try again.
                </p>
                <button className="btn-secondary" onClick={() => { setForgotSent(false); setForgotEmail('') }} style={{ marginRight: '0.75rem' }}>
                  Try Again
                </button>
                <button className="btn-primary" onClick={() => setShowForgot(false)}>
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main login view
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-950)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {logoSection}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Sign in to your account</p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="label">Email Address</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="label">
                <span>Password</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(email) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-400)', fontSize: '0.8125rem', padding: 0 }}>
                Forgot password?
              </button>
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--blue-400)', textDecoration: 'none' }}>Sign up</Link>
          </p>
          <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Looking for jobs?{' '}
            <Link to="/jobs" style={{ color: 'var(--blue-400)', textDecoration: 'none' }}>View job board</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
