import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import Applicants from './pages/Applicants'
import ApplicantProfile from './pages/ApplicantProfile'
import Interviews from './pages/Interviews'
import EmailTemplates from './pages/EmailTemplates'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import JobBoard from './pages/JobBoard'
import JobDetail from './pages/JobDetail'
import ApplicantPortal from './pages/ApplicantPortal'
import ResetPassword from './pages/ResetPassword'
import EmbedJobBoard from './pages/EmbedJobBoard'
import AcceptInvite from './pages/AcceptInvite'
import Pipeline from './pages/Pipeline'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } })

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" toastOptions={{ style: { background: 'var(--navy-800)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.875rem' }, success: { iconTheme: { primary: '#10b981', secondary: 'white' } }, error: { iconTheme: { primary: '#ef4444', secondary: 'white' } } }} />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/embed/jobs" element={<EmbedJobBoard />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              <Route path="/jobs" element={<JobBoard />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/portal" element={<ProtectedRoute><ApplicantPortal /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/jobs" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Jobs /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/applicants" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Applicants /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/applicants/:id" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><ApplicantProfile /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/pipeline" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Pipeline /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/interviews" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Interviews /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/email-templates" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><EmailTemplates /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/analytics" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Analytics /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/profile" element={<ProtectedRoute allowedRoles={['hr','super_admin']}><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
