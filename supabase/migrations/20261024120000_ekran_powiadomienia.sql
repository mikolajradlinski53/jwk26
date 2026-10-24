-- Ekran powiadomienia (feedback uczestników 2026-10-24): kliknięcie w push
-- otwiera w apce /app/powiadomienie/<id> z pełną treścią. Treść czyta tylko
-- adresat - ten sam podział co przy wysyłce (adresaci_powiadomienia) - albo admin.
create function public.moje_powiadomienie(p_id bigint)
returns table (id bigint, tytul text, body text, link text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.tytul, p.body, coalesce(p.link, '/app'), p.created_at
  from public.powiadomienia p
  where p.id = p_id
    and (
      public.is_admin()
      or auth.uid() in (select public.adresaci_powiadomienia(p.adresat, p.adresat_id, p.pula))
    );
$$;

revoke execute on function public.moje_powiadomienie(bigint) from public, anon;
grant execute on function public.moje_powiadomienie(bigint) to authenticated;
