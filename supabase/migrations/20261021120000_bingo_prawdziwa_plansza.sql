-- ============================================================================
-- Bingo: prawdziwa plansza i zasady (decyzja Mikołaja 2026-10-21)
-- ============================================================================
-- Zasady:
--   * punkty za każde zaliczone pole (bez zmian, `bingo_tasks.points`);
--   * WYGRANA: 3 pełne linie, tylko wiersze i kolumny (bez przekątnych) -
--     bonus dostaje wyłącznie PIERWSZA drużyna, która je zbierze (Kadra,
--     drużyna ukryta, nie wygrywa);
--   * KUMULACJA: wszystkie pola - bonus dla każdej drużyny, raz;
--   * środek (pole 12) jest darmowy: zapalony od startu, bez zgłoszeń.
-- Bonus za pojedynczą linię znika; klucz `bingo_bonus_linia` zostaje w
-- ustawieniach martwy, żeby nie ruszać historii w księdze.

insert into public.app_settings (key, value) values ('bingo_bonus_wygrana', '200'::jsonb)
on conflict (key) do update set value = excluded.value;

update public.app_settings set value = '500'::jsonb where key = 'bingo_bonus_plansza';

-- ---------- Pole darmowe: żadnych zgłoszeń ----------
-- Strażnik w bazie, nie tylko w planszy: stara wersja apki w pamięci telefonu
-- wciąż pokazuje środek jako zwykłe pole.
create or replace function public.bingo_bez_pola_darmowego()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.bingo_tasks
    where id = new.task_id and rodzaj = 'bingo' and position = 12
  ) then
    raise exception 'POLE_DARMOWE';
  end if;
  return new;
end;
$$;

drop trigger if exists bingo_bez_pola_darmowego on public.bingo_submissions;
create trigger bingo_bez_pola_darmowego
  before insert on public.bingo_submissions
  for each row execute function public.bingo_bez_pola_darmowego();

-- ---------- review_bingo z nowymi bonusami ----------
create or replace function public.review_bingo(p_submission_id uuid, p_approve boolean, p_note text default null)
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
  v_bonus_w  integer;
  v_bonus_p  integer;
  v_linie    integer;
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
  -- Mnożnik dotyczy wyłącznie punktów za zadanie; bonusy niżej zostają
  -- nietknięte. `skip locked` zamyka wyścig dwóch adminów akceptujących
  -- równocześnie dwa zgłoszenia tej samej drużyny.
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
  -- Pole darmowe (12) jest zapalone dla każdej drużyny.
  select array_append(coalesce(array_agg(t.position), array[]::integer[]), 12)
    into v_zapalone
  from public.bingo_submissions s
  join public.bingo_tasks t on t.id = s.task_id
  where s.team_id = v_team and s.status = 'approved' and t.rodzaj = 'bingo';

  select (value #>> '{}')::integer into v_bonus_w
  from public.app_settings where key = 'bingo_bonus_wygrana';
  select (value #>> '{}')::integer into v_bonus_p
  from public.app_settings where key = 'bingo_bonus_plansza';

  -- ---------- Wygrana: 3 linie, tylko pion i poziom ----------
  select count(*) into v_linie
  from (values
    (array[ 0, 1, 2, 3, 4]), (array[ 5, 6, 7, 8, 9]), (array[10,11,12,13,14]),
    (array[15,16,17,18,19]), (array[20,21,22,23,24]),
    (array[ 0, 5,10,15,20]), (array[ 1, 6,11,16,21]), (array[ 2, 7,12,17,22]),
    (array[ 3, 8,13,18,23]), (array[ 4, 9,14,19,24])
  ) as l(pola)
  where l.pola <@ v_zapalone;

  if v_linie >= 3
     and coalesce(v_bonus_w, 0) > 0
     and not (select ukryta from public.teams where id = v_team) then
    -- Jedna wygrana na cały wyjazd. Blokada doradcza serializuje dwie
    -- akceptacje różnych drużyn w tej samej chwili - druga zobaczy już wpis.
    perform pg_advisory_xact_lock(hashtext('bingo_wygrana'));
    if not exists (select 1 from public.points_ledger where ref_type = 'bingo_wygrana') then
      insert into public.points_ledger
        (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
      values
        (null, v_team, v_bonus_w, 'bingo_bonus',
         'Wygrana bingo: 3 linie', 'bingo_wygrana', 'wygrana', auth.uid());
    end if;
  end if;

  -- ---------- Kumulacja: pełna plansza ----------
  if (select count(distinct p) from unnest(v_zapalone) p) = 25 then
    if not exists (
      select 1 from public.points_ledger
      where team_id = v_team and ref_type = 'bingo_plansza'
    ) then
      insert into public.points_ledger
        (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
      values
        (null, v_team, v_bonus_p, 'bingo_bonus',
         'Kumulacja: pelna plansza', 'bingo_plansza', 'plansza', auth.uid());
    end if;
  end if;
end;
$$;

-- ---------- Treść planszy (tabela Mikołaja „BINGO - USTAWIENIE”) ----------
update public.bingo_tasks t
set title = v.title, description = v.description, points = 20, active = true
from (values
  ( 0, '24h szotów',          '24H szotów - wyzwanie: wódka.'),
  ( 1, 'Wieża z Sekty',       'Wieża z całej Sekty.'),
  ( 2, 'Prank na Buczim',     'Zróbcie pranka na Buczim.'),
  ( 3, 'Sekta na budowie',    'Cała Sekta na budowie.'),
  ( 4, 'Kocioł z kaska',      'Wypijcie kocioł z kaska budowlanego.'),
  ( 5, 'Fota z randomem',     'Zróbcie fotę z randomem.'),
  ( 6, 'Alko dla Kadry',      'Daj alko Kadrze.'),
  ( 7, 'Protokół w minutę',   'Drużynowy protokół poniżej minuty.'),
  ( 8, 'Mem wyjazdu',         'Zrób mema wyjazdu.'),
  ( 9, '5 roczników',         'Zdjęcie 5-ciu różnych roczników.'),
  (10, 'Pofarbuj łeb',        'Pofarbuj lub ogól łeb.'),
  (11, 'Bukiet dla Kadry',    'Bukiet dla dziewczyn z Kadry.'),
  (12, 'Pole darmowe',        'Pole darmowe - zaliczone od startu.'),
  (13, 'Gumka za skarb',      'Wymień gumkę do włosów na jak najdroższy przedmiot.'),
  (14, 'Ice bucket',          'Drużynowy ice bucket challenge.'),
  (15, 'Maskotka drużyny',    'Zróbcie maskotkę waszej drużyny.'),
  (16, 'Poderwij Radka',      'Poderwij Radka.'),
  (17, 'Zamiana ubrań',       'Zamiana ubrań wg płci.'),
  (18, 'Toast na śniadaniu',  'Wznieście toast na śniadaniu.'),
  (19, 'Pub quiz',            'Udział w pub quizie.'),
  (20, 'Ognisko dla Kadry',   'Usmaż Kadrze coś z ogniska.'),
  (21, 'Drużyna na Lujku',    'Cała drużyna na Lujku.'),
  (22, 'Gołe dupy',           'Jak najwięcej gołych dup na zdjęciu.'),
  (23, 'Sekta na Topalkach',  'Cała Sekta na Topalkach.'),
  (24, 'Z chrześniakami',     'Grupowe zdjęcie z chrześniakami.')
) as v(position, title, description)
where t.rodzaj = 'bingo' and t.position = v.position;
