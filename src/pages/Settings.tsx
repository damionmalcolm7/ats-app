import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Save, Upload, X } from 'lucide-react'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState({ company_name: '', primary_color: '#2563eb', careers_page_url: '', sender_email: '', sender_name: '', company_logo: '' })
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState('company')

  const { data: dbSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').single()
      return data
    }
  })

  useEffect(() => {
    if (dbSettings) {
      setSettings({
        company_name: dbSettings.company_name || '',
        primary_color: dbSettings.primary_color || '#2563eb',
        careers_page_url: dbSettings.careers_page_url || '',
        sender_email: dbSettings.sender_email || '',
        sender_name: dbSettings.sender_name || '',
        company_logo: dbSettings.company_logo || ''
      })
      if (dbSettings.company_logo) setLogoPreview(dbSettings.company_logo)
    }
  }, [dbSettings])

  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name || '', email: profile.email || '' })
  }, [profile])

  async function handleLogoUpload(file: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file')
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB')

    setLogoUploading(true)
    try {
      const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setLogoPreview(publicUrl)
      setSettings(s => ({ ...s, company_logo: publicUrl }))
      toast.success('Logo uploaded!')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  const settingsMutation = useMutation({
    mutationFn: async () => {
      if (dbSettings?.id) {
        const { error } = await supabase.from('app_settings').update(settings).eq('id', dbSettings.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('app_settings').insert(settings)
        if (error) throw error
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved!') },
    onError: (err: any) => toast.error(err.message)
  })

  const profileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({ full_name: profileForm.full_name }).eq('user_id', profile?.user_id)
      if (error) throw error
    },
    onSuccess: () => { refreshProfile(); toast.success('Profile updated!') },
    onError: (err: any) => toast.error(err.message)
  })

  const tabs = [{ id: 'company', label: 'Company' }, { id: 'profile', label: 'My Profile' }]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your account and company settings</p>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--navy-900)', borderRadius: '10px', padding: '0.25rem', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', background: activeTab === t.id ? 'var(--blue-500)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && (
        <div className="card" style={{ maxWidth: '640px' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>Company Settings</h2>

          {/* Logo Upload */}
          <div className="form-group">
            <label className="label">Company Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              {/* Logo preview */}
              <div style={{ width: '120px', height: '80px', background: 'var(--navy-700)', borderRadius: '10px', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Company Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    <Upload size={20} style={{ margin: '0 auto 0.25rem', display: 'block' }} />
                    No logo
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpg,image/jpeg,image/svg+xml"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                />
                <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={logoUploading} style={{ width: 'fit-content' }}>
                  {logoUploading ? <><span className="spinner" /> Uploading...</> : <><Upload size={15} /> Upload Logo</>}
                </button>
                {logoPreview && (
                  <button className="btn-secondary" style={{ width: 'fit-content', fontSize: '0.8125rem' }}
                    onClick={() => { setLogoPreview(''); setSettings(s => ({ ...s, company_logo: '' })) }}>
                    <X size={13} /> Remove Logo
                  </button>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNG, JPG or SVG. Max 5MB.<br />Recommended: 200x80px or wider</p>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Company Name</label>
            <input className="input" value={settings.company_name} onChange={e => setSettings({ ...settings, company_name: e.target.value })} placeholder="National Housing Trust" />
          </div>

          <div className="form-group">
            <label className="label">Careers Page URL</label>
            <input className="input" value={settings.careers_page_url} onChange={e => setSettings({ ...settings, careers_page_url: e.target.value })} placeholder="https://nht.gov.jm/careers" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Sender Name</label>
              <input className="input" value={settings.sender_name} onChange={e => setSettings({ ...settings, sender_name: e.target.value })} placeholder="NHT HR Team" />
            </div>
            <div className="form-group">
              <label className="label">Sender Email</label>
              <input className="input" type="email" value={settings.sender_email} onChange={e => setSettings({ ...settings, sender_email: e.target.value })} placeholder="hr@nht.gov.jm" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Brand Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="color" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                style={{ width: '48px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }} />
              <input className="input" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} style={{ width: '140px' }} />
            </div>
          </div>

          <button className="btn-primary" onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>
            {settingsMutation.isPending ? <span className="spinner" /> : <><Save size={15} /> Save Settings</>}
          </button>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: '500px' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>My Profile</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700' }}>
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: '600' }}>{profile?.full_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ')}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input className="input" value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Email Address</label>
            <input className="input" value={profileForm.email} disabled style={{ opacity: 0.6 }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Email cannot be changed here</div>
          </div>
          <button className="btn-primary" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
            {profileMutation.isPending ? <span className="spinner" /> : <><Save size={15} /> Save Profile</>}
          </button>
        </div>
      )}
    </div>
  )
}
