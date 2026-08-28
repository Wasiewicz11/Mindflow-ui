import type { IntegrationTokenScope } from '../api/integrationsApi';

export interface ScopeOption {
  value: IntegrationTokenScope;
  label: string;
  description: string;
}

export interface ScopeGroup {
  key: string;
  label: string;
  options: ScopeOption[];
}

export const SCOPE_GROUPS: ScopeGroup[] = [
  {
    key: 'projects',
    label: 'Projekty',
    options: [
      { value: 'ProjectsRead', label: 'Odczyt', description: 'Lista projektów i przestrzeni, do których masz dostęp.' },
    ],
  },
  {
    key: 'tasks',
    label: 'Zadania',
    options: [
      { value: 'TasksRead', label: 'Odczyt', description: 'Pobieranie zadań wraz z filtrami i stronicowaniem.' },
      { value: 'TasksCreate', label: 'Tworzenie', description: 'Dodawanie nowych zadań.' },
      { value: 'TasksUpdate', label: 'Edycja', description: 'Zmiana treści, statusu, priorytetu i terminu.' },
      { value: 'TasksDelete', label: 'Usuwanie', description: 'Trwałe usuwanie zadań.' },
    ],
  },
  {
    key: 'subtasks',
    label: 'Podzadania',
    options: [
      { value: 'SubtasksRead', label: 'Odczyt', description: 'Pobieranie podzadań danego zadania.' },
      { value: 'SubtasksCreate', label: 'Tworzenie', description: 'Dodawanie podzadań.' },
      { value: 'SubtasksUpdate', label: 'Edycja', description: 'Zmiana treści i stanu podzadań.' },
      { value: 'SubtasksDelete', label: 'Usuwanie', description: 'Trwałe usuwanie podzadań.' },
    ],
  },
  {
    key: 'time',
    label: 'Czas pracy',
    options: [
      { value: 'TimeEntriesRead', label: 'Odczyt', description: 'Pobieranie wpisów czasu i estymacji.' },
      { value: 'TimeEntriesCreate', label: 'Tworzenie', description: 'Dodawanie wpisów czasu pracy.' },
      { value: 'TimeEntriesUpdate', label: 'Edycja', description: 'Zmiana istniejących wpisów czasu.' },
      { value: 'TimeEntriesDelete', label: 'Usuwanie', description: 'Trwałe usuwanie wpisów czasu.' },
    ],
  },
];

export const ALL_SCOPES: IntegrationTokenScope[] = SCOPE_GROUPS.flatMap(group =>
  group.options.map(option => option.value),
);

export const SCOPE_LABELS: Record<IntegrationTokenScope, string> = Object.fromEntries(
  SCOPE_GROUPS.flatMap(group => group.options.map(option => [option.value, `${group.label}: ${option.label.toLowerCase()}`])),
) as Record<IntegrationTokenScope, string>;

/** Read-only keys are worth calling out: they cannot change anything in the account. */
export function isReadOnly(scopes: IntegrationTokenScope[]) {
  return scopes.length > 0 && scopes.every(scope => scope.endsWith('Read'));
}
