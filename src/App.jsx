import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import MfaVerify from './pages/MfaVerify'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Categories from './pages/Categories'
import Import from './pages/Import'
import Settings from './pages/Settings'
import Wealth from './pages/Wealth'
import Investments from './pages/Investments'
import RecurringExpenses from './pages/RecurringExpenses'
import Tax from './pages/Tax'

function needsMfaChallenge(mfaLevel) {
  return Boolean(mfaLevel.current && mfaLevel.next && mfaLevel.current !== mfaLevel.next)
}

function Protected({ children }) {
  const { session, household, mfaLevel, loading } = useAuth()
  if (loading) return <div className="page-loading">Laster…</div>
  if (!session) return <Navigate to="/login" replace />
  if (needsMfaChallenge(mfaLevel)) return <Navigate to="/mfa-verifiser" replace />
  if (!household) return <Navigate to="/onboarding" replace />
  return children
}

function AppRoutes() {
  const { session, household, mfaLevel, loading } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/tilbakestill-passord" element={session ? <ResetPassword /> : <Navigate to="/login" replace />} />
      <Route
        path="/mfa-verifiser"
        element={
          loading ? (
            <div className="page-loading">Laster…</div>
          ) : !session ? (
            <Navigate to="/login" replace />
          ) : needsMfaChallenge(mfaLevel) ? (
            <MfaVerify />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/onboarding"
        element={
          loading ? (
            <div className="page-loading">Laster…</div>
          ) : !session ? (
            <Navigate to="/login" replace />
          ) : needsMfaChallenge(mfaLevel) ? (
            <Navigate to="/mfa-verifiser" replace />
          ) : household ? (
            <Navigate to="/" replace />
          ) : (
            <Onboarding />
          )
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="kontoer" element={<Accounts />} />
        <Route path="transaksjoner" element={<Transactions />} />
        <Route path="kategorier" element={<Categories />} />
        <Route path="importer" element={<Import />} />
        <Route path="formue" element={<Wealth />} />
        <Route path="investeringer" element={<Investments />} />
        <Route path="faste-utgifter" element={<RecurringExpenses />} />
        <Route path="skatt" element={<Tax />} />
        <Route path="innstillinger" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
