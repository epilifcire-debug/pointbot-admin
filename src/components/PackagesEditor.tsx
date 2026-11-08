import { useCallback, useEffect, useState } from 'react'
import { commitVersion, savedText } from '../lib/versions'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS, dayLabel, fmtPrice, input, parsePrice, uid, type Day, type Msg } from '../lib/ui'

type PP = { key: string; name: string; category: string; amount: string }
type P = { key: string; id?: string; name: string; status: string; price: string; dates: string[]; blocks: string[]; prices: PP[] }
type Blk = { id: string; name: string; event_date_id: string }
const lbl = 'mb-1 block text-xs font-semibold text-muted'

export default function PackagesEditor({ eventId, blocksType, days, refreshKey }: { eventId: string; blocksType: boolean; days: Day[]; refreshKey: number }) {
  const [pk, setPk] = useState<P[]>([])
  const [blocks, setBlocks] = useState<Blk[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const sortedDays = [...days].sort((a, b) => a.event_date.localeCompare(b.event_date))

  const loadBlocks = useCallback(async () => {
    if (!blocksType) return
    const { data } = await supabase.from('blocks').select('id,name,event_date_id,sort_order').eq('event_id', eventId).order('sort_order')
    setBlocks((data ?? []) as Blk[])
  }, [eventId, blocksType])
  useEffect(() => { void loadBlocks() }, [loadBlocks, refreshKey])

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('packages')
      .select('id,name,status,price,sort_order,package_dates(event_date_id),package_blocks(block_id),package_prices(name,category,amount,active,sort_order)')
      .eq('event_id', eventId).order('sort_order')
    if (error) return setMsg({ ok: false, text: 'Não foi possível carregar os pacotes.' })
    setPk((data ?? []).map((r: any) => ({
      key: r.id, id: r.id, name: r.name, status: r.status, price: r.price != null ? fmtPrice(r.price) : '',
      dates: (r.package_dates ?? []).map((x: any) => x.event_date_id), blocks: (r.package_blocks ?? []).map((x: any) => x.block_id),
      prices: [...(r.package_prices ?? [])].filter((x: any) => x.active).sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((x: any) => ({ key: uid(), name: x.name, category: x.category, amount: fmtPrice(x.amount) })),
    })))
    setLoaded(true); setDirty(false)
  }, [eventId])
  useEffect(() => { void load() }, [load])

  const set = (key: string, patch: Partial<P>) => { setPk(pk.map((p) => p.key === key ? { ...p, ...patch } : p)); setDirty(true) }
  const toggle = (list: string[], v: string) => list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

  const fillTypes = async (p: P) => {
    const first = p.dates.length ? sortedDays.find((d) => p.dates.includes(d.id)) : sortedDays[0]
    if (!first) return setMsg({ ok: false, text: 'Escolha um dia primeiro.' })
    const { data } = await supabase.from('ticket_types').select('name,category').eq('event_date_id', first.id).is('area_id', null).order('sort_order')
    if (!data?.length) return setMsg({ ok: false, text: `O dia ${dayLabel(first.event_date)} ainda não tem tipos de ingresso.` })
    set(p.key, { prices: data.map((t: any) => ({ key: uid(), name: t.name, category: t.category, amount: '' })) }); setMsg(null)
  }

  const save = async () => {
    setMsg(null)
    const names = pk.map((p) => p.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) return setMsg({ ok: false, text: 'Há pacotes com o mesmo nome.' })
    const out: any[] = []
    for (const p of pk) {
      const price = parsePrice(p.price)
      const rows = p.prices.map((x) => ({ ...x, a: parsePrice(x.amount) }))
      if (price === 'bad' || rows.some((x) => x.a === 'bad')) return setMsg({ ok: false, text: `Preço inválido no pacote "${p.name}". Use o formato 350,00.` })
      out.push({ id: p.id ?? null, name: p.name, status: p.status, price, date_ids: p.dates, block_ids: p.blocks,
        prices: rows.map((x) => ({ name: x.name, category: x.category, amount: x.a })) })
    }
    setBusy(true)
    const { error } = await supabase.rpc('save_packages', { p_event: eventId, p_packages: out })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.code === '23505' ? 'Há nomes repetidos (pacotes ou ingressos do pacote).' : error.message || 'Não foi possível salvar.' })
    await load(); const r = await commitVersion(eventId); setMsg({ ok: true, text: savedText('Pacotes salvos.', r) })
  }

  if (!loaded) return <p className="text-sm text-muted">{msg?.text ?? 'Carregando pacotes...'}</p>
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Pacotes</h2>
        <button type="button" onClick={() => { setPk([...pk, { key: uid(), name: '', status: 'ON_SALE', price: '', dates: [], blocks: [], prices: [] }]); setDirty(true) }}
          className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />Adicionar pacote</button>
      </div>
      {!pk.length && <p className="text-xs text-muted">Sem pacotes: o bot não mostra essa seção. Um pacote deixa de aparecer quando algum dos seus dias expira.</p>}

      {pk.map((p) => (
        <div key={p.key} className="space-y-3 rounded-xl border border-line bg-bg p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1"><label className={lbl}>Nome do pacote</label><input className={input} value={p.name} onChange={(e) => set(p.key, { name: e.target.value })} placeholder={blocksType ? 'Ex.: Pacote 2 dias' : 'Ex.: Pacote 3 dias'} /></div>
            <div className="w-32"><label className={lbl}>Status</label>
              <select className={input} value={p.status} onChange={(e) => set(p.key, { status: e.target.value })}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <button type="button" aria-label="Remover pacote" onClick={() => { setPk(pk.filter((x) => x.key !== p.key)); setDirty(true) }} className="mb-2 text-muted hover:text-alert"><Trash2 size={18} /></button>
          </div>

          {blocksType ? (
            <>
              <div>
                <span className={lbl}>Blocos do pacote</span>
                {!blocks.length && <p className="text-xs text-muted">Cadastre os blocos nos dias antes de montar o pacote.</p>}
                {sortedDays.map((d) => {
                  const bl = blocks.filter((b) => b.event_date_id === d.id)
                  return bl.length ? (
                    <div key={d.id} className="mb-2">
                      <div className="text-xs text-muted">{dayLabel(d.event_date)}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {bl.map((b) => <label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.blocks.includes(b.id)} onChange={() => set(p.key, { blocks: toggle(p.blocks, b.id) })} />{b.name}</label>)}
                      </div>
                    </div>
                  ) : null
                })}
              </div>
              <div className="w-40"><label className={lbl}>Preço do pacote</label><input className={input} inputMode="decimal" value={p.price} onChange={(e) => set(p.key, { price: e.target.value })} placeholder="R$ 0,00" /></div>
            </>
          ) : (
            <>
              <div>
                <span className={lbl}>Dias do pacote</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {sortedDays.map((d) => <label key={d.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.dates.includes(d.id)} onChange={() => set(p.key, { dates: toggle(p.dates, d.id) })} />{dayLabel(d.event_date)}</label>)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={lbl}>Preço por tipo de ingresso</span>
                  <span className="flex gap-3 text-sm font-semibold text-brand-soft">
                    <button type="button" onClick={() => void fillTypes(p)}>Usar tipos do dia</button>
                    <button type="button" onClick={() => set(p.key, { prices: [...p.prices, { key: uid(), name: '', category: 'CUSTOM', amount: '' }] })}>Adicionar</button>
                  </span>
                </div>
                {p.prices.map((x) => (
                  <div key={x.key} className="flex gap-2">
                    <input className={input} value={x.name} placeholder="Nome do ingresso" aria-label="Nome do ingresso" onChange={(e) => set(p.key, { prices: p.prices.map((y) => y.key === x.key ? { ...y, name: e.target.value } : y) })} />
                    <input className={`${input} w-32`} inputMode="decimal" value={x.amount} placeholder="R$ 0,00" aria-label="Preço" onChange={(e) => set(p.key, { prices: p.prices.map((y) => y.key === x.key ? { ...y, amount: e.target.value } : y) })} />
                    <button type="button" aria-label="Remover" onClick={() => set(p.key, { prices: p.prices.filter((y) => y.key !== x.key) })} className="text-muted hover:text-alert"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}
      <button type="button" disabled={busy || (!dirty && !pk.length)} onClick={save} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy ? 'Salvando...' : dirty ? 'Salvar pacotes •' : 'Salvar pacotes'}</button>
    </section>
  )
}
