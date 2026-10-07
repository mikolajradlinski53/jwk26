-- ============================================================
-- Sekta Wyjazdowa — „Gossipy” to teraz „JWK Awards”
-- ============================================================
--
-- Decyzja Mikołaja 2026-10-07. Zmienia się tylko nazwa widoczna dla ludzi:
-- tytuł powiadomienia o nowej kategorii. Tabele, funkcje i adresy (/app/gossip)
-- zostają - ich nazwy nie są nigdzie pokazywane. Kopia utworz_kategorie
-- z 20260929160000 z jedną zmianą; `create or replace` zachowuje uprawnienia.

create or replace function public.utworz_kategorie(p_tytul text, p_opis text)
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
  values ('push', 'all', 'JWK Awards', 'Nominuj: ' || btrim(p_tytul), '/app/gossip',
          'gossip', v_id::text);

  return v_id;
end;
$$;
