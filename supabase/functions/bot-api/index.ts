// Edge Function "bot-api": o bot da Oracle consome AQUI a versão PUBLICADA (nunca rascunhos).
//   GET /bot-api          -> conteúdo publicado (exige Authorization: Bearer <BOT_API_KEY>), com ETag
//   GET /bot-api/health   -> verifica disponibilidade (sem dados)
//   POST /bot-api/status  -> o bot informa o estado do WhatsApp (mesma chave); o painel mostra o selo
// Publique SEM "Verify JWT" (a autenticação é a chave BOT_API_KEY, guardada em Secrets).
declare const Deno: any

export type Deps = {
  env: (key: string) => string | undefined
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>
  now: () => Date
}

const BASE = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...BASE, ...extra } })

// Data de hoje em Aracaju (America/Maceio): o dia vale até 23:59:59 e expira à meia-noite local.
export const todayInAracaju = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Maceio' }).format(d)

// comparação sem vazar o tamanho/posição da diferença pelo tempo de resposta
export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

// Só estes campos do sinal de vida seguem para o banco (o resto é descartado).
const STATUS_FIELDS = ['whatsapp_status', 'phone', 'published_version', 'degraded', 'uptime_seconds', 'last_connection', 'last_disconnect']
const MAX_STATUS_BYTES = 2048

async function reportStatus(req: Request, deps: Deps): Promise<Response> {
  const raw = await req.text()
  if (raw.length > MAX_STATUS_BYTES) return json({ error: 'payload_too_large' }, 413)
  let body: any
  try { body = JSON.parse(raw) } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.whatsapp_status !== 'string') return json({ error: 'invalid_status' }, 400)
  const p: Record<string, unknown> = {}
  for (const k of STATUS_FIELDS) {
    const v = body[k]
    if (typeof v === 'string' ? v.length <= 60 : typeof v === 'number' || typeof v === 'boolean') p[k] = v
  }
  const { error } = await deps.rpc('bot_report_status', { p })
  return error ? json({ error: 'upstream_error' }, 502) : json({ ok: true })
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '')
  const isStatus = req.method === 'POST' && path.endsWith('/status')
  if (!isStatus && req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, HEAD' })
  const today = todayInAracaju(deps.now())

  if (path.endsWith('/health')) {                                   // sem dados: só diz se a API e o banco respondem
    const { error } = await deps.rpc('bot_api_meta', { p_today: today })
    return error ? json({ ok: false }, 503) : json({ ok: true, service: 'pointbot-api', api_version: 1 })
  }

  const expected = deps.env('BOT_API_KEY')
  if (!expected || expected.length < 20) return json({ error: 'server_not_configured' }, 500)   // sem chave configurada: fecha
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!m || !safeEqual(m[1].trim(), expected)) return json({ error: 'unauthorized' }, 401, { 'www-authenticate': 'Bearer' })
  if (isStatus) return reportStatus(req, deps)

  const meta = await deps.rpc('bot_api_meta', { p_today: today })
  if (meta.error) return json({ error: 'upstream_error' }, 502)
  if (!meta.data?.published) return json({ error: 'not_published' }, 404)

  // ETag = publicação + dia: muda quando você publica E quando vira o dia (eventos expiram à meia-noite)
  const etag = `"p${meta.data.number}-${today}"`
  const inm = (req.headers.get('if-none-match') ?? '').split(',').map((s) => s.trim().replace(/^W\//, ''))
  if (inm.includes(etag) || inm.includes('*')) return new Response(null, { status: 304, headers: { etag, 'cache-control': 'no-cache' } })

  const base = `${deps.env('SUPABASE_URL') ?? ''}/storage/v1/object/public/event-artworks`
  const res = await deps.rpc('bot_api_payload', { p_today: today, p_base: base })
  if (res.error || !res.data) return json({ error: 'upstream_error' }, 502)
  const headers = { etag: `"p${res.data.published_version}-${today}"`, 'x-published-version': String(res.data.published_version) }
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { ...BASE, ...headers } })
  return json(res.data, 200, headers)
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  let client: any
  Deno.serve(async (req: Request) => {
    try {
      if (!client) {
        // @ts-ignore: especificador do Deno (não existe no TypeScript do painel)
        const { createClient } = await import('npm:@supabase/supabase-js@2')
        client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
      }
      return await handle(req, { env: (k) => Deno.env.get(k), rpc: (fn, args) => client.rpc(fn, args), now: () => new Date() })
    } catch {
      return json({ error: 'internal_error' }, 500)          // nunca devolve detalhes do erro
    }
  })
}
