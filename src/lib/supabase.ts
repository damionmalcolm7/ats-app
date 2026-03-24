import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'super_admin' | 'hr' | 'applicant'

export interface Profile {
  id: string
  user_id: string
  full_name: string
  email: string
  avatar_url?: string
  role: UserRole
  created_at: string
}

export interface Job {
  id: string
  title: string
  department: string
  location: string
  location_type: 'remote' | 'hybrid' | 'onsite'
  employment_type: 'full-time' | 'part-time' | 'contract'
  salary_min?: number
  salary_max?: number
  description: string
  required_skills: string[]
  experience_level: 'entry' | 'mid' | 'senior' | 'lead'
  deadline?: string
  status: 'draft' | 'active' | 'paused' | 'closed'
  created_by: string
  created_at: string
}

export interface Application {
  id: string
  job_id: string
  applicant_id: string
  cover_letter?: string
  status: 'applied' | 'screening' | 'interview' | 'assessment' | 'offer' | 'hired' | 'rejected'
  match_score?: number
  created_at: string
  updated_at: string
  job?: Job
  applicant_details?: ApplicantDetails
  profile?: Profile
}

export interface ApplicantDetails {
  id: string
  application_id: string
  full_name: string
  email: string
  phone?: string
  skills: string[]
  years_experience?: number
  education: any[]
  work_history: any[]
  resume_url?: string
  parsed_data?: any
}

export interface Interview {
  id: string
  application_id: string
  job_id: string
  scheduled_at: string
  format: 'video' | 'phone' | 'in-person'
  interviewers: string[]
  notes?: string
  location_or_link?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  application?: Application
  job?: Job
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
  trigger_event?: string
  created_by: string
  created_at: string
}

export interface Document {
  id: string
  application_id: string
  name: string
  type: string
  file_url?: string
  required: boolean
  uploaded_at?: string
  status: 'pending' | 'uploaded' | 'signed' | 'declined'
}

export interface Notification {
  id: string
  user_id: string
  message: string
  type: string
  read: boolean
  link?: string
  created_at: string
}

export interface AppSettings {
  id: string
  company_name: string
  company_logo?: string
  primary_color: string
  careers_page_url?: string
  sender_email?: string
  sender_name?: string
}
