import { useCallback, useEffect, useState } from 'react'
import { Eye, Rocket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayLocal } from '../lib/events'
import { fmtDateTime, notifyChanged } from '../lib/versions'
import { attendantText, buyText, eventText, menuText, supportText, type BotPayload } from '../lib/botMenu'
import Modal from './Modal'

type Status = { published: { number: number; at: string; by: string | null } | null; pending: boolean; items: string[]; can_publish: boolean }
const storageBase = () => `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1/object/public/event-artworks`
export const vLabel = (n: number) => `v${String(n).padStart(3, '0')}`

function Bubble({ text, img }: { text: string; img?: string | null }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl bg-[#0b141a] p-3"><div className="rounded-xl bg-[#202c33] p-3 text-sm text-white">
      {img && <img src={img} alt="Arte do evento" className="mb-2 w-full rounded-lg" />}<pre className="whitespace-pre-wrap font-sans">{text}</pre></div></div>
  )
}

function Preview({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<BotPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState('menu')
  useEffect(() => {
    void supabase.rpc('bot_preview_payload', { p_today: todayLocal(), p_base: storageBase() }).then(({ data, error }) => {
      if (error || !data) setErr('Não foi possível montar o preview.'); else setP(data as BotPayload)
    })
  }, [])
  const ev = p?.events.find((e) => e.key === sel.split(':')[1])
  const mode = sel.split(':')[0]
  return (
    <Modal title="Preview do bot" onClose={onClose}>
      <p className="mb-3 text-xs text-muted">Como o bot ficaria <b>se você publicasse agora</b> (inclui o que está salvo e ainda não foi publicado). Aproximação das mensagens reais.</p>
      {err && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{err}</p>}
      {!p && !err && <p className="text-sm text-muted">Carregando...</p>}
      {p && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-muted" htmlFor="pv">Tela</label>
          <select id="pv" value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm">
            <option value="menu">Menu principal</option>
            {p.events.map((e) => <option key={e.key} value={`ev:${e.key}`}>{e.name}</option>)}
            {p.events.filter((e) => e.state === 'ATIVO').map((e) => <option key={'b' + e.key} value={`buy:${e.key}`}>Comprar Online — {e.name}</option>)}
            <option value="support">Suporte Compras Online</option><option value="att">Falar com Atendente</option>
          </select>
          {!p.events.length && sel === 'menu' && <p className="text-xs text-sun">Nenhum evento elegível no momento (inativos, sem data ou já encerrados ficam fora).</p>}
          {sel === 'menu' && <Bubble text={menuText(p)} />}
          {mode === 'ev' && ev && <Bubble text={eventText(ev, p)} img={ev.artwork_url} />}
          {mode === 'buy' && ev && <Bubble text={buyText(ev, p)} />}
          {sel === 'support' && <Bubble text={supportText(p)} />}
          {sel === 'att' && <Bubble text={attendantText(p)} />}
        </div>
      )}
    </Modal>
  )
}

export default function PublishBar() {
  const [st, setSt] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [modal, setModal] = useState<'preview' | 'publish' | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('bot_publish_status')
    if (error) return setFailed(true)
    setFailed(false); setSt(data as Status)
  }, [])
  useEffect(() => {
    void refresh(); const h = () => void refresh()
    window.addEventListener('pointbot:changed', h); window.addEventListener('focus', h); const t = setInterval(h, 60000)
    return () => { window.removeEventListener('pointbot:changed', h); window.removeEventListener('focus', h); clearInterval(t) }
  }, [refresh])

  const publish = async () => {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('publish_to_bot')
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message || 'Não foi possível publicar.' })
    const r = data as { published?: boolean; same?: boolean; number?: number } | null
    setMsg({ ok: true, text: r?.published ? `Publicado! O bot agora usa a versão ${vLabel(r.number ?? 0)}.` : 'Nada novo para publicar: o bot já está atualizado.' })
    notifyChanged(); await refresh()
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <div className="min-w-0 flex-1">
          {failed && !st ? <span className="text-alert">Não foi possível verificar o estado do bot.</span> : st === null ? <span className="text-muted">Verificando o bot...</span> : (
            <>
              {st.published
                ? <span>Versão publicada <b className="text-mint">{vLabel(st.published.number)}</b> <span className="text-muted">• {fmtDateTime(st.published.at)}{st.published.by ? ` • ${st.published.by}` : ''}</span></span>
                : <span className="text-muted">Nada publicado ainda</span>}
              {st.pending && <span className="ml-2 rounded-full bg-sun/15 px-2 py-0.5 text-xs font-semibold text-sun">Alterações não publicadas ({st.items.length})</span>}
            </>
          )}
        </div>
        <button type="button" onClick={() => setModal('preview')} className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 font-semibold hover:border-brand"><Eye size={16} />Ver preview</button>
        <button type="button" disabled={!st?.can_publish} title={st && !st.can_publish ? 'Você não tem permissão para publicar' : undefined}
          onClick={() => { setMsg(null); setModal('publish') }} className="flex items-center gap-1 rounded-xl bg-brand px-4 py-2 font-bold hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"><Rocket size={16} />Publicar no Bot</button>
      </div>

      {modal === 'preview' && <Preview onClose={() => setModal(null)} />}
      {modal === 'publish' && st && (
        <Modal title="Publicar no Bot" onClose={() => setModal(null)}>
          {msg?.ok ? <p role="status" className="rounded-lg bg-mint/10 px-3 py-2 text-sm text-mint">{msg.text}</p> : (
            <div className="space-y-3 text-sm">
              {st.pending ? (<><p>Estas alterações passarão a valer no WhatsApp assim que você confirmar:</p>
                <ul className="list-disc space-y-1 pl-5">{st.items.map((i) => <li key={i}>{i}</li>)}</ul>
                <p className="text-xs text-muted">O que está salvo e não aparece aqui já está no ar. Dica: use "Ver preview" antes de publicar.</p></>)
                : <p>Não há alterações novas. O bot já está com a versão mais recente salva.</p>}
              {msg && !msg.ok && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-alert">{msg.text}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-line px-4 py-2 font-semibold">Cancelar</button>
                <button type="button" disabled={busy || !st.pending || !st.can_publish} onClick={() => void publish()} className="rounded-xl bg-brand px-4 py-2 font-bold hover:bg-brand-soft disabled:opacity-50">{busy ? 'Publicando...' : 'Confirmar e publicar'}</button>
              </div>
            </div>
          )}
          {msg?.ok && <div className="mt-3 flex justify-end"><button type="button" onClick={() => setModal(null)} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold">Fechar</button></div>}
        </Modal>
      )}
    </>
  )
}
