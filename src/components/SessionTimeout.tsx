import { useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const WARNING_MS = 25 * 60 * 1000 // Warning at 25 minutes

export default function SessionTimeout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
  }

  function startTimers() {
    clearTimers()

    // Warning at 25 minutes
    warningRef.current = setTimeout(() => {
      const extend = window.confirm('Your session will expire in 5 minutes due to inactivity. Click OK to stay logged in.')
      if (extend) startTimers()
    }, WARNING_MS)

    // Sign out at 30 minutes
    timeoutRef.current = setTimeout(async () => {
      clearTimers()
      await signOut()
      navigate('/login')
      alert('You have been signed out due to 30 minutes of inactivity.')
    }, TIMEOUT_MS)
  }

  useEffect(() => {
    if (!user) {
      clearTimers()
      return
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    const reset = () => startTimers()

    events.forEach(e => window.addEventListener(e, reset))
    startTimers()

    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimers()
    }
  }, [user])

  return null // No UI — runs silently in background
}
