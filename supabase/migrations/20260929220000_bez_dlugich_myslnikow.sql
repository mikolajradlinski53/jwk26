-- ============================================================
-- Sekta Wyjazdowa — zwykłe myślniki zamiast długich
-- ============================================================
--
-- Prośba Mikołaja 2026-09-29: wszędzie „-” zamiast „—”. W bazie długi
-- myślnik siedział w tekstach powiadomień (bingo, sklepik), w komunikacie
-- blackjacka i w szkicu planu. Zamiast przepisywać funkcje ręcznie —
-- każda funkcja w `public`, której kod go zawiera, jest odtwarzana ze
-- swojej definicji z podmienionym znakiem (komentarze w kodzie też).

do $$
declare
  f oid;
begin
  for f in
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and (p.prosrc like '%—%' or p.prosrc like '%–%')
  loop
    execute replace(replace(pg_get_functiondef(f), '—', '-'), '–', '-');
  end loop;
end;
$$;

update harmonogram set tytul = replace(replace(tytul, '—', '-'), '–', '-') where tytul ~ '[—–]';
update harmonogram set opis = replace(replace(opis, '—', '-'), '–', '-') where opis ~ '[—–]';
