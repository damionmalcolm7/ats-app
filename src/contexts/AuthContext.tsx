import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'
import { createAuditLog } from '../lib/audit'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true,
  signOut: async () => {}, refreshProfile: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileRef = useRef<Profile | null>(null)

  useEffect(() => { profileRef.current = profile }, [profile])

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
      if (data) {
        setProfile(data)
      } else {
        setTimeout(async () => {
          const { data: retryData } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
          if (retryData) setProfile(retryData)
        }, 2000)
      }
    } catch (e) {
      console.error('Error fetching profile:', e)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  async function signOut(reason?: string) {
    if (profileRef.current) {
      await createAuditLog({
        user_id: profileRef.current.user_id,
        user_name: profileRef.current.full_name || 'Unknown',
        user_role: profileRef.current.role || 'unknown',
        action: reason === 'timeout' ? 'SESSION_TIMEOUT' : 'SIGN_OUT',
        details: reason === 'timeout' ? { reason: 'Automatically signed out due to inactivity' } : {}
      })
    }
    clearTimeout(timeoutRef.current!)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    if (reason === 'timeout') {
      alert('You have been signed out due to 30 minutes of inactivity. Please sign in again.')
    }
  }

  function resetTimer() {
    clearTimeout(timeoutRef.current!)
    timeoutRef.current = setTimeout(() => signOut('timeout'), SESSION_TIMEOUT_MS)
  }

  useEffect(() => {
    if (!user) return
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timeoutRef.current!)
    }
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
        if (event === 'SIGNED_IN') {
          const { data: p } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single()
          if (p) {
            await createAuditLog({
              user_id: p.user_id,
              user_name: p.full_name || 'Unknown',
              user_role: p.role || 'unknown',
              action: 'SIGN_IN',
              details: { email: session.user.email }
            })
          }
        }
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
