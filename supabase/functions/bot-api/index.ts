// Edge Function "bot-api": o bot da Oracle consome AQUI a versão PUBLICADA (nunca rascunhos).
//   GET /bot-api          -> conteúdo publicado (exige Authorization: Bearer <BOT_API_KEY>), com ETag
//   GET /bot-api/health   -> verifica disponibilidade (sem dados)
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

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, HEAD' })
  const today = todayInAracaju(deps.now())
  const path = new URL(req.url).pathname.replace(/\/+$/, '')

  if (path.endsWith('/health')) {                                   // sem dados: só diz se a API e o banco respondem
    const { error } = await deps.rpc('bot_api_meta', { p_today: today })
    return error ? json({ ok: false }, 503) : json({ ok: true, service: 'pointbot-api', api_version: 1 })
  }

  const expected = deps.env('BOT_API_KEY')
  if (!expected || expected.length < 20) return json({ error: 'server_not_configured' }, 500)   // sem chave configurada: fecha
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
  if (!m || !safeEqual(m[1].trim(), expected)) return json({ error: 'unauthorized' }, 401, { 'www-authenticate': 'Bearer' })

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
