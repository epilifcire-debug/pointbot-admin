import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { EVENT_SELECT, TYPE_LABEL, artworkUrl, displayName, formatDates, isExpired, nextValidDate, shortDate, sortEvents, type EventRow } from '../lib/events'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const [events, setEvents] = useState<EventRow[] | null>(null)
  useEffect(() => {
    supabase.from('events').select(EVENT_SELECT).then(({ data }) => setEvents(sortEvents((data ?? []) as EventRow[])))
  }, [])

  const first = (profile?.name ?? session?.user.email ?? '').split(/[ @]/)[0]
  const live = (events ?? []).filter((e) => !isExpired(e))
  const n = (s: string) => live.filter((e) => e.status === s).length
  const stats = [
    { label: 'Ativos', v: n('ATIVO'), color: 'text-mint' },
    { label: 'Em breve', v: n('EM_BREVE'), color: 'text-sun' },
    { label: 'Inativos', v: (events ?? []).filter((e) => e.status === 'INATIVO').length, color: 'text-muted' },
    { label: 'Encerrados', v: (events ?? []).filter((e) => e.status !== 'INATIVO' && isExpired(e)).length, color: 'text-alert' },
  ]
  const next = live.filter((e) => e.status !== 'INATIVO').slice(0, 5)

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold">Olá, {first}</h1>
      <p className="mb-6 text-sm text-muted">Visão geral do PointBot</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
            <div className={`text-3xl font-extrabold ${s.color}`}>{events ? s.v : '—'}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Próximos eventos</h2>
          <Link to="/eventos" className="text-sm font-semibold text-brand-soft">Ver todos</Link>
        </div>
        {events && !next.length && <p className="text-sm text-muted">Nenhum evento próximo. <Link to="/eventos/novo" className="font-semibold text-brand-soft">Cadastrar evento</Link></p>}
        <ul className="divide-y divide-line">
          {next.map((e) => {
            const img = artworkUrl(e.artwork_path); const nd = nextValidDate(e)
            return (
              <li key={e.id}>
                <Link to={`/eventos/${e.id}`} className="flex items-center gap-3 py-2.5">
                  {img ? <img src={img} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-bg" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{displayName(e)}</div>
                    <div className="truncate text-xs text-muted">{TYPE_LABEL[e.type]} • {formatDates(e.event_dates.map((d) => d.event_date))}</div>
                  </div>
                  <div className="text-sm text-muted">{nd ? shortDate(nd) : ''}</div>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      {!supabaseConfigured && <p className="mt-4 text-sm text-alert">Supabase não configurado.</p>}
    </div>
  )
}
