/** Kategoria w kształcie zwracanym przez funkcję `gossipy()`. */
export type KategoriaGossipow = {
  id: string;
  tytul: string;
  opis: string | null;
  status: "otwarta" | "zamknieta" | "ujawniona";
  /** Kogo nominowała zalogowana osoba — tylko jej własny wybór. */
  moj_glos: string | null;
  moj_typ: string | null;
  /** Tylko po ujawnieniu; przy remisie kilka osób. */
  zwyciezcy: { id: string; nazwa: string }[] | null;
  /** Tylko po ujawnieniu: anonimowe uzasadnienia o zwycięzcy/zwycięzcach. */
  uzasadnienia: { tekst: string; zdjecie: string | null }[] | null;
};

export type Kandydat = { id: string; nazwa: string };

export const NAZWY_STATUSU: Record<KategoriaGossipow["status"], string> = {
  otwarta: "Nominacje trwają",
  zamknieta: "Nominacje zamknięte — czekamy na ujawnienie",
  ujawniona: "Wynik ujawniony",
};

/** Adres zdjęcia z nominacji — trasa pod /app, RLS bucketu decyduje o dostępie. */
export function adresZdjeciaGossipu(sciezka: string): string {
  return `/app/gossip/zdjecie/${sciezka}`;
}
