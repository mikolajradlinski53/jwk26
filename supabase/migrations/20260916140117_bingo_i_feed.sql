-- ============================================================
-- Sekta Wyjazdowa — bingo i feed
-- ============================================================

-- ---------- Zadania ----------
-- Wspólne dla wszystkich drużyn. Stan planszy jest per drużyna i trzyma go
-- bingo_submissions — tutaj siedzi wyłącznie treść zadania.
create table bingo_tasks (
  id          uuid primary key default gen_random_uuid(),
  position    integer not null unique check (position between 0 and 24),
  title       text not null,
  description text not null,
  points      integer not null default 20 check (points between 1 and 1000),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Zgłoszenia ----------
create table bingo_submissions (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  task_id     uuid not null references bingo_tasks(id) on delete cascade,
  photo_path  text not null,
  caption     text check (caption is null or length(caption) <= 300),
  status      user_status not null default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);

-- Jedno nieodrzucone zgłoszenie na pole i drużynę. Odrzucenie zwalnia pole samo,
-- bez żadnej dodatkowej akcji — warunek obejmuje wyłącznie nieodrzucone.
create unique index bingo_jedno_na_pole
  on bingo_submissions (team_id, task_id)
  where status <> 'rejected';

create index bingo_submissions_feed_idx
  on bingo_submissions (status, created_at desc);

-- ---------- Warstwa społeczna ----------
create table feed_likes (
  submission_id uuid not null references bingo_submissions(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (submission_id, user_id)
);

create table feed_comments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bingo_submissions(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  body          text not null check (length(trim(body)) between 1 and 500),
  created_at    timestamptz not null default now()
);

create index feed_comments_submission_idx
  on feed_comments (submission_id, created_at);

-- ============================================================
-- RLS
-- ============================================================

alter table bingo_tasks        enable row level security;
alter table bingo_submissions  enable row level security;
alter table feed_likes         enable row level security;
alter table feed_comments      enable row level security;

-- Zadania: czyta każdy zaakceptowany, pisze admin.
create policy bingo_tasks_read on bingo_tasks
  for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy bingo_tasks_admin_write on bingo_tasks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Zgłoszenia: czyta każdy zaakceptowany, bo feed jest globalny.
create policy bingo_submissions_read on bingo_submissions
  for select to authenticated
  using (public.is_approved() or public.is_admin());

-- Wstawia wyłącznie we własnym imieniu, dla własnej drużyny, ze statusem
-- oczekującym i z plikiem we własnym folderze. Ostatni warunek jest tym samym
-- zabezpieczeniem, które przy dowodach przelewu okazało się konieczne: bez niego
-- da się podpiąć cudzy plik pod własne zgłoszenie.
create policy bingo_submissions_insert_own on bingo_submissions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and team_id = (select team_id from public.profiles where id = (select auth.uid()))
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and photo_path like ((select auth.uid())::text || '/%')
    and photo_path !~ '\.\.'
  );

-- Autor wycofuje własne, póki czeka. Odblokowuje to pole reszcie drużyny,
-- zamiast trzymać ją zakładnikiem jednego kiepskiego wrzutu do czasu, aż admin
-- dojdzie do kolejki.
create policy bingo_submissions_delete_own on bingo_submissions
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

-- Brak polityki UPDATE: status zmienia wyłącznie review_bingo.

-- Lajki: czyta każdy zaakceptowany, stawia i cofa wyłącznie swoje.
create policy feed_likes_read on feed_likes
  for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy feed_likes_insert_own on feed_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_approved());

create policy feed_likes_delete_own on feed_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Komentarze: czyta każdy zaakceptowany, pisze swoje, kasuje autor albo admin.
create policy feed_comments_read on feed_comments
  for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy feed_comments_insert_own on feed_comments
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_approved());

create policy feed_comments_delete on feed_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ---------- Bucket na zdjęcia z bingo ----------
-- Prywatny jak proofs, ale z inną polityką odczytu: dowody przelewu widzi
-- wyłącznie admin, bo to dane finansowe; zdjęcia z bingo widzi każdy
-- zaakceptowany, bo na tym polega feed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bingo', 'bingo', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy bingo_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bingo'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy bingo_read_approved on storage.objects
  for select to authenticated
  using (bucket_id = 'bingo' and (public.is_approved() or public.is_admin()));

-- ---------- Ustawienia bonusów ----------
-- Strojone bez wdrożenia. Linii jest dwanaście: pięć wierszy, pięć kolumn,
-- dwie przekątne. Przy tych wartościach pełna plansza daje drużynie 1300 punktów.
insert into app_settings (key, value) values
  ('bingo_bonus_linia',   '50'),
  ('bingo_bonus_plansza', '200')
on conflict (key) do nothing;

-- ---------- Zasiew dwudziestu pięciu zadań ----------
-- PLACEHOLDERY. Dobre bingo stoi na wewnętrznych żartach i nazwiskach, więc te
-- zadania trzeba przed wyjazdem przejrzeć i podmienić w panelu albo zapytaniem.
-- Rejestr jest sekciarski celowo: komizm ma brać się z kontrastu formy z treścią.
insert into bingo_tasks (position, title, description) values
  (0,  'Zgromadzenie',            'Cała drużyna w jednym kadrze, przy wejściu do ośrodka'),
  (1,  'Ofiara ze snu',           'Wschód słońca widziany bez uprzedniego snu'),
  (2,  'Namaszczenie woźnicy',    'Zdjęcie z kierowcą autokaru'),
  (3,  'Sen niewłaściwy',         'Ktoś śpi w miejscu do tego nieprzeznaczonym'),
  (4,  'Formacja',                'Drużyna ustawiona w dowolną figurę geometryczną'),
  (5,  'Uczta',                   'Ktoś przygotowuje posiłek dla całej drużyny'),
  (6,  'Zdrada',                  'Zdjęcie z osobą z obcej drużyny, która na to przystała'),
  (7,  'Relikwia',                'Najbrzydszy przedmiot znaleziony w pokoju'),
  (8,  'Triumf',                  'Dowód wygranej w dowolnej grze'),
  (9,  'Nieuwaga',                'Cała drużyna w kadrze, nikt nie patrzy w obiektyw'),
  (10, 'Uczony',                  'Ktoś czyta książkę w trakcie imprezy'),
  (11, 'Zwierzę',                 'Zdjęcie z dowolnym miejscowym stworzeniem'),
  (12, 'Odtworzenie',             'Drużyna odgrywa scenę z filmu'),
  (13, 'Pokuta',                  'Ktoś biegnie o świcie'),
  (14, 'Połączenie zakazane',     'Najdziwniejsze zestawienie jedzenia na jednym talerzu'),
  (15, 'Porządek',                'Dowód sprzątniętego pokoju, datowany'),
  (16, 'Pieśń',                   'Ktoś śpiewa przy akompaniamencie czegokolwiek'),
  (17, 'Audiencja',               'Wspólne zdjęcie z organizatorem wyjazdu'),
  (18, 'Objawienie',              'Widok, który warto zapamiętać'),
  (19, 'Nauka bezużyteczna',      'Ktoś uczy kogoś czegoś zupełnie zbędnego'),
  (20, 'Komplet przed północą',   'Cała drużyna w jednym miejscu przed 24:00'),
  (21, 'Przełamanie',             'Dowód, że ktoś zjadł coś, czego się bał'),
  (22, 'Toast',                   'Najlepszy toast wieczoru, uwieczniony'),
  (23, 'Zaśnięcie w pół zdania',  'Dokładnie to, co w tytule'),
  (24, 'Ostatni kadr',            'Ostatnie zdjęcie wyjazdu');

-- Realtime celowo nieruszane. Ranking reaguje na żywo, bo subskrybuje
-- points_ledger, a bingo pisze do tej samej księgi — kryterium „punkty widać bez
-- odświeżania" jest więc spełnione bez ani jednej nowej subskrypcji. Dopisywanie
-- tabel do publikacji, których nic nie słucha, to martwa konfiguracja.
