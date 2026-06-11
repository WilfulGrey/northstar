import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { Spinner } from './components/States'
import { Login } from './pages/Login'
import { AcceptInvite } from './pages/AcceptInvite'
import { Dashboard } from './pages/Dashboard'
import { MyWork } from './pages/MyWork'
import { Okrs } from './pages/Okrs'
import { Epics } from './pages/Epics'
import { Board } from './pages/Board'
import { Team } from './pages/Team'
import { Integrations } from './pages/Integrations'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

function Protected() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="mywork" element={<MyWork />} />
        <Route path="okrs" element={<Okrs />} />
        <Route path="epics" element={<Epics />} />
        <Route path="board" element={<Board />} />
        <Route path="team" element={<Team />} />
        <Route path="integrations" element={<Integrations />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
