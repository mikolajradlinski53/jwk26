# Sekta Wyjazdowa — szkielet Etapu 0/1

Rdzeń: auth gate (@samorzad, OTP) → live leaderboard → panel admina do punktów.
Stack: Next.js (App Router) + Supabase + Cloudflare Workers (OpenNext).

## Kolejność setupu (rób po kolei)

1. **Baza.** Wklej `0001_init.sql` do Supabase → SQL Editor → Run.
2. **Storage.** Utwórz prywatny bucket `bingo` (na Etap 2) i odkomentuj policy na końcu migracji.
3. **Projekt Next.js.** Jeśli nie masz repo:
   ```bash
   npx create-next-app@latest sekta --ts --app --src-dir --eslint
   cd sekta
   npm install @supabase/ssr @supabase/supabase-js
   ```
   Wrzuć pliki z tego szkieletu do odpowiadających ścieżek (`src/...`).
4. **Env.** Skopiuj `.env.local.example` → `.env.local` i uzupełnij z Supabase → Settings → API.
5. **Odpal lokalnie:** `npm run dev`. Zarejestruj się swoim mailem @samorzad (dostaniesz kod OTP).
6. **Zostań adminem.** W Supabase SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'twoj.mail@samorzad.ue.wroc.pl';
   ```
   Bez tego panel `/admin` cię wyrzuci.
7. Wejdź na `/admin`, przyznaj punkty, patrz jak `/` (ranking) skacze na żywo w drugiej karcie. ✅

## Deploy na Cloudflare

```bash
npm install @opennextjs/cloudflare
npm install -D wrangler
```

Dodaj do `package.json`:
```json
"scripts": {
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"
}
```

Pliki `wrangler.jsonc` i `open-next.config.ts` masz w repo. Potem:
```bash
npx wrangler login
npm run deploy
```

**Env na Cloudflare:** `NEXT_PUBLIC_*` idą przy buildzie (ustaw w CI albo lokalnie przed `deploy`).
Sekrety serwerowe (na Etap 3):
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SMSAPI_TOKEN
```

> Uwaga: darmowy Worker ma limit **3 MiB (gzip)**. Jak apka urośnie i przekroczysz — albo tniesz zależności, albo plan Paid ($5/mies), albo Vercel free.

## Co jest, a czego jeszcze nie ma

Jest: gate domenowy, OTP login, ranking realtime, panel admina (punkty).
Brakuje (kolejne etapy): sklepik UI, bingo upload+feed, gossipy+głosowanie, SMS broadcast, mini-gra, web push.
