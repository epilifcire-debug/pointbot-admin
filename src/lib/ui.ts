export const uid = () => crypto.randomUUID()
export const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand'
export const STATUS: [string, string][] = [['ON_SALE', 'À venda'], ['SOLD_OUT', 'Esgotado'], ['HIDDEN', 'Oculto']]
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const dayLabel = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${WEEK[new Date(y, m - 1, dd).getDay()]} ${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}` }
export const fmtPrice = (a: number | string) => Number(a).toFixed(2).replace('.', ',')
export function parsePrice(s: string): number | null | 'bad' {
  const t = s.trim().replace(/^R\$\s*/, '')
  if (!t) return null
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^\d+(\.\d{1,2})?$/.test(n) ? Number(n) : 'bad'
}
export const move = <T,>(l: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= l.length) return l; const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c }
export type Day = { id: string; event_date: string }
export type Msg = { ok: boolean; text: string } | null
