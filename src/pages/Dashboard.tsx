import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Briefcase, Users, Calendar, Send, Clock, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { useState, useEffect } from 'react'

export default function Dashboard() {
  const { profile } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [jobs, applications, interviews] = await Promise.all([
        supabase.from('jobs').select('status', { count: 'exact' }),
        supabase.from('applications').select('status', { count: 'exact' }),
        supabase.from('interviews').select('status', { count: 'exact' }).eq('status', 'scheduled')
      ])
      const activeJobs = jobs.data?.filter(j => j.status === 'active').length || 0
      const totalApplicants = applications.count || 0
      const scheduledInterviews = interviews.count || 0
      const offers = applications.data?.filter(a => a.status === 'offer' || a.status === 'hired').length || 0

      // Pipeline funnel data
      const stages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired']
      const funnelData = stages.map(stage => ({
        stage: stage.charAt(0).toUpperCase() + stage.slice(1),
        count: applications.data?.filter(a => a.status === stage).length || 0
      }))

      return { activeJobs, totalApplicants, scheduledInterviews, offers, funnelData }
    }
  })

  const statCards = [
    { label: 'Active Jobs', value: stats?.activeJobs || 0, icon: Briefcase, color: '#2563eb' },
    { label: 'Total Applicants', value: stats?.totalApplicants || 0, icon: Users, color: '#10b981' },
    { label: 'Interviews', value: stats?.scheduledInterviews || 0, icon: Calendar, color: '#f59e0b' },
    { label: 'Offers Sent', value: stats?.offers || 0, icon: Send, color: '#8b5cf6' },
  ]

  const tooltipStyle = { background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }

const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedDate = now.toLocaleDateString('en-JM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formattedTime = now.toLocaleTimeString('en-JM', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Welcome back, {profile?.full_name}. Here's your hiring overview.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.625rem 1rem' }}>
          <Clock size={20} color="var(--blue-400)" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '0.03em' }}>{formattedTime}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formattedDate}</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '500' }}>{label}</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1.25rem' }}>Hiring Funnel</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats?.funnelData || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="stage" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(37,99,235,0.05)' }} />
              <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1.25rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { label: 'Post a new job', desc: 'Create a new job listing', path: '/dashboard/jobs', color: '#2563eb' },
              { label: 'View applicants', desc: 'Review recent applications', path: '/dashboard/applicants', color: '#10b981' },
              { label: 'Schedule interview', desc: 'Book an interview slot', path: '/dashboard/interviews', color: '#f59e0b' },
              { label: 'Email templates', desc: 'Manage email templates', path: '/dashboard/email-templates', color: '#8b5cf6' },
            ].map(item => (
              <a key={item.label} href={item.path}
                style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--navy-700)', textDecoration: 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-600)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy-700)')}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
