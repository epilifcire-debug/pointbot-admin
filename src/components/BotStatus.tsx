import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { botStatusView, sinceText, type BotStatusData } from '../lib/botStatus'

const POLL_MS = 30_000

// Selo do WhatsApp do bot: verde Conectado, vermelho Desconectado, cinza Sem sinal. Só leitura.
export default function BotStatus({ align = 'left' }: { align?: 'left' | 'right' }) {
  const [data, setData] = useState<BotStatusData | null>(null)
  const [failed, setFailed] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [, tick] = useState(0)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_bot_status')
    if (error || !data) { setFailed(true); return }
    setFailed(false); setData(data as BotStatusData); setFetchedAt(Date.now())
  }, [])

  useEffect(() => {
    void load()
    const poll = setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    const clock = setInterval(() => tick((n) => n + 1), 10_000)       // envelhece o sinal entre consultas
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(poll); clearInterval(clock); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const elapsed = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 1000) : 0
  const v = botStatusView(failed ? null : data, elapsed, failed)
  const tone = { ok: 'bg-mint/15 text-mint', bad: 'bg-alert/15 text-alert', off: 'bg-muted/15 text-muted' }[v.tone]
  const dot = { ok: 'bg-mint', bad: 'bg-alert', off: 'bg-muted' }[v.tone]
  const row = 'flex justify-between gap-4 py-1'

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`WhatsApp do bot: ${v.label}. Ver detalhes`}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${tone}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />{v.label}
      </button>
      {open && (
        <div role="dialog" aria-label="Detalhes do WhatsApp do bot"
          className={`absolute z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-3 text-xs shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="mb-1 text-sm font-bold">WhatsApp do bot</div>
          <p className="mb-2 text-muted">{v.hint}</p>
          {data && !failed && (
            <dl className="divide-y divide-line">
              {data.phone && <div className={row}><dt className="text-muted">Número</dt><dd>{data.phone}</dd></div>}
              <div className={row}><dt className="text-muted">Último sinal</dt><dd>{v.age == null ? 'nunca' : sinceText(v.age)}</dd></div>
              <div className={row}><dt className="text-muted">Versão no bot</dt><dd>{data.bot_version != null ? `v${data.bot_version}` : '—'}</dd></div>
              <div className={row}><dt className="text-muted">Versão publicada</dt><dd>{data.published_version != null ? `v${data.published_version}` : '—'}</dd></div>
            </dl>
          )}
          {data && !failed && v.outdated && <p className="pt-2 text-sun">O bot ainda não carregou a versão publicada (leva até 3 minutos).</p>}
          {data && !failed && data.degraded && <p className="pt-2 text-sun">O bot está usando os dados em cache (falha ao consultar a API).</p>}
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold text-brand-soft">Atualizar agora</button>
        </div>
      )}
    </div>
  )
}
