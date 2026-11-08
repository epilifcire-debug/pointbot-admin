import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Clock3, LayoutDashboard, LogOut, MessageSquare, Settings, Workflow } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import PublishBar from './PublishBar'

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/eventos', label: 'Eventos', icon: CalendarDays },
  { to: '/fluxo', label: 'Fluxo do Bot', icon: Workflow },
  { to: '/mensagens', label: 'Mensagens', icon: MessageSquare },
  { to: '/historico', label: 'Histórico', icon: Clock3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand text-white' : 'text-muted hover:bg-surface hover:text-white'
  }`

export default function Layout() {
  const { profile, session, signOut } = useAuth()
  const name = profile?.name ?? session?.user.email ?? ''
  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-bg p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-1">
          <img src="./logo.png" alt="" className="h-10 w-10 rounded-full" />
          <div>
            <div className="text-lg font-extrabold leading-none">PointBot</div>
            <div className="text-xs text-muted">Gestão de Eventos</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={link}><Icon size={18} />{label}</NavLink>
          ))}
        </nav>
        <div className="border-t border-line pt-3">
          <div className="truncate px-1 text-sm font-semibold">{name}</div>
          <div className="px-1 text-xs text-muted">{profile?.role === 'ADMIN_MASTER' ? 'Administrador Master' : 'Administrador'}</div>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 px-1 text-sm text-muted hover:text-white"><LogOut size={16} />Sair</button>
          <div className="mt-4 px-1 text-xs text-muted">by: <b className="text-white">efcsys</b></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-t flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <div className="flex items-center gap-2"><img src="./logo.png" alt="" className="h-8 w-8 rounded-full" /><b>PointBot</b></div>
          <button onClick={signOut} aria-label="Sair" className="text-muted"><LogOut size={20} /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8"><PublishBar /><Outlet /></main>
        <nav className="safe-b fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-line bg-bg md:hidden">
          {items.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[11px] ${isActive ? 'text-brand-soft' : 'text-muted'}`}>
              <Icon size={20} />{label.split(' ')[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
