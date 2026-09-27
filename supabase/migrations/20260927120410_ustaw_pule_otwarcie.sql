-- ============================================================
-- Sekta Wyjazdowa — zapisy: napraw blokadę zmiany miejsc w otwartej turze
-- ============================================================

-- D4/D8: zablokowane miało być wyłącznie przejście zamknięta -> otwarta.
-- Pierwsza wersja funkcji sprawdzała samo p_otwarta, więc zmiana liczby
-- miejsc w JUŻ otwartej turze też wpadała w REGULAMIN_ROBOCZY — sprzecznie
-- z własnym komentarzem funkcji ("zamykanie i zmiana liczby miejsc zostają
-- dozwolone zawsze"). Blokada patrzy teraz na stan sprzed zmiany, odczytany
-- pod FOR UPDATE, żeby dwóch adminów nie rozjechało się na tym, czy pula
-- była otwarta w chwili sprawdzania.
create or replace function public.ustaw_pule(p_klucz text, p_otwarta boolean, p_miejsca integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obecna boolean;
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

  select otwarta into v_obecna
  from public.pule
  where klucz = p_klucz
  for update;

  if not found then
    raise exception 'Nieznana pula: %', p_klucz;
  end if;

  -- Zablokowane jest wyłącznie zamknięta -> otwarta; otwartej wolno zmienić
  -- liczbę miejsc albo ją zamknąć, nawet gdy regulamin wrócił do wersji
  -- roboczej.
  if p_otwarta and not v_obecna and not public.regulamin_zatwierdzony() then
    raise exception 'REGULAMIN_ROBOCZY';
  end if;

  update public.pule
  set otwarta = p_otwarta, miejsca = p_miejsca
  where klucz = p_klucz;
end;
$$;

revoke execute on function public.ustaw_pule(text, boolean, integer) from anon, public;
grant  execute on function public.ustaw_pule(text, boolean, integer) to authenticated;
