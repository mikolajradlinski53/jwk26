-- Ranking pokazuje motto pod nazwą drużyny. `create or replace view` nie pozwala
-- usuwać ani przestawiać istniejących kolumn, więc motto dochodzi na końcu.
create or replace view team_scores with (security_invoker = on) as
  select t.id as team_id, t.name, t.slug, t.color,
         coalesce(sum(l.delta), 0)::int as score,
         t.motto
  from teams t
  left join points_ledger l on l.team_id = t.id
  group by t.id, t.name, t.slug, t.color, t.motto;
