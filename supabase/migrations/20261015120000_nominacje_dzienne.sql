-- ============================================================
-- Sekta Wyjazdowa — JWK Awards: jedna nominacja dziennie w kategorii
-- ============================================================
--
-- Decyzja Mikołaja 2026-10-15: każdy może nominować raz dziennie (piątek,
-- sobota, niedziela) w każdej kategorii, zamiast raz na cały wyjazd.
-- `moj_glos` w gossipy() dotyczy dzisiejszej nominacji - jutro formularz
-- pojawia się znowu.

alter table gossip_votes
  add column dzien date not null default ((now() at time zone 'Europe/Warsaw')::date);
update gossip_votes set dzien = (created_at at time zone 'Europe/Warsaw')::date where true;
alter table gossip_votes drop constraint gossip_votes_category_id_voter_id_key;
alter table gossip_votes add constraint gossip_votes_dzienna unique (category_id, voter_id, dzien);

-- Kopia oddaj_glos z 20260929160000 - komunikat o dzisiejszej nominacji.
create or replace function public.oddaj_glos(
  p_kategoria    uuid,
  p_nominowany   uuid,
  p_uzasadnienie text,
  p_zdjecie      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_min    integer;
begin
  if not public.is_approved() then
    raise exception 'Nominuja tylko przyjeci uczestnicy';
  end if;

  select status into v_status from public.gossip_categories where id = p_kategoria;
  if v_status is distinct from 'otwarta' then
    raise exception 'Kategoria nie jest otwarta';
  end if;

  if p_nominowany = auth.uid() then
    raise exception 'Nie mozna nominowac siebie';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_nominowany and status = 'approved'
  ) then
    raise exception 'Nominowac mozna tylko przyjetego uczestnika';
  end if;

  select coalesce((value #>> '{}')::integer, 200) into v_min
  from public.app_settings where key = 'gossip_min_justification';

  if length(btrim(coalesce(p_uzasadnienie, ''))) < coalesce(v_min, 200) then
    raise exception 'Uzasadnienie musi miec co najmniej % znakow', coalesce(v_min, 200);
  end if;

  -- Zdjęcie: w folderze tej kategorii, pod losową nazwą, wgrane przez tę
  -- samą osobę. Nazwa sprawdzana wzorcem, żeby ścieżka nie niosła niczego
  -- poza uuid — to ona trafia potem do przeglądarek.
  if p_zdjecie is not null then
    if p_zdjecie !~ ('^' || p_kategoria::text || '/[0-9a-f-]{36}\.jpg$')
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'gossip' and o.name = p_zdjecie
           and o.owner_id = auth.uid()::text
       ) then
      raise exception 'Nieprawidlowe zdjecie';
    end if;
  end if;

  -- Jedna nominacja na osobę, kategorię i dzień (czas polski) - kolumna
  -- `dzien` ma domyślną wartość, unikalność pilnuje indeks.
  begin
    insert into public.gossip_votes (category_id, voter_id, nominee_id, justification, photo_path)
    values (p_kategoria, auth.uid(), p_nominowany, btrim(p_uzasadnienie), p_zdjecie);
  exception when unique_violation then
    raise exception 'Nominacja w tej kategorii juz oddana dzisiaj';
  end;
end;
$$;

-- Kopia gossipy() z 20260929160000 - „mój głos” = dzisiejszy.
create or replace function public.gossipy()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with zliczone as (
    select v.category_id, v.nominee_id, count(*) as n
    from public.gossip_votes v
    group by v.category_id, v.nominee_id
  ), najlepsi as (
    select z.category_id, z.nominee_id
    from zliczone z
    where z.n = (select max(n) from zliczone z2 where z2.category_id = z.category_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id,
    'tytul', k.title,
    'opis', k.description,
    'status', k.status,
    'moj_glos', (
      select v.nominee_id from public.gossip_votes v
      where v.category_id = k.id and v.voter_id = auth.uid() and v.dzien = (now() at time zone 'Europe/Warsaw')::date
    ),
    'moj_typ', (
      select coalesce(p.display_name, 'Bez nazwy') from public.gossip_votes v
      join public.profiles p on p.id = v.nominee_id
      where v.category_id = k.id and v.voter_id = auth.uid() and v.dzien = (now() at time zone 'Europe/Warsaw')::date
    ),
    'zwyciezcy', case when k.status = 'ujawniona' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nazwa', coalesce(p.display_name, 'Bez nazwy'))
                                order by p.display_name), '[]'::jsonb)
      from najlepsi b join public.profiles p on p.id = b.nominee_id
      where b.category_id = k.id
    ) end,
    'uzasadnienia', case when k.status = 'ujawniona' then (
      select coalesce(jsonb_agg(jsonb_build_object('tekst', v.justification, 'zdjecie', v.photo_path)
                                order by v.created_at), '[]'::jsonb)
      from public.gossip_votes v
      where v.category_id = k.id
        and not v.hidden
        and v.nominee_id in (select b.nominee_id from najlepsi b where b.category_id = k.id)
    ) end
  ) order by k.created_at desc), '[]'::jsonb)
  from public.gossip_categories k
  where public.is_approved() or public.is_admin();
$$;
