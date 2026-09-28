-- ============================================================
-- Sekta Wyjazdowa — próbne powiadomienie push
-- ============================================================
--
-- Przycisk „Wyślij próbne" w karcie powiadomień: każdy sprawdza sam, czy
-- u niego powiadomienie budzi telefon i pokazuje się u góry ekranu. Jak
-- wygląda powiadomienie, decydują ustawienia telefonu, których strona nie
-- zmieni — próba pozwala je poprawić, zanim ktoś przegapi zbiórkę.

create function public.probne_powiadomienie()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;

  -- Raz na minutę na osobę: przycisk wciśnięty dwadzieścia razy nie może
  -- zasypać kolejki, z której idą też ogłoszenia dla wszystkich.
  if exists (
    select 1 from public.powiadomienia
    where ref_type = 'probne'
      and adresat_id = auth.uid()
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Probne powiadomienie mozna wyslac raz na minute';
  end if;

  insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type)
  values ('push', 'user', auth.uid(), 'Działa!',
          'Tak będą wyglądać ogłoszenia z wyjazdu.', '/app', 'probne');
end;
$$;

revoke execute on function public.probne_powiadomienie() from public, anon;
grant  execute on function public.probne_powiadomienie() to authenticated;
