-- ============================================================
-- Sekta Wyjazdowa — powiadomienie o przyjęciu a poczekalnia
-- ============================================================
--
-- Przed `otwarcie_platformy` przyjęty widzi poczekalnię, więc „Sprawdź
-- w apce swoją drużynę” obiecywało coś, czego jeszcze nie ma. Ta sama
-- reguła co czekaNaOtwarcie() w src/lib/poczekalnia.ts: pusta albo
-- nieczytelna data = platforma otwarta.

create or replace function public.powiadom_o_przyjeciu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_otwarcie timestamptz;
  v_tresc    text := 'Witaj na JWK26! Sprawdź w apce swoją drużynę.';
begin
  if new.status = 'approved'::public.user_status
     and old.status is distinct from 'approved'::public.user_status then
    begin
      select nullif(value #>> '{}', '')::timestamptz into v_otwarcie
      from public.app_settings where key = 'otwarcie_platformy';
    exception when others then
      v_otwarcie := null;
    end;
    if v_otwarcie > now() then
      v_tresc := format(
        'Masz miejsce na JWK26! Apka otworzy się dla wszystkich %s o %s.',
        to_char(v_otwarcie at time zone 'Europe/Warsaw', 'DD.MM'),
        to_char(v_otwarcie at time zone 'Europe/Warsaw', 'HH24:MI')
      );
    end if;
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'user', new.user_id, 'Zgłoszenie przyjęte', v_tresc, '/app', 'registration', new.id::text);
  end if;
  return null;
end;
$$;
