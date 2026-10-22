-- ============================================================================
-- Punktacja gry wyjazdowej (tabela Mikołaja, 2026-10-22)
-- ============================================================================
-- Bingo: pole 20 pkt (bez zmian), wygrana 100, kumulacja 200.
-- Gra terenowa: 10 pkt za stację (zdjęcie całej drużyny), bonus 150 za pełną
-- trasę liczony sam w review_bingo - raz na drużynę.

update public.app_settings set value = '100'::jsonb where key = 'bingo_bonus_wygrana';
update public.app_settings set value = '200'::jsonb where key = 'bingo_bonus_plansza';
insert into public.app_settings (key, value) values ('gra_bonus_trasa', '150'::jsonb)
on conflict (key) do update set value = excluded.value;

update public.bingo_tasks set points = 10 where rodzaj = 'quest';
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
  v_bonus_t  integer;
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

  -- Zadanie gry terenowej nie leży na planszy: bez linii i pełnej planszy,
  -- za to bonus za pełną trasę - raz na drużynę, gdy zaliczone są wszystkie
  -- aktywne, odkryte stacje (2026-10-22, punktacja Mikołaja).
  if v_rodzaj = 'quest' then
    select (value #>> '{}')::integer into v_bonus_t
    from public.app_settings where key = 'gra_bonus_trasa';

    if coalesce(v_bonus_t, 0) > 0
       and not exists (
         select 1 from public.bingo_tasks q
         where q.rodzaj = 'quest' and q.active and q.odkryte
           and not exists (
             select 1 from public.bingo_submissions s
             where s.task_id = q.id and s.team_id = v_team and s.status = 'approved'
           )
       )
       and not exists (
         select 1 from public.points_ledger
         where team_id = v_team and ref_type = 'gra_trasa'
       ) then
      insert into public.points_ledger
        (user_id, team_id, delta, category, reason, ref_type, ref_id, awarded_by)
      values
        (null, v_team, v_bonus_t, 'gra_terenowa',
         'Gra terenowa: pelna trasa', 'gra_trasa', 'trasa', auth.uid());
    end if;
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
