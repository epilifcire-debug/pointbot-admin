import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { EVENT_SELECT, TYPE_LABEL, artworkUrl, displayName, formatDates, isExpired, sortEvents, type EventRow, type EventStatus } from '../lib/events'
import StatusBadge from '../components/StatusBadge'

const tabs: { k: 'TODOS' | EventStatus; label: string }[] = [
  { k: 'TODOS', label: 'Todos' }, { k: 'ATIVO', label: 'Ativos' }, { k: 'EM_BREVE', label: 'Em breve' }, { k: 'INATIVO', label: 'Inativos' },
]

export default function Eventos() {
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [tab, setTab] = useState<'TODOS' | EventStatus>('TODOS')
  const [error, setError] = useState(false)

  useEffect(() => {
    supabase.from('events').select(EVENT_SELECT).then(({ data, error }) => {
      if (error) setError(true); else setEvents(sortEvents((data ?? []) as EventRow[]))
    })
  }, [])

  const list = (events ?? []).filter((e) => tab === 'TODOS' || e.status === tab)
  const count = (k: 'TODOS' | EventStatus) => (events ?? []).filter((e) => k === 'TODOS' || e.status === k).length

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Eventos</h1>
          <p className="text-sm text-muted">Na ordem em que aparecem no bot: próxima data primeiro</p>
        </div>
        <Link to="/eventos/novo" className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold hover:bg-brand-soft"><Plus size={16} />Novo evento</Link>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.k ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-white'}`}>
            {t.label} ({count(t.k)})
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">Não foi possível carregar os eventos.</p>}
      {events === null && !error && <p className="text-sm text-muted">Carregando...</p>}
      {events && !list.length && (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Nenhum evento aqui. <Link to="/eventos/novo" className="font-semibold text-brand-soft">Cadastre o primeiro</Link>.
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((e) => {
          const img = artworkUrl(e.artwork_path)
          return (
            <li key={e.id}>
              <Link to={`/eventos/${e.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-brand">
                {img ? <img src={img} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                     : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-bg text-muted"><CalendarDays /></div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{displayName(e)}</div>
                  <div className="text-xs text-muted">{TYPE_LABEL[e.type]}</div>
                  <div className="mt-1 text-sm">{formatDates(e.event_dates.map((d) => d.event_date))}</div>
                  <div className="mt-2"><StatusBadge status={e.status} expired={isExpired(e)} /></div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
