-- ============================================================
-- Sekta Wyjazdowa — lista adminów nadawana z góry
-- ============================================================
--
-- Profil powstaje dopiero przy pierwszym logowaniu, więc nie da się nadać
-- roli komuś, kto jeszcze nie wszedł — a wszyscy przyszli admini właśnie
-- w takim stanie są. Bez tej listy właściciel musiałby po każdym z pięciu
-- pierwszych logowań uruchamiać ręcznie zapytanie SQL, w dodatku wiedząc,
-- że ktoś się właśnie zalogował.
--
-- Lista jest czytana przez wyzwalacz tworzący profil: kto na niej figuruje,
-- wchodzi od razu jako zaakceptowany admin. Kto nie — jak dotąd, czyli
-- oczekujący uczestnik przechodzący przez dowód wpłaty i akceptację.

create table admini_wstepni (
  email text primary key,
  dodany_at timestamptz not null default now()
);

alter table admini_wstepni enable row level security;

-- Tylko admin czyta i pisze. Zwykły uczestnik nie ma powodu wiedzieć,
-- kto jest na liście, a tym bardziej jej zmieniać.
create policy admini_wstepni_admin_all on admini_wstepni
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into admini_wstepni (email) values
  ('dawid.rutkowski@samorzad.ue.wroc.pl'),
  ('magdalena.skoczylas@samorzad.ue.wroc.pl'),
  ('bartosz.buczkowski@samorzad.ue.wroc.pl'),
  ('ewa.witowska@samorzad.ue.wroc.pl'),
  ('radoslaw.wiethy@samorzad.ue.wroc.pl')
on conflict (email) do nothing;

-- ---------- Wyzwalacz czytający listę ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  -- Porównanie po małych literach: Google potrafi zwrócić adres z wielką
  -- literą w imieniu, a wtedy zwykłe `=` przepuściłoby admina jako uczestnika
  -- i nikt by nie wiedział dlaczego.
  select exists (
    select 1 from public.admini_wstepni
    where lower(email) = lower(new.email)
  ) into v_admin;

  insert into public.profiles (id, email, role, status)
  values (
    new.id,
    new.email,
    case when v_admin then 'admin' else 'member' end::public.user_role,
    case when v_admin then 'approved' else 'pending' end::public.user_status
  );
  return new;
end;
$$;

-- ---------- Nadrobienie dla kont już istniejących ----------
-- Gdyby ktoś z listy zalogował się, zanim ta migracja zdążyła wejść,
-- ma zostać adminem bez czekania na cokolwiek.
update public.profiles p
set role = 'admin', status = 'approved'
from public.admini_wstepni a
where lower(p.email) = lower(a.email)
  and (p.role <> 'admin' or p.status <> 'approved');
