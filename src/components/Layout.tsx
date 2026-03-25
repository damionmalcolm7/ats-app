import { ReactNode, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Briefcase, Users, GitBranch,
  Calendar, Mail, BarChart2, Globe, Settings,
  Bell, ChevronDown, LogOut, User, Menu, X
} from 'lucide-react'

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
    await signOut()
    navigate('/login')
  }

  return (
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
            <img src={settings.company_logo} alt="Company Logo" style={{ maxHeight: '44px', maxWidth: '180px', objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ width: '36px', height: '36px', background: 'var(--blue-500)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.2 }}>{settings?.company_name || 'ATS Platform'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recruitment System</div>
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
            {/* Notifications */}
            <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.5rem' }}>
              <Bell size={20} />
            </button>

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
  )
}
