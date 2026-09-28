/** Kategoria w kształcie zwracanym przez funkcję `gossipy()`. */
export type KategoriaGossipow = {
  id: string;
  tytul: string;
  opis: string | null;
  status: "otwarta" | "zamknieta" | "ujawniona";
  nominowani: { id: string; nazwa: string }[];
  /** Na kogo zagłosowała zalogowana osoba — tylko jej własny wybór. */
  moj_glos: string | null;
  /** Tylko po ujawnieniu; przy remisie kilka osób. */
  zwyciezcy: { id: string; nazwa: string }[] | null;
  /** Tylko po ujawnieniu: anonimowe uzasadnienia o zwycięzcy/zwycięzcach. */
  uzasadnienia: string[] | null;
};

export const NAZWY_STATUSU: Record<KategoriaGossipow["status"], string> = {
  otwarta: "Głosowanie trwa",
  zamknieta: "Głosowanie zamknięte — czekamy na ujawnienie",
  ujawniona: "Wynik ujawniony",
};
