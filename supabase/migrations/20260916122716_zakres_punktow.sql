-- ============================================================
-- Sekta Wyjazdowa — górne ograniczenie zmiany punktów
-- ============================================================
--
-- Widok team_scores liczy `coalesce(sum(l.delta), 0)::int`. Sama agregacja się
-- nie przelewa, bo sum(int4) zwraca bigint — ale końcowe rzutowanie na int już
-- tak. Dwa wpisy po 2147483647 wystarczą, żeby odczyt widoku zaczął kończyć się
-- błędem `22003 integer out of range`, i wtedy **ranking przestaje działać dla
-- wszystkich drużyn naraz**, dopóki ktoś ręcznie nie posprząta księgi.
--
-- Do tej pory nic nie broniło przed wpisaniem skrajnej wartości. Jedyny aktor,
-- który może to zrobić, to zaufany admin — ale wystarczy, że wklei nie tę
-- liczbę. Limit jest hojny wobec realnych potrzeb (najwyższe przyznania z bingo
-- to dziesiątki punktów) i odległy od zakresu int4 o cztery rzędy wielkości.
create or replace function public.award_points(
  p_delta   integer,
  p_reason  text,
  p_user_id uuid default null,
  p_team_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_id      bigint;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze przyznawac punkty';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'Zmiana punktow nie moze byc zerowa';
  end if;

  if abs(p_delta) > 100000 then
    raise exception 'Zmiana punktow poza rozsadnym zakresem';
  end if;

  -- Uzasadnienie jest obowiązkowe, bo księga jest jawna dla wszystkich
  -- zaakceptowanych. Wpis bez powodu to zaproszenie do kłótni przy ognisku.
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Uzasadnienie jest wymagane';
  end if;

  if p_user_id is not null then
    -- Drużynę bierzemy z profilu, zamiast ufać temu, co przyszło z panelu.
    -- Rozjazd user_id z team_id rozsypałby oba salda naraz. Gdy podano oba
    -- parametry, p_team_id jest świadomie ignorowany.
    select team_id into v_team_id from public.profiles where id = p_user_id;
    if v_team_id is null then
      raise exception 'Osoba nie nalezy do zadnej druzyny';
    end if;
  else
    v_team_id := p_team_id;
    if v_team_id is null then
      raise exception 'Wskaz osobe albo druzyne';
    end if;
  end if;

  insert into public.points_ledger
    (user_id, team_id, delta, category, reason, awarded_by)
  values
    (p_user_id, v_team_id, p_delta, 'admin_adjust', trim(p_reason), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
