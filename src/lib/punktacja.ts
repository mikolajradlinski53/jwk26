/**
 * Punktacja gry wyjazdowej (tabela Mikołaja, 2026-10-22). Jedno źródło dla
 * ekranu „Punktacja” uczestników i szybkiego wyboru w panelu punktów Kadry.
 *
 * Bingo i gra terenowa liczą się w apce same (review_bingo) - tu są dla
 * jasności zasad i na przypadki ręczne (np. stacja bez całej drużyny).
 * Korekty względem tabeli, uzgodnione z Mikołajem: pole bingo 20 pkt,
 * zrzyganie karane dopiero, gdy ktoś po sobie nie posprząta, a pomoc dla
 * zgonka +20.
 */
export type PozycjaPunktacji = { nazwa: string; punkty: number; automat?: boolean };
export type SekcjaPunktacji = { sekcja: string; pozycje: PozycjaPunktacji[] };

export const PUNKTACJA: SekcjaPunktacji[] = [
  {
    sekcja: "Bingo",
    pozycje: [
      { nazwa: "Wypełnione jedno pole", punkty: 20, automat: true },
      { nazwa: "Wygrana - 3 linie", punkty: 100, automat: true },
      { nazwa: "Kumulacja - wszystkie pola", punkty: 200, automat: true },
    ],
  },
  {
    sekcja: "LUJek",
    pozycje: [
      { nazwa: "Udział w danej aktywności", punkty: 5 },
      { nazwa: "Udział we wszystkich aktywnościach", punkty: 50 },
      { nazwa: "Wygrana danej aktywności", punkty: 10 },
      { nazwa: "Dostanie się do finału", punkty: 100 },
      { nazwa: "Zwycięstwo", punkty: 200 },
    ],
  },
  {
    sekcja: "Zawody",
    pozycje: [
      { nazwa: "Siatka - udział (za osobę z Sekty)", punkty: 5 },
      { nazwa: "Siatka - zwycięstwo (za osobę z Sekty)", punkty: 20 },
      { nazwa: "Szachy - udział (za osobę z Sekty)", punkty: 5 },
      { nazwa: "Szachy - zwycięstwo (za osobę z Sekty)", punkty: 20 },
      { nazwa: "Piłkarzyki - udział (za osobę z Sekty)", punkty: 5 },
      { nazwa: "Piłkarzyki - zwycięstwo (za osobę z Sekty)", punkty: 20 },
      { nazwa: "Poker - udział (za osobę z Sekty)", punkty: 5 },
      { nazwa: "Poker - zwycięstwo (najwięcej żetonów)", punkty: 100 },
    ],
  },
  {
    sekcja: "Gra terenowa",
    pozycje: [
      { nazwa: "Jedna stacja", punkty: 5 },
      { nazwa: "Jedna stacja - cała drużyna", punkty: 10, automat: true },
      { nazwa: "Pełna trasa", punkty: 100 },
      { nazwa: "Pełna trasa - cała drużyna", punkty: 150, automat: true },
    ],
  },
  {
    sekcja: "Pub Quiz",
    pozycje: [
      { nazwa: "Udział (za drużynę)", punkty: 20 },
      { nazwa: "Zwycięstwo", punkty: 200 },
    ],
  },
  {
    sekcja: "Topalkyyy / impreza Sekty",
    pozycje: [
      { nazwa: "Topalkyyy - udział (od osoby)", punkty: 5 },
      { nazwa: "Topalkyyy - wygrana", punkty: 200 },
      { nazwa: "Przebranie w motywie", punkty: 20 },
      { nazwa: "Punktualność", punkty: 20 },
    ],
  },
  {
    sekcja: "Budowa - impreza",
    pozycje: [
      { nazwa: "Przebranie w motywie", punkty: 10 },
      { nazwa: "Punktualność", punkty: 20 },
      { nazwa: "Wygrane limbo pod rogatkami", punkty: 50 },
    ],
  },
  {
    sekcja: "Chrzest",
    pozycje: [
      { nazwa: "Top 1", punkty: 100 },
      { nazwa: "Top 2", punkty: 50 },
      { nazwa: "Top 3", punkty: 30 },
      { nazwa: "Udział", punkty: 5 },
    ],
  },
  {
    sekcja: "Szkolenie",
    pozycje: [{ nazwa: "Obecność (za osobę z Sekty)", punkty: 10 }],
  },
  {
    sekcja: "Dodatkowe punkty",
    pozycje: [
      { nazwa: "Dary dla Kadry", punkty: 10 },
      { nazwa: "Pomoc Kadrze", punkty: 20 },
      { nazwa: "Wystawienie opinii", punkty: 10 },
      { nazwa: "Pomoc dla zgonka", punkty: 20 },
      { nazwa: "Znalezienie zgubionej rzeczy", punkty: 10 },
      { nazwa: "Najlepszy doping drużynowy", punkty: 20 },
      { nazwa: "Pomoc w sprzątaniu po bibie", punkty: 10 },
      { nazwa: "Zakupy dla Kadry", punkty: 10 },
      { nazwa: "Noszenie barteru", punkty: 10 },
    ],
  },
  {
    sekcja: "Ujemne punkty",
    pozycje: [
      { nazwa: "Przeszkadzanie na szkoleniu", punkty: -20 },
      { nazwa: "Utrudnianie przeprowadzenia aktywności", punkty: -30 },
      { nazwa: "Próba oszukiwania", punkty: -100 },
      { nazwa: "Złamanie regulaminu wydarzenia", punkty: -100 },
      { nazwa: "Wkurwienie Kadry", punkty: -10 },
      { nazwa: "Nieposprzątanie po sobie", punkty: -20 },
      { nazwa: "Narzekanie na aktywnościach", punkty: -5 },
      { nazwa: "Spóźnienie się", punkty: -10 },
      { nazwa: "Bałagan w części wspólnej", punkty: -10 },
      { nazwa: "Niesprzątnięcie po zrzyganiu się", punkty: -50 },
      { nazwa: "Zniszczenie czegoś", punkty: -200 },
      { nazwa: "Nieprzestrzeganie poleceń Kadry", punkty: -30 },
      { nazwa: "Agresywne zachowanie", punkty: -100 },
      { nazwa: "Wyzywanie nie na żarty", punkty: -100 },
      { nazwa: "Utrudnianie innej grupie", punkty: -30 },
      { nazwa: "Złe zachowanie w autokarze", punkty: -50 },
      { nazwa: "Opuszczanie ośrodka nocą", punkty: -100 },
    ],
  },
];

/** Powód do księgi: „Sekcja: pozycja”. */
export function powodPunktacji(sekcja: string, pozycja: PozycjaPunktacji): string {
  return `${sekcja}: ${pozycja.nazwa}`;
}
