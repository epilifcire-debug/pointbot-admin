import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'

function Guard({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="grid h-full place-items-center text-muted">Carregando...</div>
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="eventos" element={<Placeholder title="Eventos" step="B04" />} />
        <Route path="fluxo" element={<Placeholder title="Fluxo do Bot" step="B06" />} />
        <Route path="mensagens" element={<Placeholder title="Mensagens" step="B06" />} />
        <Route path="historico" element={<Placeholder title="Histórico" step="B05" />} />
        <Route path="configuracoes" element={<Placeholder title="Configurações" step="B03" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
