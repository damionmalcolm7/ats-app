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
  try {
    await supabase.from('notifications').insert({ user_id, type, title, message, link })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
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
  try {
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

    await supabase.from('notifications').insert(notifications)
  } catch (err) {
    console.error('Failed to notify HR team:', err)
  }
}
