-- ============================================================
-- Sekta Wyjazdowa — bonusy bingo odporne na wyścig
-- ============================================================
--
-- Poprzednia wersja brała `for update` na wierszu ZGŁOSZENIA, co chroniło tylko
-- przed dwukrotnym rozpatrzeniem tego samego zgłoszenia. Bonusy liczą się jednak
-- na poziomie DRUŻYNY, a każde wywołanie rpc z osobnej sesji admina to osobna
-- transakcja. Oba wyścigi zostały odtworzone na żywej bazie:
--
--   * dwóch adminów domyka ostatnie dwa pola linii — żadna transakcja nie widzi
--     commitu drugiej, obie uznają linię za niekompletną i bonus nie pada wcale
--     (1 raz na 15 prób);
--   * linia jest już kompletna, a dwóch adminów akceptuje dwa inne zgłoszenia —
--     obie transakcje przechodzą `not exists` zanim któraś zdąży wstawić wiersz
--     i bonus pada dwa razy (4 razy na 25 prób).
--
-- Dwie niezależne naprawy, bo każda zamyka co innego:
--
--   1. Blokada na wierszu drużyny serializuje akceptacje w obrębie drużyny.
--      To jedyne, co naprawia wariant z UTRATĄ bonusu — indeks by tu nie pomógł,
--      bo tam problem polega na tym, że wpisu brakuje, a nie że jest podwójny.
--   2. Unikalny indeks częściowy na księdze czyni podwójny bonus niemożliwym
--      niezależnie od logiki aplikacji — także dla przyszłych źródeł punktów,
--      które ktoś napisze za pół roku, nie pamiętając o tej pułapce.

-- ---------- Twarda gwarancja w bazie ----------
create unique index points_ledger_bonus_raz
  on points_ledger (team_id, ref_type, ref_id)
  where ref_type in ('bingo_linia', 'bingo_plansza');

-- ---------- Funkcja z blokadą na drużynie ----------
create or replace function public.review_bingo(
  p_submission_id uuid,
  p_approve       boolean,
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team     uuid;
  v_user     uuid;
  v_task     uuid;
  v_punkty   integer;
  v_tytul    text;
  v_status   public.user_status;
  v_zapalone integer[];
  v_wszystkie integer[];
  v_bonus_l  integer;
  v_bonus_p  integer;
  v_linia    record;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze rozpatrywac zgloszenia bingo';
  end if;

  if p_approve is null then
    raise exception 'Brak decyzji: p_approve nie moze byc null';
  end if;

  select team_id, user_id, task_id
    into v_team, v_user, v_task
  from public.bingo_submissions
  where id = p_submission_id and status = 'pending'
  for update;

  if v_team is null then
    raise exception 'Zgloszenie nie istnieje albo zostalo juz rozpatrzone';
  end if;

  -- Serializacja w obrębie drużyny. Bez tego dwie równoległe akceptacje liczą
  -- stan planszy, nie widząc swoich zmian nawzajem. Blokadę bierzemy po ustaleniu
  -- drużyny, ale przed jakimkolwiek liczeniem — i zawsze w tej samej kolejności
  -- (zgłoszenie, potem drużyna), więc zakleszczenie nie grozi.
  perform 1 from public.teams where id = v_team for update;

  v_status := (case when p_approve then 'approved' else 'rejected' end)::public.user_status;

  update public.bingo_submissions
  set status      = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_note
  where id = p_submission_id;

  if not p_approve then
    return;
  end if;

  -- ---------- Punkty za zadanie ----------
  select points, title into v_punkty, v_tytul
  from public.bingo_tasks where id = v_task;

  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
  values
    (v_user, v_team, v_punkty, 'bingo', v_tytul,
     'bingo_zadanie', p_submission_id::text, auth.uid());

  -- ---------- Stan planszy ----------
  select coalesce(array_agg(t.position), array[]::integer[])
    into v_zapalone
  from public.bingo_submissions s
  join public.bingo_tasks t on t.id = s.task_id
  where s.team_id = v_team and s.status = 'approved';

  select (value #>> '{}')::integer into v_bonus_l
  from public.app_settings where key = 'bingo_bonus_linia';
  select (value #>> '{}')::integer into v_bonus_p
  from public.app_settings where key = 'bingo_bonus_plansza';

  -- ---------- Bonusy za linie ----------
  -- Linie zakładają planszę pełną i aktywną. Wyłączenie zadania przez `active`
  -- czyni jego linie nieosiągalnymi — świadomie, bo dezaktywacja zadania w trakcie
  -- wyjazdu i tak psuje rywalizację, a wykrywanie „linii z dziurą" byłoby
  -- mechaniką, której nikt nie prosił.
  for v_linia in
    select * from (values
      ('wiersz-0',    array[ 0, 1, 2, 3, 4]),
      ('wiersz-1',    array[ 5, 6, 7, 8, 9]),
      ('wiersz-2',    array[10,11,12,13,14]),
      ('wiersz-3',    array[15,16,17,18,19]),
      ('wiersz-4',    array[20,21,22,23,24]),
      ('kolumna-0',   array[ 0, 5,10,15,20]),
      ('kolumna-1',   array[ 1, 6,11,16,21]),
      ('kolumna-2',   array[ 2, 7,12,17,22]),
      ('kolumna-3',   array[ 3, 8,13,18,23]),
      ('kolumna-4',   array[ 4, 9,14,19,24]),
      ('przekatna-a', array[ 0, 6,12,18,24]),
      ('przekatna-b', array[ 4, 8,12,16,20])
    ) as l(nazwa, pola)
  loop
    if v_linia.pola <@ v_zapalone then
      if not exists (
        select 1 from public.points_ledger
        where team_id = v_team
          and ref_type = 'bingo_linia'
          and ref_id = v_linia.nazwa
      ) then
        insert into public.points_ledger
          (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
        values
          (null, v_team, v_bonus_l, 'bingo_bonus',
           'Linia ' || v_linia.nazwa, 'bingo_linia', v_linia.nazwa, auth.uid());
      end if;
    end if;
  end loop;

  -- ---------- Bonus za pełną planszę ----------
  -- Porównujemy z zestawem zadań AKTYWNYCH, a nie ze sztywną dwudziestką piątką.
  -- Przy zaszytej liczbie wyłączenie choćby jednego zadania czyniło bonus cicho
  -- i trwale nieosiągalnym.
  select coalesce(array_agg(position), array[]::integer[])
    into v_wszystkie
  from public.bingo_tasks where active;

  if array_length(v_wszystkie, 1) > 0 and v_wszystkie <@ v_zapalone then
    if not exists (
      select 1 from public.points_ledger
      where team_id = v_team and ref_type = 'bingo_plansza'
    ) then
      insert into public.points_ledger
        (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
      values
        (null, v_team, v_bonus_p, 'bingo_bonus',
         'Pelna plansza', 'bingo_plansza', 'plansza', auth.uid());
    end if;
  end if;
end;
$$;
