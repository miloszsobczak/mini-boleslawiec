# PRD: Bolec — eksplorowalna makieta Bolesławca i powiatu bolesławieckiego

Wersja 0.5 · 2026-11-21 · status: szkic do akceptacji

## 1. Wizja

Przeglądarkowa, stylizowana makieta 3D powiatu bolesławieckiego zbudowana z otwartych danych geodezyjnych, w której Bolesławiec jest odwzorowany budynek po budynku. Gracz płynnie przechodzi od widoku całego powiatu do pojedynczej kamienicy na Rynku, a szczegółowość geometrii rośnie razem z przybliżeniem. Pierwsza wersja to wyłącznie eksploracja: bez NPC, ruchu ulicznego i zadań.

## 2. Decyzje podjęte

| Obszar | Decyzja |
|---|---|
| Platforma | Przeglądarka, desktop i telefon od pierwszej wersji |
| Kamera w MVP | Widok makiety (orbita, przesuwanie, zoom) |
| Architektura kamery | Wymienne tryby; tryb pieszy i inne dochodzą później bez przebudowy świata |
| Obszar wysokiego detalu | Całe miasto Bolesławiec (ok. 24 km²) |
| Reszta powiatu | Teren i zgrubna zabudowa jako tło (ok. 1300 km², 6 gmin) |
| Styl | Stylizowane low-poly: płaskie kolory, widoczne fasetki, bez tekstur fotograficznych |
| Życie w mieście | Poza zakresem na start |
| Sposób tworzenia świata | 100% automatycznie; właściciel projektu niczego nie modeluje |
| Poprawki | Właściciel klika obiekt, kopiuje jego identyfikator i opisuje słowami modelowi LLM, co zmienić; zmianę wprowadza LLM |
| Skala terenu | Prawdziwa 1:1, bez przewyższenia |
| Oświetlenie | Stała pora dnia w MVP; regulacja słońca i światła po MVP |
| Hosting | Lokalnie na czas budowy; wybór hostingu odłożony |
| Otwartość | W pełni otwarty: publiczna strona i otwarte repozytorium |
| Dodatki do eksploracji | Brak w MVP (bez karty obiektu, odkrywania miejsc, trybu zdjęć, wyszukiwarki) |

## 3. Cele i nie-cele

**Cele MVP**
- Rozpoznawalny Bolesławiec: Rynek z ratuszem, układ Starego Miasta, wiadukt kolejowy nad Bobrem, Bóbr, główne osiedla.
- Ciągła zmiana szczegółowości przy zoomie, bez widocznego „przeskakiwania” i bez ekranów ładowania.
- Kamera, którą przyjemnie się steruje: bezwładność, zoom do kursora, brak przenikania przez teren.
- Świat powstaje w 100% automatycznie z danych; każdy obiekt ma klikalny identyfikator, po którym model LLM wprowadza poprawki według wytycznych słownych.
- Cały świat odtwarzalny jednym poleceniem z danych źródłowych.

**Nie-cele MVP**
- NPC, pojazdy, cykl życia miasta, zadania, multiplayer.
- Wnętrza budynków.
- Fotorealizm i tekstury z ortofotomapy.
- Regulowana pora dnia, noc, cykl dobowy.
- Karta obiektu, odkrywanie miejsc, tryb zdjęć, wyszukiwarka z dolotem.
- Publiczny hosting.

## 4. Materiały źródłowe

Wszystkie pozycje wymagają potwierdzenia aktualnych adresów pobierania i warunków w fazie 0; listę spisałem z wiedzy, bez sprawdzania online w tej sesji.

### 4.1 Dane państwowe (GUGiK, geoportal.gov.pl)

Od nowelizacji Prawa geodezyjnego i kartograficznego z 2020 r. poniższe zbiory są bezpłatne i można je wykorzystywać w dowolnym celu.

| Zbiór | Co daje | Zastosowanie |
|---|---|---|
| NMT (numeryczny model terenu), siatka 1 m z LiDAR | Rzeźba terenu bez budynków i drzew | Siatka terenu wszystkich poziomów |
| NMPT (model pokrycia terenu) | Wysokość z budynkami i roślinnością | Wysokość lasów i drzew, kontrola wysokości budynków |
| Chmury punktów LiDAR (LAZ) | Surowe pomiary z klasyfikacją | Rozmieszczenie pojedynczych drzew, wzorzec do modeli ręcznych |
| Modele 3D budynków LOD1 i LOD2 (CityGML, paczki per powiat) | Bryły z prawdziwymi kształtami dachów | Podstawa zabudowy miasta |
| BDOT10k (paczki per powiat, TERYT 0201) | Drogi, koleje, wody, lasy, użytkowanie terenu, mosty, obrysy budynków z funkcją | Pokrycie terenu, sieć dróg, klasyfikacja budynków |
| Ortofotomapa | Zdjęcia lotnicze | Wyłącznie wzorzec kolorów i kontrola jakości |
| PRG | Granice powiatu i gmin | Przycięcie świata, obrys makiety |

Układ współrzędnych: PL-1992 (EPSG:2180), wysokości PL-EVRF2007-NH.

### 4.2 Dane społecznościowe i uzupełniające

- **OpenStreetMap** (licencja ODbL, wymaga atrybucji): nazwy ulic i miejsc, punkty zainteresowania, liczba kondygnacji, typy dachów, ścieżki, pojedyncze drzewa. Pobranie: wyciąg Geofabrik dla dolnośląskiego albo Overpass.
- **Bank Danych o Lasach**: gatunki i wiek drzewostanów (Bory Dolnośląskie) do różnicowania lasu iglastego i liściastego.
- **Mapillary / Panoramax**: zdjęcia uliczne na otwartych licencjach, jako wzorzec do modeli ręcznych.

### 4.3 Narzędzia

- Przetwarzanie: GDAL, PDAL, QGIS, Python (geopandas, rasterio), cjio / citygml-tools (CityGML → CityJSON).
- Siatki terenu: algorytmy RTIN/Delatin (biblioteki martini, delatin).
- Upraszczanie i kompresja: meshoptimizer / gltfpack.
- Modele ręczne: Blender, format glTF.
- Aplikacja: TypeScript, Vite, three.js, 3DTilesRendererJS (standard OGC 3D Tiles), three-mesh-bvh do zapytań o kolizje.

## 5. Street View i zdjęcia jako źródło modeli

- **Decyzja**: zdjęciami, w tym Street View, wolno się inspirować. Modelarz ogląda zdjęcie, żeby zrozumieć wygląd budynku (liczba okien, kształt dachu, kolor), i modeluje ręcznie na obrysie z danych GUGiK. Wygląd budynku stojącego przy ulicy jest faktem, a nie własnością autora zdjęcia.
- **Granica**: żadne piksele ani geometria ze zdjęć Google nie trafiają do projektu. Poza zakresem są: fotogrametria ze Street View, rzutowanie zdjęć jako tekstur, masowe pobieranie panoram, podawanie zrzutów do generatorów 3D oraz dane 3D z Google Earth. To ograniczenie wynika z regulaminu Google (umowa), a nie z prawa autorskiego, więc argument „tak uczą się modele językowe” go nie znosi. Nie jestem prawnikiem; przy otwartym repozytorium tej granicy warto się trzymać.
- **Rejestr podmian** zapisuje dla każdego modelu ręcznego, z jakich źródeł korzystano, żeby pochodzenie było jawne.
- **Bezpieczne źródła**: własne zdjęcia (fotogrametria albo wzorzec do modelowania), Mapillary i Panoramax, chmury punktów LiDAR z GUGiK, ortofotomapa.
- **Konsekwencja automatyzacji**: skoro budynki powstają automatycznie, Street View nie bierze udziału w ich tworzeniu, bo automatyczne przetwarzanie tych zdjęć leży za granicą opisaną wyżej. Służy tylko Tobie do oceny, co poprawić. Automatycznie można przetwarzać własne zdjęcia oraz zdjęcia na otwartych licencjach (Mapillary, Panoramax, Wikimedia Commons), z zachowaniem ich warunków atrybucji.

## 6. Doświadczenie gracza

1. Start: widok całego powiatu jak makiety na stole, z zaznaczonym Bolesławcem.
2. Zoom do miasta: pojawiają się dzielnice, potem pojedyncze budynki z dachami, drzewa, ulice.
3. Zoom do ulicy: detale fasad, mała architektura, obiekty kluczowe w pełnej jakości.
4. Etykiety miejsc (ulice, obiekty, miejscowości) pojawiają się zależnie od zoomu.

**Sterowanie w trybie makiety**: przeciąganie = przesuwanie, prawy przycisk lub Alt = obrót i pochylenie, kółko = zoom do punktu pod kursorem, dwuklik = dolot do miejsca, WASD jako alternatywa. Ruch z bezwładnością, kamera nigdy nie wchodzi pod teren.

**Sterowanie dotykiem**: jeden palec = przesuwanie, szczypanie = zoom do punktu między palcami, obrót dwoma palcami = obrót, przesunięcie dwoma palcami w pionie = pochylenie, dwukrotne stuknięcie = dolot. Interfejs działa w pionie i w poziomie.

## 7. Wymagania funkcjonalne

### 7.1 Zmienny poziom szczegółowości

Zasada: każdy kafel świata ma zapisany błąd geometryczny w metrach; kafel jest zastępowany dokładniejszym, gdy jego błąd na ekranie przekracza próg w pikselach. To daje liczbę wielokątów proporcjonalną do zoomu i jeden suwak jakości.

| Poziom | Odległość kamery (orientacyjnie) | Teren | Budynki | Roślinność |
|---|---|---|---|---|
| L0 powiat | > 10 km | Siatka z błędem ok. 20 m | Plamy zabudowy jako niskie bloki | Las jako wypiętrzona płaszczyzna |
| L1 miasto | 2–10 km | Błąd ok. 5 m | Bryły scalone per kafel (LOD1) | Kępy lasu |
| L2 dzielnica | 300 m – 2 km | Błąd ok. 1 m | Bryły z dachami (LOD2) | Pojedyncze drzewa, 2–3 warianty |
| L3 ulica | < 300 m | Błąd ok. 0,3 m, krawężniki | LOD2 + proceduralne okna, gzymsy, kominy; modele ręczne | Drzewa w pełnym modelu, mała architektura |

- Przejścia między poziomami wygładzane (przenikanie lub morfing), bez szczelin między kaflami o różnych poziomach.
- „Nie za niskie low-poly”: z bliska budynek ma kilkaset do kilku tysięcy trójkątów, a nie sześcian.
- L2–L3 generowane tylko dla Bolesławca; reszta powiatu kończy się na L1.

### 7.2 Warstwy świata

- Teren z NMT, kolorowany według pokrycia z BDOT10k (las, łąka, pole, zabudowa, woda, piasek).
- Wody: Bóbr, Kwisa, stawy jako osobna powierzchnia z prostym shaderem.
- Drogi i koleje „wtopione” w teren, z szerokością według klasy; mosty i wiadukty jako osobne obiekty.
- Budynki z modeli 3D GUGiK, kolor ścian i dachów z palety zależnej od funkcji i wieku zabudowy.
- Roślinność rozmieszczana z NMPT i chmur punktów.

### 7.3 System kamer

- Wspólny interfejs trybu kamery (wejście → pozycja i orientacja) oraz płynne przejścia między trybami.
- MVP dostarcza tryb makiety. Tryb pieszy i dron to kolejne implementacje tego samego interfejsu.
- Warunek umożliwiający tryb pieszy później: od początku dostępne zapytanie o wysokość terenu w punkcie oraz siatki kolizyjne budynków dla kafli L3.

### 7.4 Automatyczne generowanie i poprawki

Zasada: pipeline tworzy każdy obiekt sam, bez wyjątków. Właściciel projektu nie modeluje i nie edytuje parametrów; jego rola to wskazać obiekt i opisać słowami, jak ma wyglądać. Zmianę wprowadza model LLM (Claude Code pracujący w repozytorium).

**Generator budynków (automat)**
- Bryła i dach z modelu LOD2 GUGiK; gdy model jest wadliwy, bryła z obrysu BDOT10k i wysokości z NMPT, a kształt dachu dopasowany do chmury punktów LiDAR.
- Fasady proceduralne: liczba kondygnacji z wysokości i danych OSM, siatka okien, drzwi, gzymsy i kominy według reguł dla typu zabudowy (kamienica, blok, dom jednorodzinny, hala, kościół), który wynika z funkcji w BDOT10k, kształtu obrysu i położenia.
- Kolory z palety według typu i dzielnicy, z kontrolowaną losowością, żeby ulica nie była jednolita; wynik jest deterministyczny (to samo ziarno losowe daje ten sam budynek).
- Obiekty szczególne (wieże, kościoły, wiadukt, mury obronne) rekonstruowane z gęstej chmury punktów LiDAR i upraszczane do stylu, bez modelowania ręcznego.
- Opcjonalnie: automatyczne odczytanie koloru elewacji i układu okien ze zdjęć na otwartych licencjach lub własnych.

**Identyfikatory**
- Każdy obiekt świata (budynek, most, odcinek drogi, zbiornik wodny, płat lasu) ma unikalny, stabilny identyfikator, który nie zmienia się między przebudowami. Format: krótki i czytelny, np. `bud-0201-004217`, z odwzorowaniem na identyfikatory źródłowe GUGiK i OSM w indeksie.
- Identyfikator jest zachowany na wszystkich poziomach szczegółowości, także gdy budynki są scalone w jeden kafel (zapis per wierzchołek lub per fragment siatki), żeby kliknięcie działało z każdej odległości, z której obiekt jest widoczny osobno.

**Inspektor w aplikacji**
- Kliknięcie (lub stuknięcie) obiektu podświetla go i otwiera panel z identyfikatorem, adresem, typem zabudowy i aktualnymi parametrami generatora.
- Przycisk „Kopiuj identyfikator” oraz „Kopiuj kontekst dla LLM”: gotowy blok tekstu z identyfikatorem, adresem, współrzędnymi, parametrami i regułą, która wygenerowała obiekt.
- Przycisk „Pobierz”: plik glTF samego obiektu i zrzut widoku, do załączenia w rozmowie z LLM.
- Odnośnik w adresie strony do wybranego obiektu (`?obj=bud-0201-004217`), żeby dało się do niego wrócić.
- Inspektor niczego nie edytuje; służy do wskazania obiektu.

**Pętla poprawek przez LLM**
1. Właściciel klika obiekt, kopiuje identyfikator i pisze do LLM, co zmienić (np. „bud-0201-004217: dach czerwony mansardowy, cztery kondygnacje, wieża zegarowa od frontu”), opcjonalnie z własnym zdjęciem.
2. LLM wybiera najlżejszy wystarczający poziom zmiany:
   - **parametry obiektu** w `overrides/tweaks.yaml` (kolory, typ dachu, kondygnacje, układ okien, typ zabudowy, ukrycie);
   - **reguła generatora**, gdy uwaga dotyczy całego typu lub dzielnicy („kamienice przy Rynku mają mieć podcienia”);
   - **dedykowany opis proceduralny obiektu** w `overrides/objects/<id>.py`: kod składający bryłę z elementów generatora (wieże, hełmy, ryzality, łuki), gdy parametry nie wystarczą. To nadal generowanie kodem, nie modelowanie ręczne.
3. Pipeline przebudowuje tylko dotknięte kafle; LLM robi zrzut obiektu przed i po i pokazuje go do akceptacji.
4. Każda poprawka jest zapisana w repozytorium razem z treścią wytycznej, więc przebudowa świata od zera odtwarza wszystkie poprawki.

**Wymagania wobec generatora wynikające z tej pętli**
- Słownik parametrów i elementów jest opisany w repozytorium (`pipeline/GENERATOR.md`), żeby LLM wiedział, co może zmienić.
- Przebudowa pojedynczego obiektu i zrzut jego widoku jednym poleceniem, w czasie poniżej minuty.
- Import zewnętrznych modeli glTF pozostaje technicznie możliwy, ale nie jest częścią planowanego procesu.

**Ocena jakości**
- 100% obiektów powstaje bez modelowania ręcznego.
- Miarą jakości automatu jest liczba obiektów wymagających wytycznej dla LLM; obiekty kluczowe (ratusz, wiadukt kolejowy, bazylika Wniebowzięcia NMP, mury obronne, dworzec, Teatr Stary) mają być rozpoznawalne po co najwyżej kilku rundach wytycznych.

### 7.5 Pipeline danych

- Uruchamiany offline jednym poleceniem; wynik to statyczne kafle serwowane z dowolnego hostingu plików.
- Etapy: pobranie → przycięcie do granic → teren → budynki → pokrycie i drogi → roślinność → podmiany → kafle 3D Tiles + indeks.
- Deterministyczny i przyrostowy: zmiana jednego modelu przebudowuje tylko dotknięte kafle.
- Dane źródłowe poza repozytorium; w repozytorium skrypty i rejestr podmian.
- Pipeline w osobnym katalogu (`pipeline/`), niezależny od aplikacji (`app/`); łączy je tylko format kafli.
- Parametr obszaru (ramka w EPSG:2180), żeby ten sam pipeline budował pionowy plaster, miasto i powiat.
- Każde uruchomienie zapisuje czas etapów i rozmiar wyniku; każdy etap da się uruchomić osobno i ręcznie obejrzeć jego wynik w QGIS.

## 8. Wymagania niefunkcjonalne

- 60 kl./s na laptopie ze zintegrowaną grafiką (klasa Apple M1 / Intel Iris Xe) w 1080p.
- Pierwszy widok powiatu w ciągu 5 s na łączu 20 Mb/s; dalsze kafle dociągane w tle.
- Budżet sceny na desktopie: do ok. 1,5 mln trójkątów i 300 wywołań rysowania jednocześnie, pamięć karty graficznej do 1 GB.
- Telefon: co najmniej 30 kl./s na urządzeniu średniej klasy sprzed 3–4 lat, budżet ok. 400 tys. trójkątów i 150 wywołań rysowania, pamięć do 300 MB. Osiągane tym samym zestawem kafli przez wyższy próg błędu ekranowego, niższą rozdzielczość renderowania i uproszczone cienie.
- Profil jakości dobierany automatycznie przy starcie, z możliwością ręcznej zmiany.
- Stałe oświetlenie pozwala zapiec zacienienie w kaflach; nie robić tego w sposób, który zablokuje późniejszą regulację słońca (zapiekać tylko zacienienie otoczenia, cień słońca liczyć na żywo).
- Repozytorium otwarte: licencja kodu i licencja modeli ręcznych do wyboru przed pierwszą publikacją; dane źródłowe nie trafiają do repozytorium.
- Widoczna atrybucja: GUGiK, © autorzy OpenStreetMap.

## 9. Architektura (zarys)

- **Pipeline** (Python + GDAL/PDAL): surowe dane → kafle glTF w strukturze 3D Tiles.
- **Aplikacja** (TypeScript + three.js): strumieniowanie kafli, system kamer, etykiety, oświetlenie.
- **Układ współrzędnych sceny**: metry, początek w Rynku, oś Y w górę; przy rozpiętości ok. 50 km precyzja 32-bitowa wystarcza, o ile wierzchołki są zapisane względem środka kafla.
- **Renderowanie**: start na WebGL2; przejście na WebGPU do oceny w fazie 0.

## 10. Etapy

| Faza | Zakres | Kryterium ukończenia |
|---|---|---|
| 0. Walidacja danych | Pobranie realnych paczek dla powiatu (NMT, NMPT, LOD1/LOD2, BDOT10k, OSM), potwierdzenie licencji, pomiar jakości budynków LOD2 w Bolesławcu | Raport z liczbami: ile budynków ma poprawny model LOD2, ile wymaga zapasowego wyciągnięcia bryły, ile brakuje; rozmiary danych; decyzja „LOD2 GUGiK jako podstawa: tak/nie” |
| 1. Pionowy plaster | Jeden kwartał Starego Miasta przy Rynku plus ok. 1 km² terenu wokół, przez wszystkie poziomy L0–L3: teren, budynki, próbka stylu, kamera makiety (mysz i dotyk), stabilne identyfikatory i inspektor z kopiowaniem, pipeline dla tego wycinka | Płynny zoom bez przeskoków na realnych danych; styl zaakceptowany; budżety z sekcji 8 spełnione na desktopie i na telefonie referencyjnym |
| 2. Teren powiatu | Rozszerzenie kafli terenu na cały powiat, przejście miasto ↔ powiat | Płynny zoom powiat → ulica; zmierzony czas pełnej przebudowy |
| 3. Budynki | LOD1/LOD2 dla całego miasta, bloki dla powiatu, zapasowe bryły tam, gdzie LOD2 zawodzi | Całe miasto zabudowane bez dziur |
| 4. Pokrycie | Wody, drogi, koleje, lasy, drzewa, kolory | Makieta kompletna z daleka |
| 5. Detal i dopracowanie | Detale L3 najpierw dla Starego Miasta, potem reszta miasta po pomiarze rozmiaru i wydajności; światło, cienie, etykiety | Spełnione wymagania z sekcji 8 dla całego miasta |
| 6. Poprawki przez LLM | Plik poprawek, opisy proceduralne obiektów, rekonstrukcja obiektów szczególnych z LiDAR, przebudowa i zrzut pojedynczego obiektu | Ratusz i wiadukt rozpoznawalne wyłącznie dzięki wytycznym słownym; od wytycznej do zrzutu „po” mija poniżej kilku minut |
| 7. Tryb pieszy (po MVP) | Kolizje, kamera 1. osoby | Spacer z Rynku na wiadukt |

MVP = fazy 0–6.

**Zasady przekrojowe**
- Nie rozszerzamy obszaru, dopóki pionowy plaster nie spełnia kryteriów fazy 1.
- Każda faza kończy się testem na realnym telefonie i pomiarem czasu przebudowy pipeline’u.
- Próbki zawsze na realnych danych GUGiK, nigdy na sztucznych.
- Bramka w fazie 5: jeśli L3 dla całego miasta nie mieści się w budżetach, L3 zostaje na Starym Mieście i obiektach kluczowych, a reszta miasta na L2. Decyzja na podstawie pomiaru, nie z góry.

### 10.1 Stylizacja

Uproszczenie siatek nie daje samo wyglądu makiety, dlatego stylizacja jest osobnym etapem pipeline’u:
- kolory wyłącznie z ograniczonej palety (ściany, dachy, teren, zieleń, woda) przypisywane według funkcji i wieku zabudowy;
- porządkowanie brył: prostowanie prawie-prostych kątów, scalanie drobnych połaci dachów, usuwanie detali poniżej progu wielkości;
- lekkie fazowanie krawędzi i przesadzone kominy, lukarny, wieże, żeby sylwetki były czytelne z daleka;
- płaskie cieniowanie z zacienieniem otoczenia.

Próbka stylu powstaje w fazie 1 na kwartale Starego Miasta i jest akceptowana, zanim pipeline przetworzy resztę miasta.

## 11. Ryzyka

| Ryzyko | Skutek | Ograniczenie |
|---|---|---|
| Modele LOD2 GUGiK mają błędy lub braki w części miasta | Dziury w zabudowie | Zapas: wyciągnięcie brył z obrysów BDOT10k i wysokości z NMPT |
| Szczeliny i „przeskoki” między poziomami | Psuje wrażenie makiety | Fartuchy na krawędziach kafli, przenikanie poziomów |
| Styl wygląda jak surowe dane GIS, nie jak gra | Brak uroku | Wczesna próbka stylu na jednym kwartale Starego Miasta w fazie 2 |
| Rozmiar danych miasta w L3 | Długie ładowanie | Kompresja meshopt, instancjonowanie drzew i detali fasad |
| Automat nie odda charakteru obiektów kluczowych (ratusz, bazylika) | Najbardziej rozpoznawalne miejsca wyglądają generycznie | Rekonstrukcja z chmury punktów LiDAR i opis proceduralny pisany przez LLM; ocena w fazie 1 na ratuszu |
| LLM słabo ocenia wygląd bryły 3D i potrzebuje wielu rund | Poprawki obiektów złożonych są wolne | Zrzuty przed/po z kilku stron w pętli, bogaty słownik gotowych elementów, własne zdjęcia jako wzorzec |
| Identyfikatory zmieniają się po aktualizacji danych źródłowych | Poprawki trafiają w zły obiekt | Własny identyfikator przypisany raz i dopasowywany po położeniu i obrysie przy aktualizacji danych |
| Proceduralne fasady są powtarzalne | Miasto wygląda sztucznie | Reguły per typ zabudowy i dzielnica, kontrolowana losowość, próbka w fazie 1 |
| Telefon od pierwszej wersji ogranicza detal z bliska | Uboższy poziom ulicy na telefonie | Profile jakości na wspólnych kaflach; test na telefonie w każdej fazie, nie na końcu |
| Tryb pieszy obnaża niedokładności przy ziemi | Koszt fazy 6 | Wymagania kolizji i wysokości terenu wpisane już w MVP |

## 12. Pytania otwarte

1. Licencja kodu (np. MIT) i modeli ręcznych (np. CC BY) — do wyboru przed pierwszą publikacją.
2. Hosting — do wyboru, gdy będzie co pokazać.
3. Na jakich konkretnie telefonach testujemy (model referencyjny dla budżetu wydajności)?
