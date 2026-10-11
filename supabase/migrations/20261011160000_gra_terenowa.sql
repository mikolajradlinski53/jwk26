-- ============================================================
-- Sekta Wyjazdowa — gra terenowa (paczka D1)
-- ============================================================
--
-- Decyzje Mikołaja 2026-10-11: zadania gry terenowej odkrywa admin; każda
-- drużyna wysyła jedno zgłoszenie (zdjęcie + opis), admin przyjmuje, punkty
-- idą drużynie; zgłoszenia lecą do feedu jak bingo.
--
-- Zadanie gry to wiersz bingo_tasks z rodzajem 'quest' - zgłoszenia,
-- akceptacja, punkty, feed, lajki, komentarze, powiadomienia i retencja
-- działają bez zmian. Quest nie ma pola na planszy (position NULL), więc
-- review_bingo musi go pominąć przy liniach i pełnej planszy.

alter table bingo_tasks
  add column rodzaj text not null default 'bingo' check (rodzaj in ('bingo', 'quest')),
  add column odkryte boolean not null default true,
  alter column position drop not null,
  add constraint bingo_tasks_pole_tylko_bingo check ((rodzaj = 'bingo') = (position is not null));

-- Nieodkryty quest widzi wyłącznie admin.
drop policy bingo_tasks_read on bingo_tasks;
create policy bingo_tasks_read on bingo_tasks
  for select to authenticated
  using (public.is_admin() or (public.is_approved() and (rodzaj = 'bingo' or odkryte)));

-- Zgłoszenie tylko do aktywnego zadania, a questu - dopiero po odkryciu.
-- Podzapytanie przechodzi przez RLS zadań, więc nieodkryty quest i tak
-- byłby niewidoczny; warunek jest jawny dla czytelności.
drop policy bingo_submissions_insert_own on bingo_submissions;
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
    and exists (
      select 1 from public.bingo_tasks t
      where t.id = task_id and t.active and (t.rodzaj = 'bingo' or t.odkryte)
    )
  );

-- Kopia review_bingo z 20260925120200: quest dostaje kategorię
-- 'gra_terenowa' i kończy się po punktach za zadanie; stan planszy liczy
-- tylko pola bingo, a pełna plansza - różne pozycje, nie liczbę wierszy.
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
  v_bonus_l  integer;
  v_bonus_p  integer;
  v_linia    record;
  v_blogo    uuid;
  v_mnoznik  integer;
  v_rodzaj   text;
begin
  -- SECURITY DEFINER omija RLS, więc uprawnienie sprawdzamy ręcznie.
  if not public.is_admin() then
    raise exception 'Tylko admin moze rozpatrywac zgloszenia bingo';
  end if;

  if p_approve is null then
    raise exception 'Brak decyzji: p_approve nie moze byc null';
  end if;

  -- Blokada wiersza razem z warunkiem na status: drugi admin klikający to samo
  -- zgłoszenie zobaczy już zmieniony status i wyjdzie z czytelnym błędem.
  select team_id, user_id, task_id
    into v_team, v_user, v_task
  from public.bingo_submissions
  where id = p_submission_id and status = 'pending'
  for update;

  if v_team is null then
    raise exception 'Zgloszenie nie istnieje albo zostalo juz rozpatrzone';
  end if;

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
  select points, title, rodzaj into v_punkty, v_tytul, v_rodzaj
  from public.bingo_tasks where id = v_task;

  -- ---------- Błogosławieństwo ----------
  -- Jedyny nowy blok w tej funkcji. Mnożnik dotyczy wyłącznie punktów za
  -- zadanie; bonusy niżej zostają nietknięte. `skip locked` zamyka wyścig dwóch
  -- adminów akceptujących równocześnie dwa zgłoszenia tej samej drużyny — drugi
  -- nie zawiesi się na wierszu, tylko go pominie i przyzna punkty bez mnożnika.
  select id, effect_value into v_blogo, v_mnoznik
  from public.active_effects
  where scope = 'team'
    and subject_id = v_team
    and effect_key = 'blogoslawienstwo'
    and consumed_at is null
    and (expires_at is null or expires_at > now())
  order by created_at
  limit 1
  for update skip locked;

  if v_blogo is not null then
    update public.active_effects set consumed_at = now() where id = v_blogo;
    v_punkty := v_punkty * coalesce(v_mnoznik, 1);
    -- Księga jest jawna dla wszystkich zaakceptowanych, więc wpis musi sam
    -- wyjaśnić, skąd wzięła się nietypowa liczba.
    v_tytul := v_tytul || ' (blogoslawienstwo x' || coalesce(v_mnoznik, 1) || ')';
  end if;

  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
  values
    (v_user, v_team, v_punkty,
     case when v_rodzaj = 'quest' then 'gra_terenowa' else 'bingo' end, v_tytul,
     'bingo_zadanie', p_submission_id::text, auth.uid());

  -- Zadanie gry terenowej nie leży na planszy: bez linii i pełnej planszy.
  if v_rodzaj = 'quest' then
    return;
  end if;

  -- ---------- Stan planszy ----------
  select coalesce(array_agg(t.position), array[]::integer[])
    into v_zapalone
  from public.bingo_submissions s
  join public.bingo_tasks t on t.id = s.task_id
  where s.team_id = v_team and s.status = 'approved' and t.rodzaj = 'bingo';

  select (value #>> '{}')::integer into v_bonus_l
  from public.app_settings where key = 'bingo_bonus_linia';
  select (value #>> '{}')::integer into v_bonus_p
  from public.app_settings where key = 'bingo_bonus_plansza';

  -- ---------- Bonusy za linie ----------
  -- Dwanaście linii: pięć wierszy, pięć kolumn, dwie przekątne. Operator `<@`
  -- sprawdza, czy wszystkie pola linii są wśród zapalonych.
  --
  -- Idempotentność bierze się z danych, nie z ostrożności: przed dopisaniem
  -- sprawdzamy, czy wpis o tym ref_type i ref_id już dla tej drużyny istnieje.
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
        -- Bonus jest zasługą zbiorową, więc idzie jako wpis drużynowy
        -- (user_id NULL). Nie podnosi niczyjego salda indywidualnego.
        insert into public.points_ledger
          (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
        values
          (null, v_team, v_bonus_l, 'bingo_bonus',
           'Linia ' || v_linia.nazwa, 'bingo_linia', v_linia.nazwa, auth.uid());
      end if;
    end if;
  end loop;

  -- ---------- Bonus za pełną planszę ----------
  if (select count(distinct p) from unnest(v_zapalone) p) = 25 then
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

-- ---------- Powiadomienia ----------
-- Kopia powiadom_o_bingo z 20261008120000 z tekstami dla gry terenowej.
create or replace function public.powiadom_o_bingo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tytul  text;
  v_punkty integer;
  v_quest  boolean;
begin
  select title, points, rodzaj = 'quest' into v_tytul, v_punkty, v_quest
  from public.bingo_tasks where id = new.task_id;

  if new.status = 'approved'::public.user_status
     and old.status is distinct from 'approved'::public.user_status then
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'team', new.team_id,
            case when v_quest then 'Zadanie gry terenowej zaliczone' else 'Pole bingo zaliczone' end,
            coalesce(v_tytul, 'Zadanie') || ' - +' || coalesce(v_punkty, 0) || ' pkt dla drużyny',
            case when v_quest then '/app/gra' else '/app/bingo' end, 'bingo', new.id::text);
  elsif new.status = 'rejected'::public.user_status
        and old.status is distinct from 'rejected'::public.user_status then
    -- Treść powiadomienia ma limit długości w praktyce (ekran blokady), więc
    -- powód przycinamy; pełny jest w apce po dotknięciu zadania.
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'user', new.user_id,
            case when v_quest then 'Zadanie gry terenowej odrzucone' else 'Pole bingo odrzucone' end,
            coalesce(v_tytul, 'Zadanie') || ': ' ||
              coalesce(left(nullif(btrim(new.review_note), ''), 140), 'bez podania powodu') ||
              '. Możesz wrzucić nowe zdjęcie.',
            case when v_quest then '/app/gra' else '/app/bingo' end, 'bingo', new.id::text);
  end if;
  return null;
end;
$$;

-- Odkrycie questu ogłasza się wszystkim przyjętym.
create function public.powiadom_o_quescie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rodzaj = 'quest' and new.odkryte and new.active
     and (tg_op = 'INSERT' or not old.odkryte or not old.active) then
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'all', null, 'Nowe zadanie w grze terenowej',
            new.title || ' - ' || new.points || ' pkt dla drużyny', '/app/gra', 'quest', new.id::text);
  end if;
  return null;
end;
$$;

revoke execute on function public.powiadom_o_quescie() from public, anon, authenticated;

create trigger bingo_tasks_quest_odkryty
  after insert or update of odkryte, active on bingo_tasks
  for each row execute function public.powiadom_o_quescie();
