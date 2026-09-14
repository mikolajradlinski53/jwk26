# Sekta Wyjazdowa (jwk26) — spec projektowy

Data: 2026-09-14
Status: zatwierdzony do implementacji
Deadline: < 14 dni

## 1. Czym to jest

Webapp (PWA) dla ok. 60 uczestników wyjazdu samorządu UEW. Uczestnicy są podzieleni
na drużyny, zdobywają punkty za zadania, wydają je wspólnie w sklepiku, grają w
mini-gry, wrzucają zdjęcia do bingo i głosują w kategoriach typu „laluś wyjazdu".
Motyw przewodni: sekta — ciemna, poważna estetyka, z której komizm bierze się przez
kontrast z treścią.

Dostęp wyłącznie dla adresów `@samorzad.ue.wroc.pl`, po opłaceniu wyjazdu
potwierdzonym zdjęciem przelewu i akceptacji admina.

## 2. Stack

- **Next.js 15** (App Router, TypeScript) — `src/` layout
- **Supabase** — Postgres, Auth (OTP e-mail), Storage (zdjęcia), Realtime
- **Tailwind CSS v4**
- **Vercel** — hosting (odrzucone: Cloudflare Workers, patrz §10)
- **Tesseract.js** — OCR w przeglądarce
- **web-push** + **SMSAPI.pl** — powiadomienia

## 3. Decyzje architektoniczne

### D1. Logika punktowa mieszka w bazie

Każda zmiana salda to wiersz w `points_ledger` — tabeli **tylko do dopisywania**.
Saldo nigdy nie jest osobną kolumną do nadpisania; zawsze `SUM(delta)`.

Polityka RLS przepuszcza `INSERT` do `points_ledger` **wyłącznie adminowi**.
Wszystkie pozostałe źródła punktów (kasyno, bingo, sklepik) piszą przez funkcje
`SECURITY DEFINER`, które omijają RLS i wykonują całą regułę atomowo.

**Dlaczego:** nie istnieje wtedy ścieżka, którą uczestnik mógłby dosypać sobie
punkty fetchem z konsoli przeglądarki. Przy 60 osobach z telefonami i alkoholem
w obiegu to warunek tego, żeby ranking cokolwiek znaczył. Koszt: trochę PL/pgSQL.

### D2. Punkty indywidualne, sumowane na drużynę; wydatki drużynowe

`points_ledger.user_id` jest **nullowalny**, `team_id` jest zawsze wypełniony:

- **Zarobek indywidualny** → `user_id = U, team_id = T`
- **Wydatek drużynowy** (sklepik) → `user_id = NULL, team_id = T`, a kapitan,
  który kliknął zakup, ląduje w `awarded_by`

Stąd oba salda liczą się z jednej tabeli i nie kolidują:

- saldo osoby = `SUM(delta) WHERE user_id = U`
- saldo drużyny = `SUM(delta) WHERE team_id = T`

Zakup w sklepiku nie obciąża indywidualnego wyniku kapitana — to była pułapka,
w którą łatwo wpaść przy jednej tabeli.

`team_id` jest **snapshotem** z momentu zapisu. Przeniesienie kogoś między
drużynami nie przepisuje historii.

### D3. Kasyno gra przeciwko saldu indywidualnemu

Stawki i wygrane w blackjacku, slotach i dino idą na `user_id`. Skoro salda
indywidualne sumują się do drużyny, przegrana w kasynie realnie szkodzi zespołowi —
i o to chodzi.

### D4. OCR jest podpowiedzią, nie sędzią

Tesseract.js działa **w przeglądarce** przy uploadzie: wyciąga tekst, sprawdza
obecność słów kluczowych (`przelew`, `kwota`, `PLN`, `tytuł`, `odbiorca`, `IBAN`),
liczy heurystyczną pewność i zapisuje wynik razem ze zgłoszeniem.

Admin widzi zdjęcie obok wyciągniętego tekstu i akceptuje jednym kliknięciem.
Kwota **nie jest** weryfikowana — bramką jest człowiek.

**Dlaczego w przeglądarce, a nie na serwerze:** wynik OCR jest wyłącznie doradczy,
a admin i tak patrzy na oryginał — nie ma więc znaczenia, że tekst pochodzi od
niezaufanego klienta. W zamian: zero kluczy API, zero kosztów, zero cold startów
i zero 30 MB wasm w bundlu funkcji serwerowej. Gdyby jakość rozczarowała, podmiana
na OCR.space to jedna funkcja.

## 4. Model danych

```sql
-- Tożsamość i drużyny
profiles          id → auth.users, email, display_name, phone, sms_consent,
                  team_id, role ('member'|'admin'),
                  status ('pending'|'approved'|'rejected'), notes
teams             id, name, slug, color, motto, captain_id → profiles

-- Bramka wejściowa
registrations     id, user_id, full_name, phone, sms_consent, diet_notes,
                  proof_path, ocr_text, ocr_confidence, ocr_keywords_hit,
                  status, reviewed_by, reviewed_at, review_note

-- Rdzeń ekonomii (append-only)
points_ledger     id, user_id (nullable), team_id, delta, category, reason,
                  ref_type, ref_id, awarded_by, created_at
                  → widoki: user_scores, team_scores

-- Bingo (plansza wspólna dla drużyny)
bingo_tasks       id, position 0..24, title, description, points, active
bingo_submissions id, team_id, user_id, task_id, photo_path, caption,
                  status, reviewed_by, reviewed_at
                  → UNIQUE (team_id, task_id) WHERE status <> 'rejected'

-- Gossipy (kategorie z uzasadnieniem)
gossip_categories id, title, description, status ('open'|'closed'), reveal_at
gossip_nominees   id, category_id, profile_id           -- nominacje od admina
gossip_votes      id, category_id, voter_id (ukryty), nominee_id,
                  justification text CHECK (length >= 200), status
                  → UNIQUE (category_id, voter_id)
                  → widok gossip_wall bez voter_id

-- Sklepik
shop_items        id, name, description, kind ('digital'|'physical'),
                  price, stock, active, effect_key
shop_orders       id, team_id, item_id, price_paid, ordered_by → profiles,
                  status ('pending'|'fulfilled'|'cancelled'), fulfilled_by
active_effects    id, scope ('user'|'team'), subject_id, effect_key, expires_at

-- Kasyno
game_sessions     id, user_id, game, state jsonb, stake, status, created_at
                  → tabela zamknięta; widok game_view pokazuje tylko stan jawny

-- Powiadomienia i konfiguracja
broadcasts        id, body, channel ('sms'|'push'|'both'), sent_by,
                  sent_at, recipient_count
push_subscriptions id, user_id, endpoint, p256dh, auth
app_settings      key, value jsonb   -- limity kasyna, RTP, min. długość uzasadnienia
```

Wartości strojone przez `app_settings`, nie przez stałe w kodzie: dzienny limit
obrotu w kasynie, RTP slotów, minimalna długość uzasadnienia (200), próg
pewności OCR.

Liczba drużyn nie jest zaszyta w kodzie — admin zakłada je w panelu. Migracja
zasiewa 4 drużyny i 25 zadań bingo jako punkt startowy do podmiany.

Źródła punktów są trzy: zadania bingo (stała wartość `bingo_tasks.points` plus
bonusy za linię i pełną planszę), przyznania admina za aktywności offline
(`category = 'admin_adjust'`, dowolna wartość z uzasadnieniem) oraz kasyno
(dodatnie i ujemne).

## 5. Bezpieczeństwo

### Dwie pułapki rozbrojone u źródła

**Anonimowość uzasadnień w gossipach.** Gdyby `gossip_votes` miało włączony SELECT
dla zalogowanych, `voter_id` pojechałby w payloadzie do przeglądarki i anonimowość
byłaby fikcją — wystarczy zakładka Network. Dlatego:

- `REVOKE SELECT` na tabeli bazowej dla roli `authenticated`
- ściana czyta widok `gossip_wall` bez kolumny autora
- **Realtime nie subskrybuje `postgres_changes` na tej tabeli**, bo Supabase wysyła
  cały wiersz — zamiast tego kanał `broadcast` niesie sygnał „odśwież", a klient
  refetchuje widok
- admin widzi autora (moderacja i odpowiedzialność za treści)

**Talia w blackjacku.** `game_sessions.state` zawiera nierozdane karty. Gracz nie
może czytać tej tabeli, bo podejrzałby następną kartę. Ta sama technika: tabela
zamknięta, widok `game_view` pokazuje wyłącznie rękę gracza i odkrytą kartę
krupiera. Karty rozdaje funkcja w bazie, przeglądarka rysuje.

### Pozostałe zasady

- Przeglądarka używa wyłącznie klucza `anon`. `service_role` żyje tylko w route
  handlerach dla SMS broadcast i nigdy nie trafia do bundla klienta.
- Trigger na `auth.users` odrzuca adresy spoza `@samorzad.ue.wroc.pl` — twardy
  backstop niezależny od walidacji w UI.
- Bucket `proofs` (dowody przelewu) i `bingo` są prywatne; dostęp przez podpisane URL-e.
- Dowody przelewu widzi wyłącznie admin — to dane finansowe.

### Trójstanowa bramka w middleware

| Stan | Dokąd |
|---|---|
| niezalogowany | `/login` |
| zalogowany, `status = 'pending'` | `/rejestracja` (i nigdzie indziej) |
| zalogowany, `status = 'approved'` | pełna apka |
| `role = 'admin'` | dodatkowo `/admin/*` |

## 6. Przepływy

**Wejście:** OTP na maila @samorzad → formularz (imię, telefon, zgoda SMS, dieta,
zdjęcie przelewu) → OCR w przeglądarce dopisuje tekst i pewność → status `pending`
→ admin akceptuje i przypisuje drużynę → pełny dostęp.

**Bingo:** uczestnik wybiera pole z planszy drużyny, wrzuca zdjęcie (kompresja po
stronie klienta przed uploadem) → kolejka admina → akceptacja zapala pole **całej
drużynie**, punkty lecą na `user_id` autora zdjęcia → funkcja sprawdza linie
i pełną planszę, dopisuje bonusy → zdjęcie trafia do globalnego feedu `/feed`.

**Sklepik:** kapitan kupuje z salda drużyny. Funkcja `SECURITY DEFINER` w jednej
transakcji sprawdza saldo i stan magazynu, dopisuje ujemny wiersz do ledgera,
tworzy zamówienie i zmniejsza stock. Pozycje `digital` aktywują `active_effects`
od razu; `physical` lądują w kolejce do wydania w panelu admina.

**Gossipy:** admin ogłasza kategorię i nominowanych → każdy oddaje jeden głos
w kategorii z uzasadnieniem min. 200 znaków → uzasadnienia trafiają na ścianę
**anonimowo** → admin zamyka kategorię i ujawnia wynik.
Nie można głosować na siebie.

**Kasyno:** sloty (RTP ok. 88%), blackjack (hit/stand/double; split poza v1 —
rozgałęzione ręce to nieproporcjonalnie dużo pracy), dino w motywie sekty
(umiejętnościowa, więc payout z twardym sufitem dziennym). Wszystko rozstrzygane
funkcjami w bazie, RNG po stronie serwera, dzienny limit obrotu z `app_settings`.

**Powiadomienia:** web push jako kanał bieżący, SMS przez SMSAPI na komunikaty
krytyczne. Onboarding wykrywa iOS i pokazuje instrukcję „Dodaj do ekranu głównego",
bo Safari udostępnia push wyłącznie zainstalowanym PWA.

## 7. Routing

```
/login            OTP
/rejestracja      formularz + OCR (jedyna dostępna trasa dla 'pending')
/                 ranking na żywo — przełącznik drużyny / indywidualny
/bingo            plansza drużyny + upload
/feed             globalny strumień zaakceptowanych zdjęć
/gossip           kategorie, głosowanie, ściana uzasadnień
/shop             sklepik (zakup tylko dla kapitana)
/arcade           blackjack · sloty · dino
/me               saldo, historia, ustawienia powiadomień
/admin            punkty · rejestracje · bingo · gossipy · sklepik · broadcast · drużyny
```

## 8. Design system

- Tło `#0a0908`, złoto świecy `#c9a227`, krew `#8b1e1e`, pergamin `#e8e0d0`
- Nagłówki: `Cinzel` (szeryfowa, rytualna). Treść: `Inter`
- Ziarno, winieta, subtelne migotanie na akcentach; animacje wyłączone przy
  `prefers-reduced-motion`
- Mobile-first — apka będzie używana wyłącznie na telefonach, w ciemności,
  często jedną ręką. Cele dotykowe min. 44 px.
- Estetyka poważna, nie memiarska

## 9. Harmonogram

| Dni | Zakres |
|---|---|
| 1–2 | Projekt Next.js, migracja `0001_init.sql`, auth, RLS, deploy na Vercel |
| 3 | Bramka rejestracyjna z OCR + akceptacja w panelu admina |
| 4–5 | Ranking realtime, panel admina, design system |
| 6–8 | Bingo: upload, kolejka, bonusy, globalny feed |
| 9 | Sklepik + perki |
| 10–12 | Kasyno: sloty → blackjack → dino |
| 13 | Gossipy + moderacja |
| 14 | Push, SMS, PWA, test na żywych ludziach |

Rdzeń stoi w produkcji po dniu 3. Ryzyko kumuluje się na końcu listy, nie
w fundamencie.

## 10. Ryzyka

| Ryzyko | Rozbrojenie |
|---|---|
| Uczestnicy dosypują sobie punkty | Ledger zamknięty na RLS, zapisy tylko przez `SECURITY DEFINER` (D1) |
| Wyciek autorów uzasadnień | Tabela zamknięta, widok bez kolumny, `broadcast` zamiast `postgres_changes` (§5) |
| Podglądanie talii w blackjacku | Tabela zamknięta, widok tylko ze stanem jawnym (§5) |
| Inflacja punktów z kasyna | House edge + dzienny limit obrotu + sufit na dino |
| Kapitan przepuszcza dorobek drużyny | Zakup tylko dla kapitana, historia jawna dla drużyny |
| Push nie dociera na iPhone'y | SMS jako kanał zapasowy; onboarding uczy instalacji PWA |
| Zdjęcia zjadają darmowy Storage | Kompresja po stronie klienta przed uploadem |
| Deploy zjada dni z deadline'u | Vercel zamiast Cloudflare Workers — limit 3 MiB gzip, WebSockety Realtime i upload potrafią kosztować 1–2 dni debugowania, czego przy 14 dniach nie ma skąd wziąć |

## 11. Poza zakresem v1

Split w blackjacku · anonimowy feed wyznań (zastąpiony kategoriami) ·
tryb offline poza samą grą dino · panel statystyk po wyjeździe ·
wielojęzyczność · automatyczna weryfikacja kwoty przelewu

## 12. Kryteria ukończenia

1. Osoba spoza `@samorzad.ue.wroc.pl` nie zakłada konta — odbija się na triggerze.
2. Osoba bez zaakceptowanego przelewu widzi wyłącznie `/rejestracja`.
3. Ranking aktualizuje się w drugiej karcie bez odświeżania.
4. Próba dopisania sobie punktów przez konsolę przeglądarki kończy się błędem RLS.
5. Zaakceptowane pole bingo zapala się wszystkim w drużynie i ląduje w `/feed`.
6. Nie-kapitan nie kupi w sklepiku; kapitan nie kupi ponad saldo drużyny.
7. Głos w gossipach nie przechodzi poniżej 200 znaków uzasadnienia, a `voter_id`
   nie pojawia się w żadnej odpowiedzi sieciowej dla nie-admina.
8. Blackjack: nierozdane karty nie występują w żadnej odpowiedzi dla gracza.
9. Dzienny limit kasyna zatrzymuje grę po przekroczeniu.
10. Push dociera na Androida oraz na iOS po instalacji PWA; SMS dociera do
    wszystkich ze zgodą.
