-- Gra terenowa na mapie (paczka 2026-10-15, punkt 6).
--
-- Admin wkleja link z Map Google, aplikacja wyciąga z niego współrzędne
-- i zapisuje je przy zadaniu. Uczestnicy widzą pinezki odkrytych zadań na
-- mapie (OpenStreetMap) i jednym dotknięciem otwierają nawigację w Mapach
-- Google. Współrzędne są opcjonalne - zadanie bez miejsca dalej działa.

alter table public.bingo_tasks
  add column lat double precision,
  add column lng double precision,
  add column link_mapy text,
  add constraint bingo_tasks_miejsce_kompletne check ((lat is null) = (lng is null)),
  add constraint bingo_tasks_miejsce_zakres check (
    lat is null or (lat between -90 and 90 and lng between -180 and 180)
  ),
  add constraint bingo_tasks_link_mapy_dlugosc check (link_mapy is null or length(link_mapy) <= 2000);
