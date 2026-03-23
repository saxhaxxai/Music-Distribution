import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Login } from '@/pages/Login'
import { CreatorDashboard } from '@/pages/CreatorDashboard'
import { AdminOverview } from '@/pages/admin/AdminOverview'
import { CreatorsList } from '@/pages/admin/CreatorsList'
import { GeneratePost } from '@/pages/GeneratePost'
import { Signup } from '@/pages/Signup'
import { SubmitPost } from '@/pages/SubmitPost'

const queryClient = new QueryClient()

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (!isAdmin) return <Navigate to="/dashboard" />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} /> : <Signup />} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={isAdmin ? <Navigate to="/admin" /> : <CreatorDashboard />} />
        <Route path="/dashboard/generate" element={<GeneratePost />} />
        <Route path="/dashboard/submit" element={<SubmitPost />} />
        <Route path="/admin" element={<AdminRoute><AdminOverview /></AdminRoute>} />
        <Route path="/admin/creators" element={<AdminRoute><CreatorsList /></AdminRoute>} />
        <Route path="/admin/generate" element={<AdminRoute><GeneratePost /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to={user ? (isAdmin ? '/admin' : '/dashboard') : '/login'} />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
