import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { createAuditLog } from '../lib/audit'
import { useAuth } from '../contexts/AuthContext'
import { sendEmail } from '../lib/email'
import toast from 'react-hot-toast'
import { Upload, Trash2, Mail, RefreshCw } from 'lucide-react'

export default function Settings() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [activeTab, setActiveTab] = useState('company')
  const [settings, setSettings] = useState<any>(null)
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    job_title: (profile as any)?.job_title || ''
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('hr')
  const [uploading, setUploading] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({ full_name: '', job_title: '' })

  const { data: savedSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data as any
    }
  })

  // Sync settings state when savedSettings loads
  useEffect(() => {
    if (savedSettings && !settings) setSettings(savedSettings)
  }, [savedSettings])

  // Load full profile including job_title
  useQuery({
    queryKey: ['my-profile', profile?.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', profile?.user_id).single()
      if (data) setProfileForm({ full_name: data.full_name || '', job_title: data.job_title || '' })
      return data
    },
    enabled: !!profile?.user_id
  })

  const { data: hrUsers = [] } = useQuery({
    queryKey: ['hr-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role, job_title, created_at')
        .in('role', ['hr', 'super_admin'])
        .order('full_name')
      return data || []
    },
    enabled: isSuperAdmin
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      return data || []
    },
    enabled: isSuperAdmin
  })

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['hr-invites'],
    queryFn: async () => {
      const { data } = await supabase
        .from('hr_invites')
        .select('*')
        .eq('accepted', false)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: isSuperAdmin
  })

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('app_settings').upsert({ ...settings, id: (savedSettings as any)?.id || 1 })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved!') },
    onError: (err: any) => toast.error(err.message)
  })

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        full_name: profileForm.full_name,
        job_title: profileForm.job_title
      }).eq('user_id', profile?.user_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', profile?.user_id] })
      toast.success('Profile updated!')
    },
    onError: (err: any) => toast.error(err.message)
  })

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim()) throw new Error('Please enter an email address')
      const { data: existing } = await supabase.from('profiles').select('user_id').eq('email', inviteEmail.trim()).single()
      if (existing) throw new Error('This person already has an account')
      const { data: invite, error } = await supabase
        .from('hr_invites')
        .insert({ email: inviteEmail.trim(), role: inviteRole, invited_by: profile?.user_id })
        .select().single()
      if (error) throw error
      const inviteUrl = `${window.location.origin}/invite/${invite.token}`
      const roleLabel = inviteRole === 'super_admin' ? 'Super Admin' : 'HR Staff'
      await sendEmail({
        to: inviteEmail.trim(),
        subject: `You've been invited to join ${settings?.company_name || 'Our Company'} ATS`,
        body: `You have been invited to join the ${settings?.company_name || 'Our Company'} Applicant Tracking System as ${roleLabel}.\n\nClick the button below to set up your account:\n\n<a href="${inviteUrl}" style="display:inline-block;background:#1B3A6B;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Set Up My Account</a>\n\nThis invite expires in 7 days.\n\nBest regards,\n${profile?.full_name || 'HR Team'}`,
        application_id: null,
        hr_name: profile?.full_name || 'HR Team'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-invites'] })
      toast.success(`Invite sent to ${inviteEmail}!`)
      setInviteEmail('')
      setInviteRole('hr')
    },
    onError: (err: any) => toast.error(err.message)
  })

  const resendInvite = useMutation({
    mutationFn: async (invite: any) => {
      const inviteUrl = `${window.location.origin}/invite/${invite.token}`
      const roleLabel = invite.role === 'super_admin' ? 'Super Admin' : 'HR Staff'
      await sendEmail({
        to: invite.email,
        subject: `Reminder: You've been invited to join ${settings?.company_name || 'Our Company'} ATS`,
        body: `This is a reminder that you have been invited to join the ${settings?.company_name || 'Our Company'} Applicant Tracking System as ${roleLabel}.\n\nClick the button below to set up your account:\n\n<a href="${inviteUrl}" style="display:inline-block;background:#1B3A6B;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Set Up My Account</a>\n\nThis invite expires in 7 days.\n\nBest regards,\n${profile?.full_name || 'HR Team'}`,
        application_id: null,
        hr_name: profile?.full_name || 'HR Team'
      })
    },
    onSuccess: () => toast.success('Invite resent!'),
    onError: (err: any) => toast.error(err.message)
  })

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hr_invites').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-invites'] }); toast.success('Invite revoked') }
  })

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-users'] }); toast.success('Role updated') },
    onError: (err: any) => toast.error(err.message)
  })

  const editUser = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        full_name: editForm.full_name,
        job_title: editForm.job_title
      }).eq('user_id', editingUser.user_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-users'] })
      toast.success('Profile updated!')
      setEditingUser(null)
    },
    onError: (err: any) => toast.error(err.message)
  })

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ role: 'applicant' }).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-users'] }); toast.success('User removed from HR team') },
    onError: (err: any) => toast.error(err.message)
  })

  async function uploadLogo(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setSettings({ ...settings, company_logo: publicUrl })
      toast.success('Logo uploaded!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const tabs = [
    { id: 'company', label: 'Company' },
    ...(isSuperAdmin ? [{ id: 'users', label: 'Team Members' }] : []),
    { id: 'profile', label: 'My Profile' },
    { id: 'embed', label: 'Embed Code' },
    ...(isSuperAdmin ? [{ id: 'audit', label: 'Audit Logs' }] : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your preferences</p>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--navy-900)', borderRadius: '10px', padding: '0.25rem', width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', background: activeTab === t.id ? 'var(--blue-500)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Company Tab */}
      {activeTab === 'company' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
              {isSuperAdmin ? 'Company Settings' : 'Company Information'}
            </h2>
            {!isSuperAdmin && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--navy-700)', padding: '0.25rem 0.625rem', borderRadius: '6px' }}>
                View only
              </span>
            )}
          </div>

          {settingsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner" /></div>
          ) : !settings ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No company settings found</div>
          ) : (
            <>
              <div className="form-group">
                <label className="label">Company Name</label>
                <input className="input" value={settings.company_name || ''} onChange={e => isSuperAdmin && setSettings({ ...settings, company_name: e.target.value })} disabled={!isSuperAdmin} style={{ opacity: isSuperAdmin ? 1 : 0.7 }} />
              </div>
              <div className="form-group">
                <label className="label">Company Logo</label>
                {settings.company_logo ? (
                  <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--navy-700)', borderRadius: '8px', display: 'inline-block' }}>
                    <img src={settings.company_logo} alt="Logo" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>No logo uploaded</div>
                )}
                {isSuperAdmin && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} className="btn-secondary">
                    <Upload size={15} /> {uploading ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
                  </label>
                )}
              </div>
              <div className="form-group">
                <label className="label">Sender Name</label>
                <input className="input" value={settings.sender_name || ''} onChange={e => isSuperAdmin && setSettings({ ...settings, sender_name: e.target.value })} disabled={!isSuperAdmin} style={{ opacity: isSuperAdmin ? 1 : 0.7 }} />
              </div>
              <div className="form-group">
                <label className="label">Sender Email</label>
                <input className="input" type="email" value={settings.sender_email || ''} onChange={e => isSuperAdmin && setSettings({ ...settings, sender_email: e.target.value })} disabled={!isSuperAdmin} style={{ opacity: isSuperAdmin ? 1 : 0.7 }} />
              </div>
              <div className="form-group">
                <label className="label">Careers Page URL</label>
                <input className="input" value={settings.careers_url || ''} onChange={e => isSuperAdmin && setSettings({ ...settings, careers_url: e.target.value })} disabled={!isSuperAdmin} style={{ opacity: isSuperAdmin ? 1 : 0.7 }} />
              </div>
              {isSuperAdmin && (
                <button className="btn-primary" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                  {saveSettings.isPending ? <span className="spinner" /> : 'Save Settings'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Team Members Tab */}
      {activeTab === 'users' && isSuperAdmin && (
        <div style={{ maxWidth: '700px' }}>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.375rem' }}>Invite Team Member</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Send an invite link to add a new HR team member. They will receive an email to set up their account.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Email Address</label>
                <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                  onKeyDown={e => e.key === 'Enter' && sendInvite.mutate()} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Role</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="hr">HR Staff</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button className="btn-primary" onClick={() => sendInvite.mutate()} disabled={sendInvite.isPending || !inviteEmail.trim()} style={{ marginBottom: '0.125rem' }}>
                {sendInvite.isPending ? <span className="spinner" /> : <><Mail size={15} /> Send Invite</>}
              </button>
            </div>
          </div>

          {pendingInvites.length > 0 && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '0.9375rem' }}>Pending Invites ({pendingInvites.length})</h3>
              {pendingInvites.map((invite: any) => (
                <div key={invite.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--navy-700)', borderRadius: '8px', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={16} color="#f59e0b" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{invite.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {invite.role?.replace('_', ' ') || 'hr'} · Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => resendInvite.mutate(invite)} className="btn-secondary" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}>
                      <RefreshCw size={13} /> Resend
                    </button>
                    <button onClick={() => { if (confirm('Revoke this invite?')) revokeInvite.mutate(invite.id) }}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '0.9375rem' }}>Active Team Members ({hrUsers.length})</h3>
            {hrUsers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>No team members yet</p>
            ) : hrUsers.map((user: any) => (
              <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--navy-700)', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: '700', flexShrink: 0 }}>
                    {user.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.full_name}
                      {user.user_id === profile?.user_id && <span style={{ fontSize: '0.7rem', background: 'rgba(37,99,235,0.2)', color: 'var(--blue-400)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>You</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {user.job_title ? `${user.job_title} · ` : ''}{user.email}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {user.user_id !== profile?.user_id ? (
                    <>
                      <select value={user.role}
                        onChange={e => { if (confirm(`Change ${user.full_name}'s role to ${e.target.value}?`)) changeRole.mutate({ userId: user.user_id, role: e.target.value }) }}
                        className="input" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}>
                        <option value="hr">HR Staff</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                      <button onClick={() => { setEditingUser(user); setEditForm({ full_name: user.full_name || '', job_title: user.job_title || '' }) }}
                        className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        title="Edit profile">
                        ✏️
                      </button>
                      <button onClick={() => { if (confirm(`Remove ${user.full_name} from the HR team?`)) removeUser.mutate(user.user_id) }}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <span className={`badge ${user.role === 'super_admin' ? 'badge-purple' : 'badge-blue'}`} style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
                      {user.role?.replace('_', ' ') || 'hr'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: '400px' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>My Profile</h2>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input className="input" value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Job Title</label>
            <input className="input" value={profileForm.job_title} onChange={e => setProfileForm({ ...profileForm, job_title: e.target.value })} placeholder="e.g. Senior HR Officer" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              This is your actual position at the organization — it will appear in emails you send to applicants
            </div>
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="label">System Role</label>
            <input className="input" value={profile?.role?.replace('_', ' ') || ''} disabled style={{ opacity: 0.6, textTransform: 'capitalize' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Your system access level — contact your Super Admin to change this
            </div>
          </div>
          <button className="btn-primary" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? <span className="spinner" /> : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Embed Tab */}
      {activeTab === 'embed' && (
        <div className="card" style={{ maxWidth: '640px' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>Embed Job Board</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Copy and paste this code into your website to display the job board directly on your careers page.
          </p>
          <div className="form-group">
            <label className="label">Iframe Embed Code</label>
            <textarea className="input" readOnly
              value={`<iframe\n  src="${window.location.origin}/embed/jobs"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border: none; border-radius: 8px;"\n  title="Job Openings"\n></iframe>`}
              style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '0.8125rem', resize: 'none' }}
              onClick={e => (e.target as HTMLTextAreaElement).select()} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>Click the code to select it, then copy and paste into your website</div>
          </div>
          <div className="form-group">
            <label className="label">Preview Link</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input className="input" readOnly value={`${window.location.origin}/embed/jobs`} onClick={e => (e.target as HTMLInputElement).select()} />
              <a href={`${window.location.origin}/embed/jobs`} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>Preview</a>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && isSuperAdmin && (
        <div style={{ maxWidth: '900px' }}>
          <div className="card">
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Audit Logs</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Track all user activity in the system</p>
            </div>
            {auditLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No audit logs yet</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: '500', fontSize: '0.875rem' }}>{log.user_name}</td>
                        <td>
                          <span className={`badge ${log.user_role === 'super_admin' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
  {log.user_role === 'super_admin' ? 'Super Admin' : 'HR Staff'}
</span>
                        </td>
                        <td>
                          <span style={{
                            background: log.action === 'SIGN_IN' ? 'rgba(16,185,129,0.1)' : log.action === 'SIGN_OUT' ? 'rgba(100,116,139,0.1)' : log.action === 'SESSION_TIMEOUT' ? 'rgba(245,158,11,0.1)' : log.action.includes('DELETE') ? 'rgba(239,68,68,0.1)' : 'rgba(37,99,235,0.1)',
                            color: log.action === 'SIGN_IN' ? '#10b981' : log.action === 'SIGN_OUT' ? '#94a3b8' : log.action === 'SESSION_TIMEOUT' ? '#f59e0b' : log.action.includes('DELETE') ? '#ef4444' : '#3b82f6',
                            borderRadius: '5px', padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontWeight: '500', fontFamily: 'monospace'
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '250px' }}>
                          {log.details ? (
                            <span>
                              {Object.entries(log.details).map(([k, v]: any) => (
                                <span key={k} style={{ display: 'inline-block', marginRight: '0.5rem' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</span>{' '}
                                  <span>{String(v)}</span>
                                </span>
                              ))}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingUser(null)}>
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Edit Profile</h2>
              <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--navy-700)', borderRadius: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '700', flexShrink: 0 }}>
                  {editingUser.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{editingUser.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{editingUser.role?.replace('_', ' ')}</div>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Full Name</label>
                <input className="input" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label className="label">Job Title</label>
                <input className="input" value={editForm.job_title} onChange={e => setEditForm({ ...editForm, job_title: e.target.value })} placeholder="e.g. Senior HR Officer" />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  This appears in emails sent to applicants
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => editUser.mutate()} disabled={editUser.isPending || !editForm.full_name}>
                {editUser.isPending ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
