import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'

const COLORS = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4']
const tooltipStyle = { background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8125rem' }

export default function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const [apps, jobs, interviews] = await Promise.all([
        supabase.from('applications').select('status, created_at, match_score'),
        supabase.from('jobs').select('status, department, created_at'),
        supabase.from('interviews').select('format, status, scheduled_at'),
      ])

      const applications = apps.data || []
      const allJobs = jobs.data || []

      // Pipeline funnel
      const stages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected']
      const funnelData = stages.map(s => ({ stage: s.charAt(0).toUpperCase() + s.slice(1), count: applications.filter(a => a.status === s).length }))

      // Jobs by department
      const deptMap: Record<string, number> = {}
      allJobs.forEach(j => { deptMap[j.department] = (deptMap[j.department] || 0) + 1 })
      const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }))

      // Applications over last 6 months
      const now = new Date()
      const monthlyData = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        const label = d.toLocaleString('default', { month: 'short' })
        const count = applications.filter(a => {
          const ad = new Date(a.created_at)
          return ad.getMonth() === d.getMonth() && ad.getFullYear() === d.getFullYear()
        }).length
        return { month: label, applications: count }
      })

      // Interview formats
      const ivMap: Record<string, number> = {}
      ;(interviews.data || []).forEach(iv => { ivMap[iv.format] = (ivMap[iv.format] || 0) + 1 })
      const ivData = Object.entries(ivMap).map(([name, value]) => ({ name, value }))

      // KPIs
      const totalApps = applications.length
      const hired = applications.filter(a => a.status === 'hired').length
      const offers = applications.filter(a => a.status === 'offer' || a.status === 'hired').length
      const avgMatchScore = applications.filter(a => a.match_score != null).reduce((s, a) => s + (a.match_score || 0), 0) / (applications.filter(a => a.match_score != null).length || 1)

      return { funnelData, deptData, monthlyData, ivData, totalApps, hired, offers, avgMatchScore: Math.round(avgMatchScore), activeJobs: allJobs.filter(j => j.status === 'active').length }
    }
  })

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center' }}><span className="spinner" /></div>

  const kpis = [
    { label: 'Total Applications', value: data?.totalApps || 0 },
    { label: 'Active Jobs', value: data?.activeJobs || 0 },
    { label: 'Hired', value: data?.hired || 0 },
    { label: 'Offers Extended', value: data?.offers || 0 },
    { label: 'Avg Match Score', value: `${data?.avgMatchScore || 0}%` },
    { label: 'Offer Accept Rate', value: data?.offers ? `${Math.round((data.hired / data.offers) * 100)}%` : '0%' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Hiring performance overview</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '1.125rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
            <div style={{ fontSize: '1.875rem', fontWeight: '700' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Applications Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.monthlyData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="applications" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Hiring Pipeline</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.funnelData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Jobs by Department</h3>
          {data?.deptData && data.deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {data.deptData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No data yet</div>}
        </div>

        <div className="card">
          <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Interview Formats</h3>
          {data?.ivData && data.ivData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.ivData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.ivData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No interviews yet</div>}
        </div>
      </div>
    </div>
  )
}
