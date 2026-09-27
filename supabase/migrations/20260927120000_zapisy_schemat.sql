-- ============================================================
-- Sekta Wyjazdowa — zapisy: schemat
-- ============================================================
--
-- Sama struktura. Funkcje przychodzą w kolejnych migracjach, jedna na task.

-- ---------- Pule ----------
-- Kolumna nazywa się `miejsca`, nie `limit` jak w specu: `limit` jest słowem
-- zastrzeżonym i każde odwołanie do niego wymagałoby cudzysłowu.
create table pule (
  klucz     text primary key check (klucz in ('dzialacze', 'swiezaki', 'alumni')),
  nazwa     text not null,
  otwarta   boolean not null default false,
  miejsca   integer not null default 0 check (miejsca >= 0),
  kolejnosc smallint not null
);

-- Zamknięte i bez miejsc: nic nie rusza, dopóki admin tego nie zrobi.
insert into pule (klucz, nazwa, kolejnosc) values
  ('dzialacze', 'Działacze', 1),
  ('swiezaki',  'Świeżaki',  2),
  ('alumni',    'Alumni',    3);

alter table pule enable row level security;

create policy pule_read on pule
  for select to authenticated using (true);

-- Brak polityk zapisu: pule zmienia wyłącznie ustaw_pule() (admin).

-- ---------- Zgłoszenia: nowe pola ----------
-- Wszystkie dopuszczają NULL, bo na produkcji jest już zgłoszenie z planu 02
-- (D12). Wymagalność pilnuje zloz_zgloszenie().
alter table registrations
  add column pula                        text references pule(klucz),
  add column imie                        text,
  add column nazwisko                    text,
  add column nr_indeksu                  text,
  add column data_urodzenia              date,
  add column dojazd                      text
    check (dojazd in ('autokar_oba', 'autokar_tam', 'autokar_powrot', 'wlasny')),
  add column ksywka                      text check (length(ksywka) <= 24),
  add column piosenka                    text check (length(piosenka) <= 200),
  add column uwagi                       text check (length(uwagi) <= 1000),
  add column wersja_zgod                 text,
  add column zgoda_wizerunek             boolean not null default false,
  add column zgoda_wizerunek_wycofana_at timestamptz,
  add column rezerwa                     boolean not null default false,
  add column kolejnosc_rezerwy           integer;

-- Rezerwa bywa bez zdjęcia przelewu (D3). Regułę „akceptacja wymaga zdjęcia"
-- trzyma review_registration, nie ograniczenie tabeli.
alter table registrations alter column proof_path drop not null;

-- Pod liczenie zajętych miejsc — zapytanie wykonywane przy każdym zapisie.
create index registrations_pula_idx on registrations (pula, rezerwa, status);

-- ---------- Dane wrażliwe (D6) ----------
create table dane_wrazliwe (
  registration_id   uuid primary key references registrations(id) on delete cascade,
  ice_imie          text check (length(ice_imie) <= 60),
  -- 21, nie 20: wzorzec telefonu dopuszcza „+" i dwadzieścia znaków po nim.
  ice_telefon       text check (length(ice_telefon) <= 21),
  ice_poinformowany boolean not null default false,
  dieta             text check (length(dieta) <= 500),
  alergie           text check (length(alergie) <= 500),
  choroby_leki      text check (length(choroby_leki) <= 500),
  zgoda_art9_at     timestamptz,
  created_at        timestamptz not null default now()
);

alter table dane_wrazliwe enable row level security;

create policy dane_wrazliwe_read on dane_wrazliwe
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.registrations r
      where r.id = registration_id and r.user_id = (select auth.uid())
    )
  );

-- Supabase nadaje anon i authenticated pełne granty na nowych tabelach. RLS
-- bez polityk zapisu i tak by je zatrzymał, ale dane z art. 9 RODO zasługują
-- na dwa zamki, nie jeden.
revoke all on dane_wrazliwe from anon;
revoke insert, update, delete on dane_wrazliwe from authenticated;

-- Tabela świadomie NIE trafia do publikacji supabase_realtime: Realtime
-- wysyła cały wiersz każdemu subskrybentowi, któremu RLS go pokaże.

-- ---------- Ustawienia ----------
insert into app_settings (key, value) values
  ('regulamin_zatwierdzony', 'false'),
  ('data_konca_jwk',         '"2026-10-25"'::jsonb),
  ('data_retencji_zgloszen', '"2027-12-31"'::jsonb)
on conflict (key) do nothing;

-- /regulamin jest publiczny i pokazuje baner wersji roboczej zależnie od flagi.
drop policy settings_read_public on app_settings;
create policy settings_read_public on app_settings
  for select to anon
  using (key in ('data_jwk', 'data_swiezakow', 'miejsce_nazwa', 'miejsce_adres',
                 'regulamin_zatwierdzony'));
