import { useAuth } from '../auth/AuthContext'
import { supabaseConfigured } from '../lib/supabase'

const stats = [
  { label: 'Eventos ativos', color: 'text-mint' },
  { label: 'Em breve', color: 'text-sun' },
  { label: 'Inativos', color: 'text-alert' },
  { label: 'Versão publicada', color: 'text-brand-soft' },
]

export default function Dashboard() {
  const { profile, session } = useAuth()
  const first = (profile?.name ?? session?.user.email ?? '').split(/[ @]/)[0]
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold">Olá, {first}</h1>
      <p className="mb-6 text-sm text-muted">Visão geral do PointBot</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
            <div className={`text-3xl font-extrabold ${s.color}`}>—</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm">
        <div className="mb-1 font-bold">Status da instalação</div>
        <ul className="space-y-1 text-muted">
          <li>Supabase: <b className={supabaseConfigured ? 'text-mint' : 'text-alert'}>{supabaseConfigured ? 'conectado' : 'não configurado'}</b></li>
          <li>Os números aparecem depois da etapa B04 (Eventos).</li>
        </ul>
      </div>
    </div>
  )
}
