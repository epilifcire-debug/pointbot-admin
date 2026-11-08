import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'
import Configuracoes from './pages/Configuracoes'
import Eventos from './pages/Eventos'
import Historico from './pages/Historico'
import FluxoBot from './pages/FluxoBot'
import EventoForm from './pages/EventoForm'

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
        <Route path="eventos" element={<Eventos />} />
        <Route path="eventos/novo" element={<EventoForm />} />
        <Route path="eventos/:id" element={<EventoForm />} />
        <Route path="fluxo" element={<FluxoBot />} />
        <Route path="mensagens" element={<FluxoBot />} />
        <Route path="historico" element={<Historico />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
