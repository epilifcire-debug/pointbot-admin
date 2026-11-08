import { formatDates } from './events'
import { dayLabel } from './ui'
import { lotText, money } from './snapshot'

// Formato devolvido pela API do bot (e pelo preview). Só o que existe é enviado: seções vazias nunca vêm.
export type BotEvent = { key: string; name: string; type: string; state: 'ATIVO' | 'EM_BREVE'; next_date: string; dates: string[]
  location?: string; purchase_url?: string; artwork_url?: string; artists?: string[]; special_guests?: string[]
  days?: any[]; blocks_by_day?: any[]; areas?: any[]; packages?: any[]; payments?: any[] }
export type BotPayload = { api_version: number; published_version: number | null; published_at: string | null; server_date: string
  events: BotEvent[]; messages: Record<string, string>; settings: { support: any; attendance: any } }

export const subst = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)
const hourText = (hhmm: string) => { const [h, m] = hhmm.split(':'); return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}` }
export const attendanceText = (a: any) =>
  `Segunda a sábado: ${hourText(a.mon_sat.start)} às ${hourText(a.mon_sat.end)}\nDomingos e feriados: ${hourText(a.sun_holiday.start)} às ${hourText(a.sun_holiday.end)}`

// A numeração (1, 2, 3...) é gerada na hora a partir da ordem da API; nunca é guardada.
export function menuText(p: BotPayload) {
  const L = [p.messages.welcome ?? '', '']
  p.events.forEach((e, i) => L.push(`${i + 1} - ${e.name.toUpperCase()} (${formatDates(e.dates)})`))
  L.push(`${p.events.length + 1} - Falar com Atendente`)
  return L.join('\n')
}

const pay = (list?: any[]) => (list ?? []).flatMap((c) => [`${c.name} — ${c.label}`, ...(c.surcharge_text ? [`   ${c.surcharge_text}`] : [])])
const types = (list?: any[]) => (list ?? []).map((t) => `${t.name}${t.quantity ? ` (${t.quantity} ingressos)` : ''}: ${money(t.price)}`)
const sold = (s: string) => (s === 'SOLD_OUT' ? ' — ESGOTADO' : '')

export function eventText(e: BotEvent, p: BotPayload) {
  const L = [e.name.toUpperCase(), formatDates(e.dates)]
  if (e.location) L.push(e.location)
  if (e.state === 'EM_BREVE') {
    if (e.artists?.length) L.push('', 'ARTISTAS', ...e.artists.map((n) => `• ${n}`))
    if (e.special_guests?.length) L.push('', 'PARTICIPAÇÕES ESPECIAIS', ...e.special_guests.map((n) => `• ${n}`))
    L.push('', p.messages.coming_soon ?? '')
    return L.join('\n')
  }
  for (const d of e.days ?? []) {
    L.push('', `${dayLabel(d.date).toUpperCase()}${d.lot ? ` — ${lotText(d.lot)}` : ''}${sold(d.status)}`, ...types(d.ticket_types))
    if (d.artists?.length) L.push(`Atrações: ${d.artists.join(', ')}`)
    if (d.special_guests?.length) L.push(`Participações especiais: ${d.special_guests.join(', ')}`)
    if (d.payments?.length) L.push('Pagamento neste dia:', ...pay(d.payments))
  }
  for (const d of e.blocks_by_day ?? []) {
    L.push('', dayLabel(d.date).toUpperCase())
    for (const b of d.blocks) L.push(`${b.name}${b.artist ? ` (${b.artist})` : ''}${b.lot ? ` — ${lotText(b.lot)}` : ''} — ${money(b.price)}${sold(b.status)}`)
  }
  for (const a of e.areas ?? []) {
    L.push('', `${a.name.toUpperCase()}${a.lot ? ` — ${lotText(a.lot)}` : ''}${sold(a.status)}`, ...types(a.ticket_types))
    if (a.casadinha) L.push(`${a.casadinha.name} (2 ingressos): ${money(a.casadinha.price)}`)
    if (a.payments?.length) L.push('Pagamento nesta área:', ...pay(a.payments))
  }
  if (e.artists?.length) L.push('', 'ARTISTAS', ...e.artists.map((n) => `• ${n}`))
  if (e.special_guests?.length) L.push('', 'PARTICIPAÇÕES ESPECIAIS', ...e.special_guests.map((n) => `• ${n}`))
  if (e.packages?.length) L.push('', 'PACOTES', ...e.packages.flatMap((k) => [`${k.name}${k.price ? ` — ${money(k.price)}` : ''}${sold(k.status)}`,
    ...(k.prices ?? []).map((x: any) => `   ${x.name}: ${money(x.amount)}`), ...pay(k.payments).map((s) => `   ${s}`)]))
  if (e.payments?.length) L.push('', 'FORMAS DE PAGAMENTO', ...pay(e.payments))
  return L.join('\n')
}

export const buyText = (e: BotEvent, p: BotPayload) => subst(p.messages.buy_online ?? '', { link: e.purchase_url ?? '(link de compra não cadastrado)' })
export const attendantText = (p: BotPayload) => subst(p.messages.talk_to_attendant ?? '', { horario: attendanceText(p.settings.attendance) })
export function supportText(p: BotPayload) {
  const s = p.settings.support
  if (!s?.active) return 'Suporte Compras Online está desativado.'
  return [p.messages.online_support ?? '', '', s.message, `Contato: ${s.name ? s.name + ' ' : ''}${s.phone}`].filter((x, i) => x !== '' || i === 2).join('\n')
}
