import { createClient } from "@/lib/supabase/server";

/**
 * Zdjęcie z nominacji w gossipach. Kto co widzi, rozstrzyga polityka bucketu
 * `gossip` (admin zawsze, uczestnik dopiero po ujawnieniu i tylko o
 * zwycięzcy) — trasa tylko podaje plik dalej. Ścieżka to `<kategoria>/<uuid>.jpg`,
 * więc adres nie zdradza autora.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kategoria: string; plik: string }> },
) {
  const { kategoria, plik } = await params;
  if (!/^[0-9a-f-]{36}$/.test(kategoria) || !/^[0-9a-f-]{36}\.jpg$/.test(plik)) {
    return new Response("Nie ma takiego zdjęcia", { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase.storage.from("gossip").download(`${kategoria}/${plik}`);
  if (!data) return new Response("Nie ma takiego zdjęcia", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": "image/jpeg",
      // Krótko i prywatnie: admin może ukryć nominację po ujawnieniu, a wtedy
      // zdjęcie ma zniknąć także z telefonów, które je już widziały.
      "Cache-Control": "private, max-age=300",
    },
  });
}
