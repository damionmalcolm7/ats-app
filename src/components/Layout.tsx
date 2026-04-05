import { ReactNode, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import {
  LayoutDashboard, Briefcase, Users, GitBranch,
  Calendar, Mail, BarChart2, Globe, Settings,
  ChevronDown, LogOut, User, Menu, X, Sun, Moon
} from 'lucide-react'
import NotificationsPanel from './NotificationsPanel'
import { createAuditLog } from '../lib/audit'
import SessionTimeout from './SessionTimeout'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Briefcase, label: 'Jobs', path: '/dashboard/jobs' },
  { icon: Users, label: 'Applicants', path: '/dashboard/applicants' },
  { icon: GitBranch, label: 'Pipeline', path: '/dashboard/pipeline' },
  { icon: Calendar, label: 'Interviews', path: '/dashboard/interviews' },
  { icon: Mail, label: 'Email Templates', path: '/dashboard/email-templates' },
  { icon: BarChart2, label: 'Analytics', path: '/dashboard/analytics' },
  { icon: Globe, label: 'Job Board', path: '/jobs' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const DARK_LOGO = 'https://ljgjgaojkihpaykfewpa.supabase.co/storage/v1/object/public/avatars/nht-logo-white.png'
  const LIGHT_LOGO = 'https://ljgjgaojkihpaykfewpa.supabase.co/storage/v1/object/public/avatars/Logo%20Text%20and%20Slogan%20to%20left.png'

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data
    }
  })
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    if (profile) {
      await createAuditLog({
        user_id: profile.user_id,
        user_name: profile.full_name || 'Unknown',
        user_role: profile.role || 'unknown',
        action: 'SIGN_OUT'
      })
    }
    await signOut()
    navigate('/login')
  }

  return (
    <>
    <SessionTimeout />
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy-950)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40, display: 'none' }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '240px', background: 'var(--navy-900)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30
      }}>
        {/* Logo */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '64px' }}>
          {settings?.company_logo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <img src={theme === 'light' ? LIGHT_LOGO : settings.company_logo} alt="Company Logo" style={{ maxHeight: '36px', maxWidth: '160px', objectFit: 'contain' }} />
              <div style={{ fontSize: '0.72rem', color: 'var(--blue-400)', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Talent Hub</div>
            </div>
          ) : (
            <>
              <div style={{ width: '36px', height: '36px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.2 }}>{settings?.company_name || 'ATS Platform'}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--blue-400)', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Talent Hub</div>
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem 0.625rem', overflowY: 'auto' }}>
          {navItems.map(({ icon: Icon, label, path }) => (
            <div key={path} className={`sidebar-link ${location.pathname === path ? 'active' : ''}`}
              onClick={() => navigate(path)}>
              <Icon size={18} />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        {/* Settings */}
        <div style={{ padding: '0.75rem 0.625rem', borderTop: '1px solid var(--border)' }}>
          <div className={`sidebar-link ${location.pathname === '/dashboard/settings' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/settings')}>
            <Settings size={18} />
            <span>Settings</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          height: '60px', background: 'var(--navy-900)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 20
        }}>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <input className="input" placeholder="Search jobs, applicants..." style={{ background: 'var(--navy-800)', height: '36px', fontSize: '0.8125rem' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme toggle */}
            <div style={{ position: 'relative' }} className="tooltip-wrapper">
              <button onClick={toggleTheme}
                style={{ background: 'none', border: theme === 'light' ? '1.5px solid #32438c' : 'none', borderRadius: '8px', cursor: 'pointer', color: theme === 'light' ? '#32438c' : 'var(--text-secondary)', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {theme === 'dark' ? <Sun size={18} color='var(--text-secondary)' fill='none' /> : <Moon size={18} color='#32438c' fill='none' />}
              </button>
              <span className="tooltip">{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
            </div>

            <NotificationsPanel />

            {/* User menu */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '600' }}>
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: '500' }}>{profile?.full_name || 'User'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ')}</div>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" />
              </button>

              {userMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '10px', minWidth: '160px', overflow: 'hidden', zIndex: 100 }}>
                  <div onClick={() => { navigate('/dashboard/profile'); setUserMenuOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-700)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <User size={15} /> Profile
                  </div>
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <div onClick={handleSignOut}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', color: '#ef4444' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-700)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <LogOut size={15} /> Sign Out
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
    </>
  )
}
