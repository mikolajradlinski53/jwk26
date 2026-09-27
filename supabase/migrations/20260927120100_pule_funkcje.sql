-- ============================================================
-- Sekta Wyjazdowa — zapisy: funkcje pul
-- ============================================================

-- ---------- Flaga regulaminu ----------
-- Prawami wywołującego: app_settings czyta każdy zalogowany, a w ustaw_pule
-- (SECURITY DEFINER) i tak wykona się prawami właściciela.
create function public.regulamin_zatwierdzony()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::boolean
     from public.app_settings where key = 'regulamin_zatwierdzony'),
    false
  );
$$;

revoke execute on function public.regulamin_zatwierdzony() from anon, public;
grant  execute on function public.regulamin_zatwierdzony() to authenticated;

-- ---------- Ustawianie puli ----------
-- D8: żadnej tury nie da się otworzyć, dopóki regulamin jest roboczy.
-- Akceptacja wersji roboczej niczego nie wiąże, więc zapis na niej stojący
-- byłby zapisem bez regulaminu. Zamykanie i zmiana liczby miejsc zostają
-- dozwolone zawsze.
create function public.ustaw_pule(p_klucz text, p_otwarta boolean, p_miejsca integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze zmieniac pule';
  end if;

  -- Ta sama pułapka, którą hartowanie bramy rozbroiło w review_registration:
  -- `if null then` zachowuje się jak fałsz i po cichu zamknęłoby pulę.
  if p_otwarta is null or p_miejsca is null then
    raise exception 'Brak wartosci: otwarta i miejsca sa wymagane';
  end if;

  if p_miejsca < 0 then
    raise exception 'Liczba miejsc nie moze byc ujemna';
  end if;

  if p_otwarta and not public.regulamin_zatwierdzony() then
    raise exception 'REGULAMIN_ROBOCZY';
  end if;

  update public.pule
  set otwarta = p_otwarta, miejsca = p_miejsca
  where klucz = p_klucz;

  if not found then
    raise exception 'Nieznana pula: %', p_klucz;
  end if;
end;
$$;

revoke execute on function public.ustaw_pule(text, boolean, integer) from anon, public;
grant  execute on function public.ustaw_pule(text, boolean, integer) to authenticated;

-- ---------- Stan pul ----------
-- Prawami właściciela, bo uczestnik nie widzi cudzych zgłoszeń, a musi
-- zobaczyć „32 z 40 miejsc". Wychodzą wyłącznie liczby, żadnych nazwisk.
--
-- Miejsce zajmują zgłoszenia pending i approved, które nie są rezerwą (D4).
create function public.stan_pul()
returns table (
  klucz      text,
  nazwa      text,
  otwarta    boolean,
  miejsca    integer,
  zajete     integer,
  w_rezerwie integer,
  kolejnosc  smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.klucz,
         p.nazwa,
         p.otwarta,
         p.miejsca,
         (select count(*)::integer from public.registrations r
          where r.pula = p.klucz and not r.rezerwa
            and r.status in ('pending'::public.user_status, 'approved'::public.user_status)),
         (select count(*)::integer from public.registrations r
          where r.pula = p.klucz and r.rezerwa
            and r.status = 'pending'::public.user_status),
         p.kolejnosc
  from public.pule p
  order by p.kolejnosc;
$$;

revoke execute on function public.stan_pul() from anon, public;
grant  execute on function public.stan_pul() to authenticated;

-- ---------- Pozycja w rezerwie ----------
-- Numer w kolejce liczony na żywo, nie kolejnosc_rezerwy wprost: ta rośnie
-- przez cały czas zapisów, więc po trzech awansach osoba z numerem 7 jest
-- w rzeczywistości czwarta. NULL dla kogoś, kto na rezerwie nie jest.
create function public.pozycja_w_rezerwie()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pula    text;
  v_numer   integer;
  v_pozycja integer;
begin
  select pula, kolejnosc_rezerwy into v_pula, v_numer
  from public.registrations
  where user_id = auth.uid()
    and status = 'pending'::public.user_status
    and rezerwa;

  if v_pula is null then
    return null;
  end if;

  select count(*)::integer + 1 into v_pozycja
  from public.registrations
  where pula = v_pula
    and rezerwa
    and status = 'pending'::public.user_status
    and kolejnosc_rezerwy < v_numer;

  return v_pozycja;
end;
$$;

revoke execute on function public.pozycja_w_rezerwie() from anon, public;
grant  execute on function public.pozycja_w_rezerwie() to authenticated;
