-- ============================================================
-- Sekta Wyjazdowa — panel „Aktywność” dla adminów
-- ============================================================
--
-- Zestawienie z danych, które apka już ma (decyzja Mikołaja 2026-10-11):
-- ostatnie logowanie, powiadomienia, liczba wpisów w zabawach. Nic nowego
-- nie jest zbierane. Celowo BEZ nominacji JWK Awards: regulamin § 19 ust. 6
-- pozwala Kadrze ustalać autora nominacji wyłącznie przy naruszeniu.

create function public.aktywnosc_uczestnikow()
returns table (
  id                  uuid,
  nazwa               text,
  email               text,
  rola                text,
  status              text,
  pula                text,
  konto_od            timestamptz,
  ostatnie_logowanie  timestamptz,
  powiadomienia       boolean,
  bingo               integer,
  feed                integer,
  gry                 integer,
  sklep               integer,
  zawody              integer,
  ostatnia_aktywnosc  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin';
  end if;

  return query
  with
    zgl as (
      select distinct on (r.user_id) r.user_id, r.imie, r.nazwisko, r.pula
      from public.registrations r
      order by r.user_id, (r.status = 'approved'::public.user_status) desc, r.created_at desc
    ),
    bingo as (select user_id, count(*)::int n, max(created_at) t from public.bingo_submissions group by user_id),
    feed as (
      select user_id, count(*)::int n, max(created_at) t from (
        select user_id, created_at from public.feed_likes
        union all
        select user_id, created_at from public.feed_comments
      ) x group by user_id
    ),
    gry as (
      select user_id, count(*)::int n, max(t) t from (
        select user_id, created_at t from public.game_sessions
        union all
        select user_id, started_at from public.kruk_gry
      ) x group by user_id
    ),
    sklep as (select ordered_by user_id, count(*)::int n, max(created_at) t from public.shop_orders group by ordered_by),
    zawody as (
      select user_id, count(*)::int n, max(created_at) t from (
        select user_id, created_at from public.zawody_sklad
        union all
        select user_id, created_at from public.zawody_zapisy
      ) x group by user_id
    ),
    push as (select distinct user_id from public.push_subscriptions)
  select
    p.id,
    coalesce(nullif(btrim(concat_ws(' ', zgl.imie, zgl.nazwisko)), ''), p.display_name, p.email),
    p.email,
    p.role::text,
    p.status::text,
    zgl.pula,
    u.created_at,
    u.last_sign_in_at,
    push.user_id is not null,
    coalesce(bingo.n, 0),
    coalesce(feed.n, 0),
    coalesce(gry.n, 0),
    coalesce(sklep.n, 0),
    coalesce(zawody.n, 0),
    greatest(u.last_sign_in_at, bingo.t, feed.t, gry.t, sklep.t, zawody.t)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join zgl on zgl.user_id = p.id
  left join bingo on bingo.user_id = p.id
  left join feed on feed.user_id = p.id
  left join gry on gry.user_id = p.id
  left join sklep on sklep.user_id = p.id
  left join zawody on zawody.user_id = p.id
  left join push on push.user_id = p.id
  order by 15 desc nulls last;
end;
$$;

revoke execute on function public.aktywnosc_uczestnikow() from public, anon;
grant execute on function public.aktywnosc_uczestnikow() to authenticated;
