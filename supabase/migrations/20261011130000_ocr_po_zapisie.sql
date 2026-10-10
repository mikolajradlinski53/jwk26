-- ============================================================
-- Sekta Wyjazdowa — OCR przelewu dopisywany po zgłoszeniu
-- ============================================================
--
-- Dotąd telefon czytał zdjęcie przelewu (Tesseract: kilka MB modelu plus
-- rozpoznawanie, do 45 s) PRZED zloz_zgloszenie - a miejsce w puli zajmuje
-- dopiero zloz_zgloszenie. O 12:00 wolniejszy telefon przegrywał miejsce,
-- choć kliknął pierwszy. Teraz formularz najpierw zajmuje miejsce (bez OCR),
-- a wynik OCR dopisuje w tle tą funkcją. OCR to tylko podpowiedź dla admina.

create function public.uzupelnij_ocr(
  p_proof_path       text,
  p_ocr_text         text    default null,
  p_ocr_confidence   real    default null,
  p_ocr_keywords_hit integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;

  -- Tylko własne zgłoszenie, tylko to zdjęcie i tylko raz: wynik raz zapisany
  -- (albo wpisany przez dolacz_przelew) się nie zmienia. Brak pasującego
  -- wiersza to nie błąd - zgłoszenie mogło już zostać rozpatrzone.
  update public.registrations
  set ocr_text         = p_ocr_text,
      ocr_confidence   = p_ocr_confidence,
      ocr_keywords_hit = coalesce(p_ocr_keywords_hit, 0)
  where user_id = auth.uid()
    and proof_path = p_proof_path
    and ocr_text is null
    and ocr_confidence is null;
end;
$$;

revoke execute on function public.uzupelnij_ocr(text, text, real, integer) from public, anon;
grant  execute on function public.uzupelnij_ocr(text, text, real, integer) to authenticated;
