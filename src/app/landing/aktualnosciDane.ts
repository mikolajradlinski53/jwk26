/**
 * Posty z social mediów tej edycji (teksty od Mikołaja 2026-10-11). Kafelek
 * pokazuje grafikę albo okładkę rolki, a pełny opis otwiera się po
 * kliknięciu. Najnowszy na górze.
 *
 * Rolka z Facebooka nie daje się osadzić (odtwarzacz zwraca „Film
 * niedostępny”), więc leży u nas: MP4 H.264 720×1280 przekonwertowane
 * z oryginału .mov (HEVC nie gra w Chrome), okładka to kadr z 1. sekundy.
 * Film ładuje się dopiero po otwarciu okna.
 */
export type Post = {
  id: string;
  tytul: string;
  /** Grafika kwadratowa w public/aktualnosci. */
  grafika?: string;
  /** Film w public/aktualnosci z kadrem na okładkę kafelka. */
  wideo?: { src: string; plakat: string };
  link?: { href: string; etykieta: string };
  tresc: string;
};

export const POSTY: Post[] = [
  {
    id: "budowa",
    tytul: "Motyw piątkowej imprezy: BUDOWA",
    wideo: { src: "/aktualnosci/jwk-budowa.mp4", plakat: "/aktualnosci/jwk-budowa-plakat.jpg" },
    link: { href: "https://www.facebook.com/reel/1396960375852697", etykieta: "Obejrzyj rolkę na Facebooku" },
    tresc: `Do wyjazdu coraz bliżej, dlatego czas na ogłoszenie motywu piątkowej imprezy!!! 💃🏼
I zdecydowanie wystarczy tu tylko jedno zdanie…
UWAGA! NA TERENIE JWK TRWA BUDOWA! 🦺🔨
A że najlepsze imprezy nie biorą się znikąd, to ktoś musi to wszystko zaplanować!!
Poznajcie zatem ekipę, która bierze to zadanie na siebie! 👷
🏗️ Dawid - Koordynator
Kierownik całego zamieszania. Szef budowy i człowiek, który próbuje utrzymać ekipę w ryzach. Ma ambicje i nadzieję, że chociaż połowa rzeczy pójdzie zgodnie z planem...
📢 Ewa - Promka
Odpowiada za to, żeby na naszej budowie pojawiło się jak najwięcej osób. Główny cel - nagłośnić JWK, zanim jeszcze zdążymy cokolwiek wybudować
💸 Madzia - Finanse
Liczy, kalkuluje i pilnuje, żebyśmy nie wydali całej kasy na zbędny sprzęt. Z nią nawet spontaniczny zakup młotka wymaga solidnego uzasadnienia!
🗂️ Miki - Admi i logitech
Doskonale wie co i dlaczego jeszcze nie dojechało. Bez niego nawet betoniarka nie wiedziałaby, w którą stronę ruszyć
🤝 Bartek i Radek - KZ
Załatwiają współprace, barter i wszystko, co może przydać się na placu budowy. Kiedy reszta ekipy mówi „przydałoby się to ogarnąć”, oni odpowiadają - "potrzymajcie mi piwo"
A teraz przyznajcie się, czy ktoś się tego spodziewał?! 🚧`,
  },
  {
    id: "szkolenia",
    tytul: "Szkolenia: nowa forma, case study",
    grafika: "/aktualnosci/jwk-szkolenie-post.jpg",
    tresc: `A co z merytoryką? 📚

W tym roku szykujemy nieco inne rozwiązanie na szkolenie!

Zamiast pokazu slajdów i wiercenia się na krześle aż do końca, mamy dla was trochę praktyki i sporo wiedzy, którą naprawdę możecie później wykorzystać 🤓

🆕 Świeżaki zmierzą się z case studies opartymi na prawdziwych sytuacjach z projektów. Każda grupa dostanie konkretny problem, spróbuje go rozwiązać, przedstawi swoje podejście, a na koniec pozna rozwiązanie, które zostało zastosowane w rzeczywistości.

🎓 Na Działaczy czeka samorządowy niezbędnik, czyli rzeczy, które każdy Samorządowiec powinien znać. Przejdziemy przez trzy bloki tematyczne: sprawy socjalno-bytowe, organy kolegialne i jednoosobowe na uczelni i w Samorządzie oraz pomoce zewnętrzne i ogólnopolską działalność w Samorządności.

Szkolenie dla Działaczy jest obowiązkowe dla Działaczy, a dla Świeżaków - dla Świeżaków. Ale harmonogram jest taki, że każdy może spokojnie pojawić się na obu 😎

Szkolenia będą naprawdę wartościowe, dlatego nie przewidujemy pytań “kiedy koniec?” 🗓️`,
  },
  {
    id: "grywalizacja",
    tytul: "Nowość: grywalizacja",
    grafika: "/aktualnosci/jwk-gry-post.jpg",
    tresc: `Co powiecie na zdrową rywalizację? 👀

Przedstawiamy GRYWALIZACJĘ, która będzie nam towarzyszyć przez cały wyjazd! 🎮🍂

Każdego dnia będziecie mogli zdobywać punkty za udział w różnych aktywnościach i zadaniach. Będzie trochę wyzwań, dużo śmiechu i jeszcze więcej wspólnych wspomnień 🫶

Co dla Was przygotowaliśmy?
🎯 Bingo - klasyka gatunku, żeby trochę się powygłupiać
🍺 LUJeK - nieco mniejsza wersja LUJa, za którym wszyscy tak bardzo tęsknimy
🌲 Gra terenowa - trochę ruchu i pięknych widoków
🏐 Turnieje - siatkówka, piłkarzyki, szachy oraz Poker Texas Hold’em
🧠 Pub Quiz - sprawdzimy, kto wie wszystko, albo kto ma dużego farta

Nie wszystko będzie obowiązkowe, ale zdecydowanie zachęcamy do udziału! Im więcej aktywności, tym więcej punktów. A skoro punkty można zdobywać, to będzie je można również stracić... 🫡

A DODATKOWO na naszej stronie powstanie specjalny SKLEPIK, w którym będziecie mogli wymieniać zdobyte punkty na różne nagrody! Warto jednak zbierać je do samego końca, gdyż najlepsze nagrody i ich ceny poznacie podczas zwieńczenia JWK, o którym opowiemy Wam nieco później 🎁

Nie nastawiajcie się wyłącznie na walkę o pierwsze miejsce. Nastawcie się na dobrą zabawę, a punkty wpadną przy okazji 😗

Chociaż oczywiście... wygrywać też będzie można 😎🏆

Więcej szczegółów już wkrótce!`,
  },
];
