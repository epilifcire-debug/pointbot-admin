# PointBot Admin

Painel PWA para editar, salvar e publicar os dados do PointBot (Point do Ingresso).
Frontend: Vite + React + TypeScript + Tailwind. Backend: Supabase. Hospedagem: GitHub Pages.

## Rodar local
```
cp .env.example .env.local   # preencha URL e chave anon do Supabase
npm install
npm run dev
```

## Configurar o deploy (uma vez)
1. GitHub > Settings > Pages > Source: **GitHub Actions**.
2. GitHub > Settings > Secrets and variables > Actions > New repository secret:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API; use a chave anon/publishable)
   - Para migrations automáticas: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`
3. Faça push na `main`. O painel abre em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. Supabase > Authentication > URL Configuration: coloque essa URL em Site URL.
5. Supabase > Authentication > Providers > Email: **desative "Allow new users to sign up"**. Crie o usuário Master em Authentication > Users.

## Etapas
B02 banco, B03 auth/RLS, B04 eventos, B05 versionamento, B06 publicação/API, B07 Oracle.
Migrations em `supabase/migrations/`, Edge Functions em `supabase/functions/`.

Nunca commitar senha, `.env` ou `service_role`.
