import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import CamaroteDays from '../components/CamaroteDays'
import BlocosDays from '../components/BlocosDays'
import ExternoEditor from '../components/ExternoEditor'
import PaymentsEditor from '../components/PaymentsEditor'
import PackagesEditor from '../components/PackagesEditor'
import { BUCKET, EVENT_SELECT, STATUS_LABEL, TYPE_LABEL, artworkUrl, displayName, type EventRow, type EventStatus, type EventType } from '../lib/events'

type Draft = { key: string; id?: string; event_date: string; start_time: string }
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand'
const label = 'mb-1 block text-xs font-semibold text-muted'
const uid = () => crypto.randomUUID()

export default function EventoForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [loading, setLoading] = useState(Boolean(id))
  const [type, setType] = useState<EventType>('EVENTO_EXTERNO')
  const [f, setF] = useState({ base_name: '', status: 'EM_BREVE' as EventStatus, location: '', purchase_url: '', description: '', send: false })
  const [days, setDays] = useState<Draft[]>([{ key: uid(), event_date: '', start_time: '' }])
  const [orig, setOrig] = useState<{ dayIds: string[]; art: string | null }>({ dayIds: [], art: null })
  const [file, setFile] = useState<File | null>(null)
  const [removeArt, setRemoveArt] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [blocksKey, setBlocksKey] = useState(0)

  useEffect(() => {
    if (!id) return
    supabase.from('events').select(EVENT_SELECT).eq('id', id).maybeSingle().then(({ data }) => {
      const e = data as EventRow | null
      if (!e) { setMsg({ ok: false, text: 'Evento não encontrado.' }); setLoading(false); return }
      setType(e.type)
      setF({ base_name: e.base_name, status: e.status, location: e.location ?? '', purchase_url: e.purchase_url ?? '', description: e.description ?? '', send: e.send_artwork_whatsapp })
      const ds = [...e.event_dates].sort((a, b) => a.event_date.localeCompare(b.event_date))
      setDays(ds.length ? ds.map((d) => ({ key: d.id, id: d.id, event_date: d.event_date, start_time: (d.start_time ?? '').slice(0, 5) })) : [{ key: uid(), event_date: '', start_time: '' }])
      setOrig({ dayIds: ds.map((d) => d.id), art: e.artwork_path })
      setLoading(false)
    })
  }, [id])

  const preview = useMemo(() => file ? URL.createObjectURL(file) : removeArt ? null : artworkUrl(orig.art), [file, removeArt, orig.art])
  const name = displayName({ display_name: null, base_name: f.base_name || '...', type, event_dates: days.filter((d) => d.event_date).map((d) => ({ id: d.key, event_date: d.event_date, start_time: null })) })

  const pick = (fl: File | undefined) => {
    if (!fl) return
    if (!['image/jpeg', 'image/png'].includes(fl.type)) return setMsg({ ok: false, text: 'A imagem deve ser JPG ou PNG.' })
    if (fl.size > 2 * 1024 * 1024) return setMsg({ ok: false, text: 'A imagem deve ter no máximo 2 MB.' })
    setMsg(null); setFile(fl); setRemoveArt(false)
  }

  const save = async (ev: FormEvent) => {
    ev.preventDefault(); setMsg(null)
    const valid = days.filter((d) => d.event_date)
    if (!f.base_name.trim()) return setMsg({ ok: false, text: 'Informe o nome do evento.' })
    if (f.status !== 'INATIVO' && !valid.length) return setMsg({ ok: false, text: 'Informe pelo menos uma data (ou deixe o evento Inativo).' })
    if (new Set(valid.map((d) => d.event_date)).size !== valid.length) return setMsg({ ok: false, text: 'Há datas repetidas.' })

    setBusy(true)
    const payload = {
      base_name: f.base_name.trim(), status: f.status, location: f.location.trim() || null,
      purchase_url: f.purchase_url.trim() || null, description: f.description.trim() || null, send_artwork_whatsapp: f.send,
    }
    let eid = id
    if (!eid) {
      const { data, error } = await supabase.from('events').insert({ ...payload, type }).select('id').single()
      if (error || !data) { setBusy(false); return setMsg({ ok: false, text: 'Não foi possível salvar o evento.' }) }
      eid = data.id as string
    } else {
      const { error } = await supabase.from('events').update(payload).eq('id', eid)
      if (error) { setBusy(false); return setMsg({ ok: false, text: 'Não foi possível salvar o evento.' }) }
    }

    // dias: remove os apagados, atualiza os existentes, cria os novos
    const keep = valid.filter((d) => d.id).map((d) => d.id!)
    const removed = orig.dayIds.filter((x) => !keep.includes(x))
    if (removed.length) {
      const { error } = await supabase.from('event_dates').delete().in('id', removed)
      if (error) { setBusy(false); return setMsg({ ok: false, text: 'Não foi possível remover um dia: ele já tem ingressos, atrações ou pacotes ligados a ele.' }) }
    }
    for (const [i, d] of valid.entries()) {
      const row = { event_id: eid, event_date: d.event_date, start_time: d.start_time || null, sort_order: i }
      const { error } = d.id ? await supabase.from('event_dates').update(row).eq('id', d.id) : await supabase.from('event_dates').insert(row)
      if (error) { setBusy(false); return setMsg({ ok: false, text: 'Não foi possível salvar as datas.' }) }
    }

    // arte: guarda só o caminho no banco
    let art = orig.art
    if (file) {
      const path = `${eid}/${uid()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (up.error) { setBusy(false); return setMsg({ ok: false, text: 'Evento salvo, mas o envio da imagem falhou. Tente de novo.' }) }
      await supabase.from('events').update({ artwork_path: path }).eq('id', eid)
      if (orig.art) await supabase.storage.from(BUCKET).remove([orig.art])
      art = path
    } else if (removeArt && orig.art) {
      await supabase.from('events').update({ artwork_path: null }).eq('id', eid)
      await supabase.storage.from(BUCKET).remove([orig.art]); art = null
    }

    setBusy(false)
    if (!id) return nav(`/eventos/${eid}`, { replace: true })
    const { data } = await supabase.from('event_dates').select('id').eq('event_id', eid)
    setOrig({ dayIds: (data ?? []).map((r) => r.id as string), art }); setFile(null); setRemoveArt(false)
    setMsg({ ok: true, text: 'Evento salvo.' })
    // recarrega ids dos dias novos
    const { data: fresh } = await supabase.from('events').select(EVENT_SELECT).eq('id', eid).maybeSingle()
    const ds = [...((fresh as EventRow | null)?.event_dates ?? [])].sort((a, b) => a.event_date.localeCompare(b.event_date))
    if (ds.length) setDays(ds.map((d) => ({ key: d.id, id: d.id, event_date: d.event_date, start_time: (d.start_time ?? '').slice(0, 5) })))
  }

  const savedDays = days.filter((d) => d.id && d.event_date).map((d) => ({ id: d.id!, event_date: d.event_date }))

  if (loading) return <p className="text-sm text-muted">Carregando...</p>

  return (
    <div className="mx-auto max-w-3xl space-y-5">
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/eventos" className="text-xs text-muted hover:text-white">Eventos /</Link>
          <h1 className="text-2xl font-extrabold">{id ? name : 'Novo evento'}</h1>
        </div>
        <button disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy ? 'Salvando...' : 'Salvar'}</button>
      </div>

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Informações gerais</h2>
        <div>
          <span className={label}>Tipo de evento</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TYPE_LABEL) as EventType[]).map((t) => (
              <label key={t} className={`rounded-xl border px-3 py-2.5 text-sm ${type === t ? 'border-brand bg-brand/10' : 'border-line'} ${id && type !== t ? 'opacity-40' : 'cursor-pointer'}`}>
                <input type="radio" className="mr-2" name="type" checked={type === t} disabled={Boolean(id)} onChange={() => setType(t)} />{TYPE_LABEL[t]}
              </label>
            ))}
          </div>
          {id && <p className="mt-1 text-xs text-muted">O tipo não pode ser alterado depois de criado.</p>}
        </div>
        <div>
          <label className={label} htmlFor="nome">Nome base</label>
          <input id="nome" className={input} value={f.base_name} onChange={(e) => setF({ ...f, base_name: e.target.value })} placeholder={type === 'PRE_CAJU_CAMAROTE' ? 'Camarote Aju' : type === 'PRE_CAJU_BLOCOS' ? 'Blocos Pré-Caju' : 'Nome do evento'} required />
          {type !== 'EVENTO_EXTERNO' && <p className="mt-1 text-xs text-muted">O ano vem das datas. No bot aparece: <b className="text-white">{name}</b></p>}
        </div>
        <div>
          <span className={label}>Status</span>
          <div className="flex flex-wrap gap-4 text-sm">
            {(Object.keys(STATUS_LABEL) as EventStatus[]).map((s) => (
              <label key={s} className="flex items-center gap-2"><input type="radio" name="status" checked={f.status === s} onChange={() => setF({ ...f, status: s })} />{STATUS_LABEL[s]}</label>
            ))}
          </div>
          {f.status === 'EM_BREVE' && <p className="mt-1 text-xs text-muted">Em breve não precisa de preços: o bot mostra nome, data e artistas.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label} htmlFor="local">Local</label><input id="local" className={input} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div><label className={label} htmlFor="link">Link de compra</label><input id="link" className={input} type="url" placeholder="https://" value={f.purchase_url} onChange={(e) => setF({ ...f, purchase_url: e.target.value })} /></div>
        </div>
        <div><label className={label} htmlFor="desc">Descrição (opcional)</label><textarea id="desc" rows={3} className={input} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Datas</h2>
          <button type="button" onClick={() => setDays([...days, { key: uid(), event_date: '', start_time: '' }])} className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />Adicionar dia</button>
        </div>
        {days.map((d, i) => (
          <div key={d.key} className="flex items-end gap-2">
            <div className="flex-1"><label className={label}>Dia {i + 1}</label>
              <input type="date" className={input} value={d.event_date} onChange={(e) => setDays(days.map((x) => x.key === d.key ? { ...x, event_date: e.target.value } : x))} /></div>
            <div className="w-32"><label className={label}>Horário</label>
              <input type="time" className={input} value={d.start_time} onChange={(e) => setDays(days.map((x) => x.key === d.key ? { ...x, start_time: e.target.value } : x))} /></div>
            <button type="button" aria-label="Remover dia" disabled={days.length === 1} onClick={() => setDays(days.filter((x) => x.key !== d.key))} className="mb-2 text-muted hover:text-alert disabled:opacity-30"><Trash2 size={18} /></button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Arte do evento</h2>
        <div className="flex items-center gap-4">
          {preview ? <img src={preview} alt="" className="h-28 w-28 rounded-xl object-cover" /> : <div className="grid h-28 w-28 place-items-center rounded-xl bg-bg text-muted"><ImagePlus /></div>}
          <div className="space-y-2 text-sm">
            <label className="inline-block cursor-pointer rounded-xl border border-line px-3 py-2 font-semibold hover:border-brand">
              {preview ? 'Trocar imagem' : 'Enviar imagem'}
              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {preview && <button type="button" onClick={() => { setFile(null); setRemoveArt(true) }} className="ml-3 text-alert">Remover</button>}
            <p className="text-xs text-muted">JPG ou PNG, até 2 MB.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.send} onChange={(e) => setF({ ...f, send: e.target.checked })} />Enviar a arte no WhatsApp junto com as informações</label>
      </section>

      <p className="text-xs text-muted">Ingressos, preços, artistas e pagamentos entram nas próximas etapas.</p>
    </form>
    {id && type === 'PRE_CAJU_CAMAROTE' && <CamaroteDays days={savedDays} />}
    {id && type === 'PRE_CAJU_BLOCOS' && <BlocosDays days={savedDays} onSaved={() => setBlocksKey((k) => k + 1)} />}
    {id && type === 'EVENTO_EXTERNO' && <ExternoEditor eventId={id} />}
    {id && type !== 'EVENTO_EXTERNO' && savedDays.length > 0 && (
      <PackagesEditor eventId={id} blocksType={type === 'PRE_CAJU_BLOCOS'} days={savedDays} refreshKey={blocksKey} />
    )}
    {id && <PaymentsEditor eventId={id} type={type} days={savedDays} />}
    </div>
  )
}
