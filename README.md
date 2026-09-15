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

Nową migrację twórz przez `npx supabase migration new <nazwa>`, ale **sprawdź
wygenerowaną nazwę, zanim cokolwiek w niej napiszesz**. CLI bierze bieżący czas
UTC, a pierwsza migracja dostała znacznik wpisany z ręki (`20260915120000`),
wyprzedzający czas realny — przez kilka godzin doby `migration new` produkuje więc
nazwę *wcześniejszą* niż to, co już jest zastosowane. Przemianuj plik, jeśli tak
wyjdzie; kolejność decyduje o tym, czy migracja zastanie typy i tabele, na których
stoi.

Jeśli `db push` odbije się od `must be owner of table objects`, znaczy to, że
migracja zakłada polityki na `storage.objects`, do których rola migrująca nie ma
praw. Załóż je wtedy ręcznie w panelu (Storage → Policies), **nie usuwając** ich
z pliku — kolejny projekt odtwarzany od zera ma je dostać automatycznie.

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

### Pierwszy admin trzeba założyć ręcznie

Nie ma ścieżki, którą ktokolwiek zostałby adminem sam z siebie — i to jest
zamierzone. Zaraz po pierwszym wdrożeniu wykonaj w SQL Editorze:

```sql
update profiles
set role = 'admin', status = 'approved'
where email = 'twoj.adres@samorzad.ue.wroc.pl';
```

**Oba pola naraz.** Bramka sprawdza `status` przed `role`, więc admin ze statusem
`pending` odbija się na `/rejestracja` dokładnie tak jak każdy inny — i nie ma jak
zaakceptować ani siebie, ani nikogo innego.

## Brama wejściowa

Uczestnik ze statusem innym niż `approved` widzi wyłącznie `/rejestracja`:
formularz z imieniem, telefonem, zgodą SMS, uwagami dietetycznymi i zdjęciem
potwierdzenia przelewu. Zdjęcie jest kompresowane w przeglądarce przed wysyłką,
a Tesseract.js wyciąga z niego tekst i liczy trafienia słów kluczowych.

**OCR jest podpowiedzią, nie sędzią.** Jego awaria nie blokuje zgłoszenia —
`przeczytajDowod` zwraca wtedy `null`, a kolejka admina pokazuje wprost, że
rozpoznanie się nie powiodło. Kwota nie jest nigdzie weryfikowana; bramką jest
człowiek patrzący na oryginał.

Dowody przelewu leżą w prywatnym buckecie `proofs` i widzi je **wyłącznie admin**,
przez podpisane URL-e ważne godzinę. Autor zgłoszenia też ich nie pobierze — to
dane finansowe, a swoje zdjęcie widział przed wysłaniem.

Akceptacja idzie przez funkcję `review_registration` (`SECURITY DEFINER`), bo
granty kolumnowe blokują `profiles.status` i `profiles.team_id` nawet adminowi.
Funkcja jest jedyną drogą zmiany tych pól i sama sprawdza uprawnienia, bo
`SECURITY DEFINER` omija RLS.

## Logowanie

Apka loguje kodem OTP (`verifyOtp`), nie magic linkiem. Supabase wysyła jedno
i drugie tym samym mailem, ale **domyślne szablony renderują wyłącznie
`{{ .ConfirmationURL }}`** — trzeba je podmienić na `{{ .Token }}`
w Authentication → Emails → Templates.

Szablony są dwa i oba mają znaczenie: **Confirm signup** idzie przy pierwszym
logowaniu (konto powstaje dopiero wtedy), **Magic Link** przy każdym kolejnym.
Poprawienie jednego sprawia, że błąd wraca za drugim razem.

`Site URL` w Authentication → URL Configuration musi wskazywać na produkcję.
Zostawiony na `http://localhost:3000` wysyła ludziom linki w pustkę.

### Wbudowany mailer Supabase nie nadaje się do tej apki

Dwa ograniczenia, z których drugie jest blokujące: **2 maile na godzinę** oraz
**wysyłka wyłącznie na adresy członków zespołu projektu** — każdy inny odbiorca
dostaje `Email address not authorized` i mail nie wychodzi wcale.

Oznacza to, że logowanie działa tylko właścicielowi projektu. Zanim ktokolwiek
poza tobą spróbuje wejść, musi stać custom SMTP (Authentication → SMTP Settings);
limit rośnie wtedy do 30/h i jest regulowany w Authentication → Rate Limits.

## Architektura w trzech zdaniach

Saldo punktów nigdy nie jest kolumną — to zawsze `SUM(delta)` z `points_ledger`,
tabeli tylko do dopisywania, do której RLS wpuszcza `INSERT` wyłącznie adminowi.
Pozostałe źródła punktów piszą przez funkcje `SECURITY DEFINER`, więc nie istnieje
ścieżka pozwalająca uczestnikowi dosypać sobie punkty z konsoli przeglądarki.
Dostęp bramkuje `src/proxy.ts` na podstawie `profiles.status`, ale prawdziwą
blokadą jest RLS — bramka to wygoda nawigacyjna, nie zabezpieczenie.

## Stack

Next.js 16 · Supabase · Tailwind v4 · Tesseract.js · Vitest · Vercel

W Next 16 `middleware.ts` nazywa się `proxy.ts` i przy katalogu `src/` **musi**
leżeć w `src/proxy.ts`. W korzeniu repo build przechodzi bez ostrzeżenia,
a bramka po prostu nie działa. Sygnał, że jest podpięta: linia
`ƒ Proxy (Middleware)` w tabeli tras po `npm run build`.

## Lokalizacja

Projekt mieszka w `D:\Projects\jwk26`. Został przeniesiony z `C:\Users\...\Downloads`,
bo dysk C: zapełnił się do zera i build przestawał zapisywać cache.
