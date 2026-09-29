import { createClient } from "@/lib/supabase/server";

/**
 * Zdjęcie z feedu pod stałym adresem (spec porządku, D5).
 *
 * Podpisany adres ważny godzinę zmieniał się przy każdym wejściu do feedu,
 * więc przeglądarka nie mogła niczego zapamiętać i ściągała wszystkie zdjęcia
 * od nowa - główny zjadacz limitu 5 GB transferu w Supabase Free. Tutaj:
 * bramka sesji z proxy (trasa pod /app), RLS decyduje, kto co widzi, a zdjęcie
 * z bingo nigdy się nie zmienia, więc telefon trzyma je tydzień.
 *
 * `?podglad` - mała wersja (720 px); starsze zdjęcia jej nie mają, wtedy pełne.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: wpis } = await supabase
    .from("bingo_submissions")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!wpis) return new Response("Nie ma takiego zdjęcia", { status: 404 });

  const pelne = wpis.photo_path as string;
  const sciezki = new URL(request.url).searchParams.has("podglad")
    ? [pelne.replace(/\.jpg$/, ".podglad.jpg"), pelne]
    : [pelne];

  for (const sciezka of sciezki) {
    const { data } = await supabase.storage.from("bingo").download(sciezka);
    if (data) {
      return new Response(data, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=604800, immutable",
        },
      });
    }
  }
  return new Response("Nie ma takiego zdjęcia", { status: 404 });
}
