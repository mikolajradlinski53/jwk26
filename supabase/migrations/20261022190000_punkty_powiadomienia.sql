-- Punkty od Kadry (award_points) - push do całej drużyny (Mikołaj 2026-10-22).
-- Osoba: „+30 pkt: Imię Nazwisko”, drużyna: „+30 pkt dla drużyny”; treść to
-- powód z księgi. Minus to typograficzny „−”, jak na ekranie punktacji.
create or replace function public.award_points(p_delta integer, p_reason text, p_user_id uuid default null, p_team_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_id      bigint;
  v_kto     text;
  v_liczba  text;
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
    select team_id, coalesce(display_name, 'ktoś z drużyny') into v_team_id, v_kto
    from public.profiles where id = p_user_id;
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

  v_liczba := case when p_delta > 0 then '+' || p_delta else '−' || abs(p_delta) end;
  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
  values ('push', 'team', v_team_id,
          v_liczba || ' pkt' || case when p_user_id is not null then ': ' || v_kto else ' dla drużyny' end,
          trim(p_reason), '/app', 'punkty', v_id::text);

  return v_id;
end;
$$;
