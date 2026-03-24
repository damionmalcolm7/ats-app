-- =============================================
-- ATS FULL DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  full_name text,
  email text,
  avatar_url text,
  role text not null default 'applicant' check (role in ('super_admin','hr','applicant')),
  created_at timestamptz default now()
);

-- =============================================
-- APP SETTINGS
-- =============================================
create table if not exists app_settings (
  id uuid primary key default uuid_generate_v4(),
  company_name text default 'Our Company',
  company_logo text,
  primary_color text default '#2563eb',
  careers_page_url text,
  sender_email text,
  sender_name text,
  updated_at timestamptz default now()
);

-- Insert default settings row
insert into app_settings (company_name) values ('Our Company') on conflict do nothing;

-- =============================================
-- JOBS
-- =============================================
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  department text not null default '',
  location text default '',
  location_type text default 'onsite' check (location_type in ('remote','hybrid','onsite')),
  employment_type text default 'full-time' check (employment_type in ('full-time','part-time','contract')),
  salary_min numeric,
  salary_max numeric,
  description text default '',
  required_skills text[] default '{}',
  experience_level text default 'mid' check (experience_level in ('entry','mid','senior','lead')),
  deadline timestamptz,
  status text default 'draft' check (status in ('draft','active','paused','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- APPLICATIONS
-- =============================================
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade not null,
  applicant_id uuid references auth.users(id) not null,
  cover_letter text,
  status text default 'applied' check (status in ('applied','screening','interview','assessment','offer','hired','rejected')),
  match_score integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- APPLICANT DETAILS
-- =============================================
create table if not exists applicant_details (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade unique not null,
  full_name text,
  email text,
  phone text,
  skills text[] default '{}',
  years_experience integer,
  education jsonb default '[]',
  work_history jsonb default '[]',
  resume_url text,
  parsed_data jsonb
);

-- =============================================
-- PIPELINE STAGES
-- =============================================
create table if not exists pipeline_stages (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade,
  name text not null,
  order_index integer default 0,
  color text default '#2563eb',
  created_at timestamptz default now()
);

-- =============================================
-- INTERVIEWS
-- =============================================
create table if not exists interviews (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade not null,
  job_id uuid references jobs(id),
  scheduled_at timestamptz not null,
  format text default 'video' check (format in ('video','phone','in-person')),
  interviewers text[] default '{}',
  notes text,
  location_or_link text,
  status text default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at timestamptz default now()
);

-- =============================================
-- DOCUMENTS
-- =============================================
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade not null,
  name text not null,
  type text default 'other',
  file_url text,
  required boolean default true,
  uploaded_at timestamptz,
  status text default 'pending' check (status in ('pending','uploaded','signed','declined')),
  created_at timestamptz default now()
);

-- =============================================
-- SIGNATURES
-- =============================================
create table if not exists signatures (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  applicant_id uuid references auth.users(id),
  signed_at timestamptz,
  signature_data text,
  status text default 'pending' check (status in ('pending','signed','declined')),
  created_at timestamptz default now()
);

-- =============================================
-- EMAIL TEMPLATES
-- =============================================
create table if not exists email_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject text not null,
  body text not null,
  variables text[] default '{}',
  trigger_event text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- =============================================
-- EMAIL LOGS
-- =============================================
create table if not exists email_logs (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade,
  template_id uuid references email_templates(id),
  recipient_email text,
  sent_at timestamptz default now(),
  status text default 'sent'
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  type text default 'info',
  read boolean default false,
  link text,
  created_at timestamptz default now()
);

-- =============================================
-- RATINGS
-- =============================================
create table if not exists ratings (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade unique not null,
  rated_by uuid references auth.users(id),
  score integer check (score between 1 and 5),
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- TAGS
-- =============================================
create table if not exists tags (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade not null,
  label text not null,
  color text default '#2563eb',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- =============================================
-- APPLICATION NOTES
-- =============================================
create table if not exists application_notes (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade not null,
  content text not null,
  author uuid references auth.users(id),
  created_at timestamptz default now()
);

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'applicant')
  )
  on conflict (user_id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = coalesce(excluded.email, profiles.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table profiles enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table applicant_details enable row level security;
alter table interviews enable row level security;
alter table documents enable row level security;
alter table signatures enable row level security;
alter table email_templates enable row level security;
alter table email_logs enable row level security;
alter table notifications enable row level security;
alter table ratings enable row level security;
alter table tags enable row level security;
alter table application_notes enable row level security;
alter table app_settings enable row level security;
alter table pipeline_stages enable row level security;

-- PROFILES policies
create policy "Users can read own profile" on profiles for select using (auth.uid() = user_id);
create policy "HR can read all profiles" on profiles for select using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "Users can update own profile" on profiles for update using (auth.uid() = user_id);
create policy "Allow insert own profile" on profiles for insert with check (auth.uid() = user_id);

-- JOBS policies
create policy "Anyone can read active jobs" on jobs for select using (status = 'active' or auth.uid() = created_by or exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "HR can insert jobs" on jobs for insert with check (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "HR can update jobs" on jobs for update using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "HR can delete jobs" on jobs for delete using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- APPLICATIONS policies
create policy "Applicants can read own applications" on applications for select using (auth.uid() = applicant_id or exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "Anyone can insert application" on applications for insert with check (true);
create policy "HR can update applications" on applications for update using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- APPLICANT DETAILS policies
create policy "HR can read applicant details" on applicant_details for select using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')) or exists(select 1 from applications a where a.id = applicant_details.application_id and a.applicant_id = auth.uid()));
create policy "Anyone can insert applicant details" on applicant_details for insert with check (true);

-- INTERVIEWS policies
create policy "HR can manage interviews" on interviews for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "Applicants can read own interviews" on interviews for select using (exists(select 1 from applications a where a.id = interviews.application_id and a.applicant_id = auth.uid()));

-- DOCUMENTS policies
create policy "HR can manage documents" on documents for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "Applicants can read own documents" on documents for select using (exists(select 1 from applications a where a.id = documents.application_id and a.applicant_id = auth.uid()));
create policy "Applicants can update own documents" on documents for update using (exists(select 1 from applications a where a.id = documents.application_id and a.applicant_id = auth.uid()));

-- EMAIL TEMPLATES policies
create policy "HR can manage email templates" on email_templates for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- EMAIL LOGS policies
create policy "HR can read email logs" on email_logs for select using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "Anyone can insert email log" on email_logs for insert with check (true);

-- NOTIFICATIONS policies
create policy "Users can manage own notifications" on notifications for all using (auth.uid() = user_id);

-- RATINGS policies
create policy "HR can manage ratings" on ratings for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- TAGS policies
create policy "HR can manage tags" on tags for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- APPLICATION NOTES policies
create policy "HR can manage notes" on application_notes for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- APP SETTINGS policies
create policy "Anyone can read settings" on app_settings for select using (true);
create policy "HR can update settings" on app_settings for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- PIPELINE STAGES policies
create policy "HR can manage pipeline" on pipeline_stages for all using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- SIGNATURES policies
create policy "HR can read signatures" on signatures for select using (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));
create policy "Applicants can manage own signatures" on signatures for all using (auth.uid() = applicant_id);

-- RATINGS upsert by application_id
create policy "HR can insert ratings" on ratings for insert with check (exists(select 1 from profiles p where p.user_id = auth.uid() and p.role in ('hr','super_admin')));

-- =============================================
-- STORAGE BUCKETS
-- =============================================
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;

-- Storage policies
create policy "Anyone can upload resumes" on storage.objects for insert with check (bucket_id = 'resumes');
create policy "Anyone can read resumes" on storage.objects for select using (bucket_id = 'resumes');
create policy "Anyone can upload documents" on storage.objects for insert with check (bucket_id = 'documents');
create policy "Anyone can read documents" on storage.objects for select using (bucket_id = 'documents');
create policy "Anyone can upload avatars" on storage.objects for insert with check (bucket_id = 'avatars');
create policy "Anyone can read avatars" on storage.objects for select using (bucket_id = 'avatars');

-- =============================================
-- SET YOUR SUPER ADMIN
-- Run this after signing up with info@nicolaithedesigner.com
-- Replace the email below if needed
-- =============================================
-- update profiles set role = 'super_admin' where email = 'info@nicolaithedesigner.com';
