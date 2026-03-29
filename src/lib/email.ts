import { supabase } from './supabase'

interface SendEmailParams {
  to: string
  subject?: string
  body?: string
  template_event?: string
  application_id?: string
  applicant_name?: string
  job_title?: string
  interview_date?: string
  hr_name?: string
}

export async function sendEmail(params: SendEmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params
    })
    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Failed to send email:', err)
    return { success: false, error: err.message }
  }
}

// Trigger emails based on application status changes
export async function sendStatusEmail(
  status: string,
  to: string,
  applicantName: string,
  jobTitle: string,
  applicationId: string,
  hrName?: string,
  interviewDate?: string
) {
  const eventMap: Record<string, string> = {
    applied: 'application_received',
    screening: 'application_received',
    interview: 'shortlisted',
    assessment: 'shortlisted',
    offer: 'offer_sent',
    rejected: 'rejected_application',
    hired: 'offer_sent',
  }

  const event = eventMap[status]
  if (!event) return

  return sendEmail({
    to,
    template_event: event,
    application_id: applicationId,
    applicant_name: applicantName,
    job_title: jobTitle,
    hr_name: hrName,
    interview_date: interviewDate,
  })
}
