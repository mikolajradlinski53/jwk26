-- ============================================================
-- Sekta Wyjazdowa — odrzucone pole bingo: powiadomienie z powodem
-- ============================================================
--
-- Zgłoszenie Mikołaja 2026-10-08: odrzucone zdjęcie znikało z planszy bez
-- śladu, a notatka admina („widoczna dla uczestnika”) nigdzie nie docierała.
-- Plansza pokazuje teraz pole „odrzucone” z powodem; tu dochodzi push do
-- osoby, która wysłała zdjęcie (adresat `user`), z powodem w treści.
-- Kopia powiadom_o_bingo z 20260928150000 z dodaną gałęzią odrzucenia.

create or replace function public.powiadom_o_bingo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tytul  text;
  v_punkty integer;
begin
  if new.status = 'approved'::public.user_status
     and old.status is distinct from 'approved'::public.user_status then
    select title, points into v_tytul, v_punkty from public.bingo_tasks where id = new.task_id;
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'team', new.team_id, 'Pole bingo zaliczone',
            coalesce(v_tytul, 'Zadanie') || ' — +' || coalesce(v_punkty, 0) || ' pkt dla drużyny',
            '/app/bingo', 'bingo', new.id::text);
  elsif new.status = 'rejected'::public.user_status
        and old.status is distinct from 'rejected'::public.user_status then
    select title into v_tytul from public.bingo_tasks where id = new.task_id;
    -- Treść powiadomienia ma limit długości w praktyce (ekran blokady), więc
    -- powód przycinamy; pełny jest na planszy po dotknięciu pola.
    insert into public.powiadomienia (kanal, adresat, adresat_id, tytul, body, link, ref_type, ref_id)
    values ('push', 'user', new.user_id, 'Pole bingo odrzucone',
            coalesce(v_tytul, 'Zadanie') || ': ' ||
              coalesce(left(nullif(btrim(new.review_note), ''), 140), 'bez podania powodu') ||
              '. Możesz wrzucić nowe zdjęcie.',
            '/app/bingo', 'bingo', new.id::text);
  end if;
  return null;
end;
$$;
