import { STATUS_LABEL, TYPE_LABEL, formatDates } from './events'
import { dayLabel } from './ui'
import { paymentLabel } from './payments'

// O snapshot é guardado pelo banco e nunca muda. Aqui só o lemos e apresentamos.
export type Snap = { schema: number; event: any; dates: any[]; areas: any[]; ticket_types: any[]; artists: any[]; blocks: any[]; packages: any[]; payments: any[] }
export type Section = { title: string; lines: string[] }

const SALE: Record<string, string> = { ON_SALE: 'À venda', SOLD_OUT: 'Esgotado', HIDDEN: 'Oculto' }
export const money = (v: string | number | null | undefined) => {
  if (v == null || v === '') return 'sem preço'
  const [i, d] = Number(v).toFixed(2).split('.')
  return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`
}
export const lotText = (n: number | null | undefined) => (n ? `${n}º Lote` : 'sem lote')
const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : '')
const byDate = (a: any, b: any) => String(a.event_date).localeCompare(String(b.event_date))

export function describeSnapshot(s: Snap): Section[] {
  const e = s.event
  const dayName = new Map(s.dates.map((d) => [d.id, dayLabel(d.event_date)]))
  const areaName = new Map(s.areas.map((a) => [a.id, a.name]))
  const out: Section[] = [{ title: 'Evento', lines: [
    `Nome: ${e.shown_name}`, `Tipo: ${TYPE_LABEL[e.type as keyof typeof TYPE_LABEL]}`, `Status: ${STATUS_LABEL[e.status as keyof typeof STATUS_LABEL]}`,
    ...(e.location ? [`Local: ${e.location}`] : []), ...(e.purchase_url ? [`Link de compra: ${e.purchase_url}`] : []),
    e.artwork_path ? `Arte: anexada${e.send_artwork_whatsapp ? ' (enviada no WhatsApp)' : ' (não enviada no WhatsApp)'}` : 'Arte: sem arte',
  ] }]
  out.push({ title: 'Datas', lines: [...s.dates].sort(byDate).map((d) => `${dayLabel(d.event_date)}${hhmm(d.start_time) ? ` às ${hhmm(d.start_time)}` : ''} — ${lotText(d.current_lot)} — ${SALE[d.status]}`) })
  if (s.areas.length) out.push({ title: 'Áreas', lines: s.areas.map((a) => `${a.name} — ${lotText(a.current_lot)} — ${SALE[a.status]}`) })
  if (s.ticket_types.length) out.push({ title: 'Ingressos e preços', lines: s.ticket_types.map((t) => {
    const where = t.area_id ? areaName.get(t.area_id) : t.event_date_id ? dayName.get(t.event_date_id) : 'Evento'
    return `${where}: ${t.name} — ${money(t.price)}${t.quantity_per_purchase > 1 ? ` (${t.quantity_per_purchase} ingressos)` : ''}`
  }) })
  if (s.blocks.length) out.push({ title: 'Blocos', lines: s.blocks.map((b) => `${dayName.get(b.event_date_id)}: ${b.name}${b.artist ? ` (${b.artist})` : ''} — ${lotText(b.current_lot)} — ${money(b.price)} — ${SALE[b.status]}`) })
  const art = (k: string) => s.artists.filter((a) => a.participation_type === k)
  const who = (a: any) => `${a.event_date_id ? `${dayName.get(a.event_date_id)}: ` : ''}${a.name}`
  if (art('ARTIST').length) out.push({ title: 'Artistas', lines: art('ARTIST').map(who) })
  if (art('SPECIAL_GUEST').length) out.push({ title: 'Participações especiais', lines: art('SPECIAL_GUEST').map(who) })
  if (s.packages.length) out.push({ title: 'Pacotes', lines: s.packages.flatMap((p) => [
    `${p.name} — ${SALE[p.status]}${p.price ? ` — ${money(p.price)}` : ''}`,
    ...p.prices.map((x: any) => `   ${x.name}: ${money(x.amount)}`),
  ]) })
  if (s.payments.length) out.push({ title: 'Formas de pagamento', lines: s.payments.map((c) => {
    const scope = c.scope_type === 'EVENT' ? '' : `[${c.scope_type === 'AREA' ? areaName.get(c.scope_id) : c.scope_type === 'DATE' ? dayName.get(c.scope_id) : 'Pacote'}] `
    return `${scope}${c.name} — ${paymentLabel({ cash: c.cash_only, max: c.max_installments ?? '', sur: c.has_surcharge })}${c.has_surcharge && c.surcharge_text ? ` (${c.surcharge_text})` : ''}${c.active ? '' : ' — inativa'}`
  }) })
  return out
}

// "Print": como a configuração daquela versão aparece no bot (derivado do snapshot, sem dados atuais)
export function botPreview(s: Snap): { artwork: string | null; lines: string[] } {
  const e = s.event, L: string[] = []
  const artwork = e.send_artwork_whatsapp ? e.artwork_path : null
  L.push(String(e.shown_name).toUpperCase(), formatDates(s.dates.map((d) => d.event_date)))
  if (e.location) L.push(e.location)
  const uniq = (k: string, day?: string | null) => [...new Set(s.artists.filter((a) => a.participation_type === k && (day === undefined || a.event_date_id === day)).map((a) => a.name))]
  if (e.status === 'EM_BREVE') {
    if (uniq('ARTIST').length) L.push('', 'ARTISTAS', ...uniq('ARTIST').map((n) => `• ${n}`))
    if (uniq('SPECIAL_GUEST').length) L.push('', 'PARTICIPAÇÕES ESPECIAIS', ...uniq('SPECIAL_GUEST').map((n) => `• ${n}`))
    L.push('', 'Mais informações em breve!')
    return { artwork, lines: L }
  }
  const price = (t: any) => `${t.name}${t.quantity_per_purchase > 1 ? ` (${t.quantity_per_purchase} ingressos)` : ''}: ${money(t.price)}`
  const sold = (st: string) => (st === 'SOLD_OUT' ? ' — ESGOTADO' : '')
  if (e.type === 'PRE_CAJU_CAMAROTE') {
    for (const d of [...s.dates].sort(byDate).filter((x) => x.status !== 'HIDDEN')) {
      L.push('', `${dayLabel(d.event_date).toUpperCase()} — ${lotText(d.current_lot)}${sold(d.status)}`)
      L.push(...s.ticket_types.filter((t) => t.event_date_id === d.id && t.active).map(price))
      if (uniq('ARTIST', d.id).length) L.push(`Atrações: ${uniq('ARTIST', d.id).join(', ')}`)
      if (uniq('SPECIAL_GUEST', d.id).length) L.push(`Participações especiais: ${uniq('SPECIAL_GUEST', d.id).join(', ')}`)
    }
  } else if (e.type === 'PRE_CAJU_BLOCOS') {
    for (const d of [...s.dates].sort(byDate)) {
      const bl = s.blocks.filter((b) => b.event_date_id === d.id && b.status !== 'HIDDEN')
      if (!bl.length) continue
      L.push('', dayLabel(d.event_date).toUpperCase())
      L.push(...bl.map((b) => `${b.name}${b.artist ? ` (${b.artist})` : ''} — ${lotText(b.current_lot)} — ${money(b.price)}${sold(b.status)}`))
    }
  } else {
    for (const a of s.areas.filter((x) => x.status !== 'HIDDEN')) {
      L.push('', `${a.name.toUpperCase()} — ${lotText(a.current_lot)}${sold(a.status)}`)
      L.push(...s.ticket_types.filter((t) => t.area_id === a.id && t.active).map(price))
    }
    if (uniq('ARTIST').length) L.push('', 'ARTISTAS', ...uniq('ARTIST').map((n) => `• ${n}`))
    if (uniq('SPECIAL_GUEST').length) L.push('', 'PARTICIPAÇÕES ESPECIAIS', ...uniq('SPECIAL_GUEST').map((n) => `• ${n}`))
  }
  const pk = s.packages.filter((p) => p.status !== 'HIDDEN')
  if (pk.length) L.push('', 'PACOTES', ...pk.flatMap((p) => [`${p.name}${p.price ? ` — ${money(p.price)}` : ''}`, ...p.prices.map((x: any) => `   ${x.name}: ${money(x.amount)}`)]))
  const pay = s.payments.filter((c) => c.active && c.scope_type === 'EVENT')
  if (pay.length) L.push('', 'FORMAS DE PAGAMENTO', ...pay.flatMap((c) => [
    `${c.name} — ${paymentLabel({ cash: c.cash_only, max: c.max_installments ?? '', sur: c.has_surcharge })}`,
    ...(c.has_surcharge && c.surcharge_text ? [`   ${c.surcharge_text}`] : []),
  ]))
  return { artwork, lines: L }
}
