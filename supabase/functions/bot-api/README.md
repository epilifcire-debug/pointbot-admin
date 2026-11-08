# bot-api: conteúdo publicado para o bot da Oracle

Entrega **somente a versão publicada** (nunca rascunhos). Os eventos já vêm filtrados pela data de Aracaju
(INATIVO, sem data e encerrados ficam de fora) e **ordenados pela próxima data válida, da mais próxima para a mais distante**.
A numeração do menu (1, 2, 3...) **não** vem da API: o bot numera na hora, pela ordem recebida.

## Configurar (uma vez)
1. Supabase > Edge Functions > **Secrets**: crie `BOT_API_KEY` com uma chave longa e aleatória (mínimo 20 caracteres).
   No PowerShell: `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`
2. Publique a função `bot-api` (Deploy a new function > Via Editor) com o conteúdo de `index.ts`.
3. Na função, **desligue "Verify JWT"** (a autenticação é a `BOT_API_KEY`).
4. Guarde a mesma chave na Oracle (variável de ambiente `POINTBOT_API_KEY`). Nunca coloque a chave no código, no Git ou no painel.

## Endereços
- `GET https://SEU-PROJETO.supabase.co/functions/v1/bot-api`: conteúdo publicado (exige a chave)
- `GET https://SEU-PROJETO.supabase.co/functions/v1/bot-api/health`: saúde da API e do banco (sem dados, sem chave)

```bash
curl -i https://SEU-PROJETO.supabase.co/functions/v1/bot-api/health
curl -i -H "Authorization: Bearer $POINTBOT_API_KEY" https://SEU-PROJETO.supabase.co/functions/v1/bot-api
# segunda chamada, enviando o ETag recebido: responde 304 sem baixar o conteúdo
curl -i -H "Authorization: Bearer $POINTBOT_API_KEY" -H 'If-None-Match: "p3-2026-11-13"' https://SEU-PROJETO.supabase.co/functions/v1/bot-api
```

## Cache e ETag
O `ETag` é `"p<versão publicada>-<data de Aracaju>"`. Ele muda quando você **publica** e também **quando vira o dia**
(à meia-noite de Aracaju eventos expiram). A Oracle deve guardar o último conteúdo + ETag e enviar `If-None-Match`:
`304` = continue usando o cache; `200` = substitua o cache. Consultar a cada alguns minutos é suficiente.

## Respostas
| Código | Significado | O que o bot faz |
|---|---|---|
| 200 | Conteúdo novo (cabeçalhos `ETag` e `X-Published-Version`) | Valida e troca o cache |
| 304 | Nada mudou | Mantém o cache |
| 401 | Chave ausente ou errada | Registra o erro; mantém o cache |
| 404 `not_published` | Nada foi publicado ainda | Mantém o cache |
| 500 `server_not_configured` | `BOT_API_KEY` não configurada no Supabase | Registra o erro; mantém o cache |
| 502 `upstream_error` | Banco indisponível | Mantém o cache e tenta de novo depois |
| 503 (health) | Banco indisponível | Modo degradado |

**Regra de ouro:** uma resposta de erro ou vazia **nunca** substitui um cache válido.

## Formato (resumo; seções vazias nunca são enviadas)
```json
{
  "api_version": 1,
  "published_version": 3,
  "published_at": "2026-11-08T16:31:55.228+00:00",
  "server_date": "2026-11-13",
  "events": [
    {
      "key": "c2a57f79-7ec0-4932-a3a4-c2732a16f229",
      "days": [
        {
          "lot": 4,
          "date": "2026-11-13",
          "status": "ON_SALE",
          "artists": [
            "Novo Artista"
          ],
          "ticket_types": [
            {
              "name": "Meia Entrada",
              "price": 999,
              "category": "MEIA"
            }
          ]
        }
      ],
      "name": "Camarote Aju 2026",
      "type": "PRE_CAJU_CAMAROTE",
      "dates": [
        "2026-11-13",
        "2026-11-14"
      ],
      "state": "ATIVO",
      "location": "Orla",
      "payments": [
        {
          "name": "Banese Card / Elo",
          "label": "até 10x sem juros"
        },
        {
          "name": "Demais cartões",
          "label": "até 5x sem juros"
        }
      ],
      "next_date": "2026-11-13",
      "artwork_url": "https://x.supabase.co/storage/v1/object/public/event-artworks/c2a57f79-7ec0-4932-a3a4-c2732a16f229/a.png",
      "purchase_url": "https://compra.com/camarote"
    },
    {
      "key": "aa63e36b-4d78-4df7-9d2f-170020927de2",
      "name": "Pré-Réveillon",
      "type": "EVENTO_EXTERNO",
      "dates": [
        "2026-12-29"
      ],
      "state": "EM_BREVE",
      "artists": [
        "Saulo"
      ],
      "next_date": "2026-12-29",
      "artwork_url": "https://x.supabase.co/storage/v1/object/public/event-artworks/aa63e36b-4d78-4df7-9d2f-170020927de2/a.png"
    }
  ],
  "messages": {
    "welcome": "…",
    "invalid_option": "…",
    "coming_soon": "…",
    "sold_out": "…",
    "buy_online": "…",
    "online_support": "…",
    "talk_to_attendant": "…",
    "closing": "…"
  },
  "settings": {
    "support": {
      "name": "Maria",
      "phone": "79988887777",
      "title": "Suporte Compras Online",
      "active": true,
      "message": "Ajuda",
      "initial_message": "Olá!"
    },
    "attendance": {
      "mon_sat": {
        "end": "20:00",
        "start": "08:00"
      },
      "sun_holiday": {
        "end": "20:00",
        "start": "14:00"
      }
    }
  }
}
```
- `events[].state`: `ATIVO` ou `EM_BREVE`. Em breve traz só nome, datas, local, arte, `artists` e `special_guests` (se existirem), sem preços.
- `special_guests`, `packages`, `payments`, `casadinha` e `artwork_url` só existem quando há conteúdo. Se a chave não vem, o bot não mostra a seção.
- Camarote usa `days[]`; Blocos usam `blocks_by_day[]` (preço único, nunca tipos de ingresso); evento externo usa `areas[]`
  (cada uma com seu lote; `casadinha` só quando existe).
- `payments[].label`: "até 10x sem juros", "até 12x" (com acréscimo, e então `surcharge_text` traz o texto) ou "à vista".
- `server_date` é o dia de Aracaju usado no filtro. Preços são números (reais).
