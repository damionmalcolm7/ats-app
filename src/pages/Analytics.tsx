import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { FileText, Download, Filter, Search } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4']
const tooltipStyle = { background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8125rem' }

const STATUS_OPTIONS = ['all', 'applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected']
const PARISHES = ['all', 'Clarendon', 'Hanover', 'Kingston', 'Manchester', 'Portland', 'St. Andrew', 'St. Ann', 'St. Catherine', 'St. Elizabeth', 'St. James', 'St. Mary', 'St. Thomas', 'Trelawny', 'Westmoreland']
const JOB_TYPES = ['all', 'full-time', 'part-time', 'contract', 'internship', 'remote', 'temporary']

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard')
  const [filters, setFilters] = useState({ status: 'all', location: 'all', employment_type: 'all', department: '', search: '' })

  const { data: reportData = [], isLoading: reportLoading } = useQuery({
    queryKey: ['report-data', filters],
    queryFn: async () => {
      let query = supabase
        .from('applications')
        .select(`
          id, status, match_score, created_at, updated_at,
          job:jobs(title, department, location, employment_type),
          applicant_details(full_name, email, phone, years_experience)
        `)
        .order('created_at', { ascending: false })

      if (filters.status !== 'all') query = query.eq('status', filters.status)

      const { data, error } = await query
      if (error) throw error

      // Apply client-side filters
      let results = (data || []) as any[]
      if (filters.location !== 'all') results = results.filter(r => r.job?.location === filters.location)
      if (filters.employment_type !== 'all') results = results.filter(r => r.job?.employment_type === filters.employment_type)
      if (filters.department) results = results.filter(r => r.job?.department?.toLowerCase().includes(filters.department.toLowerCase()))
      if (filters.search) results = results.filter(r =>
        r.applicant_details?.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.job?.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.applicant_details?.email?.toLowerCase().includes(filters.search.toLowerCase())
      )

      return results
    },
    enabled: activeTab === 'reports'
  })

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const [apps, jobs, interviews] = await Promise.all([
        supabase.from('applications').select('status, created_at, match_score'),
        supabase.from('jobs').select('status, department, created_at'),
        supabase.from('interviews').select('format, status, scheduled_at'),
      ])

      const applications = apps.data || []
      const allJobs = jobs.data || []

      const stages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected']
      const funnelData = stages.map(s => ({ stage: s.charAt(0).toUpperCase() + s.slice(1), count: applications.filter(a => a.status === s).length }))

      const deptMap: Record<string, number> = {}
      allJobs.forEach(j => { deptMap[j.department] = (deptMap[j.department] || 0) + 1 })
      const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }))

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

      const ivMap: Record<string, number> = {}
      ;(interviews.data || []).forEach(iv => { ivMap[iv.format] = (ivMap[iv.format] || 0) + 1 })
      const ivData = Object.entries(ivMap).map(([name, value]) => ({ name, value }))

      const totalApps = applications.length
      const hired = applications.filter(a => a.status === 'hired').length
      const offers = applications.filter(a => a.status === 'offer' || a.status === 'hired').length
      const avgMatchScore = applications.filter(a => a.match_score != null).reduce((s, a) => s + (a.match_score || 0), 0) / (applications.filter(a => a.match_score != null).length || 1)

      return { funnelData, deptData, monthlyData, ivData, totalApps, hired, offers, avgMatchScore: Math.round(avgMatchScore), activeJobs: allJobs.filter(j => j.status === 'active').length }
    },
    enabled: activeTab === 'dashboard'
  })

  // Export to CSV/Excel
  function exportCSV() {
    const headers = ['Applicant Name', 'Email', 'Phone', 'Job Title', 'Department', 'Location', 'Job Type', 'Status', 'Match Score', 'Applied Date']
    const rows = reportData.map(r => [
      r.applicant_details?.full_name || '',
      r.applicant_details?.email || '',
      r.applicant_details?.phone || '',
      r.job?.title || '',
      r.job?.department || '',
      r.job?.location || '',
      r.job?.employment_type || '',
      r.status || '',
      r.match_score != null ? `${r.match_score}%` : '',
      new Date(r.created_at).toLocaleDateString()
    ])

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `NHT_Applicant_Report_${new Date().toLocaleDateString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export to PDF
  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' })

    // Header
    doc.setFillColor(27, 58, 107)
    doc.rect(0, 0, 297, 25, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('National Housing Trust', 14, 10)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Applicant Report', 14, 18)

    // Report info
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)
    doc.text(`Total Records: ${reportData.length}`, 14, 38)

    // Active filters
    const activeFilters = []
    if (filters.status !== 'all') activeFilters.push(`Status: ${filters.status}`)
    if (filters.location !== 'all') activeFilters.push(`Location: ${filters.location}`)
    if (filters.employment_type !== 'all') activeFilters.push(`Type: ${filters.employment_type}`)
    if (filters.department) activeFilters.push(`Department: ${filters.department}`)
    if (activeFilters.length > 0) doc.text(`Filters: ${activeFilters.join(' | ')}`, 14, 44)

    // Table
    autoTable(doc, {
      startY: activeFilters.length > 0 ? 50 : 44,
      head: [['Applicant Name', 'Email', 'Job Title', 'Department', 'Location', 'Type', 'Status', 'Match Score', 'Applied Date']],
      body: reportData.map(r => [
        r.applicant_details?.full_name || '—',
        r.applicant_details?.email || '—',
        r.job?.title || '—',
        r.job?.department || '—',
        r.job?.location || '—',
        r.job?.employment_type || '—',
        (r.status || '—').charAt(0).toUpperCase() + (r.status || '').slice(1),
        r.match_score != null ? `${r.match_score}%` : '—',
        new Date(r.created_at).toLocaleDateString()
      ]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 20 },
        8: { cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' })
        doc.text('© National Housing Trust — Confidential', 14, doc.internal.pageSize.height - 8)
      }
    })

    doc.save(`NHT_Applicant_Report_${new Date().toLocaleDateString()}.pdf`)
  }

  const kpis = [
    { label: 'Total Applications', value: analytics?.totalApps || 0 },
    { label: 'Active Jobs', value: analytics?.activeJobs || 0 },
    { label: 'Hired', value: analytics?.hired || 0 },
    { label: 'Offers Extended', value: analytics?.offers || 0 },
    { label: 'Avg Match Score', value: `${analytics?.avgMatchScore || 0}%` },
    { label: 'Offer Accept Rate', value: analytics?.offers ? `${Math.round((analytics.hired / analytics.offers) * 100)}%` : '0%' },
  ]

  const statusBadge: Record<string, string> = {
    applied: '#2563eb', screening: '#f59e0b', interview: '#8b5cf6',
    assessment: '#f59e0b', offer: '#10b981', hired: '#10b981', rejected: '#ef4444'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Analytics & Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Hiring performance and applicant reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--navy-900)', borderRadius: '10px', padding: '0.25rem', width: 'fit-content' }}>
        {[{ id: 'dashboard', label: '📊 Dashboard' }, { id: 'reports', label: '📋 Reports' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', background: activeTab === t.id ? 'var(--blue-500)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {kpis.map(k => (
                  <div key={k.label} className="card" style={{ padding: '1.125rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                    <div style={{ fontSize: '1.875rem', fontWeight: '700' }}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Applications Over Time</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analytics?.monthlyData || []}>
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
                    <BarChart data={analytics?.funnelData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Jobs by Department</h3>
                  {analytics?.deptData && analytics.deptData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={analytics.deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {analytics.deptData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No data yet</div>}
                </div>
                <div className="card">
                  <h3 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Interview Formats</h3>
                  {analytics?.ivData && analytics.ivData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={analytics.ivData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {analytics.ivData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No interviews yet</div>}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <span style={{ fontWeight: '600', fontSize: '0.9375rem' }}>Filter Report</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" placeholder="Search applicant or job..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} style={{ paddingLeft: '2.25rem' }} />
              </div>
              {/* Status */}
              <select className="input" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              {/* Location */}
              <select className="input" value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })}>
                {PARISHES.map(p => <option key={p} value={p}>{p === 'all' ? 'All Locations' : p}</option>)}
              </select>
              {/* Job Type */}
              <select className="input" value={filters.employment_type} onChange={e => setFilters({ ...filters, employment_type: e.target.value })}>
                {JOB_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Job Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              {/* Department */}
              <input className="input" placeholder="Department..." value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} />
            </div>
          </div>

          {/* Export buttons + record count */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {reportLoading ? 'Loading...' : `${reportData.length} record${reportData.length !== 1 ? 's' : ''} found`}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={exportCSV} disabled={reportData.length === 0}>
                <Download size={15} /> Export Excel (CSV)
              </button>
              <button className="btn-primary" onClick={exportPDF} disabled={reportData.length === 0}>
                <FileText size={15} /> Export PDF
              </button>
            </div>
          </div>

          {/* Report Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {reportLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><span className="spinner" /></div>
            ) : reportData.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found matching your filters.</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Contact</th>
                      <th>Job Title</th>
                      <th>Department</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Match Score</th>
                      <th>Applied Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: '500' }}>{r.applicant_details?.full_name || '—'}</td>
                        <td>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{r.applicant_details?.email || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.applicant_details?.phone || ''}</div>
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>{r.job?.title || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{r.job?.department || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{r.job?.location || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'capitalize' }}>{r.job?.employment_type || '—'}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500', background: `${statusBadge[r.status]}22`, color: statusBadge[r.status], textTransform: 'capitalize' }}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.match_score != null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '50px', height: '6px', background: 'var(--navy-700)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${r.match_score}%`, height: '100%', background: r.match_score >= 70 ? '#10b981' : '#f59e0b', borderRadius: '3px' }} />
                              </div>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{r.match_score}%</span>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
