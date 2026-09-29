-- ============================================================
-- Sekta Wyjazdowa — gossipy: nominacja = głos
-- ============================================================
--
-- Zgłoszenie Mikołaja 2026-09-29: to uczestnik nominuje i uzasadnia, nie
-- admin. Admin zakłada samą kategorię; każdy przyjęty nominuje w niej jedną
-- osobę (dowolnego przyjętego poza sobą), z uzasadnieniem i opcjonalnym
-- zdjęciem. Wygrywa najczęściej nominowany, admin ujawnia wynik.
--
-- Zasady anonimowości z planu 12 bez zmian: tabela głosów bez grantów, odczyt
-- wyłącznie przez funkcje, autora widzi tylko admin. Zdjęcie dokłada jedną
-- rzecz do pilnowania — jego ścieżka nie może zdradzać autora, więc plik
-- leży pod `<kategoria>/<losowy uuid>.jpg`, a nie w folderze użytkownika jak
-- w bingo.

-- ---------- Koniec listy nominowanych ----------
drop function if exists public.utworz_kategorie(text, text, uuid[]);
drop table if exists gossip_nominees;

alter table gossip_votes
  add column photo_path text check (photo_path is null or length(photo_path) <= 200);

-- ---------- Bucket na zdjęcia ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gossip', 'gossip', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Zdjęcie jest jawne dla uczestników dopiero wtedy, gdy jawne jest jego
-- uzasadnienie: kategoria ujawniona, wpis nieukryty, nominowany wśród
-- zwycięzców. Ta sama reguła co w gossipy() — zdjęcie o przegranym
-- zdradzałoby, że ktoś na niego głosował.
create function public.gossip_zdjecie_jawne(p_sciezka text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select g.category_id, g.nominee_id
    from public.gossip_votes g
    join public.gossip_categories k on k.id = g.category_id
    where g.photo_path = p_sciezka and not g.hidden and k.status = 'ujawniona'
  ), zliczone as (
    select g.nominee_id, count(*) as n
    from public.gossip_votes g
    where g.category_id = (select category_id from v limit 1)
    group by g.nominee_id
  )
  select exists (
    select 1 from v
    where v.nominee_id in (
      select z.nominee_id from zliczone z where z.n = (select max(n) from zliczone)
    )
  );
$$;

revoke execute on function public.gossip_zdjecie_jawne(text) from public, anon;
grant  execute on function public.gossip_zdjecie_jawne(text) to authenticated;

-- Przez funkcję, bo polityka działa z prawami uczestnika, a ten nie ma
-- grantu na gossip_categories.
create function public.gossip_kategoria_otwarta(p_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gossip_categories k
    where k.id::text = p_id and k.status = 'otwarta'
  );
$$;

revoke execute on function public.gossip_kategoria_otwarta(text) from public, anon;
grant  execute on function public.gossip_kategoria_otwarta(text) to authenticated;

-- Wgrać można tylko do folderu otwartej kategorii. Właściciela pliku
-- (owner_id) Storage zapisuje sam; oddaj_glos sprawdza go, żeby nikt nie
-- podpiął cudzego zdjęcia pod swoją nominację.
create policy gossip_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gossip'
    and public.is_approved()
    and public.gossip_kategoria_otwarta((storage.foldername(name))[1])
  );

create policy gossip_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gossip'
    and (public.is_admin() or public.gossip_zdjecie_jawne(name))
  );

-- ---------- Admin: kategoria ----------
-- Od razu otwarta; powiadomienie idzie do wszystkich, bo nominowanie jest
-- teraz po stronie uczestników i ktoś musi im powiedzieć, że mogą.
create function public.utworz_kategorie(p_tytul text, p_opis text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin tworzy kategorie';
  end if;
  if nullif(btrim(p_tytul), '') is null then
    raise exception 'Podaj nazwe kategorii';
  end if;

  insert into public.gossip_categories (title, description)
  values (btrim(p_tytul), nullif(btrim(p_opis), ''))
  returning id into v_id;

  insert into public.powiadomienia (kanal, adresat, tytul, body, link, ref_type, ref_id)
  values ('push', 'all', 'Nowe gossipy', 'Nominuj: ' || btrim(p_tytul), '/app/gossip',
          'gossip', v_id::text);

  return v_id;
end;
$$;

-- ---------- Uczestnik: nominacja ----------
drop function if exists public.oddaj_glos(uuid, uuid, text);

create function public.oddaj_glos(
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

  begin
    insert into public.gossip_votes (category_id, voter_id, nominee_id, justification, photo_path)
    values (p_kategoria, auth.uid(), p_nominowany, btrim(p_uzasadnienie), p_zdjecie);
  exception when unique_violation then
    raise exception 'Nominacja w tej kategorii juz oddana';
  end;
end;
$$;

-- ---------- Kogo można nominować ----------
-- Przyjęci poza pytającym. Osobna funkcja, bo uczestnik nie czyta profili
-- innych osób wprost.
create function public.kandydaci_gossipow()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nazwa', coalesce(p.display_name, 'Bez nazwy'))
                            order by coalesce(p.display_name, 'Bez nazwy')), '[]'::jsonb)
  from public.profiles p
  where p.status = 'approved'
    and p.id <> auth.uid()
    and (public.is_approved() or public.is_admin());
$$;

-- ---------- Uczestnik: odczyt ----------
-- Jak w planie 12, bez listy nominowanych. `moj_glos`/`moj_typ` to własna
-- nominacja; uzasadnienia po ujawnieniu niosą też ścieżkę zdjęcia.
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
      where v.category_id = k.id and v.voter_id = auth.uid()
    ),
    'moj_typ', (
      select coalesce(p.display_name, 'Bez nazwy') from public.gossip_votes v
      join public.profiles p on p.id = v.nominee_id
      where v.category_id = k.id and v.voter_id = auth.uid()
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

-- ---------- Admin: moderacja ze zdjęciem ----------
create or replace function public.moderacja_gossipow(p_kategoria uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moderuje gossipy';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id,
      'autor', coalesce(a.display_name, a.email),
      'na_kogo', coalesce(n.display_name, n.email),
      'tekst', v.justification,
      'zdjecie', v.photo_path,
      'ukryte', v.hidden,
      'przejrzane', v.przejrzane_at is not null,
      'kiedy', v.created_at
    ) order by v.created_at), '[]'::jsonb)
    from public.gossip_votes v
    join public.profiles a on a.id = v.voter_id
    join public.profiles n on n.id = v.nominee_id
    where v.category_id = p_kategoria
  );
end;
$$;

revoke execute on function public.utworz_kategorie(text, text) from public, anon;
grant  execute on function public.utworz_kategorie(text, text) to authenticated;
revoke execute on function public.oddaj_glos(uuid, uuid, text, text) from public, anon;
grant  execute on function public.oddaj_glos(uuid, uuid, text, text) to authenticated;
revoke execute on function public.kandydaci_gossipow() from public, anon;
grant  execute on function public.kandydaci_gossipow() to authenticated;
