import { supabase } from './supabase'

export async function createNotification({
  user_id,
  type,
  title,
  message,
  link
}: {
  user_id: string
  type: string
  title: string
  message: string
  link?: string
}) {
  const { error } = await supabase.from('notifications').insert({ user_id, type, title, message, link })
  if (error) console.error('Failed to create notification:', error.message)
}

// Notify all HR/Admin users
export async function notifyHRTeam({
  type,
  title,
  message,
  link
}: {
  type: string
  title: string
  message: string
  link?: string
}) {
  const { data: hrUsers } = await supabase
    .from('profiles')
    .select('user_id')
    .in('role', ['hr', 'super_admin'])

  if (!hrUsers?.length) return

  const notifications = hrUsers.map(u => ({
    user_id: u.user_id,
    type,
    title,
    message,
    link
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) console.error('Failed to notify HR team:', error.message)
}
