# Komponenty UI

## Aplikacja

- `src/app/AppShell.tsx` - glowny shell aplikacji po zalogowaniu; trzyma aktywna zakladke, pobiera przestrzenie/projekty i przekazuje akcje do widokow.
- `src/App.tsx` - wybiera normalna aplikacje albo Design Book po `?design`.

## Layout

- `src/features/layout/ui/Sidebar.tsx` - lewy sidebar desktopowy z nawigacja, przestrzeniami i projektami.
- `src/features/layout/ui/ThemeSelector.tsx` - wybor motywu aplikacji.

## Zadania

- `src/features/tasks/ui/CalendarView.tsx` - widok kalendarza dzien/tydzien/miesiac, timeblocking, drag and drop, tworzenie taska z kliknietego slotu i integracja z `/calendar/blocks`.
- `src/features/tasks/ui/TaskAddModal.tsx` - standardowy modal dodawania zadania.
- `src/features/tasks/ui/TaskEditModal.tsx` - modal edycji zadania z opisem, etykietami i podzadaniami.
- `src/features/tasks/ui/TaskList.tsx` - kompaktowa lista zadan.
- `src/features/tasks/ui/TaskListGrouped.tsx` - glowna lista zadan pogrupowana wedlug terminow/statusow.
- `src/features/tasks/ui/TaskWeekView.tsx` - starszy widok tygodniowy taskow.
- `src/features/tasks/ui/TaskBoardView.tsx` - widok tablicowy zadan.
- `src/features/tasks/ui/TaskKanbanView.tsx` - kanban dla zadan.
- `src/features/tasks/ui/QuickAddTask.tsx` - szybkie dodawanie zadania z poziomu glownego widoku.
- `src/features/tasks/ui/TasksView.tsx` - kontener widoku zadan.

## Wspoldzielone UI

- `src/shared/ui/CalendarDatePicker.tsx` - inline date picker uzywany w modalach zadan.
- `src/shared/ui/CustomSelect.tsx` - wspoldzielony select stylowany pod Mindle.

## Projekty I Przestrzenie

- `src/views/ProjectView.tsx` - widok pojedynczego projektu.
- `src/features/spaces/ui/SpacesView.tsx` - widok przestrzeni.
- `src/features/spaces/ui/SpaceSettingsModal.tsx` - ustawienia przestrzeni.

## Notatki

- `src/features/notes/ui/NotesGrid.tsx` - siatka notatek i akcje dodawania/edycji/usuwania.

## Auth

- `src/features/auth/ui/LoginScreen.tsx` - ekran logowania przez Google.

## Design

- `src/views/DesignBook.tsx` - podglad design systemu dostepny przez `?design`.
