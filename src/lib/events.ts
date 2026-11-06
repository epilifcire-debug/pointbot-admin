import { supabase } from './supabase'

export type EventType = 'PRE_CAJU_CAMAROTE' | 'PRE_CAJU_BLOCOS' | 'EVENTO_EXTERNO'
export type EventStatus = 'ATIVO' | 'EM_BREVE' | 'INATIVO'
export type DateRow = { id: string; event_date: string; start_time: string | null; sort_order?: number }
export type EventRow = {
  id: string; base_name: string; display_name: string | null; type: EventType; status: EventStatus
  location: string | null; purchase_url: string | null; description: string | null
  artwork_path: string | null; send_artwork_whatsapp: boolean; event_dates: DateRow[]
}

export const TYPE_LABEL: Record<EventType, string> = {
  PRE_CAJU_CAMAROTE: 'Camarote Pré-Caju', PRE_CAJU_BLOCOS: 'Blocos Pré-Caju', EVENTO_EXTERNO: 'Evento externo',
}
export const STATUS_LABEL: Record<EventStatus, string> = { ATIVO: 'Ativo', EM_BREVE: 'Em breve', INATIVO: 'Inativo' }
export const BUCKET = 'event-artworks'
export const EVENT_SELECT = '*, event_dates(id,event_date,start_time,sort_order)'

// Mesma regra do banco: o dia vale até 23:59:59 de Aracaju (America/Maceio).
export const todayLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' })

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const dates = (e: Pick<EventRow, 'event_dates'>) => e.event_dates.map((d) => d.event_date).sort()

// Pré-Caju mostra o ano da primeira data; o nome-base nunca guarda o ano.
export function displayName(e: Pick<EventRow, 'display_name' | 'base_name' | 'type' | 'event_dates'>) {
  if (e.display_name) return e.display_name
  const ds = dates(e)
  return e.type !== 'EVENTO_EXTERNO' && ds.length ? `${e.base_name} ${ds[0].slice(0, 4)}` : e.base_name
}
export const nextValidDate = (e: Pick<EventRow, 'event_dates'>, today = todayLocal()) =>
  dates(e).find((d) => d >= today) ?? null
export const isExpired = (e: Pick<EventRow, 'event_dates'>) => e.event_dates.length > 0 && nextValidDate(e) === null

// ordem do bot: próxima data válida crescente; sem data depois; encerrados por último
export function sortEvents<T extends Pick<EventRow, 'event_dates'>>(list: T[]) {
  const rank = (e: T) => { const n = nextValidDate(e); return n ? [0, n] : isExpired(e) ? [2, ''] : [1, ''] }
  return [...list].sort((a, b) => { const x = rank(a), y = rank(b); return x[0] !== y[0] ? +x[0] - +y[0] : String(x[1]).localeCompare(String(y[1])) })
}

export function formatDates(ds: string[]) {
  const s = [...ds].sort()
  if (!s.length) return 'Sem data'
  const p = s.map((d) => d.split('-'))
  if (p.every((x) => x[0] === p[0][0] && x[1] === p[0][1])) {
    const days = p.map((x) => String(+x[2]))
    const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} e ${days[days.length - 1]}` : days[0]
    return `${list} de ${MONTHS[+p[0][1] - 1]} de ${p[0][0]}`
  }
  return p.map((x) => `${x[2]}/${x[1]}/${x[0]}`).join(', ')
}
export const shortDate = (d: string) => { const [, m, day] = d.split('-'); return `${day}/${m}` }
export const artworkUrl = (path: string | null) => path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
