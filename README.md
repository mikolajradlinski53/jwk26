# Sekta Wyjazdowa (jwk26)

Webapp (PWA) dla uczestników wyjazdu samorządu UEW: ranking drużyn, bingo ze
zdjęciami, sklepik, kasyno i gossipy. Dostęp wyłącznie dla adresów
`@samorzad.ue.wroc.pl` po potwierdzeniu wpłaty.

- Produkcja: <https://jwk26.vercel.app>
- Spec: [`docs/superpowers/specs/2026-09-14-sekta-wyjazdowa-design.md`](docs/superpowers/specs/2026-09-14-sekta-wyjazdowa-design.md)
- Plany: [`docs/superpowers/plans/`](docs/superpowers/plans/)
- Poprzedni szkielet: gałąź `archive/skeleton`

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # uzupełnij z Supabase → Project Settings → API
npm run dev
```

## Testy

Chodzą przeciwko **osobnemu** projektowi Supabase (`jwk26-test`) — zakładają
i kasują w nim użytkowników. Konfiguracja w `.env.test`, wzorzec w `.env.example`.

```bash
npm test
```

Projekt testowy musi mieć włączone logowanie hasłem (Authentication → Providers →
Email, `Confirm email` wyłączone). Apka używa OTP, ale kodu z maila nie da się
przepisać w teście automatycznym.

## Migracje

Zawsze przez CLI — `db push` zapisuje w bazie, co zostało zastosowane, i nie
wykona tego samego dwa razy. Wklejanie SQL-a do SQL Editora nie zostawia śladu
i kończy się błędem `42710` przy drugim uruchomieniu.

```bash
npx supabase link --project-ref <REF>
npx supabase db push
```

Każdą migrację stosuj w **obu** projektach: głównym i testowym.

Nową migrację twórz przez `npx supabase migration new <nazwa>` — wersja musi być
znacznikiem czasu, żeby kolejność się zgadzała.

## Wdrożenie

```bash
npx vercel --prod
```

Zmienne środowiskowe siedzą w Vercelu (`vercel env ls`), nie w repo. Po zmianie
adresu produkcyjnego trzeba go dopisać w Supabase → **Authentication → URL
Configuration** (`Site URL` oraz `Redirect URLs`) — inaczej kody OTP z produkcji
odbijają.

`SUPABASE_SERVICE_ROLE_KEY` celowo nie jest jeszcze w Vercelu. Dochodzi w planie
08 razem z SMS-ami; wcześniej byłby tam ostrym nożem bez zastosowania.

## Architektura w trzech zdaniach

Saldo punktów nigdy nie jest kolumną — to zawsze `SUM(delta)` z `points_ledger`,
tabeli tylko do dopisywania, do której RLS wpuszcza `INSERT` wyłącznie adminowi.
Pozostałe źródła punktów piszą przez funkcje `SECURITY DEFINER`, więc nie istnieje
ścieżka pozwalająca uczestnikowi dosypać sobie punkty z konsoli przeglądarki.
Dostęp bramkuje `src/proxy.ts` na podstawie `profiles.status`, ale prawdziwą
blokadą jest RLS — bramka to wygoda nawigacyjna, nie zabezpieczenie.

## Stack

Next.js 16 · Supabase · Tailwind v4 · Vitest · Vercel

W Next 16 `middleware.ts` nazywa się `proxy.ts` i przy katalogu `src/` **musi**
leżeć w `src/proxy.ts`. W korzeniu repo build przechodzi bez ostrzeżenia,
a bramka po prostu nie działa. Sygnał, że jest podpięta: linia
`ƒ Proxy (Middleware)` w tabeli tras po `npm run build`.

## Lokalizacja

Projekt mieszka w `D:\Projects\jwk26`. Został przeniesiony z `C:\Users\...\Downloads`,
bo dysk C: zapełnił się do zera i build przestawał zapisywać cache.
