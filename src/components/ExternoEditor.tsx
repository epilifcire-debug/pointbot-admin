import { useCallback, useEffect, useState } from 'react'
import { commitVersion, savedText } from '../lib/versions'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS, fmtPrice, input, move, parsePrice, uid, type Msg } from '../lib/ui'
import NameList, { type NDraft } from './NameList'

type TD = { key: string; id?: string; name: string; category: string; qty: number; price: string }
type Casa = { id?: string; on: boolean; name: string; price: string }
type Area = { key: string; id?: string; name: string; lot: string; status: string; types: TD[]; casa: Casa }

const STD: [string, string][] = [['Meia Entrada', 'MEIA'], ['Entrada Solidária', 'SOLIDARIA'], ['Inteira', 'INTEIRA']]
const lbl = 'mb-1 block text-xs font-semibold text-muted'
const blank = (): Area => ({ key: uid(), name: '', lot: '', status: 'ON_SALE', types: [], casa: { on: false, name: 'Casadinha', price: '' } })

function Note({ m }: { m: Msg }) {
  return m ? <p role="status" className={`rounded-lg px-3 py-2 text-sm ${m.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{m.text}</p> : null
}

export default function ExternoEditor({ eventId }: { eventId: string }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [artists, setArtists] = useState<NDraft[]>([])
  const [guests, setGuests] = useState<NDraft[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dirtyA, setDirtyA] = useState(false)
  const [dirtyB, setDirtyB] = useState(false)
  const [busy, setBusy] = useState<'a' | 'b' | null>(null)
  const [msgA, setMsgA] = useState<Msg>(null)
  const [msgB, setMsgB] = useState<Msg>(null)

  const loadAreas = useCallback(async () => {
    const { data, error } = await supabase.from('event_areas')
      .select('id,name,current_lot,status,sort_order,ticket_types(id,name,category,quantity_per_purchase,sort_order,ticket_prices(amount,active))')
      .eq('event_id', eventId).order('sort_order')
    if (error) return setMsgA({ ok: false, text: 'Não foi possível carregar as áreas.' })
    setAreas((data ?? []).map((a: any) => {
      const ts = [...(a.ticket_types ?? [])].sort((x: any, y: any) => x.sort_order - y.sort_order)
      const row = (t: any): TD => { const p = (t.ticket_prices ?? []).find((x: any) => x.active); return { key: t.id, id: t.id, name: t.name, category: t.category, qty: t.quantity_per_purchase, price: p ? fmtPrice(p.amount) : '' } }
      const c = ts.find((t: any) => t.category === 'CASADINHA')
      return { key: a.id, id: a.id, name: a.name, lot: a.current_lot ? String(a.current_lot) : '', status: a.status,
        types: ts.filter((t: any) => t.category !== 'CASADINHA').map(row),
        casa: c ? { id: c.id, on: true, name: c.name, price: row(c).price } : { on: false, name: 'Casadinha', price: '' } }
    }))
    setDirtyA(false)
  }, [eventId])

  const loadArtists = useCallback(async () => {
    const { data, error } = await supabase.from('event_artists').select('id,participation_type,sort_order,artists(name)')
      .eq('event_id', eventId).is('event_date_id', null).order('sort_order')
    if (error) return setMsgB({ ok: false, text: 'Não foi possível carregar os artistas.' })
    const pick = (k: string) => (data ?? []).filter((r: any) => r.participation_type === k).map((r: any) => ({ key: r.id, id: r.id, name: r.artists?.name ?? '' }))
    setArtists(pick('ARTIST')); setGuests(pick('SPECIAL_GUEST')); setDirtyB(false)
  }, [eventId])

  useEffect(() => { void Promise.all([loadAreas(), loadArtists()]).then(() => setLoaded(true)) }, [loadAreas, loadArtists])

  const setA = (key: string, patch: Partial<Area>) => { setAreas((l) => l.map((a) => a.key === key ? { ...a, ...patch } : a)); setDirtyA(true) }
  const setT = (ak: string, tk: string, patch: Partial<TD>) => { setAreas((l) => l.map((a) => a.key === ak ? { ...a, types: a.types.map((t) => t.key === tk ? { ...t, ...patch } : t) } : a)); setDirtyA(true) }

  const saveAreas = async () => {
    setMsgA(null)
    const lower = (s: string) => s.trim().toLowerCase()
    if (new Set(areas.map((a) => lower(a.name))).size !== areas.length) return setMsgA({ ok: false, text: 'Há áreas com o mesmo nome.' })
    const payload: any[] = []
    for (const a of areas) {
      const list = a.types.map((t) => ({ t, p: parsePrice(t.price) }))
      const cp = a.casa.on ? parsePrice(a.casa.price) : null
      if (list.some((x) => x.p === 'bad') || cp === 'bad') return setMsgA({ ok: false, text: `Preço inválido na área "${a.name}". Use o formato 100,00.` })
      const names = [...a.types.map((t) => lower(t.name)), ...(a.casa.on ? [lower(a.casa.name || 'Casadinha')] : [])]
      if (new Set(names).size !== names.length) return setMsgA({ ok: false, text: `A área "${a.name}" tem ingressos com o mesmo nome.` })
      payload.push({ id: a.id ?? null, name: a.name, lot: a.lot ? Number(a.lot) : null, status: a.status,
        types: [...list.map(({ t, p }) => ({ id: t.id ?? null, name: t.name, category: t.category, quantity: t.qty, price: p })),
                ...(a.casa.on ? [{ id: a.casa.id ?? null, name: a.casa.name.trim() || 'Casadinha', category: 'CASADINHA', quantity: 2, price: cp }] : [])] })
    }
    setBusy('a')
    const { error } = await supabase.rpc('save_event_areas', { p_event: eventId, p_areas: payload })
    setBusy(null)
    if (error) return setMsgA({ ok: false, text: error.code === '23505' ? 'Há nomes repetidos (áreas ou ingressos da mesma área).' : error.message || 'Não foi possível salvar.' })
    await loadAreas(); const r = await commitVersion(eventId); setMsgA({ ok: true, text: savedText('Áreas e ingressos salvos.', r) })
  }

  const saveArtists = async () => {
    setMsgB(null)
    const dup = (l: NDraft[]) => new Set(l.map((x) => x.name.trim().toLowerCase())).size !== l.length
    if (dup(artists) || dup(guests)) return setMsgB({ ok: false, text: 'Há nomes repetidos na mesma lista.' })
    setBusy('b')
    const { error } = await supabase.rpc('save_event_artists', { p_event: eventId, p_artists: [
      ...artists.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? null, name: a.name, type: 'ARTIST' })),
      ...guests.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? null, name: a.name, type: 'SPECIAL_GUEST' }))] })
    setBusy(null)
    if (error) return setMsgB({ ok: false, text: error.code === '23505' ? 'Há nomes repetidos.' : error.message || 'Não foi possível salvar.' })
    await loadArtists(); const r = await commitVersion(eventId); setMsgB({ ok: true, text: savedText('Artistas salvos.', r) })
  }

  if (!loaded) return <p className="text-sm text-muted">{msgA?.text ?? 'Carregando...'}</p>

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Áreas e ingressos</h2>
          <button type="button" onClick={() => { setAreas((l) => [...l, blank()]); setDirtyA(true) }} className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />Adicionar área</button>
        </div>
        {!areas.length && <p className="text-xs text-muted">Nenhuma área ainda. Cada área tem o seu próprio lote (ex.: Arena, Área VIP).</p>}

        {areas.map((a, ai) => (
          <div key={a.key} className="space-y-4 rounded-xl border border-line bg-bg p-3">
            <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]">
              <div className="col-span-2 sm:col-span-1"><label className={lbl}>Nome da área</label><input className={input} value={a.name} placeholder="Ex.: Arena" onChange={(e) => setA(a.key, { name: e.target.value })} /></div>
              <div><label className={lbl}>Lote atual</label>
                <select className={input} value={a.lot} onChange={(e) => setA(a.key, { lot: e.target.value })}>
                  <option value="">Sem lote</option>
                  {Array.from({ length: Math.max(10, Number(a.lot) || 0) }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}º Lote</option>)}
                </select></div>
              <div><label className={lbl}>Status</label>
                <select className={input} value={a.status} onChange={(e) => setA(a.key, { status: e.target.value })}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <span className="flex pb-1">
                <button type="button" aria-label="Subir área" onClick={() => { setAreas((l) => move(l, ai, -1)); setDirtyA(true) }} className="p-1 text-muted hover:text-white"><ArrowUp size={16} /></button>
                <button type="button" aria-label="Descer área" onClick={() => { setAreas((l) => move(l, ai, 1)); setDirtyA(true) }} className="p-1 text-muted hover:text-white"><ArrowDown size={16} /></button>
                <button type="button" aria-label="Remover área" onClick={() => { if (!a.id || window.confirm(`Remover a área "${a.name || 'sem nome'}" com todos os seus ingressos?`)) { setAreas((l) => l.filter((x) => x.key !== a.key)); setDirtyA(true) } }} className="p-1 text-muted hover:text-alert"><Trash2 size={16} /></button>
              </span>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold">Tipos de ingresso</h4>
                <button type="button" onClick={() => setA(a.key, { types: [...a.types, { key: uid(), name: '', category: 'CUSTOM', qty: 1, price: '' }] })} className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />Adicionar tipo</button>
              </div>
              {!a.types.length && (
                <button type="button" onClick={() => setA(a.key, { types: STD.map(([name, category]) => ({ key: uid(), name, category, qty: 1, price: '' })) })}
                  className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-brand hover:text-white">Adicionar Meia, Solidária e Inteira</button>
              )}
              <ul className="space-y-2">
                {a.types.map((t, ti) => (
                  <li key={t.key} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 sm:grid-cols-[1fr_8rem_5rem_auto]">
                    <input className={input} value={t.name} placeholder="Nome do ingresso" aria-label="Nome do ingresso" onChange={(e) => setT(a.key, t.key, { name: e.target.value })} />
                    <input className={input} inputMode="decimal" value={t.price} placeholder="R$ 0,00" aria-label="Preço" onChange={(e) => setT(a.key, t.key, { price: e.target.value })} />
                    {t.category === 'CUSTOM'
                      ? <input className={`${input} hidden sm:block`} type="number" min={1} value={t.qty} aria-label="Ingressos por compra" title="Ingressos por compra" onChange={(e) => setT(a.key, t.key, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                      : <span className="hidden sm:block" />}
                    <span className="flex">
                      <button type="button" aria-label="Subir" onClick={() => setA(a.key, { types: move(a.types, ti, -1) })} className="p-1 text-muted hover:text-white"><ArrowUp size={16} /></button>
                      <button type="button" aria-label="Descer" onClick={() => setA(a.key, { types: move(a.types, ti, 1) })} className="p-1 text-muted hover:text-white"><ArrowDown size={16} /></button>
                      <button type="button" aria-label="Remover" onClick={() => setA(a.key, { types: a.types.filter((x) => x.key !== t.key) })} className="p-1 text-muted hover:text-alert"><Trash2 size={16} /></button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">Deixe o preço vazio se ainda não foi definido.</p>
            </div>

            <div className="space-y-3 rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={a.casa.on} onChange={(e) => setA(a.key, { casa: { ...a.casa, on: e.target.checked } })} />Habilitar Casadinha (2 ingressos)
              </label>
              {a.casa.on && (
                <div className="grid grid-cols-[1fr_8rem] gap-2">
                  <div><label className={lbl}>Nome da Casadinha</label><input className={input} value={a.casa.name} onChange={(e) => setA(a.key, { casa: { ...a.casa, name: e.target.value } })} /></div>
                  <div><label className={lbl}>Preço</label><input className={input} inputMode="decimal" value={a.casa.price} placeholder="R$ 0,00" aria-label="Preço da Casadinha" onChange={(e) => setA(a.key, { casa: { ...a.casa, price: e.target.value } })} /></div>
                </div>
              )}
              <p className="text-xs text-muted">{a.casa.on ? 'No bot aparece como 2 ingressos pelo preço informado.' : 'Desligada: a Casadinha não aparece no bot.'}</p>
            </div>
          </div>
        ))}

        <Note m={msgA} />
        <button type="button" disabled={busy === 'a'} onClick={saveAreas} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy === 'a' ? 'Salvando...' : dirtyA ? 'Salvar áreas e ingressos •' : 'Salvar áreas e ingressos'}</button>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Artistas e participações</h2>
        <NameList title="Artistas / atrações" items={artists} onChange={(l) => { setArtists(l); setDirtyB(true) }} add="Adicionar artista" />
        <NameList title="Participações especiais (opcional)" hint="Se não houver, esta seção não aparece no bot." items={guests} onChange={(l) => { setGuests(l); setDirtyB(true) }} add="Adicionar" />
        <Note m={msgB} />
        <button type="button" disabled={busy === 'b'} onClick={saveArtists} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy === 'b' ? 'Salvando...' : dirtyB ? 'Salvar artistas •' : 'Salvar artistas'}</button>
      </section>
    </>
  )
}
