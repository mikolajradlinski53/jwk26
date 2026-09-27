-- ============================================================
-- Sekta Wyjazdowa — zapisy: wycofanie zgód i retencja
-- ============================================================

-- ---------- Wycofanie zgody na dane zdrowotne ----------
-- Art. 7 ust. 3 RODO: wycofać ma być równie łatwo, jak wyrazić. Stąd funkcja
-- bez parametrów, wołana jednym przyciskiem.
--
-- Czyści zdrowie, zostawia ICE: ICE nie stoi na zgodzie, tylko na
-- uzasadnionym interesie organizatora. Wiersz znika, gdy nie zostaje w nim nic.
-- Obejmuje wszystkie zgłoszenia osoby, także stare odrzucone.
create function public.wycofaj_zgode_zdrowie()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;

  update public.dane_wrazliwe d
  set dieta = null, alergie = null, choroby_leki = null, zgoda_art9_at = null
  from public.registrations r
  where r.id = d.registration_id
    and r.user_id = auth.uid();

  -- Zgłoszenia sprzed planu 08 trzymały dietę w registrations.diet_notes.
  -- To też dane o zdrowiu, więc wycofanie zgody je obejmuje.
  update public.registrations
  set diet_notes = null
  where user_id = auth.uid() and diet_notes is not null;

  delete from public.dane_wrazliwe d
  using public.registrations r
  where r.id = d.registration_id
    and r.user_id = auth.uid()
    and d.ice_imie is null
    and d.ice_telefon is null;
end;
$$;

revoke execute on function public.wycofaj_zgode_zdrowie() from anon, public;
grant  execute on function public.wycofaj_zgode_zdrowie() to authenticated;

-- ---------- Wycofanie zgody na wizerunek ----------
-- Stempel czasu, bo wycofanie działa na przyszłość: zdjęcie opublikowane
-- wcześniej nie staje się naruszeniem.
create function public.wycofaj_zgode_wizerunek()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;

  update public.registrations
  set zgoda_wizerunek = false,
      zgoda_wizerunek_wycofana_at = now()
  where user_id = auth.uid()
    and zgoda_wizerunek;
end;
$$;

revoke execute on function public.wycofaj_zgode_wizerunek() from anon, public;
grant  execute on function public.wycofaj_zgode_wizerunek() to authenticated;

-- ---------- Wycofanie zgody na SMS-y ----------
-- Profil to źródło, z którego skorzysta wysyłka SMS; zgłoszenie trzyma kopię
-- z chwili zapisu i też ją gasimy, żeby panel nie pokazywał nieaktualnej zgody.
create function public.wycofaj_zgode_sms()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;

  update public.profiles set sms_consent = false where id = auth.uid();
  update public.registrations set sms_consent = false
  where user_id = auth.uid() and sms_consent;
end;
$$;

revoke execute on function public.wycofaj_zgode_sms() from anon, public;
grant  execute on function public.wycofaj_zgode_sms() to authenticated;

-- ---------- Retencja (D10) ----------
-- Osobno od harmonogramu, żeby test mógł ją zawołać wprost. Terminy
-- z app_settings: data_konca_jwk + 14 dni dla danych wrażliwych,
-- data_retencji_zgloszen dla reszty.
create function public.sprzataj_dane()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_koniec     date;
  v_retencja   date;
  v_wrazliwe   integer := 0;
  v_zgloszenia integer := 0;
begin
  select (value #>> '{}')::date into v_koniec
  from public.app_settings where key = 'data_konca_jwk';

  select (value #>> '{}')::date into v_retencja
  from public.app_settings where key = 'data_retencji_zgloszen';

  if v_koniec is not null and current_date >= v_koniec + 14 then
    -- Warunek zawsze prawdziwy zamiast gołego `delete`: niektóre konfiguracje
    -- odrzucają DELETE bez WHERE, a tu nie ma czego zawężać.
    delete from public.dane_wrazliwe where registration_id is not null;
    get diagnostics v_wrazliwe = row_count;

    -- Stara kolumna z planu 02 — ta sama kategoria danych, ten sam termin.
    update public.registrations set diet_notes = null where diet_notes is not null;
  end if;

  if v_retencja is not null and current_date > v_retencja then
    update public.registrations
    set imie = null, nazwisko = null, nr_indeksu = null, data_urodzenia = null,
        phone = null, full_name = '(usunieto)', ksywka = null,
        piosenka = null, uwagi = null, ocr_text = null
    where full_name <> '(usunieto)';
    get diagnostics v_zgloszenia = row_count;

    update public.profiles p
    set phone = null
    where exists (
      select 1 from public.registrations r
      where r.user_id = p.id and r.full_name = '(usunieto)'
    );
  end if;

  return jsonb_build_object('dane_wrazliwe', v_wrazliwe, 'zgloszenia', v_zgloszenia);
end;
$$;

-- Wyłącznie harmonogram i klucz serwisowy. Uczestnik, który mógłby to
-- zawołać, niczego by nie zyskał, ale nie ma powodu dawać mu tej dźwigni.
revoke execute on function public.sprzataj_dane() from anon, public, authenticated;
grant  execute on function public.sprzataj_dane() to service_role;

-- ---------- Harmonogram ----------
-- Codziennie o 3:17 UTC — poza godzinami, w których ktokolwiek klika.
-- cron.schedule z istniejącą nazwą nadpisuje zadanie, więc ponowne
-- zastosowanie migracji nie zdubluje go.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('sprzataj-dane', '17 3 * * *', 'select public.sprzataj_dane()');
