import { supabase } from './supabase'

export async function createAuditLog({
  user_id,
  user_name,
  user_role,
  action,
  entity_type,
  entity_id,
  details
}: {
  user_id: string
  user_name: string
  user_role: string
  action: string
  entity_type?: string
  entity_id?: string
  details?: Record<string, any>
}) {
  try {
    await supabase.from('audit_logs').insert({
      user_id,
      user_name,
      user_role,
      action,
      entity_type,
      entity_id: entity_id?.toString(),
      details
    })
  } catch (err) {
    console.error('Audit log error:', err)
  }
}
