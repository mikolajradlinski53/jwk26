-- ============================================================================
-- Licytacje (2026-10-22) - poprawki z przeglądu końcowego
-- ============================================================================
-- 1. Licytacja w ciemno: tabela `licytacje` (z item_id) tylko dla admina.
--    Uczestnicy czytają licytacje wyłącznie przez licytacje_lista() (security
--    definer, maskuje przedmiot), a ekran słucha realtime tylko na ofertach.
-- 2. licytacje_tick: każda licytacja we własnym podbloku z obsługą wyjątku -
--    jedna zepsuta nie blokuje zamykania pozostałych.

drop policy licytacje_read on public.licytacje;
create policy licytacje_read on public.licytacje
  for select to authenticated using (public.is_admin());
create or replace function public.licytacje_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l      public.licytacje;
  v_nazwa  text;
  v_kand   record;
  v_zw     uuid;
  v_cena   integer;
  v_user   uuid;
  v_order  uuid;
  v_saldo  integer;
  v_druz   text;
begin
  -- Otwarcie: raz na licytację, także dla wystawionych „od razu”.
  for v_l in
    select * from public.licytacje
    where status = 'trwa' and start <= now() and koniec > now() and not otwarcie_ogloszone
    for update skip locked
  loop
   begin
    select case when v_l.w_ciemno then 'Tajemnicza nagroda' else i.name end into v_nazwa
    from public.shop_items i where i.id = v_l.item_id;
    insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
    values ('push', 'all', 'Licytacja otwarta',
            v_nazwa || ' - cena wywoławcza ' || v_l.cena_wywolawcza || ' pkt',
            '/app/sklep', 'licytacja', v_l.id::text);
    update public.licytacje set otwarcie_ogloszone = true where id = v_l.id;
   exception when others then
    raise warning 'licytacje_tick: ogloszenie % nie przeszlo: %', v_l.id, sqlerrm;
   end;
  end loop;

  -- Zamknięcie. `skip locked` + zmiana statusu w tej samej transakcji: drugi
  -- tick (albo równoległy) nie zamknie tej samej licytacji drugi raz.
  for v_l in
    select * from public.licytacje
    where status = 'trwa' and koniec <= now()
    for update skip locked
  loop
   -- Każda licytacja we własnym podbloku: błąd jednej (dziwna pozycja,
   -- zakleszczenie z rzuc_klatwe) cofa tylko ją - zostaje 'trwa' i wraca
   -- w następnej minucie, reszta zamyka się normalnie.
   begin
    v_zw := null; v_cena := null; v_user := null; v_order := null;

    -- Od najwyższej oferty w dół, każda drużyna swoją najwyższą ofertą;
    -- wygrywa pierwsza, która w tej chwili może zapłacić.
    for v_kand in
      select k.team_id, k.kwota, k.user_id
      from (
        select distinct on (o.team_id) o.team_id, o.kwota, o.user_id, o.created_at
        from public.licytacje_oferty o
        where o.licytacja_id = v_l.id
        order by o.team_id, o.kwota desc, o.created_at
      ) k
      order by k.kwota desc, k.created_at
    loop
      perform 1 from public.teams where id = v_kand.team_id for update;
      select coalesce(sum(delta), 0)::integer into v_saldo
      from public.points_ledger where team_id = v_kand.team_id;
      if v_saldo >= v_kand.kwota then
        v_zw := v_kand.team_id; v_cena := v_kand.kwota; v_user := v_kand.user_id;
        exit;
      end if;
    end loop;

    if v_zw is not null then
      v_order := public.zrealizuj_wygrana(v_l.id, v_zw, v_cena, v_user);
    end if;

    update public.licytacje
    set status = 'zamknieta', zwyciezca_team = v_zw, cena_koncowa = v_cena,
        order_id = v_order, otwarcie_ogloszone = true
    where id = v_l.id;

    -- Po zamknięciu nazwa jest jawna, także dla licytacji w ciemno.
    select i.name into v_nazwa from public.shop_items i where i.id = v_l.item_id;
    if v_zw is not null then
      select name into v_druz from public.teams where id = v_zw;
      insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
      values ('push', 'all', 'Licytacja rozstrzygnięta',
              v_druz || ' wygrywa: ' || v_nazwa || ' za ' || v_cena || ' pkt',
              '/app/sklep', 'licytacja', v_l.id::text);
    else
      insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
      values ('push', 'all', 'Licytacja zamknięta', v_nazwa || ': bez zwycięzcy',
              '/app/sklep', 'licytacja', v_l.id::text);
    end if;
   exception when others then
    raise warning 'licytacje_tick: zamkniecie % nie przeszlo: %', v_l.id, sqlerrm;
   end;
  end loop;
end;
$$;


