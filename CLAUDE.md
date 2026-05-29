# MindFlow UI — CLAUDE.md

Ten plik ma działać jak szybki handbook dla LLM i developera. Czytaj go przed większą zmianą. Traktuj go jak połączenie:

- architektonicznej mapy repo,
- operacyjnego playbooka do rozwijania feature'ów,
- guardrailów jakościowych, żeby nie dokładać długu.

Jeśli kod i ten dokument są w konflikcie: ufaj kodowi, ale przy większej rozbieżności zaktualizuj też ten plik.

---

## 1. Stack i runtime

- Frontend: React 19 + TypeScript + Vite
- Styling: Tailwind v4
- API: `https://mindflow-api-0506.onrender.com`
- Realtime tasków: SignalR
- Stan:
  - server state głównie przez lokalne hooki feature’ów
  - UI state lokalnie w komponentach i w `AppShell`
- Design Book: `?design`

Podstawowe komendy:

```bash
npm install
npm run dev
npm run build
npm run lint
```

---

## 2. Szybki model aplikacji

To nie jest duży framework-driven app z rozbudowanym global state. To modularny frontend z jednym głównym shellem i feature’ami podzielonymi domenowo.

Najważniejszy przepływ:

1. `src/main.tsx` montuje `App`.
2. `src/App.tsx` przełącza np. `?design`.
3. Standardowa aplikacja wchodzi do `src/app/AppShell.tsx`.
4. `AppShell` spina layout, auth, spaces, projects, notes i główne widoki tasków.
5. Feature’y dostarczają własne API, hooki modelu i UI.

W praktyce:

- `AppShell` jest dziś kompozytorem aplikacji.
- `ProjectView` to osobny full-page view dla pojedynczego projektu.
- `features/tasks` jest najbardziej rozwiniętym feature’em i wzorcem dla kolejnych.

---

## 3. Aktualna architektura repo

### Główne katalogi

```text
src/
  app/           shell aplikacji i główna orkiestracja
  assets/        assety statyczne
  components/    współdzielone komponenty domenowo-neutralne (obecnie mało używane)
  features/      feature'y domenowe
  shared/        typy, klient API, wspólne UI primitives
  views/         pełne widoki / ekrany złożone z feature'ów
```

### Warstwy i odpowiedzialność

#### `src/app/`

Tu trafia shell aplikacji i logika spinająca kilka feature’ów naraz.

Umieszczaj tutaj:

- layout całej aplikacji,
- routing warunkowy / tryby aplikacji,
- stan przekrojowy kilku feature’ów,
- orkiestrację widoków.

Nie wrzucaj tutaj:

- szczegółów pojedynczego feature’a,
- komponentów, które należą do konkretnej domeny.

#### `src/views/`

Tu trafiają pełne widoki/ekrany.

Przykłady:

- `ProjectView.tsx`
- `DesignBook.tsx`

Widok może:

- pobierać dane z hooków feature’a,
- sklejać kilka komponentów z `features/.../ui`,
- utrzymywać lokalny stan widoku.

Widok nie powinien:

- implementować surowych wywołań HTTP,
- duplikować modelu feature’a.

#### `src/features/<feature>/`

To podstawowa jednostka skalowania aplikacji.

Każdy feature powinien mieć maksymalnie trzy podwarstwy:

- `api/` — wywołania backendu
- `model/` — hooki, mapery, logika danych
- `ui/` — komponenty feature’a

Aktualne feature’y:

- `auth`
- `layout`
- `notes`
- `projects`
- `spaces`
- `tasks`
- `users`

#### `src/shared/`

Tu trafiają rzeczy naprawdę współdzielone i domenowo-neutralne:

- `shared/api/client.ts`
- `shared/types/index.ts`
- `shared/ui/*`

Zasada:

- jeśli coś zna pojęcia typu `task`, `space`, `project`, najpewniej nie należy do `shared/ui`,
- jeśli coś jest ogólnym primitive’em albo adapterem, może być w `shared`.

---

## 4. Obecny podział domen

### Tasks

Najbardziej kompletna domena.

Zawiera:

- API tasków,
- mapowanie API -> UI model,
- hook globalnej listy tasków `useTasks`,
- hook tasków projektu `useProjectTasks`,
- kilka reprezentacji UI: list, grouped list, week, board, kanban, modal add/edit, quick add.

Ważne:

- `Task` w UI ma pola pochodne i frontendowe, np. `isCompleted`, `project_id`, `createdAt: Date`
- API mapujemy przez `mapApiTask`
- do zapisu używamy `toCreateTaskDto` i `toUpdateTaskDto`

Nie omijaj mapperów przy pracy z taskami.

### Projects

Project jest dziś lekkim lokalnym konceptem UI powiązanym ze space.

Ważne:

- projekt ma `space_id` w modelu UI,
- API zwraca też backendowe nazwy typu `spaceId`, które są mapowane lokalnie.

### Spaces

Spaces są pobierane z API, ale kolor przestrzeni jest obecnie rozszerzeniem frontendowym.

To ważne przy zmianach:

- backend space nie musi znać pola `color`,
- UI utrzymuje kolor lokalnie i aktualizuje go we własnym stanie.

### Notes

Notes są aktualnie lokalne w `AppShell`.

To oznacza:

- brak pełnej osobnej warstwy `api/model`,
- przy rozbudowie notesów warto wydzielić je do pełnego feature’a jak tasks.

### Auth / Users

Auth dostarcza hook stanu zalogowania i integrację logowania.
Users dostarcza aktualnego usera (`getMe`).

---

## 5. Zasady architektoniczne

### 5.1. Jedno źródło odpowiedzialności

Każda rzecz powinna mieć jedno naturalne miejsce:

- HTTP tylko w `features/*/api`
- mapowanie DTO tylko w `model`
- render i interakcje tylko w `ui` lub `views`

Nie mieszaj tych warstw w jednym pliku bez mocnego powodu.

### 5.2. Feature-first, nie file-type-first

Nie twórz nowych globalnych katalogów typu:

- `src/api`
- `src/hooks`
- `src/modals`

Repo już jest ułożone feature-first. Rozwijaj je w ten sam sposób.

### 5.3. Shared ma być naprawdę shared

Nie wrzucaj do `shared/` rzeczy tylko dlatego, że "mogą się kiedyś przydać".

Przenieś coś do `shared` dopiero gdy:

- jest używane przez co najmniej 2 miejsca,
- nie niesie konkretnej semantyki domenowej,
- ma stabilne API.

### 5.4. Nie duplikuj istniejącego UI

Przed stworzeniem nowego komponentu sprawdź:

- `CalendarDatePicker`
- `TaskEditModal`
- `TaskAddModal`
- istniejące warianty list/task board/week

Jeśli podobny komponent już istnieje, rozszerz go albo wydziel z niego primitive.

### 5.5. Stan lokalny > zbyt wczesna globalizacja

Preferuj:

- lokalny `useState` dla stanu prezentacyjnego,
- feature hook dla stanu danych domenowych,
- `AppShell` tylko dla stanu przekrojowego.

Nie dodawaj nowego global state managera bez realnej potrzeby.

---

## 6. Jak dodawać nowy feature

Docelowy wzorzec:

```text
src/features/<feature>/
  api/
  model/
  ui/
  index.ts
```

### Krok 1. Zdefiniuj domenę

Odpowiedz sobie:

- jakie encje obsługuje feature?
- czy ma backend, czy jest lokalny?
- czy potrzebuje full-page view, czy tylko sekcji/osadzenia?
- czy ma własny model danych, czy korzysta z istniejącego?

### Krok 2. Zbuduj warstwę `api/`

Dodaj tu:

- DTO request/response,
- funkcje HTTP,
- tylko transport i serializację requestów.

Nie dodawaj tu:

- logiki UI,
- mapowania pod komponenty,
- stanu Reactowego.

### Krok 3. Zbuduj warstwę `model/`

Dodaj tu:

- hooki typu `useX`,
- mapery `mapApiX`,
- funkcje normalizacji danych,
- pochodne pola potrzebne przez UI.

Zasada:

- komponenty nie powinny ręcznie domyślać pól pochodnych w kilku miejscach.

### Krok 4. Zbuduj warstwę `ui/`

Dodaj tu:

- komponenty feature’a,
- modale,
- toolbary,
- listy,
- controls specyficzne dla domeny.

Zanim zrobisz nowy komponent:

1. sprawdź, czy istnieje podobny,
2. oceń, czy lepiej rozszerzyć obecny,
3. dopiero potem twórz nowy.

### Krok 5. Dodaj `index.ts`

Eksportuj tylko public API feature’a:

- hooki,
- funkcje API jeśli naprawdę potrzebne,
- główne komponenty UI.

Nie wystawiaj każdego helpera bez potrzeby.

### Krok 6. Podepnij do `views/` lub `app/`

Jeśli to:

- pełen ekran -> `src/views/`
- fragment istniejącego flow -> feature UI + integracja w `AppShell` lub innym view

---

## 7. Jak rozwijać istniejący feature bez długu

### Preferowana kolejność pracy

1. Najpierw znajdź istniejący flow danych.
2. Potem sprawdź, gdzie jest warstwa odpowiedzialna za zmianę.
3. Zmieniaj jak najbliżej źródła odpowiedzialności.
4. Dopiero na końcu dodawaj nowe abstrakcje.

### Czerwone flagi

Jeśli robisz którąś z tych rzeczy, zatrzymaj się i uprość:

- kopiujesz ten sam JSX do drugiego pliku,
- mapujesz to samo DTO w kilku komponentach,
- używasz nowych inline `style`, mimo że da się to zrobić Tailwindem,
- dorzucasz nowy komponent tylko dlatego, że łatwiej skopiować niż wydzielić,
- doklejasz logikę domenową do `AppShell`, choć należy do feature’a,
- komponent ma jednocześnie fetch, mapping, render i skomplikowane eventy.

### Kiedy wydzielać komponent

Wydziel wtedy, gdy:

- komponent ma własną odpowiedzialność,
- jest używany lub zaraz będzie używany w więcej niż jednym miejscu,
- poprawia czytelność bez ukrywania istotnej logiki.

Nie wydzielaj, jeśli wynik będzie tylko cienkim wrapperem bez wartości.

### Kiedy wydzielać hook

Wydziel wtedy, gdy:

- logika stanu lub efektów jest powtarzalna,
- komponent traci czytelność przez logikę nie-renderującą,
- potrzebujesz jednego kontraktu używanego w wielu UI.

---

## 8. Reguły jakości bez długu

### Architektura

- jedna odpowiedzialność na plik tak daleko, jak to praktyczne
- zero "tymczasowych" helperów bez nazwy i miejsca docelowego
- zero duplikacji DTO mappingu
- zero nowej logiki biznesowej w `shared/ui`

### Typy

- używaj istniejących typów z `shared/types`
- jeśli backend shape różni się od UI shape, mapuj to jawnie
- nie rozlewaj `any`
- nie ukrywaj problemów typów przez agresywne casty

### Dane

- pochodne pola licz w modelu albo blisko źródła danych
- nie licz tego samego na 4 różne sposoby w UI
- optymistyczne update’y tylko tam, gdzie zachowanie jest już spójne

### UI

- wykorzystuj istniejące komponenty i wzorce ruchu
- nowe interakcje muszą mieć hover/focus/disabled
- mobile i desktop traktuj jako dwa realne konteksty, nie afterthought

### Refactor hygiene

Jeśli ruszasz stary kod i widzisz małą, tanią poprawkę porządkującą:

- zrób ją w tej samej zmianie, jeśli nie rozszerza znacząco zakresu,
- nie rób przy okazji dużego "cleanupu wszystkiego".

Zasada: leave it cleaner than you found it, but bez rozlewania scope’u.

---

## 9. Obecne wzorce, które warto utrzymać

### Tasks API flow

- fetch z API
- `mapApiTask`
- UI pracuje na typie `Task`
- zapis idzie przez `toCreateTaskDto` / `toUpdateTaskDto`

To jest dobry wzorzec dla innych feature’ów.

### Full-page views

Pełne widoki jak `ProjectView` są sensownym miejscem do:

- pobrania feature hooka,
- ustawienia view mode,
- sklejenia list/board/week.

### Shared UI primitives

Komponenty typu `CalendarDatePicker` i `CustomSelect` są dobrymi kandydatami do reużycia, nie do klonowania.

---

## 10. Obecne miejsca wymagające ostrożności

To nie są błędy same w sobie, ale ważne punkty przy rozwoju:

- `AppShell` jest dość duży i pełni rolę centralnego orchestratora
- `notes` są jeszcze bardziej lokalne niż reszta domen
- `spaces.color` jest frontendowym rozszerzeniem
- część UI nadal używa inline `style` dla precyzyjnych wartości wizualnych

Wniosek:

- przy nowych pracach nie zwiększaj ciężaru `AppShell`, jeśli da się przenieść logikę do feature’a lub view,
- nową domenę buduj już w pełnym układzie `api/model/ui`.

---

## 11. UI Review Protocol

Po każdej zmianie UI wykonaj ten checklist. Jeśli coś wypada na ❌, popraw to od razu.

### Brand

- [ ] Kolory z palety: `#0f1115` (ink), `#f7f7f4` (surface), `#f1f0ed` (hover/divider), `#e8e8e4` (border), `#9098a4` (muted)
- [ ] Border radius: `8px` min dla interaktywnych elementów, `18px` dla modali/kart
- [ ] Font weight: max `650–700` dla nagłówków, `500–600` dla labeli, `400` dla body
- [ ] Letter spacing: `-0.01em` do `-0.03em` na nagłówkach, `0.06em` na UPPERCASE labelach

### Animacje

- [ ] Każdy nowy interaktywny element ma `transition` (min. `opacity` lub `background`)
- [ ] Czas animacji: `<= 0.3s` (preferuj `0.18–0.22s`)
- [ ] Easing: `ease`, `cubic-bezier(0.4,0,0.2,1)` lub `cubic-bezier(0.34,1.2,0.64,1)`; nigdy `linear`
- [ ] Dropdown/popup: `opacity + translateY(-6px) + scale(0.97)`, zawsze w DOM, ukrywanie przez `pointer-events: none`
- [ ] Expand inline: `grid-template-rows: 0fr -> 1fr` z `0.28s ease`

### UX

- [ ] Hover state widoczny
- [ ] Focus/active state dla klawiaturowców
- [ ] Placeholder text w kolorze `#b0b5be`
- [ ] Disabled state: `opacity: 0.4`, `cursor: not-allowed`

### Czystość

- [ ] Maks 2–3 kolory akcentowe w jednym widoku
- [ ] Nowy komponent nie powiela istniejącego
- [ ] Brak inline `style`, jeśli da się użyć Tailwinda; wyjątek: dynamiczne wartości i bardzo precyzyjne tokeny wizualne

---

## 12. Design tokens

```text
Ink:      #0f1115 / #3a3f47 / #5a606b / #8a909a / #9098a4 / #b0b5be / #c0c5cc
Surface:  #FDFDFD / #f7f7f4 / #f1f0ed / #ececec
Border:   #e8e8e4 / #e3e3df

Priority:
  P1 Pilne:   oklch(0.62 0.18 25)  bg: oklch(0.96 0.03 25)
  P2 Wysokie: oklch(0.70 0.16 55)  bg: oklch(0.96 0.03 55)
  P3 Średnie: oklch(0.70 0.13 230) bg: oklch(0.96 0.03 230)
  P4 Niskie:  oklch(0.65 0.01 260) bg: oklch(0.95 0.005 260)

Status:
  NotStarted: oklch(0.55 0.01 260) bg: oklch(0.96 0.005 260)
  InProgress: oklch(0.55 0.15 230) bg: oklch(0.96 0.03 230)
  Completed:  oklch(0.50 0.15 145) bg: oklch(0.96 0.03 145)

Shadows:
  dropdown: 0 8px 24px -6px rgba(15,17,21,.16)
  modal:    0 24px 48px -12px rgba(15,17,21,.22)

Radius:
  xs=4 sm=6 md=8 lg=12 xl=18 full=9999
```

---

## 13. Konwencje implementacyjne

- nowe shared komponenty: `src/components/` lub `src/shared/ui/` zależnie od semantyki
- nowe full-page widoki: `src/views/`
- nowe feature’y: `src/features/<feature>/api|model|ui`
- endpoint tasków projektu: `GET /projects/{projectId}/tasks`
- globalne animacje: `src/index.css`
- jeśli dodajesz nowy reusable typ lub adapter, najpierw sprawdź `src/shared/types` i `src/shared/api`

---

## 14. Definition of done dla zmian kodu

Zmiana jest gotowa, gdy:

1. jest w poprawnej warstwie architektury,
2. nie duplikuje istniejących komponentów lub mapperów,
3. build przechodzi,
4. UI spełnia checklistę,
5. mobile i desktop są uwzględnione,
6. dokumentacja `CLAUDE.md` jest aktualna, jeśli zmiana zmienia sposób pracy z repo.

---

## 15. Instrukcja dla LLM w jednym skrócie

Jeśli dodajesz coś nowego:

1. znajdź właściwy feature,
2. dodaj lub rozszerz `api`,
3. zmapuj dane w `model`,
4. zbuduj UI bez duplikowania istniejących komponentów,
5. podłącz w `view` lub `AppShell`,
6. sprawdź mobile,
7. zrób build,
8. zostaw kod czytelniejszy niż przed zmianą.

Domyślna strategia: rozszerzaj istniejące wzorce, nie wymyślaj nowej architektury dla pojedynczej zmiany.
