/**
 * Regulamin JWK26 - treść przekazana przez Mikołaja 2026-10-11 (wersja z
 * Magdaleną Skoczylas jako zastępstwem, obowiązkowymi szkoleniami, brakiem
 * NNW/OC i datą 12.10), z dopiskami z aplikacji: tury i lista rezerwowa
 * (§ 3 ust. 4), potwierdzenie wpłaty (§ 3 ust. 5), harmonogram w Aplikacji
 * (§ 4 ust. 1) i § 19 „Aplikacja JWK26” - dalsze paragrafy przesunięte o jeden.
 * Zmiana treści wymaga podbicia WERSJA_ZGOD w src/lib/zapisy/zgody.ts - zgłoszenie zapisuje wersję, którą uczestnik
 * zaakceptował.
 */
export type Paragraf = { numer: number; tytul: string; ustepy: string[] };

export const KOORDYNATOR = "Dawid Rutkowski";
export const KOORDYNATOR_MAIL = "dawid.rutkowski@samorzad.ue.wroc.pl";
export const KOORDYNATOR_TELEFON = "+48 608 008 363";

export const REGULAMIN: Paragraf[] = [
  {
    numer: 1,
    tytul: "Przedmiot i zakres Regulaminu",
    ustepy: [
      "Niniejszy Regulamin określa warunki udziału, zasady zachowania, bezpieczeństwa i odpowiedzialności związane z Jesiennym Wyjazdem Komisji 2026, zwanym dalej „Wydarzeniem” albo „JWK26”.",
      "Wydarzenie ma charakter szkoleniowo-integracyjny i jest skierowane do ograniczonej grupy osób związanych z działalnością Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu, zwanego dalej „SSUEW”.",
      "Wydarzenie odbywa się od dnia 23 października 2026 r. do dnia 25 października 2026 r. na terenie Ośrodka Wypoczynkowego Zielone Wzgórze przy ul. Poznańskiej 5, 58-540 Karpacz, a także w innych miejscach, w których jest realizowany ogłoszony program.",
      "Regulamin dotyczy każdej osoby zakwalifikowanej do udziału, w tym członków Kadry Organizacyjnej, chyba że dane postanowienie ze swej natury odnosi się wyłącznie do uczestników.",
      "Zasady płatności i ich rozliczenia nie są przedmiotem niniejszego Regulaminu; przekazuje się je uczestnikom odrębnie, przed dokonaniem wpłaty. Regulamin nie zmienia stron ani treści umów zawieranych z usługodawcami.",
    ],
  },
  {
    numer: 2,
    tytul: "Definicje i podział ról",
    ustepy: [
      "Ilekroć w Regulaminie mowa o „Organizatorze”, oznacza to osoby przygotowujące program i koordynujące Wydarzenie w ramach działalności Samorządu Studentów Uniwersytetu Ekonomicznego we Wrocławiu, działające przez wskazaną Uczestnikom Kadrę Organizacyjną. Pojęcie to określa funkcję organizacyjną na potrzeby Regulaminu; nie przesądza, kto jest stroną poszczególnych umów ani kto ponosi odpowiedzialność za określone świadczenie lub zdarzenie. Kwestie te wynikają z rzeczywiście dokonanych czynności, zawartych umów i właściwych przepisów prawa.",
      "„Kadra Organizacyjna” oznacza osoby wyznaczone do bieżącego prowadzenia Wydarzenia, wskazane uczestnikom przed wyjazdem wraz ze sposobem kontaktu; „Koordynator” oznacza osobę kierującą pracą tej Kadry.",
      "Imiona i nazwiska Koordynatora oraz wyznaczonego zastępcy, wraz z numerem telefonu do pilnego kontaktu podczas Wydarzenia, podaje się Uczestnikom przed wyjazdem. W razie niedostępności Koordynatora jego zadania związane z bieżącym prowadzeniem Wydarzenia wykonuje Magdalena Skoczylas.",
      "„Uczestnik” oznacza osobę, której udział został potwierdzony przez Organizatora i która zapoznała się z Regulaminem; „Obiekt” oznacza ośrodek wymieniony w § 1 ust. 3; „Aplikacja” oznacza aplikację internetową JWK26 opisaną w § 19.",
      "Kadra wykonuje czynności faktyczne związane z przebiegiem Wydarzenia. Samo powierzenie funkcji Koordynatora lub członka Kadry nie stanowi pełnomocnictwa do składania oświadczeń woli ani zaciągania zobowiązań w imieniu UEW.",
      "Obsługa Obiektu odpowiada za świadczenia i bezpieczeństwo techniczne w zakresie wynikającym z właściwych przepisów oraz zawartych z nią umów. Polecenia Kadry nie zastępują obowiązujących zasad Obiektu ani poleceń służb.",
    ],
  },
  {
    numer: 3,
    tytul: "Charakter udziału i warunki uczestnictwa",
    ustepy: [
      "Udział w Wydarzeniu jest dobrowolny i przysługuje osobie pełnoletniej należącej do Komisji SSUEW albo zaproszonej do udziału z uwagi na program Wydarzenia.",
      "Udział osoby spoza społeczności studenckiej UEW wymaga indywidualnego potwierdzenia przez Organizatora, z uwzględnieniem celu Wydarzenia i dostępności miejsc.",
      "Warunkiem udziału jest złożenie kompletnego zgłoszenia, spełnienie ogłoszonych kryteriów kwalifikacji, otrzymanie potwierdzenia udziału oraz zaakceptowanie Regulaminu w wersji udostępnionej przed zgłoszeniem i dokonaniem wpłaty. Organizator utrwala datę akceptacji i oznaczenie wersji Regulaminu zaakceptowanej przez Uczestnika. Jeżeli po akceptacji wprowadzono zmianę istotną dla praw lub obowiązków Uczestnika, stosuje się § 22 ust. 2.",
      "Liczba miejsc jest ograniczona. Zakłada się udział do 54 Uczestników i 6 osób Kadry. Złożenie zgłoszenia nie stanowi potwierdzenia udziału. Zgłoszenia przyjmowane są w turach ogłaszanych przez Organizatora; po wyczerpaniu miejsc w danej turze zgłoszenie może trafić na listę rezerwową.",
      "Zgłoszenie na listę główną wymaga dołączenia w formularzu potwierdzenia wpłaty. Osoba przesunięta z listy rezerwowej przesyła potwierdzenie wpłaty w terminie wskazanym przez Organizatora. Zgłoszenie, do którego nie przesłano potwierdzenia wpłaty, zostaje odrzucone, a zwolnione miejsce przechodzi na kolejną osobę z listy rezerwowej.",
      "Organizator może odmówić zakwalifikowania osoby, która nie spełnia jawnych warunków udziału, podała istotnie nieprawdziwe dane, po wezwaniu nie usunęła braków zgłoszenia lub której udział stwarza konkretne i należycie uzasadnione zagrożenie dla bezpieczeństwa innych osób. O odmowie informuje się indywidualnie, z podaniem zwięzłej przyczyny.",
      "Odmowa udzielenia dobrowolnej zgody na rozpowszechnianie wizerunku, podania danych o zdrowiu albo wskazania kontaktu alarmowego nie stanowi samodzielnej podstawy odmowy udziału.",
    ],
  },
  {
    numer: 4,
    tytul: "Informacje organizacyjne i program",
    ustepy: [
      "Organizator przekazuje Uczestnikom przed rozpoczęciem Wydarzenia ramowy program, godziny rozpoczęcia i zakończenia, miejsce zbiórki, dane kontaktowe Kadry, zasady dojazdu i zakres świadczeń zapewnionych w ramach pobytu. Aktualny harmonogram jest dostępny także w Aplikacji.",
      "Uczestnik jest obowiązany zapoznać się z przekazanymi informacjami oraz sprawdzać wiadomości kierowane na adres podany w zgłoszeniu.",
      "Kadra może zmienić kolejność, godziny lub miejsce realizacji poszczególnych punktów programu, gdy jest to uzasadnione pogodą, możliwościami Obiektu, bezpieczeństwem lub inną obiektywną przeszkodą. O zmianie informuje Uczestników bez zbędnej zwłoki.",
      "Zmiana programu nie może polegać na pozbawieniu Uczestników zasadniczego celu szkoleniowego Wydarzenia bez zapewnienia odpowiedniego rozwiązania; uprawnienia wynikające z odrębnych warunków udziału i przepisów prawa pozostają zachowane.",
      "Udział w zajęciach szkoleniowych oznaczonych jako obowiązkowe w programie przekazanym przed potwierdzeniem udziału jest obowiązkiem Uczestnika, z zastrzeżeniem uzasadnionej niemożności udziału, w szczególności ze względów zdrowotnych lub bezpieczeństwa. Udział w aktywnościach sportowych, rekreacyjnych i dodatkowych jest dobrowolny.",
    ],
  },
  {
    numer: 5,
    tytul: "Przyjazd, obecność i opuszczanie Wydarzenia",
    ustepy: [
      "Uczestnik stawia się w miejscu i czasie określonym w informacji organizacyjnej oraz potwierdza obecność Kadrze. Spóźnienie lub brak możliwości przyjazdu zgłasza niezwłocznie pod wskazanym numerem telefonu.",
      "Uczestnik, który zamierza wcześniej zakończyć udział, opuszcza teren Obiektu na dłużej albo nie bierze udziału w zaplanowanym wspólnym przejściu lub wyjeździe, powiadamia Kadrę w sposób umożliwiający aktualizację listy obecności. Nie jest to wymóg uzyskania zgody na swobodne przemieszczanie się osoby dorosłej.",
      "Kadra może zbierać potwierdzenia obecności na punktach programu, jeżeli służy to rozliczeniu udziału, organizacji transportu lub bezpieczeństwu grupy.",
      "Uczestnik nie może przekazywać swojego miejsca ani uprawnienia do zakwaterowania innej osobie bez uprzedniego potwierdzenia przez Kadrę i Obiekt.",
      "Jeżeli przewidziano wspólny transport, Uczestnik może wybrać dojazd i powrót we własnym zakresie, informując o tym Kadrę przed terminem wskazanym w informacji organizacyjnej. Kadra przekazuje takiej osobie miejsce i godzinę rozpoczęcia Wydarzenia oraz sposób potwierdzenia przybycia. Zakres świadczeń związanych z transportem i zasady płatności podaje się odrębnie przed dokonaniem wpłaty.",
    ],
  },
  {
    numer: 6,
    tytul: "Zakwaterowanie i korzystanie z Obiektu",
    ustepy: [
      "Zakwaterowanie następuje według listy przygotowanej przez Kadrę we współpracy z Obiektem. Uczestnik otrzymuje informację o przydzielonym pokoju oraz zasadach korzystania z pomieszczeń wspólnych.",
      "Zmiana pokoju, wymiana miejsc lub przyjęcie osoby nieujętej na liście noclegowej wymagają uprzedniej zgody Obiektu oraz Kadry. Nie dotyczy to sytuacji nagłych związanych z bezpieczeństwem.",
      "Uczestnik korzysta z pomieszczeń zgodnie z ich przeznaczeniem, regulaminem Obiektu, zasadami ochrony przeciwpożarowej oraz poleceniami obsługi dotyczącymi bezpieczeństwa.",
      "Przy objęciu pokoju Uczestnik powinien niezwłocznie zgłosić obsłudze Obiektu i Kadrze zauważone uszkodzenia, braki w wyposażeniu lub zastrzeżenia do stanu pomieszczenia. Zgłoszenie może być udokumentowane zdjęciem i krótkim protokołem.",
      "Po zakończeniu pobytu Uczestnik zdaje pokój w stanie niepogorszonym, z uwzględnieniem zużycia wynikającego z prawidłowego korzystania, w terminie wyznaczonym przez Obiekt, oraz zwraca przekazane klucze lub karty.",
      "Uczestnik przestrzega ciszy nocnej i innych ograniczeń obowiązujących w Obiekcie. W pokojach i częściach wspólnych zakazane są działania zagrażające urządzeniom technicznym, instalacjom lub bezpieczeństwu pożarowemu.",
    ],
  },
  {
    numer: 7,
    tytul: "Prawa Uczestnika",
    ustepy: [
      "Uczestnik ma prawo do poszanowania godności, prywatności i równego traktowania, uzyskania jasnych informacji o programie i zasadach pobytu oraz zgłoszenia uwag dotyczących bezpieczeństwa i organizacji.",
      "Uczestnik może zwrócić się do Kadry o uzasadnione dostosowanie sposobu uczestnictwa do swoich potrzeb, w zakresie możliwym przy dostępnych warunkach i bez naruszania praw innych osób.",
      "Uczestnik może odmówić udziału w aktywności stwarzającej dla niego szczególne ryzyko oraz niezwłocznie zgłosić Kadrze okoliczności, które według jego oceny uzasadniają taką decyzję.",
      "Uczestnik ma prawo zgłosić zastrzeżenia do ustaleń dotyczących szkody, środka porządkowego lub przebiegu interwencji oraz otrzymać informację o sposobie rozpatrzenia zgłoszenia.",
    ],
  },
  {
    numer: 8,
    tytul: "Podstawowe obowiązki Uczestnika",
    ustepy: [
      "Uczestnik jest obowiązany przestrzegać Regulaminu, zasad Obiektu, powszechnie obowiązującego prawa oraz uzasadnionych poleceń Kadry odnoszących się do bezpieczeństwa, porządku i przebiegu programu.",
      "Uczestnik zachowuje się z poszanowaniem godności, nietykalności, prywatności i mienia innych osób, współpracuje w sytuacjach zagrożenia oraz nie utrudnia udzielania pomocy.",
      "Uczestnik niezwłocznie przekazuje Kadrze lub obsłudze Obiektu informacje o wypadku, zaginięciu osoby, pożarze, poważnej awarii, agresji, przemocy, uszkodzeniu mienia albo innym zdarzeniu wymagającym reakcji.",
      "Uczestnik odpowiada za własne decyzje podejmowane poza oficjalnym programem; postanowienie to nie wyłącza odpowiedzialności innych osób lub podmiotów w zakresie wynikającym z prawa.",
      "Uczestnik zabezpiecza swoje rzeczy osobiste w rozsądnym zakresie i korzysta z udostępnionych przez Obiekt możliwości ich przechowywania. Utrata rzeczy powinna zostać niezwłocznie zgłoszona Obiektowi i Kadrze.",
      "Uczestnik bierze udział w obowiązkowych zajęciach szkoleniowych wskazanych zgodnie z § 4 ust. 5. O przeszkodzie w uczestnictwie zawiadamia Kadrę możliwie niezwłocznie. Obowiązek obecności nie oznacza obowiązku wykonania czynności, która w konkretnych okolicznościach stwarza dla niego zagrożenie.",
    ],
  },
  {
    numer: 9,
    tytul: "Zakazy i zachowania naruszające Regulamin",
    ustepy: [
      "Zabrania się przemocy fizycznej, gróźb, uporczywego nękania, molestowania, poniżania, dyskryminacji oraz innych zachowań naruszających bezpieczeństwo lub dobra osobiste.",
      "Zabrania się posiadania, używania lub udostępniania środków odurzających, substancji psychotropowych i innych środków, których obrót lub posiadanie jest prawnie zabronione.",
      "Zabrania się wnoszenia lub używania broni, materiałów wybuchowych, pirotechnicznych oraz przedmiotów niebezpiecznych w sposób zagrażający osobom albo mieniu.",
      "Zabrania się niszczenia, zabierania lub ukrywania cudzych rzeczy, blokowania dróg ewakuacyjnych, ingerowania w instalacje, używania otwartego ognia poza miejscami do tego przeznaczonymi oraz zakłócania spokoju innych gości Obiektu.",
      "Nie wolno utrwalać ani publikować treści naruszających prywatność, godność lub prawa innych osób, w szczególności nagrań z pomieszczeń sanitarnych, sytuacji intymnych lub interwencji medycznej.",
    ],
  },
  {
    numer: 10,
    tytul: "Alkohol i zdolność bezpiecznego uczestnictwa",
    ustepy: [
      "Spożywanie alkoholu może odbywać się wyłącznie zgodnie z prawem, zasadami Obiektu i zakresem wyznaczonym przez program; zakazane jest spożywanie w czasie aktywności, które wymagają trzeźwości dla bezpieczeństwa.",
      "Osoba znajdująca się pod wpływem alkoholu lub innego środka w stopniu utrudniającym bezpieczny udział może zostać odsunięta od określonej aktywności. Decyzja powinna uwzględniać okoliczności i być odnotowana przez Kadrę.",
      "Jeżeli zachowanie lub stan Uczestnika wskazuje na konkretne zagrożenie dla niego lub innych osób, Kadra podejmuje działania adekwatne do sytuacji, w szczególności odsuwa go od niebezpiecznej aktywności, zawiadamia obsługę Obiektu albo wzywa właściwe służby. Postanowienie to nie uprawnia do przymusowego badania trzeźwości, przeszukania ani zatrzymania Uczestnika.",
      "Uczestnik nie może prowadzić pojazdu w stanie wyłączającym bezpieczne prowadzenie ani nakłaniać innej osoby do takiego zachowania.",
    ],
  },
  {
    numer: 11,
    tytul: "Zdrowie, pierwsza pomoc i sytuacje nadzwyczajne",
    ustepy: [
      "W razie nagłego zachorowania, urazu lub innego zagrożenia Kadra niezwłocznie podejmuje działania adekwatne do sytuacji, a gdy stan osoby lub okoliczności tego wymagają, wzywa pomoc pod numerem alarmowym 112, zapewnia służbom dostęp do poszkodowanego oraz udziela możliwej i bezpiecznej pomocy do czasu ich przybycia.",
      "Kadra nie zastępuje personelu medycznego i nie podejmuje decyzji zastrzeżonych dla osób wykonujących zawody medyczne. Postanowienie to nie ogranicza obowiązku udzielenia pomocy wynikającego z powszechnie obowiązujących przepisów.",
      "Podanie informacji o alergiach, diecie, stanie zdrowia lub kontakcie alarmowym jest dobrowolne. Jeżeli Uczestnik prosi o dostosowanie wyżywienia albo aktywności, przekazuje tylko informacje niezbędne do oceny tej potrzeby.",
      "W razie ewakuacji, pożaru, awarii lub zaginięcia Uczestnika należy wykonywać polecenia właściwych służb i obsługi Obiektu oraz w miarę możliwości potwierdzić Kadrze swoją obecność w bezpiecznym miejscu.",
      "Kontakt z osobą wskazaną przez Uczestnika jako kontakt alarmowy następuje jedynie wtedy, gdy uzasadnia to konkretna sytuacja, z poszanowaniem prywatności Uczestnika i jego zdolności do samodzielnego działania.",
      "Organizator nie zapewnia dodatkowego grupowego ubezpieczenia NNW ani OC w związku z Wydarzeniem. Informacja ta nie ogranicza praw wynikających z innych obowiązujących polis lub przepisów prawa.",
    ],
  },
  {
    numer: 12,
    tytul: "Bezpieczeństwo aktywności poza Obiektem",
    ustepy: [
      "Przed rozpoczęciem aktywności poza Obiektem Kadra przekazuje miejsce zbiórki, przewidywany czas trwania, trasę lub cel oraz sposób kontaktu w przypadku oddzielenia się od grupy.",
      "Uczestnik stosuje się do zasad korzystania z terenu, warunków pogodowych, przepisów ruchu i poleceń służb. Nie podejmuje działań wymagających umiejętności lub wyposażenia, których nie posiada.",
      "Kadra może przerwać aktywność lub zmienić jej przebieg, jeżeli powstanie konkretne zagrożenie dla życia, zdrowia lub bezpieczeństwa grupy.",
      "Osoba, która oddzieliła się od grupy, zawiadamia Kadrę, o ile może uczynić to bezpiecznie; Kadra podejmuje odpowiednie czynności weryfikacyjne i w razie potrzeby zwraca się do służb.",
    ],
  },
  {
    numer: 13,
    tytul: "Szkody w mieniu i dokumentowanie zdarzeń",
    ustepy: [
      "Uczestnik ponosi odpowiedzialność za wyrządzoną przez siebie szkodę na zasadach określonych przez właściwe przepisy prawa. Zakres odpowiedzialności ustala się w odniesieniu do rzeczywistej szkody, okoliczności jej powstania i związku z zachowaniem danej osoby.",
      "Osoba, która spowodowała lub zauważyła szkodę, niezwłocznie zawiadamia obsługę Obiektu oraz Kadrę, jeżeli szkoda dotyczy pomieszczenia, wyposażenia lub mienia używanego podczas Wydarzenia.",
      "W miarę możliwości sporządza się dokumentację obejmującą datę, miejsce, opis uszkodzenia, zdjęcia, dane obecnych osób, stanowisko osoby, której dotyczy zgłoszenie, oraz dokument wskazujący wartość naprawy lub odtworzenia.",
      "Osoby zakwaterowane w tym samym pokoju odpowiadają solidarnie za określoną szkodę, jeżeli odpowiedzialność każdej z nich za jej wyrządzenie wynika z właściwych przepisów prawa albo jeżeli każda z nich wyraźnie przyjęła solidarne zobowiązanie na warunkach odrębnego porozumienia dotyczącego danego pokoju. Sam przydział do pokoju nie tworzy odpowiedzialności solidarnej.",
      "Osobie, do której kierowane jest roszczenie, przedstawia się podstawę faktyczną, dokumentację i sposób wyliczenia żądania oraz umożliwia złożenie wyjaśnień. Podpisanie protokołu potwierdza zapoznanie się z jego treścią, o ile wyraźnie nie uzgodniono inaczej; odmowę podpisu odnotowuje się w protokole.",
      "Roszczenia dotyczące mienia Obiektu są zgłaszane przez uprawniony podmiot albo osobę legitymującą się stosownym umocowaniem. Kadra nie może bez umocowania uznać w cudzym imieniu długu lub zobowiązać do zapłaty.",
      "Jeżeli mimo podjętych czynności nie ustalono osoby odpowiedzialnej za szkodę, Kadra dokumentuje stwierdzony stan, okoliczności ujawnienia szkody oraz zebrane informacje i przekazuje je uprawnionemu podmiotowi. Brak ustalenia sprawcy nie stanowi samodzielnej podstawy żądania zapłaty od wszystkich osób zakwaterowanych w danym pokoju. Roszczenie może być kierowane do osoby lub osób, których odpowiedzialność wynika z ustalonych okoliczności i właściwych przepisów prawa.",
      "Ustalenia Kadry dotyczące przebiegu zdarzenia mają charakter dokumentacyjny i nie stanowią samodzielnego rozstrzygnięcia o odpowiedzialności cywilnej Uczestnika. Dokumentację przekazuje się osobie uprawnionej do dochodzenia roszczenia, z zachowaniem zasad ochrony danych osobowych.",
    ],
  },
  {
    numer: 14,
    tytul: "Rzeczy osobiste i odpowiedzialność innych podmiotów",
    ustepy: [
      "Kadra Organizacyjna nie prowadzi depozytu rzeczy osobistych ani nie przyjmuje ich na przechowanie, chyba że konkretna rzecz została przez nią wyraźnie przyjęta na uzgodnionych warunkach. Samo wniesienie rzeczy do Obiektu albo poinformowanie Kadry o miejscu jej pozostawienia nie oznacza przyjęcia tej rzeczy na przechowanie przez Kadrę.",
      "Uczestnik powinien niezwłocznie zgłosić zaginięcie albo uszkodzenie rzeczy Obiektowi oraz Kadrze, podając okoliczności i dostępne dowody. Kadra udziela informacji potrzebnych do skierowania zgłoszenia do właściwego podmiotu.",
      "Postanowienia Regulaminu nie wyłączają odpowiedzialności Obiektu, przewoźnika, Organizatora ani innych osób, gdy odpowiedzialność ta wynika z przepisów prawa lub zawartych przez te podmioty umów.",
      "Nikt nie jest zobowiązany do zrzeczenia się roszczeń dotyczących uszkodzenia ciała, rozstroju zdrowia albo szkody w mieniu jako warunku udziału w Wydarzeniu.",
    ],
  },
  {
    numer: 15,
    tytul: "Środki porządkowe",
    ustepy: [
      "W razie naruszenia Regulaminu Kadra może zastosować środek odpowiedni do rodzaju naruszenia i stopnia zagrożenia: zwrócenie uwagi, pisemne upomnienie, odsunięcie od wskazanej aktywności lub wykluczenie z dalszego udziału w Wydarzeniu.",
      "Przed zastosowaniem środka, o ile sytuacja pozwala, Uczestnikowi umożliwia się przedstawienie stanowiska. Przy doborze środka bierze się pod uwagę przebieg zdarzenia, jego skutki, stopień winy, wcześniejsze naruszenia i możliwość przywrócenia bezpieczeństwa.",
      "Wykluczenie może nastąpić w szczególności w razie przemocy, poważnego zagrożenia dla osób, uporczywego naruszania zasad po upomnieniu lub rażącego naruszenia regulaminu Obiektu. Decyzję podejmuje Koordynator po konsultacji z co najmniej jedną inną osobą Kadry, chyba że niezwłoczne działanie jest konieczne.",
      "Decyzję i jej przyczyny dokumentuje się zwięźle, bez gromadzenia danych nadmiarowych. Uczestnik otrzymuje informację o decyzji oraz może zgłosić zastrzeżenia na adres podany w § 20.",
      "W razie wykluczenia Kadra ustala bezpieczny sposób zakończenia udziału, uwzględniając stan Uczestnika, porę dnia i dostępne środki transportu. Jeżeli jest potrzebna pomoc medyczna albo interwencja służb, wzywa się właściwe podmioty. Wykluczenie nie powoduje automatycznego zrzeczenia się roszczeń przez którąkolwiek stronę.",
      "Ustalenia dotyczące sposobu zakończenia udziału, w tym informacje o zaoferowanej pomocy, odmowie jej przyjęcia oraz zawiadomieniu służb, odnotowuje się zgodnie z § 16, jeżeli mają znaczenie dla bezpieczeństwa osoby wykluczonej.",
    ],
  },
  {
    numer: 16,
    tytul: "Dokumentowanie incydentów i poufność",
    ustepy: [
      "Kadra sporządza bez zbędnej zwłoki zapis istotnego incydentu, wskazując możliwie dokładnie czas otrzymania zgłoszenia, miejsce zdarzenia, zaobserwowane fakty, podjęte działania i ich godziny, osoby powiadomione oraz źródło informacji. Obserwacje własne odróżnia się od relacji innych osób. Późniejsze uzupełnienie zapisu oznacza się datą jego dokonania.",
      "Dokumentację fotograficzną, nagrania i relacje świadków zbiera się jedynie w zakresie potrzebnym do wyjaśnienia zdarzenia, ochrony osób lub dochodzenia praw. Nie rozpowszechnia się jej w grupach towarzyskich ani publicznych kanałach.",
      "Dostęp do dokumentacji mają wyłącznie osoby, którym jest niezbędny do wykonania określonych czynności. Dalsze udostępnienie następuje na właściwej podstawie prawnej.",
      "Dokumentowanie przez Kadrę nie ogranicza prawa Uczestnika do zgłoszenia sprawy bezpośrednio Obiektowi, odpowiedniej jednostce UEW, Policji, służbom medycznym albo innemu uprawnionemu organowi.",
    ],
  },
  {
    numer: 17,
    tytul: "Rezygnacja i wcześniejsze zakończenie udziału",
    ustepy: [
      "Uczestnik może zrezygnować z udziału przed rozpoczęciem Wydarzenia albo zakończyć go w jego trakcie, składając informację na adres dawid.rutkowski@samorzad.ue.wroc.pl lub bezpośrednio Kadrze.",
      "W razie wcześniejszego wyjazdu Uczestnik, jeżeli jest to możliwe, powiadamia Kadrę o opuszczeniu Obiektu. Kadra aktualizuje listę obecności i niezwłocznie przekazuje Obiektowi informacje konieczne do prawidłowego zakwaterowania.",
      "Skutki finansowe rezygnacji lub odwołania określają odrębnie przekazane warunki płatności oraz obowiązujące przepisy prawa. Niniejszy paragraf nie ustanawia bezzwrotnych opłat ani automatycznej utraty świadczeń.",
    ],
  },
  {
    numer: 18,
    tytul: "Wizerunek i dane osobowe",
    ustepy: [
      "Podczas Wydarzenia mogą być wykonywane zdjęcia i nagrania dokumentujące jego przebieg. Rozpowszechnianie rozpoznawalnego wizerunku Uczestnika wymaga odpowiedniej podstawy prawnej, w szczególności odrębnego zezwolenia, chyba że zastosowanie ma ustawowy wyjątek.",
      "Zezwolenie na rozpowszechnianie wizerunku jest odrębne, dobrowolne i nie stanowi warunku udziału. Uczestnik może zgłosić Kadrze, że nie życzy sobie fotografowania z bliska; Kadra przekazuje tę informację osobom dokumentującym Wydarzenie.",
      "Przed pozyskaniem danych Uczestnik otrzymuje odrębną informację wskazującą rzeczywistego administratora albo administratorów danych, cele i podstawy przetwarzania, zakres odbiorców, okres przechowywania oraz przysługujące mu prawa. Informacja uwzględnia sposób przekazywania danych Obiektowi i osobom prowadzącym Wydarzenie.",
      "Informacje o zdrowiu, szczególnych potrzebach żywieniowych i osobie do kontaktu alarmowego są zbierane wyłącznie w zakresie niezbędnym do wskazanego celu, zgodnie z przekazaną informacją i właściwą podstawą przetwarzania.",
      "Akceptacja Regulaminu nie jest równoznaczna z wyrażeniem zgody na przetwarzanie wszystkich danych osobowych ani na rozpowszechnianie wizerunku.",
    ],
  },
  {
    numer: 19,
    tytul: "Aplikacja JWK26 i treści Uczestników",
    ustepy: [
      "Do zapisów, przekazywania informacji organizacyjnych oraz zabaw integracyjnych w czasie Wydarzenia służy Aplikacja JWK26, do której Uczestnik loguje się kontem wskazanym w zgłoszeniu. Korzystanie z funkcji rozrywkowych Aplikacji (bingo, gra terenowa, zawody, gry, nominacje, sklepik drużynowy) jest dobrowolne.",
      "Punkty zdobywane w Aplikacji służą wyłącznie zabawie integracyjnej. Nie mają wartości pieniężnej, nie można ich kupić, sprzedać, przenieść poza Aplikację ani wymienić na pieniądze. Świadczenia dostępne za punkty w sklepiku drużynowym są elementem programu przygotowanym przez Organizatora i mogą zostać zmienione lub wycofane.",
      "Treści zamieszczane przez Uczestników w Aplikacji - w szczególności zdjęcia, podpisy, komentarze, nominacje i ich uzasadnienia - nie mogą naruszać prawa, Regulaminu ani dóbr osobistych, godności i prywatności innych osób. Zakazane są treści obraźliwe, dyskryminujące, o charakterze seksualnym, przedstawiające sytuacje intymne, interwencje medyczne lub osoby w sposób je ośmieszający, a także zdjęcia osób, które zgłosiły, że nie życzą sobie fotografowania.",
      "Zamieszczając zdjęcie, Uczestnik potwierdza, że osoby na nim rozpoznawalne nie sprzeciwiają się jego pokazaniu pozostałym Uczestnikom w Aplikacji. Treści Uczestników są widoczne wyłącznie dla zalogowanych Uczestników i Kadry i nie są publikowane poza Aplikacją bez odrębnej podstawy prawnej.",
      "Kadra moderuje treści w Aplikacji i może ukryć lub usunąć treść naruszającą Regulamin, także bez uprzedzenia. Osoba, której dotyczy treść, może zażądać jej usunięcia, zgłaszając to Kadrze lub na adres podany w § 20; zgłoszenie rozpatruje się niezwłocznie.",
      "Nominacje w zabawach Aplikacji, wraz z uzasadnieniami i zdjęciami, są anonimowe wobec innych Uczestników, ale nie wobec Kadry, która może ustalić autora treści naruszającej Regulamin wyłącznie w celu zastosowania § 15.",
      "Zasady przetwarzania danych osobowych w Aplikacji opisuje Polityka prywatności dostępna w Aplikacji.",
    ],
  },
  {
    numer: 20,
    tytul: "Zgłoszenia, uwagi i skargi",
    ustepy: [
      "Uczestnik może zgłosić bieżący problem członkowi Kadry, a po zakończeniu Wydarzenia przesłać skargę lub uwagę na adres dawid.rutkowski@samorzad.ue.wroc.pl w sposób umożliwiający identyfikację sprawy.",
      "Zgłoszenie powinno możliwie dokładnie określać zdarzenie, datę, osoby, których dotyczy, oraz oczekiwane działanie. Brak części tych informacji nie wyklucza przyjęcia zgłoszenia, jeżeli jego treść pozwala na podjęcie czynności.",
      "Organizator potwierdza przyjęcie skargi i udziela odpowiedzi w terminie 14 dni od otrzymania, a gdy wyjaśnienie wymaga dłuższego czasu, informuje o przyczynie i przewidywanym terminie odpowiedzi.",
      "Właściwy adresat roszczenia zależy od charakteru zdarzenia i rzeczywistych zobowiązań. Przekazanie skargi Kadrze nie odbiera Uczestnikowi prawa do skierowania jej bezpośrednio do Obiektu lub innego odpowiedzialnego podmiotu.",
    ],
  },
  {
    numer: 21,
    tytul: "Odwołanie i zmiana Wydarzenia",
    ustepy: [
      "Jeżeli realizacja programu staje się niemożliwa albo stwarza poważne zagrożenie, Kadra wstrzymuje jego realizację i niezwłocznie informuje Uczestników o dalszym postępowaniu. Decyzje dotyczące umów zawartych z usługodawcami podejmują strony tych umów albo osoby należycie umocowane.",
      "W razie istotnej zmiany terminu, miejsca lub zasad uczestnictwa po potwierdzeniu udziału Uczestnik otrzymuje jasną informację i możliwość podjęcia decyzji co do dalszego udziału, z zachowaniem uprawnień wynikających z prawa i odrębnych warunków dotyczących świadczeń.",
      "Organizator nie odpowiada za niezależne od niego zdarzenia w zakresie, w jakim zgodnie z prawem wyłączają one odpowiedzialność. Samo powołanie się na okoliczności nadzwyczajne nie wyłącza obowiązków, które w danej sytuacji wynikają z przepisów.",
    ],
  },
  {
    numer: 22,
    tytul: "Zmiana Regulaminu i postanowienia końcowe",
    ustepy: [
      "Regulamin udostępnia się przed zgłoszeniem w formie umożliwiającej zapisanie i odtworzenie jego treści. Wersję zaakceptowaną przez Uczestnika oraz datę akceptacji utrwala się w dokumentacji zgłoszenia.",
      "Zmiana Regulaminu po potwierdzeniu udziału nie może bez zgody Uczestnika nakładać na niego istotnie nowych obowiązków ani pozbawiać go praw już nabytych. O zmianie informuje się indywidualnie w formie dokumentowej.",
      "W sprawach nieuregulowanych stosuje się właściwe przepisy prawa oraz mające zastosowanie zasady Obiektu. Postanowień Regulaminu nie interpretuje się jako wyłączenia bezwzględnie obowiązujących praw Uczestnika.",
      "Regulamin wchodzi w życie z dniem 12.10.2026 r. i jest stosowany do JWK26 po udostępnieniu go Uczestnikom. Kontakt Organizatora: dawid.rutkowski@samorzad.ue.wroc.pl, +48 608 008 363.",
    ],
  },
];

/** § 1 ust. 3 przed odsłoną ośrodka (spec landingu, sekcja 1). */
const USTEP_MIEJSCA_ZAKRYTY =
  "Wydarzenie odbywa się od dnia 23 października 2026 r. do dnia 25 października 2026 r. w ośrodku wypoczynkowym, którego nazwę i adres Organizator ogłosi przed rozpoczęciem zapisów, a także w innych miejscach, w których jest realizowany ogłoszony program.";

/**
 * Regulamin do pokazania. Przed odsłoną ośrodka § 1 ust. 3 nie podaje
 * miejsca. Wersja zgód się nie zmienia: odsłona zapisów odsłania też ośrodek,
 * więc każdy, kto akceptuje regulamin, widzi go w pełnym brzmieniu.
 */
export function regulaminDoWyswietlenia(osrodekOdsloniety: boolean): Paragraf[] {
  if (osrodekOdsloniety) return REGULAMIN;
  return REGULAMIN.map((p) =>
    p.numer === 1 ? { ...p, ustepy: p.ustepy.map((u, i) => (i === 2 ? USTEP_MIEJSCA_ZAKRYTY : u)) } : p,
  );
}
