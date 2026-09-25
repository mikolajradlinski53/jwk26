-- ============================================================
-- Sekta Wyjazdowa — bębny: losowanie i wycena
-- ============================================================
--
-- Dwie osobne funkcje, nie jedna, i to jest decyzja o testowalności (D9 specu).
-- Wycena wpleciona w zakrec_slotami() byłaby sprawdzalna tylko przez czekanie,
-- aż trójka Oka wypadnie sama — raz na 216 spinów, każdy za dziesięć punktów
-- i z limitem obrotu na karku.

-- ---------- Losowanie ----------
-- Trzy niezależne losowania. `+ 1` jest konieczne: tablice w Postgresie liczą
-- się od jedynki, więc floor(random() * 6) bez tego zwraca NULL dla zera —
-- w jednym spinie na sześć, na każdym bębnie osobno.
create function public.losuj_bebny()
returns text[]
language sql
volatile
set search_path = ''
as $$
  with symbole as (
    select array['oko', 'swieca', 'kielich', 'sztylet', 'pieczec', 'klucz'] as s
  )
  select array[
    s[1 + floor(random() * 6)::int],
    s[1 + floor(random() * 6)::int],
    s[1 + floor(random() * 6)::int]
  ]
  from symbole;
$$;

-- ---------- Wycena ----------
-- Czysta w tym sensie, że nie zmienia niczego i dla tych samych bębnów daje ten
-- sam wynik. `stable`, nie `immutable`, bo czyta tabelę wypłat z app_settings.
create function public.rozstrzygnij_bebny(p_bebny text[])
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_wyplaty jsonb;
  v_a text := p_bebny[1];
  v_b text := p_bebny[2];
  v_c text := p_bebny[3];
begin
  -- Postgres zwraca NULL za końcem tablicy, nie błąd, więc bez tego warunku
  -- dwa bębny wyceniłyby się jako „trzy różne" i zwróciły zero.
  if array_length(p_bebny, 1) is distinct from 3 then
    raise exception 'Bebny musza miec dokladnie trzy symbole';
  end if;

  select value into v_wyplaty from public.app_settings where key = 'slots_wyplaty';

  if v_a = v_b and v_b = v_c then
    if v_a = 'oko' then
      return (v_wyplaty ->> 'trojka_oko')::integer;
    end if;
    return (v_wyplaty ->> 'trojka')::integer;
  end if;

  -- Wszystkie trzy układy pary naraz. Trójka została już wykluczona wyżej,
  -- więc „jakakolwiek dwójka się zgadza" znaczy tu dokładnie parę.
  if v_a = v_b or v_b = v_c or v_a = v_c then
    return (v_wyplaty ->> 'para')::integer;
  end if;

  return 0;
end;
$$;

-- Obie pomocnicze są dostępne graczowi, choć nie ma powodu ich wołać.
-- rozstrzygnij_bebny nic nie zmienia i nie ujawnia niczego poza tabelą wypłat,
-- a losuj_bebny bez zapisu do księgi jest generatorem liczb bez konsekwencji.
-- Zamknięcie ich wymagałoby osobnej roli dla testów, która byłaby większym
-- ryzykiem niż to, co zamyka.
revoke execute on function public.losuj_bebny() from anon, public;
grant  execute on function public.losuj_bebny() to authenticated;
revoke execute on function public.rozstrzygnij_bebny(text[]) from anon, public;
grant  execute on function public.rozstrzygnij_bebny(text[]) to authenticated;
