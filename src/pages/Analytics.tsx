import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { FileText, Download, Filter, Search } from 'lucide-react'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'

const COLORS = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4']
const tooltipStyle = { background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8125rem' }
const STATUS_OPTIONS = ['all', 'applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected']
const PARISHES = ['all', 'Clarendon', 'Hanover', 'Kingston', 'Manchester', 'Portland', 'St. Andrew', 'St. Ann', 'St. Catherine', 'St. Elizabeth', 'St. James', 'St. Mary', 'St. Thomas', 'Trelawny', 'Westmoreland']
const JOB_TYPES = ['all', 'full-time', 'part-time', 'contract', 'internship', 'remote', 'temporary']

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard')
  const [filters, setFilters] = useState({ status: 'all', location: 'all', employment_type: 'all', department: '', search: '' })
  const [exporting, setExporting] = useState(false)
  const chartsRef = useRef<HTMLDivElement>(null)

  const { data: reportData = [], isLoading: reportLoading } = useQuery({
    queryKey: ['report-data', filters],
    queryFn: async () => {
      let query = supabase
        .from('applications')
        .select(`id, status, match_score, created_at, updated_at, job:jobs(title, department, location, employment_type), applicant_details(full_name, email, phone, years_experience)`)
        .order('created_at', { ascending: false })
      if (filters.status !== 'all') query = query.eq('status', filters.status)
      const { data, error } = await query
      if (error) throw error
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
        supabase.from('applications').select('status, created_at, match_score, source'),
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
        return { month: d.toLocaleString('default', { month: 'short' }), applications: applications.filter(a => { const ad = new Date(a.created_at); return ad.getMonth() === d.getMonth() && ad.getFullYear() === d.getFullYear() }).length }
      })
      const ivMap: Record<string, number> = {}
      ;(interviews.data || []).forEach(iv => { ivMap[iv.format] = (ivMap[iv.format] || 0) + 1 })
      const ivData = Object.entries(ivMap).map(([name, value]) => ({ name, value }))

      // Source tracking
      const sourceMap: Record<string, number> = {}
      applications.forEach(a => {
        const src = (a as any).source || 'Direct'
        sourceMap[src] = (sourceMap[src] || 0) + 1
      })
      const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
      const totalApps = applications.length
      const hired = applications.filter(a => a.status === 'hired').length
      const offers = applications.filter(a => a.status === 'offer' || a.status === 'hired').length
      const avgMatchScore = applications.filter(a => a.match_score != null).reduce((s, a) => s + (a.match_score || 0), 0) / (applications.filter(a => a.match_score != null).length || 1)
      return { funnelData, deptData, monthlyData, ivData, sourceData, totalApps, hired, offers, avgMatchScore: Math.round(avgMatchScore), activeJobs: allJobs.filter(j => j.status === 'active').length }
    }
  })

  function exportCSV() {
    const headers = ['Applicant Name', 'Email', 'Phone', 'Job Title', 'Department', 'Location', 'Job Type', 'Status', 'Match Score', 'Source', 'Applied Date']
    const rows = reportData.map(r => [
      r.applicant_details?.full_name || '', r.applicant_details?.email || '', r.applicant_details?.phone || '',
      r.job?.title || '', r.job?.department || '', r.job?.location || '', r.job?.employment_type || '',
      r.status || '', r.match_score != null ? `${r.match_score}%` : '', new Date(r.created_at).toLocaleDateString()
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

  async function exportPDF() {
    setExporting(true)
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageW = doc.internal.pageSize.width
      const pageH = doc.internal.pageSize.height

      // ── PAGE 1: Cover + KPIs + Charts ──
      // Header banner
      doc.setFillColor(27, 58, 107)
      doc.rect(0, 0, pageW, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('National Housing Trust', 14, 13)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Recruitment Analytics & Applicant Report', 14, 22)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 14, 22, { align: 'right' })

      // KPI boxes
      const kpis = [
        { label: 'Total Applications', value: String(analytics?.totalApps || 0) },
        { label: 'Active Jobs', value: String(analytics?.activeJobs || 0) },
        { label: 'Hired', value: String(analytics?.hired || 0) },
        { label: 'Offers Extended', value: String(analytics?.offers || 0) },
        { label: 'Avg Match Score', value: `${analytics?.avgMatchScore || 0}%` },
        { label: 'Offer Accept Rate', value: analytics?.offers ? `${Math.round(((analytics?.hired || 0) / analytics.offers) * 100)}%` : '0%' },
      ]
      const boxW = (pageW - 28) / kpis.length
      kpis.forEach((kpi, i) => {
        const x = 14 + i * boxW
        doc.setFillColor(245, 247, 250)
        doc.roundedRect(x, 34, boxW - 2, 18, 2, 2, 'F')
        doc.setTextColor(100, 100, 100)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(kpi.label, x + (boxW - 2) / 2, 40, { align: 'center' })
        doc.setTextColor(27, 58, 107)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(kpi.value, x + (boxW - 2) / 2, 48, { align: 'center' })
      })

      // Capture charts as images
      if (chartsRef.current) {
        const canvas = await html2canvas(chartsRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false
        })
        const imgData = canvas.toDataURL('image/png')
        const imgH = (canvas.height / canvas.width) * (pageW - 28)
        doc.addImage(imgData, 'PNG', 14, 56, pageW - 28, imgH)
      }

      // ── PAGE 2: Data Table ──
      doc.addPage()

      // Page 2 header
      doc.setFillColor(27, 58, 107)
      doc.rect(0, 0, pageW, 18, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Applicant Data', 14, 12)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`${reportData.length} records`, pageW - 14, 12, { align: 'right' })

      // Active filters
      const activeFilters = []
      if (filters.status !== 'all') activeFilters.push(`Status: ${filters.status}`)
      if (filters.location !== 'all') activeFilters.push(`Location: ${filters.location}`)
      if (filters.employment_type !== 'all') activeFilters.push(`Type: ${filters.employment_type}`)
      if (filters.department) activeFilters.push(`Department: ${filters.department}`)

      let startY = 24
      if (activeFilters.length > 0) {
        doc.setTextColor(100, 100, 100)
        doc.setFontSize(8)
        doc.text(`Filters applied: ${activeFilters.join('  |  ')}`, 14, 24)
        startY = 30
      }

      (doc as any).autoTable({
        startY,
        head: [['Applicant Name', 'Email', 'Job Title', 'Department', 'Location', 'Type', 'Status', 'Match Score', 'Source', 'Applied Date']],
        body: reportData.map(r => [
          r.applicant_details?.full_name || '—',
          r.applicant_details?.email || '—',
          r.job?.title || '—',
          r.job?.department || '—',
          r.job?.location || '—',
          r.job?.employment_type || '—',
          (r.status || '—').charAt(0).toUpperCase() + (r.status || '').slice(1),
          r.match_score != null ? `${r.match_score}%` : '—',
          r.source || 'Direct',
          new Date(r.created_at).toLocaleDateString()
        ]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 32 }, 1: { cellWidth: 42 }, 2: { cellWidth: 32 },
          3: { cellWidth: 24 }, 4: { cellWidth: 24 }, 5: { cellWidth: 20 },
          6: { cellWidth: 20 }, 7: { cellWidth: 18 }, 8: { cellWidth: 23 },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          doc.setFontSize(7.5)
          doc.setTextColor(150, 150, 150)
          doc.text(`Page ${data.pageNumber}`, pageW / 2, pageH - 6, { align: 'center' })
          doc.text('© National Housing Trust — Confidential', 14, pageH - 6)
          doc.text(new Date().toLocaleDateString(), pageW - 14, pageH - 6, { align: 'right' })
        }
      })

      doc.save(`NHT_Report_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const kpis = [
    { label: 'Total Applications', value: analytics?.totalApps || 0 },
    { label: 'Active Jobs', value: analytics?.activeJobs || 0 },
    { label: 'Hired', value: analytics?.hired || 0 },
    { label: 'Offers Extended', value: analytics?.offers || 0 },
    { label: 'Avg Match Score', value: `${analytics?.avgMatchScore || 0}%` },
    { label: 'Offer Accept Rate', value: analytics?.offers ? `${Math.round(((analytics?.hired || 0) / analytics.offers) * 100)}%` : '0%' },
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
        {activeTab === 'dashboard' && (
          <button className="btn-primary" onClick={exportPDF} disabled={exporting}>
            {exporting ? <><span className="spinner" /> Generating PDF...</> : <><FileText size={15} /> Export Report with Charts (PDF)</>}
          </button>
        )}
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

              {/* Charts - captured for PDF export */}
              <div ref={chartsRef} style={{ background: 'white', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9375rem' }}>Applications Over Time</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analytics?.monthlyData || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} />
                        <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="applications" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9375rem' }}>Hiring Pipeline</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics?.funnelData || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                        <XAxis dataKey="stage" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} />
                        <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9375rem' }}>Jobs by Department</h3>
                    {analytics?.deptData && analytics.deptData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={analytics.deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                            {analytics.deptData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No data yet</div>}
                  </div>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9375rem' }}>Interview Formats</h3>
                    {analytics?.ivData && analytics.ivData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={analytics.ivData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                            {analytics.ivData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No interviews yet</div>}
                  </div>
                </div>

                {/* Source Tracking Chart */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9375rem' }}>Applications by Source</h3>
                    {analytics?.sourceData && analytics.sourceData.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {analytics.sourceData.map((s: any, i: number) => {
                          const total = analytics.sourceData.reduce((sum: number, x: any) => sum + x.value, 0)
                          const pct = Math.round((s.value / total) * 100)
                          return (
                            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '120px', fontSize: '0.8125rem', color: '#555', flexShrink: 0 }}>{s.name}</div>
                              <div style={{ flex: 1, height: '20px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#f97316','#14b8a6','#a855f7'][i % 10], borderRadius: '4px', transition: 'width 0.3s' }} />
                              </div>
                              <div style={{ width: '60px', fontSize: '0.8125rem', color: '#555', textAlign: 'right', flexShrink: 0 }}>{s.value} ({pct}%)</div>
                            </div>
                          )
                        })}
                      </div>
                    ) : <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No source data yet</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <>
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <span style={{ fontWeight: '600', fontSize: '0.9375rem' }}>Filter Report</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" placeholder="Search applicant or job..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} style={{ paddingLeft: '2.25rem' }} />
              </div>
              <select className="input" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select className="input" value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })}>
                {PARISHES.map(p => <option key={p} value={p}>{p === 'all' ? 'All Locations' : p}</option>)}
              </select>
              <select className="input" value={filters.employment_type} onChange={e => setFilters({ ...filters, employment_type: e.target.value })}>
                {JOB_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Job Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <input className="input" placeholder="Department..." value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {reportLoading ? 'Loading...' : `${reportData.length} record${reportData.length !== 1 ? 's' : ''} found`}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={exportCSV} disabled={reportData.length === 0}>
                <Download size={15} /> Export Excel (CSV)
              </button>
              <button className="btn-primary" onClick={exportPDF} disabled={reportData.length === 0 || exporting}>
                {exporting ? <><span className="spinner" /> Generating...</> : <><FileText size={15} /> Export Data Table (PDF)</>}
              </button>
            </div>
          </div>

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
                      <th>Source</th>
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
                        <td>
                          {r.source ? <span style={{ background: 'rgba(37,99,235,0.1)', color: '#3b82f6', borderRadius: '5px', padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>{r.source}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
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
