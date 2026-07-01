import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Filter,
  Flame,
  Link2,
  ListChecks,
  Moon,
  PencilLine,
  Plus,
  Search,
  ShieldAlert,
  Sunrise,
  Target,
  Trash2,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { TaskPriority, type Project, type Task, type TaskPriority as TaskPriorityValue } from '../../../shared/types';
import { getGoalDays, upsertGoalDay, type ApiGoalDay, type UpsertGoalDayDto } from '../api/goalsApi';

type GoalsMode = 'week' | 'heatmap';
type TaskSortMode = 'default' | 'priority' | 'date-asc' | 'date-desc' | 'project';
type DateFilterMode = 'all' | 'with-date' | 'no-date' | 'completed';
type GoalIconKey = 'sunrise' | 'code' | 'moon' | 'list' | 'target' | 'chart';

interface GoalCheckItem {
  id: string;
  text: string;
  done?: boolean;
}

interface GoalProjectColumn {
  title: string;
  items: GoalCheckItem[];
  checkable?: boolean;
}

interface GoalProjectBlock {
  title: string;
  description: string;
  objective?: string;
  columns: GoalProjectColumn[];
}

interface GoalEditorColumn {
  id: string;
  content: string;
  html?: string;
}

interface GoalNotionBlock {
  columns: GoalEditorColumn[];
}

interface GoalSection {
  id: string;
  title: string;
  icon?: LucideIcon;
  iconKey?: GoalIconKey;
  items?: GoalCheckItem[];
  note?: string;
  project?: GoalProjectBlock;
  notion?: GoalNotionBlock;
}

interface GoalDay {
  id: string;
  date: string;
  dayShort: string;
  dateLabel: string;
  title: string;
  markerLevel: 0 | 1 | 2 | 3 | 4;
  sections: GoalSection[];
  linkedTaskIds: string[];
}

interface AssignableTask {
  id: string;
  content: string;
  isCompleted: boolean;
  status: Task['status'];
  priority: TaskPriorityValue;
  dueDate?: string;
  projectName?: string;
  projectColor?: string;
  tags?: string[];
}

interface EditorTaskTarget {
  dayId: string;
  sectionId: string;
  columnId: string;
  caretPosition: number;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
}

const GOAL_DAYS: GoalDay[] = [
  {
    id: 'monday',
    date: '2026-05-26',
    dayShort: 'Pon',
    dateLabel: '26.05',
    title: 'Poniedziałek - ustawienie tygodnia',
    markerLevel: 2,
    linkedTaskIds: ['mock-inbox', 'mock-plan'],
    sections: [
      {
        id: 'monday-morning',
        title: 'Rano',
        icon: Sunrise,
        items: [
          { id: 'monday-water', text: '10 minut bez telefonu po przebudzeniu.', done: true },
          { id: 'monday-plan', text: 'Wybierz jeden mierzalny wynik tygodnia.', done: true },
        ],
        note: 'Tydzień wygrywa jeden konkretny efekt, nie lista życzeń.',
      },
      {
        id: 'monday-focus',
        title: 'Blok organizacyjny - 45 min',
        icon: ListChecks,
        items: [
          { id: 'monday-inbox', text: 'Wyczyść inbox zadań i przenieś rzeczy na dni.', done: false },
          { id: 'monday-blocks', text: 'Zarezerwuj trzy bloki pracy głębokiej.', done: false },
        ],
      },
    ],
  },
  {
    id: 'tuesday',
    date: '2026-05-27',
    dayShort: 'Wt',
    dateLabel: '27.05',
    title: 'Wtorek - przygotowanie danych',
    markerLevel: 1,
    linkedTaskIds: ['mock-research', 'mock-csv'],
    sections: [
      {
        id: 'tuesday-data',
        title: 'Blok data - 60 min',
        icon: Code2,
        items: [
          { id: 'tuesday-source', text: 'Zbierz przykładowe wyniki rolek i filmów.', done: true },
          { id: 'tuesday-columns', text: 'Ustal kolumny i format CSV.', done: false },
          { id: 'tuesday-cleanup', text: 'Usuń dane, które nic nie mówią o wyniku biznesowym.', done: false },
        ],
      },
      {
        id: 'tuesday-evening',
        title: 'Wieczór',
        icon: Moon,
        items: [
          { id: 'tuesday-walk', text: 'Krótki spacer bez słuchawek.', done: false },
          { id: 'tuesday-sleep', text: 'Telefon ładuje się poza łóżkiem.', done: false },
        ],
      },
    ],
  },
  {
    id: 'wednesday',
    date: '2026-05-28',
    dayShort: 'Sr',
    dateLabel: '28.05',
    title: 'Środa - start systemu',
    markerLevel: 3,
    linkedTaskIds: ['mock-readme', 'mock-csv', 'mock-questions', 'mock-walk'],
    sections: [
      {
        id: 'wednesday-morning',
        title: 'Rano',
        icon: Sunrise,
        items: [
          { id: 'wed-wake', text: 'Wstań.', done: true },
          { id: 'wed-social', text: 'Nie otwieraj Instagrama / LinkedIna przez pierwszą godzinę.' },
        ],
        note: 'Zapisz na kartce albo w Notion:\n„Dzisiaj wygrywam, jeśli zrobię 1 konkretną rzecz do data i pójdę spać przed 00:45.”',
      },
      {
        id: 'wednesday-data',
        title: 'Blok data - 60-90 min',
        icon: Code2,
        note: 'Wybierz jeden projekt:',
        project: {
          title: 'Projekt: Dashboard wyników contentu / video',
          description: '',
          objective: 'zbudować prosty projekt data, który łączy Twoje doświadczenie z video/contentem.',
          columns: [
            {
              title: 'Zakres',
              items: [
                { id: 'wed-scope-csv', text: 'dane wejściowe: ręcznie przygotowany CSV z przykładowymi wynikami rolek/filmów' },
                { id: 'wed-scope-columns', text: 'kolumny: data, platforma, tytuł, wyświetlenia, watch time, CTR, liczba leadów, przychód, koszt, czas produkcji' },
                { id: 'wed-scope-output', text: 'efekt: prosty dashboard albo raport' },
              ],
            },
            {
              title: 'W środę robisz tylko',
              checkable: true,
              items: [
                { id: 'wed-folder', text: 'zakładasz folder projektu' },
                { id: 'wed-readme', text: 'tworzysz plik README.md' },
                { id: 'wed-csv', text: 'tworzysz pierwszy plik CSV z minimum 20 przykładowymi rekordami', done: true },
                { id: 'wed-questions', text: 'zapisujesz 5 pytań biznesowych, na które projekt ma odpowiadać', done: true },
              ],
            },
            {
              title: 'Przykłady pytań',
              items: [
                { id: 'wed-q-format', text: 'które formaty contentu dają najlepszy wynik?' },
                { id: 'wed-q-leads', text: 'czy więcej wyświetleń oznacza więcej leadów?' },
                { id: 'wed-q-revenue', text: 'który typ filmu daje najlepszy przychód względem czasu produkcji?' },
                { id: 'wed-q-platforms', text: 'które platformy są najbardziej opłacalne?' },
                { id: 'wed-q-next', text: 'co warto produkować dalej?' },
              ],
            },
          ],
        },
      },
      {
        id: 'wednesday-evening',
        title: 'Wieczór',
        icon: Moon,
        items: [
          { id: 'wed-walk', text: '20 minut spaceru.' },
          { id: 'wed-phone', text: 'Telefon poza łóżkiem.' },
          { id: 'wed-sleep', text: 'Sen: łóżko najpóźniej 00:45.' },
        ],
      },
    ],
  },
  {
    id: 'thursday',
    date: '2026-05-29',
    dayShort: 'Czw',
    dateLabel: '29.05',
    title: 'Czwartek - pierwszy techniczny wynik',
    markerLevel: 2,
    linkedTaskIds: ['mock-notebook', 'mock-metrics', 'mock-readme'],
    sections: [
      {
        id: 'thursday-data',
        title: 'Blok data - 60-90 min',
        icon: Code2,
        items: [
          { id: 'thu-load', text: 'Wczytaj CSV w notebooku albo skrypcie Python.', done: true },
          { id: 'thu-metrics', text: 'Policz sumę wyświetleń, średni CTR i średni przychód.' },
          { id: 'thu-top', text: 'Wyciągnij top 5 materiałów po wyniku.' },
          { id: 'thu-readme', text: 'Zapisz krótkie wnioski w README.md.' },
        ],
        note: 'Nie upiększaj. Ma działać.',
      },
      {
        id: 'thursday-content',
        title: 'Content - 20 min',
        icon: Target,
        items: [
          { id: 'thu-post-topic', text: 'Napisz szkic posta o przejściu w data + pracę zdalną.' },
          { id: 'thu-post-structure', text: 'Opisz gdzie jesteś teraz, dlaczego data i co budujesz w tym tygodniu.' },
        ],
      },
    ],
  },
  {
    id: 'friday',
    date: '2026-05-30',
    dayShort: 'Pt',
    dateLabel: '30.05',
    title: 'Piątek - publikacja pierwszego contentu',
    markerLevel: 1,
    linkedTaskIds: ['mock-post', 'mock-publish'],
    sections: [
      {
        id: 'friday-content',
        title: 'Blok content - 60 min',
        icon: Target,
        items: [
          { id: 'fri-platform', text: 'Wybierz jedną platformę: LinkedIn albo Instagram.' },
          { id: 'fri-publish', text: 'Opublikuj pierwszy materiał przed analizą profili innych ludzi.' },
          { id: 'fri-note', text: 'Zapisz jedną rzecz, którą poprawisz w następnym poście.' },
        ],
      },
    ],
  },
  {
    id: 'saturday',
    date: '2026-05-31',
    dayShort: 'Sob',
    dateLabel: '31.05',
    title: 'Sobota - porządek i regeneracja',
    markerLevel: 0,
    linkedTaskIds: ['mock-review'],
    sections: [
      {
        id: 'saturday-review',
        title: 'Przegląd - 30 min',
        icon: BarChart3,
        items: [
          { id: 'sat-review', text: 'Sprawdź, które cele realnie posunęły projekt do przodu.' },
          { id: 'sat-adjust', text: 'Usuń lub uprość cele, które były za ciężkie.' },
        ],
      },
      {
        id: 'saturday-rest',
        title: 'Regeneracja',
        icon: Moon,
        items: [
          { id: 'sat-rest', text: 'Minimum godzina poza ekranami.' },
        ],
      },
    ],
  },
  {
    id: 'sunday',
    date: '2026-06-01',
    dayShort: 'Nd',
    dateLabel: '01.06',
    title: 'Niedziela - spokojne domknięcie',
    markerLevel: 1,
    linkedTaskIds: ['mock-plan'],
    sections: [
      {
        id: 'sunday-close',
        title: 'Wieczór',
        icon: Moon,
        items: [
          { id: 'sun-close', text: 'Zapisz trzy fakty: co działało, co przeszkadzało, co robisz jutro.' },
          { id: 'sun-sleep', text: 'Sen bez nadrabiania telefonu w łóżku.' },
        ],
      },
    ],
  },
];

const FALLBACK_TASKS: AssignableTask[] = [
  { id: 'mock-readme', content: 'README.md', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P3, dueDate: '2026-05-28', projectName: 'Dashboard data', projectColor: '#3b82f6', tags: ['data', 'projekt'] },
  { id: 'mock-csv', content: 'CSV - 20 rekordów', isCompleted: true, status: 'Completed', priority: TaskPriority.P2, dueDate: '2026-05-28', projectName: 'Dashboard data', projectColor: '#3b82f6', tags: ['data', 'csv'] },
  { id: 'mock-questions', content: '5 pytań biznesowych', isCompleted: true, status: 'Completed', priority: TaskPriority.P3, dueDate: '2026-05-28', projectName: 'Dashboard data', projectColor: '#3b82f6', tags: ['biznes', 'data'] },
  { id: 'mock-walk', content: '20 min spaceru', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P4, dueDate: '2026-05-28', projectName: 'Osobiste', projectColor: '#2f7a52', tags: ['zdrowie'] },
  { id: 'mock-notebook', content: 'Notebook z metrykami', isCompleted: false, status: 'InProgress', priority: TaskPriority.P2, dueDate: '2026-05-29', projectName: 'Dashboard data', projectColor: '#3b82f6', tags: ['python', 'data'] },
  { id: 'mock-metrics', content: 'Top 5 materiałów po wyniku', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P3, dueDate: '2026-05-29', projectName: 'Dashboard data', projectColor: '#3b82f6', tags: ['analiza'] },
  { id: 'mock-post', content: 'Szkic posta o przejściu w data', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P3, dueDate: '2026-05-29', projectName: 'Content', projectColor: '#8b5cf6', tags: ['content'] },
  { id: 'mock-publish', content: 'Publikacja na LinkedIn', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P2, dueDate: '2026-05-30', projectName: 'Content', projectColor: '#8b5cf6', tags: ['content', 'linkedin'] },
  { id: 'mock-inbox', content: 'Porządek w inboxie zadań', isCompleted: true, status: 'Completed', priority: TaskPriority.P4, dueDate: '2026-05-26', projectName: 'Praca', projectColor: '#9098a4', tags: ['organizacja'] },
  { id: 'mock-plan', content: 'Plan kolejnego tygodnia', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P3, projectName: 'Osobiste', projectColor: '#2f7a52', tags: ['plan'] },
  { id: 'mock-research', content: 'Zebrać wyniki contentu', isCompleted: true, status: 'Completed', priority: TaskPriority.P3, dueDate: '2026-05-27', projectName: 'Dashboard data', projectColor: '#3b82f6', tags: ['research'] },
  { id: 'mock-review', content: 'Przegląd tygodnia', isCompleted: false, status: 'NotStarted', priority: TaskPriority.P4, dueDate: '2026-05-31', projectName: 'Osobiste', projectColor: '#2f7a52', tags: ['review'] },
];

const HEATMAP_LEVELS: Array<0 | 1 | 2 | 3 | 4> = [
  0, 1, 0, 2, 3, 1, 0,
  1, 2, 1, 0, 3, 4, 1,
  0, 0, 2, 1, 2, 3, 0,
  1, 3, 2, 4, 3, 2, 1,
  0, 1, 3, 4, 4, 3, 2,
  1, 2, 4, 3, 4, 2, 1,
  0, 1, 2, 3, 2, 1, 0,
  1, 0, 1, 2, 3, 2, 0,
];

const GOAL_ICON_BY_KEY: Record<GoalIconKey, LucideIcon> = {
  sunrise: Sunrise,
  code: Code2,
  moon: Moon,
  list: ListChecks,
  target: Target,
  chart: BarChart3,
};

function isGoalIconKey(value: unknown): value is GoalIconKey {
  return typeof value === 'string' && value in GOAL_ICON_BY_KEY;
}

function getSectionIconKey(section: GoalSection): GoalIconKey {
  if (section.iconKey) return section.iconKey;
  if (section.icon === Sunrise) return 'sunrise';
  if (section.icon === Code2) return 'code';
  if (section.icon === Moon) return 'moon';
  if (section.icon === Target) return 'target';
  if (section.icon === BarChart3) return 'chart';
  return 'list';
}

function serializeGoalSections(sections: GoalSection[]) {
  return sections.map(section => {
    const { icon, ...serializable } = section;
    void icon;
    return {
      ...serializable,
      iconKey: getSectionIconKey(section),
    };
  });
}

function SectionIcon({ iconKey, className }: { iconKey: GoalIconKey; className: string }) {
  const Icon = GOAL_ICON_BY_KEY[iconKey];
  return <Icon className={className} />;
}

function hydrateGoalSections(sections: unknown): GoalSection[] {
  if (!Array.isArray(sections)) return [];

  return sections
    .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === 'object')
    .map(section => ({
      ...(section as unknown as GoalSection),
      iconKey: isGoalIconKey(section.iconKey) ? section.iconKey : 'list',
      icon: undefined,
    }));
}

function hydrateGoalDay(apiDay: ApiGoalDay): GoalDay {
  const fallback = GOAL_DAYS.find(day => day.date === apiDay.date);
  return {
    id: fallback?.id ?? apiDay.date,
    date: apiDay.date,
    dayShort: apiDay.dayShort,
    dateLabel: apiDay.dateLabel,
    title: apiDay.title,
    markerLevel: apiDay.markerLevel,
    sections: hydrateGoalSections(apiDay.sections),
    linkedTaskIds: apiDay.linkedTaskIds ?? [],
  };
}

function mergeGoalDays(apiDays: ApiGoalDay[]) {
  const hydratedByDate = new Map(apiDays.map(day => [day.date, hydrateGoalDay(day)]));
  const defaultDates = new Set(GOAL_DAYS.map(day => day.date));
  const defaultsWithSavedData = GOAL_DAYS.map(day => hydratedByDate.get(day.date) ?? day);
  const extraDays = Array.from(hydratedByDate.values())
    .filter(day => !defaultDates.has(day.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  return [...defaultsWithSavedData, ...extraDays];
}

function toUpsertGoalDayDto(day: GoalDay, linkedTaskIds: string[]): UpsertGoalDayDto {
  return {
    dayShort: day.dayShort,
    dateLabel: day.dateLabel,
    title: day.title,
    markerLevel: day.markerLevel,
    sections: serializeGoalSections(day.sections),
    linkedTaskIds,
  };
}

function collectCheckableItems(day: GoalDay): GoalCheckItem[] {
  return collectCheckableItemsFromSections(day.sections);
}

function collectCheckableItemsFromSections(sections: GoalSection[]): GoalCheckItem[] {
  return sections.flatMap(section => {
    const directItems = section.items ?? [];
    const projectItems = section.project?.columns.flatMap(column => column.checkable ? column.items : []) ?? [];
    const notionItems = section.notion?.columns.flatMap(column => collectTodosFromEditorContent(column)) ?? [];
    return [...directItems, ...projectItems, ...notionItems];
  });
}

function createGoalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function collectTodosFromEditorContent(column: GoalEditorColumn): GoalCheckItem[] {
  return column.content
    .split('\n')
    .map<GoalCheckItem | null>((line, index) => {
      const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/) ??
        line.match(/^\s*\[([ xX])\]\s+(.+)$/) ??
        line.match(/^\s*(☐|☑)\s+(.+)$/);
      if (!match) return null;

      return {
        id: `${column.id}-todo-${index}`,
        text: match[2].trim(),
        done: match[1].toLowerCase() === 'x' || match[1] === '☑',
      };
    })
    .filter((item): item is GoalCheckItem => Boolean(item));
}

function createEditorColumns(count: number, firstContent = ''): GoalEditorColumn[] {
  return Array.from({ length: count }).map((_, index) => ({
    id: createGoalId('goal-column'),
    content: index === 0 ? firstContent : '',
    html: index === 0 ? textToEditorHtml(firstContent) : '',
  }));
}

function focusEditorColumn(columnId: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-goal-column="${columnId}"]`)?.focus();
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToEditorHtml(content: string) {
  if (!content.trim()) return '';

  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<div><br></div>';
      if (trimmed.startsWith('# ')) return `<h3>${escapeHtml(trimmed.slice(2)) || '<br>'}</h3>`;
      if (trimmed.startsWith('> ')) return `<blockquote>${escapeHtml(trimmed.slice(2)) || '<br>'}</blockquote>`;
      return htmlForEditorLine(line);
    })
    .join('');
}

function getInitialCheckedIds(days = GOAL_DAYS) {
  return new Set(
    days.flatMap(day => collectCheckableItems(day))
      .filter(item => item.done)
      .map(item => item.id),
  );
}

function updateGoalItemDone(sections: GoalSection[], itemId: string, done: boolean): GoalSection[] {
  return sections.map(section => ({
    ...section,
    items: section.items?.map(item => item.id === itemId ? { ...item, done } : item),
    project: section.project ? {
      ...section.project,
      columns: section.project.columns.map(column => ({
        ...column,
        items: column.items.map(item => item.id === itemId ? { ...item, done } : item),
      })),
    } : section.project,
  }));
}

function getCompletion(day: GoalDay, checkedIds: Set<string>) {
  const items = collectCheckableItems(day);
  const completed = items.filter(item => item.done || checkedIds.has(item.id)).length;
  return {
    completed,
    total: items.length,
    percent: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
  };
}

function markerClass(level: GoalDay['markerLevel']) {
  if (level === 4) return 'bg-[#2f7a52]';
  if (level === 3) return 'bg-[#4f9467]';
  if (level === 2) return 'bg-[#93b59b]';
  if (level === 1) return 'bg-[#d9e3d7]';
  return 'bg-white border border-[#c0c5cc] dark:bg-[#232326] dark:border-white/20';
}

function heatmapClass(level: 0 | 1 | 2 | 3 | 4) {
  if (level === 4) return 'bg-[#2f7a52]';
  if (level === 3) return 'bg-[#4f9467]';
  if (level === 2) return 'bg-[#93b59b]';
  if (level === 1) return 'bg-[#d9e3d7]';
  return 'bg-[#f1f0ed] dark:bg-white/8';
}

function priorityLabel(priority: TaskPriorityValue) {
  if (priority === TaskPriority.P1) return 'P1';
  if (priority === TaskPriority.P2) return 'P2';
  if (priority === TaskPriority.P3) return 'P3';
  return 'P4';
}

function priorityRank(priority: TaskPriorityValue) {
  if (priority === TaskPriority.P1) return 0;
  if (priority === TaskPriority.P2) return 1;
  if (priority === TaskPriority.P3) return 2;
  return 3;
}

function parseTaskDate(dateStr?: string) {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function formatTaskDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function mapTasks(tasks: Task[], projects: Project[]): AssignableTask[] {
  const projectById = new Map(projects.map(project => [project.id, project]));
  return tasks.map(task => {
    const project = task.project_id ? projectById.get(task.project_id) : undefined;
    return {
      id: task.id,
      content: task.content,
      isCompleted: task.isCompleted,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      projectName: project?.name,
      projectColor: project?.color,
      tags: task.tags,
    };
  });
}

interface GoalsViewProps {
  tasks: Task[];
  projects: Project[];
}

export function GoalsView({ tasks, projects }: GoalsViewProps) {
  const hasLoadedGoalDaysRef = useRef(false);
  const [goalDays, setGoalDays] = useState<GoalDay[]>(GOAL_DAYS);
  const [mode, setMode] = useState<GoalsMode>('week');
  const [selectedDayId, setSelectedDayId] = useState('wednesday');
  const [checkedGoalIds, setCheckedGoalIds] = useState(getInitialCheckedIds);
  const [linkedTasksByDay, setLinkedTasksByDay] = useState<Record<string, string[]>>(
    () => Object.fromEntries(GOAL_DAYS.map(day => [day.id, day.linkedTaskIds])),
  );
  const [assigningDayId, setAssigningDayId] = useState<string | null>(null);
  const [editorTaskTarget, setEditorTaskTarget] = useState<EditorTaskTarget | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    let cancelled = false;

    getGoalDays()
      .then(apiDays => {
        if (cancelled) return;
        if (apiDays.length === 0) {
          hasLoadedGoalDaysRef.current = true;
          return;
        }

        const nextDays = mergeGoalDays(apiDays);
        setGoalDays(nextDays);
        setCheckedGoalIds(getInitialCheckedIds(nextDays));
        setLinkedTasksByDay(Object.fromEntries(nextDays.map(day => [day.id, day.linkedTaskIds])));
        hasLoadedGoalDaysRef.current = true;
      })
      .catch(error => {
        console.error('Failed to fetch goal days:', error);
        hasLoadedGoalDaysRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedGoalDaysRef.current) return;

    const timeoutId = window.setTimeout(() => {
      void Promise.all(
        goalDays.map(day => upsertGoalDay(
          day.date,
          toUpsertGoalDayDto(day, linkedTasksByDay[day.id] ?? day.linkedTaskIds),
        )),
      ).catch(error => {
        console.error('Failed to save goal days:', error);
      });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [goalDays, linkedTasksByDay]);

  const availableTasks = useMemo(() => {
    const liveTasks = mapTasks(tasks, projects);
    return liveTasks.length > 0 ? [...liveTasks, ...FALLBACK_TASKS] : FALLBACK_TASKS;
  }, [tasks, projects]);

  const selectedDay = goalDays.find(day => day.id === selectedDayId) ?? goalDays[0];
  const completion = getCompletion(selectedDay, checkedGoalIds);
  const linkedTaskIds = linkedTasksByDay[selectedDay.id] ?? [];
  const linkedTasks = linkedTaskIds
    .map(taskId => availableTasks.find(task => task.id === taskId))
    .filter((task): task is AssignableTask => Boolean(task));
  const completedLinkedTasks = linkedTasks.filter(task => task.isCompleted).length;

  const toggleGoalItem = (itemId: string) => {
    const done = !checkedGoalIds.has(itemId);
    setCheckedGoalIds(prev => {
      const next = new Set(prev);
      if (done) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
    setGoalDays(days => days.map(day => ({
      ...day,
      sections: updateGoalItemDone(day.sections, itemId, done),
    })));
  };

  const navigateDay = (direction: -1 | 1) => {
    const currentIndex = goalDays.findIndex(day => day.id === selectedDay.id);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), goalDays.length - 1);
    setSelectedDayId(goalDays[nextIndex].id);
  };

  const updateDayTitle = (dayId: string, title: string) => {
    setGoalDays(prev => prev.map(day => day.id === dayId ? { ...day, title } : day));
  };

  const updateSection = (dayId: string, sectionId: string, updater: (section: GoalSection) => GoalSection) => {
    setGoalDays(prev => prev.map(day => {
      if (day.id !== dayId) return day;
      return {
        ...day,
        sections: day.sections.map(section => section.id === sectionId ? updater(section) : section),
      };
    }));
  };

  const deleteSection = (dayId: string, sectionId: string) => {
    const section = goalDays.find(day => day.id === dayId)?.sections.find(section => section.id === sectionId);
    setConfirmDialog({
      title: 'Usunąć blok?',
      message: `Blok "${section?.title || 'bez nazwy'}" zniknie z tego dnia razem z całą treścią.`,
      confirmLabel: 'Usuń blok',
      tone: 'danger',
      onConfirm: () => {
        setGoalDays(prev => prev.map(day => day.id === dayId ? {
          ...day,
          sections: day.sections.filter(section => section.id !== sectionId),
        } : day));
      },
    });
  };

  const updateSectionItemText = (dayId: string, sectionId: string, itemId: string, text: string) => {
    updateSection(dayId, sectionId, section => ({
      ...section,
      items: (section.items ?? []).map(item => item.id === itemId ? { ...item, text } : item),
    }));
  };

  const updateProjectItemText = (dayId: string, sectionId: string, columnIndex: number, itemId: string, text: string) => {
    updateSection(dayId, sectionId, section => {
      if (!section.project) return section;
      return {
        ...section,
        project: {
          ...section.project,
          columns: section.project.columns.map((column, index) => index === columnIndex
            ? { ...column, items: column.items.map(item => item.id === itemId ? { ...item, text } : item) }
            : column),
        },
      };
    });
  };

  const updateProjectColumnTitle = (dayId: string, sectionId: string, columnIndex: number, title: string) => {
    updateSection(dayId, sectionId, section => {
      if (!section.project) return section;
      return {
        ...section,
        project: {
          ...section.project,
          columns: section.project.columns.map((column, index) => index === columnIndex ? { ...column, title } : column),
        },
      };
    });
  };

  const addEditorBlock = (dayId: string) => {
    const firstColumn = { id: createGoalId('goal-column'), content: '', html: '' };
    const sectionId = createGoalId('goal-editor');

    setGoalDays(prev => prev.map(day => day.id === dayId ? {
      ...day,
      sections: [
        ...day.sections,
        {
          id: sectionId,
          title: '',
          iconKey: 'list',
          notion: {
            columns: [firstColumn],
          },
        },
      ],
    } : day));

    focusEditorColumn(firstColumn.id);
  };

  const updateEditorBlock = (dayId: string, sectionId: string, updater: (block: GoalNotionBlock) => GoalNotionBlock) => {
    updateSection(dayId, sectionId, section => {
      if (!section.notion) return section;
      return {
        ...section,
        notion: updater(section.notion),
      };
    });
  };

  const insertTaskIntoEditor = (target: EditorTaskTarget, task: AssignableTask) => {
    let nextHtml = '';
    let nextLineIndex = 0;
    const taskLine = `${task.isCompleted ? '☑' : '☐'} ${task.content}`;

    updateEditorBlock(target.dayId, target.sectionId, block => ({
      ...block,
      columns: block.columns.map(column => {
        if (column.id !== target.columnId) return column;
        const nextValue = replaceCurrentLine(column.content, target.caretPosition, taskLine);
        const replacement = replaceLineInEditorHtml(
          getCurrentEditorHtml(target.columnId, column.html ?? textToEditorHtml(column.content)),
          column.content,
          target.caretPosition,
          htmlForEditorLine(taskLine),
        );
        nextHtml = replacement.html;
        nextLineIndex = replacement.lineIndex;
        return {
          ...column,
          content: nextValue.content,
          html: nextHtml,
        };
      }),
    }));

    setLinkedTasksByDay(prev => {
      const current = prev[target.dayId] ?? [];
      if (current.includes(task.id)) return prev;
      return { ...prev, [target.dayId]: [...current, task.id] };
    });

    setEditorTaskTarget(null);
    if (nextHtml) {
      replaceEditorDom(target.columnId, nextHtml);
      placeCaretInEditorLine(target.columnId, nextLineIndex, taskLine.length);
    }
  };

  const assigningDay = assigningDayId ? goalDays.find(day => day.id === assigningDayId) ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 animate-fade-in">
      <div className="flex flex-col gap-3 border-b border-[#e8e8e4] pb-3 dark:border-white/8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mf-segmented w-fit">
            <button
              type="button"
              onClick={() => setMode('week')}
              className={`mf-segmented-option ${mode === 'week' ? 'is-active' : ''}`}
            >
              Tydzień
            </button>
            <button
              type="button"
              onClick={() => setMode('heatmap')}
              className={`mf-segmented-option ${mode === 'heatmap' ? 'is-active' : ''}`}
            >
              Heatmapa
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateDay(-1)}
            disabled={selectedDay.id === goalDays[0].id}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Poprzedni dzień"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAssigningDayId(selectedDay.id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e8e8e4] bg-white px-3 text-[13px] font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <Link2 className="h-4 w-4" />
            Przypisz taski
          </button>
          <button
            type="button"
            onClick={() => navigateDay(1)}
            disabled={selectedDay.id === goalDays[goalDays.length - 1].id}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Następny dzień"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mode === 'week' ? (
        <>
          <div className="overflow-x-auto pb-1 no-scrollbar">
            <div className="grid min-w-[760px] grid-cols-7 gap-2">
              {goalDays.map(day => {
                const isSelected = day.id === selectedDay.id;
                const dayCompletion = getCompletion(day, checkedGoalIds);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`flex min-h-[78px] flex-col items-center justify-center rounded-[18px] border px-3 py-3 text-center transition-[background-color,border-color,box-shadow,transform] duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
                      isSelected
                        ? 'border-[#d8d8d3] bg-white shadow-[0_8px_24px_-6px_rgba(15,17,21,.12)] dark:border-white/12 dark:bg-[#232326] dark:shadow-none'
                        : 'border-transparent bg-transparent hover:border-[#e8e8e4] hover:bg-white dark:hover:border-white/10 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-sm font-semibold text-[#0f1115] dark:text-white">{day.dayShort}</span>
                    <span className="mt-1 text-[12px] font-medium text-[#9098a4]">{day.dateLabel}</span>
                    <span className={`mt-2 h-2.5 w-2.5 rounded-full ${markerClass(day.markerLevel)}`} />
                    <span className="mt-1 text-[11px] font-medium text-[#9098a4]">{dayCompletion.completed}/{dayCompletion.total}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
            <main className="min-w-0">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <EditableText
                    value={selectedDay.title}
                    onChange={value => updateDayTitle(selectedDay.id, value)}
                    className="text-[24px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white"
                    placeholder="Tytuł dnia"
                  />
                  <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">
                    {completion.completed} z {completion.total} kroków domkniętych dzisiaj
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addEditorBlock(selectedDay.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e8e8e4] bg-white px-3 text-[13px] font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                    Blok
                  </button>
                </div>
              </div>

              <div className="relative space-y-7">
                {selectedDay.sections.map((section, index) => (
                  <GoalSectionView
                    key={section.id}
                    section={section}
                    isLast={index === selectedDay.sections.length - 1}
                    checkedGoalIds={checkedGoalIds}
                    onToggle={toggleGoalItem}
                    onSectionTitleChange={value => updateSection(selectedDay.id, section.id, current => ({ ...current, title: value }))}
                    onSectionNoteChange={value => updateSection(selectedDay.id, section.id, current => ({ ...current, note: value }))}
                    onItemTextChange={(itemId, value) => updateSectionItemText(selectedDay.id, section.id, itemId, value)}
                    onProjectTitleChange={value => updateSection(selectedDay.id, section.id, current => current.project ? ({ ...current, project: { ...current.project, title: value } }) : current)}
                    onProjectDescriptionChange={value => updateSection(selectedDay.id, section.id, current => current.project ? ({ ...current, project: { ...current.project, description: value } }) : current)}
                    onProjectObjectiveChange={value => updateSection(selectedDay.id, section.id, current => current.project ? ({ ...current, project: { ...current.project, objective: value } }) : current)}
                    onProjectColumnTitleChange={(columnIndex, value) => updateProjectColumnTitle(selectedDay.id, section.id, columnIndex, value)}
                    onProjectItemTextChange={(columnIndex, itemId, value) => updateProjectItemText(selectedDay.id, section.id, columnIndex, itemId, value)}
                    onEditorBlockChange={updater => updateEditorBlock(selectedDay.id, section.id, updater)}
                    onSectionDelete={() => deleteSection(selectedDay.id, section.id)}
                    onEditorTaskCommand={(columnId, caretPosition) => setEditorTaskTarget({
                      dayId: selectedDay.id,
                      sectionId: section.id,
                      columnId,
                      caretPosition,
                    })}
                  />
                ))}
              </div>
            </main>

            <GoalsRightRail
              completion={completion}
              linkedTasks={linkedTasks}
              completedLinkedTasks={completedLinkedTasks}
              onAssign={() => setAssigningDayId(selectedDay.id)}
            />
          </div>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <HeatmapPanel selectedDay={selectedDay} onSelectDay={setSelectedDayId} />
          <GoalsRightRail
            completion={completion}
            linkedTasks={linkedTasks}
            completedLinkedTasks={completedLinkedTasks}
            onAssign={() => setAssigningDayId(selectedDay.id)}
          />
        </div>
      )}

      {assigningDay && (
        <AssignTasksModal
          dayTitle={assigningDay.title}
          tasks={availableTasks}
          initialSelectedIds={linkedTasksByDay[assigningDay.id] ?? []}
          onClose={() => setAssigningDayId(null)}
          onSave={(taskIds) => {
            setLinkedTasksByDay(prev => ({ ...prev, [assigningDay.id]: taskIds }));
            setAssigningDayId(null);
          }}
        />
      )}

      {editorTaskTarget && (
        <EditorTaskPickerModal
          tasks={availableTasks}
          onClose={() => setEditorTaskTarget(null)}
          onSelect={task => insertTaskIntoEditor(editorTaskTarget, task)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
        />
      )}
    </div>
  );
}

function GoalSectionView({
  section,
  isLast,
  checkedGoalIds,
  onToggle,
  onSectionTitleChange,
  onSectionNoteChange,
  onItemTextChange,
  onProjectTitleChange,
  onProjectDescriptionChange,
  onProjectObjectiveChange,
  onProjectColumnTitleChange,
  onProjectItemTextChange,
  onEditorBlockChange,
  onSectionDelete,
  onEditorTaskCommand,
}: {
  section: GoalSection;
  isLast: boolean;
  checkedGoalIds: Set<string>;
  onToggle: (id: string) => void;
  onSectionTitleChange: (value: string) => void;
  onSectionNoteChange: (value: string) => void;
  onItemTextChange: (itemId: string, value: string) => void;
  onProjectTitleChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onProjectObjectiveChange: (value: string) => void;
  onProjectColumnTitleChange: (columnIndex: number, value: string) => void;
  onProjectItemTextChange: (columnIndex: number, itemId: string, value: string) => void;
  onEditorBlockChange: (updater: (block: GoalNotionBlock) => GoalNotionBlock) => void;
  onSectionDelete: () => void;
  onEditorTaskCommand: (columnId: string, caretPosition: number) => void;
}) {
  const [titleFocusSignal, setTitleFocusSignal] = useState(0);

  return (
    <section className="relative grid grid-cols-[42px_minmax(0,1fr)] gap-3">
      {!isLast && <div className="absolute left-[20px] top-11 bottom-[-28px] w-px bg-[#e8e8e4] dark:bg-white/10" />}
      <div className="relative z-10 flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8e8e4] bg-white text-[#5a606b] shadow-sm dark:border-white/10 dark:bg-[#232326] dark:text-gray-300">
          <SectionIcon iconKey={getSectionIconKey(section)} className="h-4 w-4" />
        </div>
      </div>

      <div className="min-w-0 pt-1">
        <div className="group/section-title flex items-start gap-2">
          <EditableText
            value={section.title}
            onChange={onSectionTitleChange}
            className="text-[17px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white"
            placeholder={section.notion ? 'Nazwa bloku' : 'Nagłówek sekcji'}
            autoFocusSignal={titleFocusSignal}
          />
          <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity duration-200 ease group-hover/section-title:opacity-100 group-focus-within/section-title:opacity-100">
            <button
              type="button"
              onClick={() => setTitleFocusSignal(signal => signal + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Edytuj nazwę bloku"
              title="Edytuj nazwę bloku"
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSectionDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/10 dark:hover:text-red-400"
              aria-label="Usuń blok"
              title="Usuń blok"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {section.notion && (
          <NotionBlockEditor
            block={section.notion}
            onChange={onEditorBlockChange}
            onTaskCommand={onEditorTaskCommand}
          />
        )}

        {!section.notion && section.items && (
          <div className="mt-3 space-y-2">
            {section.items.map(item => (
              <GoalCheckRow
                key={item.id}
                item={item}
                checked={checkedGoalIds.has(item.id)}
                onToggle={onToggle}
                onTextChange={value => onItemTextChange(item.id, value)}
              />
            ))}
          </div>
        )}

        {!section.notion && section.note && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2.5 text-[13px] leading-5 text-[#3a3f47] dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-300">
            <Target className="mt-0.5 h-4 w-4 flex-none text-[#2f7a52]" />
            <EditableText
              value={section.note}
              onChange={onSectionNoteChange}
              multiline
              className="text-[13px] leading-5 text-[#3a3f47] dark:text-gray-300"
              placeholder="Tekst / intencja"
            />
          </div>
        )}

        {!section.notion && section.project && (
          <div className="mt-3 rounded-[18px] border border-[#e8e8e4] bg-white p-4 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
            <div className="mb-4">
              <EditableText
                value={section.project.title}
                onChange={onProjectTitleChange}
                className="text-[15px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white"
                placeholder="Tytuł bloku"
              />
              {section.project.description && (
                <EditableText
                  value={section.project.description}
                  onChange={onProjectDescriptionChange}
                  multiline
                  className="mt-1 text-[13px] leading-5 text-[#5a606b] dark:text-gray-400"
                  placeholder="Opis bloku"
                />
              )}
              {section.project.objective && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#f7f7f4] px-3 py-2 dark:bg-white/[0.04]">
                  <span className="mt-[2px] flex-none text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Cel</span>
                  <EditableText
                    value={section.project.objective}
                    onChange={onProjectObjectiveChange}
                    multiline
                    className="text-[13px] leading-5 text-[#3a3f47] dark:text-gray-300"
                    placeholder="Cel projektu"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {section.project.columns.map((column, columnIndex) => (
                <div key={`${section.id}-${columnIndex}`} className="min-w-0 border-t border-[#f1f0ed] pt-3 dark:border-white/8 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0 first:lg:border-l-0 first:lg:pl-0">
                  <EditableText
                    value={column.title}
                    onChange={value => onProjectColumnTitleChange(columnIndex, value)}
                    className="mb-2 text-[12px] font-semibold text-[#0f1115] dark:text-white"
                    placeholder="Nagłówek kolumny"
                  />
                  <div className="space-y-2">
                    {column.items.map(item => column.checkable ? (
                      <GoalCheckRow
                        key={item.id}
                        item={item}
                        checked={checkedGoalIds.has(item.id)}
                        onToggle={onToggle}
                        onTextChange={value => onProjectItemTextChange(columnIndex, item.id, value)}
                        compact
                      />
                    ) : (
                      <div key={item.id} className="flex gap-2 text-[12px] leading-5 text-[#3a3f47] dark:text-gray-300">
                        <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#9098a4]" />
                        <EditableText
                          value={item.text}
                          onChange={value => onProjectItemTextChange(columnIndex, item.id, value)}
                          multiline
                          className="text-[12px] leading-5 text-[#3a3f47] dark:text-gray-300"
                          placeholder="Wpis"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type SlashCommand =
  | { label: string; aliases: string[]; kind: 'columns'; count: 2 | 3 }
  | { label: string; aliases: string[]; kind: 'insert'; insertText: string }
  | { label: string; aliases: string[]; kind: 'format'; format: 'heading' | 'quote' }
  | { label: string; aliases: string[]; kind: 'task' };

const SLASH_COMMANDS: SlashCommand[] = [
  { label: '3 kolumny', aliases: ['3 col', '3 cols', '3 kolumny', 'three columns'], kind: 'columns', count: 3 },
  { label: '2 kolumny', aliases: ['2 col', '2 cols', '2 kolumny', 'two columns'], kind: 'columns', count: 2 },
  { label: 'Task z listy', aliases: ['task', 'zadanie', 'zadania'], kind: 'task' },
  { label: 'Checkbox', aliases: ['checkbox', 'check', 'todo'], kind: 'insert', insertText: '☐ ' },
  { label: 'Lista', aliases: ['lista', 'list', 'bullet', 'punkt'], kind: 'insert', insertText: '• ' },
  { label: 'Nagłówek', aliases: ['naglowek', 'nagłówek', 'heading', 'head', 'hea', 'h1'], kind: 'format', format: 'heading' },
  { label: 'Cytat', aliases: ['cytat', 'quote', 'blockquote'], kind: 'format', format: 'quote' },
  { label: 'Tekst', aliases: ['tekst', 'text', 'paragraph'], kind: 'insert', insertText: '' },
];

function getSlashQuery(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized.startsWith('/')) return null;
  return normalized.slice(1).trim();
}

function getMatchingSlashCommands(value: string) {
  const query = getSlashQuery(value);
  if (query === null) return [];
  if (!query) return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter(command =>
    command.label.toLowerCase().includes(query) ||
    command.aliases.some(alias => alias.includes(query)),
  );
}

function editorGridClass(columnCount: number) {
  if (columnCount === 3) return 'lg:grid-cols-3';
  if (columnCount === 2) return 'lg:grid-cols-2';
  return 'grid-cols-1';
}

function getCurrentLine(content: string, caretPosition: number) {
  const beforeCaret = content.slice(0, caretPosition);
  const afterCaret = content.slice(caretPosition);
  const lineStart = beforeCaret.lastIndexOf('\n') + 1;
  const nextBreak = afterCaret.indexOf('\n');
  const lineEnd = nextBreak === -1 ? content.length : caretPosition + nextBreak;

  return {
    line: content.slice(lineStart, lineEnd),
    lineStart,
    lineEnd,
  };
}

function replaceCurrentLine(content: string, caretPosition: number, nextLine: string) {
  const currentLine = getCurrentLine(content, caretPosition);
  return {
    content: `${content.slice(0, currentLine.lineStart)}${nextLine}${content.slice(currentLine.lineEnd)}`,
    caret: currentLine.lineStart + nextLine.length,
  };
}

function getCurrentLineIndex(content: string, caretPosition: number) {
  return content.slice(0, getCurrentLine(content, caretPosition).lineStart).split('\n').length - 1;
}

function removeCurrentLine(content: string, caretPosition: number) {
  const currentLine = getCurrentLine(content, caretPosition);
  const removeStart = currentLine.lineStart > 0 ? currentLine.lineStart - 1 : currentLine.lineStart;
  const removeEnd = currentLine.lineEnd < content.length ? currentLine.lineEnd + 1 : currentLine.lineEnd;
  return `${content.slice(0, removeStart)}${content.slice(removeEnd)}`;
}

function getEditorCaretOffset(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const nodeInfo = getCurrentEditorNode(editor);
  if (nodeInfo) {
    const lines = Array.from(editor.childNodes).map(nodeText);
    const beforeLine = lines.slice(0, nodeInfo.index).reduce((total, line) => total + line.length + 1, 0);
    return beforeLine + editorLinePrefix(nodeInfo.node).length + getCaretOffsetInsideNode(nodeInfo.node);
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return 0;

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(editor);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().replace(/\u00a0/g, ' ').length;
}

function getSelectionMenuPosition(itemCount = SLASH_COMMANDS.length) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { top: 34, left: 8, maxHeight: 320 };

  const range = selection.getRangeAt(0).cloneRange();
  let rect = range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    range.insertNode(marker);
    rect = marker.getBoundingClientRect();
    marker.remove();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const menuWidth = 208;
  const preferredHeight = Math.min(340, Math.max(48, itemCount * 42 + 8));
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const margin = 12;
  const gap = 6;
  const availableBelow = viewportBottom - rect.bottom - margin;
  const availableAbove = rect.top - viewportTop - margin;
  const placeAbove = availableBelow < preferredHeight && availableAbove > availableBelow;
  const availableHeight = placeAbove ? availableAbove : availableBelow;
  const maxHeight = Math.max(120, Math.min(preferredHeight, availableHeight));
  const rawTop = placeAbove ? rect.top - maxHeight - gap : rect.bottom + gap;

  return {
    top: Math.max(viewportTop + margin, Math.min(rawTop, viewportBottom - maxHeight - margin)),
    left: Math.max(viewportLeft + margin, Math.min(rect.left, viewportRight - menuWidth - margin)),
    maxHeight,
  };
}

function editorTextFromElement(editor: HTMLElement) {
  const lines = Array.from(editor.childNodes).map(nodeText);
  if (lines.length === 0) return editor.innerText.replace(/\u00a0/g, ' ');
  return lines.join('\n').replace(/\u00a0/g, ' ');
}

function getCaretOffsetInsideNode(root: Node) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;

  const localRange = document.createRange();
  localRange.selectNodeContents(root);
  localRange.setEnd(range.startContainer, range.startOffset);
  return localRange.toString().replace(/\u00a0/g, ' ').length;
}

function parseEditorLine(text: string) {
  const trimmed = text.trimStart();

  const checkboxMatch =
    trimmed.match(/^- \[([ xX])\]\s*(.*)$/) ??
    trimmed.match(/^\[([ xX])\]\s*(.*)$/) ??
    trimmed.match(/^(☐|☑)\s*(.*)$/);

  if (checkboxMatch) {
    return {
      kind: checkboxMatch[1].toLowerCase() === 'x' || checkboxMatch[1] === '☑' ? 'checkbox-checked' : 'checkbox',
      text: checkboxMatch[2],
    };
  }

  const bulletMatch =
    trimmed.match(/^•\s*(.*)$/) ??
    trimmed.match(/^-\s+(?!\[[ xX]\]\s*)(.*)$/);

  if (bulletMatch) {
    return {
      kind: 'bullet',
      text: bulletMatch[1],
    };
  }

  return null;
}

function editorLinePrefix(node: Node) {
  if (!(node instanceof HTMLElement)) return '';
  if (node.dataset.goalLine === 'bullet') return '• ';
  if (node.dataset.goalLine === 'checkbox') return '☐ ';
  if (node.dataset.goalLine === 'checkbox-checked') return '☑ ';
  return '';
}

function isQuoteNode(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.tagName === 'BLOCKQUOTE';
}

function textFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLBRElement) return '\n';
  return Array.from(node.childNodes).map(textFromNode).join('');
}

function getContinuationPrefix(line: string) {
  const trimmed = line.trimStart();
  const leadingWhitespace = line.slice(0, line.length - trimmed.length);
  if (/^•\s+\S/.test(trimmed)) return `${leadingWhitespace}• `;
  if (/^-\s+\[[ xX]\]\s+\S/.test(trimmed)) return `${leadingWhitespace}- [ ] `;
  if (/^☐\s+\S/.test(trimmed) || /^☑\s+\S/.test(trimmed)) return `${leadingWhitespace}☐ `;
  if (/^-\s+\S/.test(trimmed)) return `${leadingWhitespace}- `;
  return null;
}

function isEmptyListLine(line: string) {
  return /^(•|-\s*|- \[[ xX]\]|☐|☑)\s*$/.test(line.trim());
}

function getLineWithoutListPrefix(line: string) {
  const trimmed = line.trimStart();
  const leadingWhitespace = line.slice(0, line.length - trimmed.length);
  const match =
    trimmed.match(/^•\s*(.*)$/) ??
    trimmed.match(/^- \[[ xX]\]\s*(.*)$/) ??
    trimmed.match(/^[☐☑]\s*(.*)$/) ??
    trimmed.match(/^-\s+(.*)$/);

  return match ? `${leadingWhitespace}${match[1]}` : null;
}

function htmlForEditorLine(text: string, format?: 'heading' | 'quote') {
  const parsedLine = parseEditorLine(text);
  if (!format && parsedLine) {
    const escapedText = escapeHtml(parsedLine.text) || '<br>';
    return `<div data-goal-line="${parsedLine.kind}"><span data-goal-line-text>${escapedText}</span></div>`;
  }

  const escaped = escapeHtml(text) || '<br>';
  if (format === 'heading') return `<h3>${escaped}</h3>`;
  if (format === 'quote') return `<blockquote>${escaped}</blockquote>`;
  return `<div>${escaped}</div>`;
}

function normalizeEditorHtml(sourceHtml: string, fallbackContent: string) {
  const template = document.createElement('template');
  template.innerHTML = sourceHtml || textToEditorHtml(fallbackContent) || '<div><br></div>';

  return Array.from(template.content.childNodes)
    .map(node => {
      if (node instanceof HTMLElement && node.tagName === 'H3') return node.outerHTML;
      if (node instanceof HTMLElement && node.tagName === 'BLOCKQUOTE') return node.outerHTML;
      return htmlForEditorLine(nodeText(node));
    })
    .join('');
}

function createEditorLineNode(text: string, format?: 'heading' | 'quote') {
  const template = document.createElement('template');
  template.innerHTML = htmlForEditorLine(text, format);
  return template.content.firstChild ?? document.createElement('div');
}

function replaceLineInEditorHtml(sourceHtml: string, content: string, caretPosition: number, lineHtml: string) {
  const template = document.createElement('template');
  template.innerHTML = normalizeEditorHtml(sourceHtml, content);

  const lineIndex = getCurrentLineIndex(content, caretPosition);
  const replacement = document.createElement('template');
  replacement.innerHTML = lineHtml;
  const replacementNode = replacement.content.firstChild ?? document.createElement('div');
  const nodes = Array.from(template.content.childNodes);

  if (nodes.length === 0) {
    template.content.appendChild(replacementNode);
    return { html: template.innerHTML, lineIndex };
  }

  while (nodes.length <= lineIndex) {
    const spacer = document.createElement('div');
    spacer.innerHTML = '<br>';
    template.content.appendChild(spacer);
    nodes.push(spacer);
  }

  nodes[lineIndex].replaceWith(replacementNode);
  return { html: template.innerHTML, lineIndex };
}

function getCurrentEditorHtml(columnId: string, fallbackHtml: string) {
  return document.querySelector<HTMLElement>(`[data-goal-column="${columnId}"]`)?.innerHTML ?? fallbackHtml;
}

function replaceEditorDom(columnId: string, html: string) {
  requestAnimationFrame(() => {
    const editor = document.querySelector<HTMLElement>(`[data-goal-column="${columnId}"]`);
    if (!editor) return;

    editor.innerHTML = html;
    editor.focus();
  });
}

function getTextNodeForCaret(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node;

  if (node instanceof HTMLElement) {
    const lineTextNode = node.querySelector('[data-goal-line-text]')?.firstChild;
    if (lineTextNode?.nodeType === Node.TEXT_NODE) return lineTextNode;
  }

  for (const child of Array.from(node.childNodes)) {
    const textNode = getTextNodeForCaret(child);
    if (textNode) return textNode;
  }

  return null;
}

function placeCaretInEditorLine(columnId: string, lineIndex: number, offset: number) {
  requestAnimationFrame(() => {
    const editor = document.querySelector<HTMLElement>(`[data-goal-column="${columnId}"]`);
    const target = editor?.childNodes[lineIndex] ?? editor?.lastChild;
    if (!editor || !target) return;

    editor.focus();
    const range = document.createRange();
    const visibleOffset = Math.max(0, offset - editorLinePrefix(target).length);
    const textNode = getTextNodeForCaret(target) ?? target;
    const length = textNode.textContent?.length ?? 0;
    range.setStart(textNode, Math.min(visibleOffset, length));
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
}

interface CurrentEditorNode {
  node: ChildNode;
  index: number;
}

function getCurrentEditorNode(editor: HTMLElement): CurrentEditorNode | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node: Node | null = selection.getRangeAt(0).startContainer;
  if (!editor.contains(node)) return null;

  if (node === editor) {
    const index = Math.max(0, Math.min(selection.getRangeAt(0).startOffset, editor.childNodes.length - 1));
    const child = editor.childNodes[index] ?? editor.lastChild;
    return child ? { node: child as ChildNode, index } : null;
  }

  while (node?.parentNode && node.parentNode !== editor) {
    node = node.parentNode;
  }

  if (!node || node === editor) return null;
  const childNode = node as ChildNode;
  const index = Array.from(editor.childNodes).indexOf(childNode);
  return index >= 0 ? { node: childNode, index } : null;
}

function nodeText(node: Node) {
  return `${editorLinePrefix(node)}${textFromNode(node).replace(/\u00a0/g, ' ').replace(/\u200b/g, '')}`;
}

function NotionBlockEditor({
  block,
  onChange,
  onTaskCommand,
}: {
  block: GoalNotionBlock;
  onChange: (updater: (block: GoalNotionBlock) => GoalNotionBlock) => void;
  onTaskCommand: (columnId: string, caretPosition: number) => void;
}) {
  const applyCommand = (command: SlashCommand, columnId: string, caretPosition: number) => {
    const column = block.columns.find(item => item.id === columnId);
    if (!column) return;

    if (command.kind === 'task') {
      onTaskCommand(columnId, caretPosition);
      return;
    }

    if (command.kind === 'columns') {
      const contentWithoutCommand = removeCurrentLine(column.content, caretPosition).trim();
      const columns = createEditorColumns(command.count, contentWithoutCommand);
      onChange(current => ({ ...current, columns }));
      focusEditorColumn(columns[0].id);
      return;
    }

    if (command.kind === 'format') {
      const formattedText = getCurrentLine(column.content, caretPosition).line.replace(/^\/\w*/, '').trim();
      const nextContent = replaceCurrentLine(column.content, caretPosition, formattedText).content;
      const replacement = replaceLineInEditorHtml(
        getCurrentEditorHtml(columnId, column.html ?? textToEditorHtml(column.content)),
        column.content,
        caretPosition,
        htmlForEditorLine(formattedText, command.format),
      );
      const nextHtml = replacement.html;
      onChange(current => ({
        ...current,
        columns: current.columns.map(column => column.id === columnId ? {
          ...column,
          content: nextContent,
          html: nextHtml,
        } : column),
      }));
      replaceEditorDom(columnId, nextHtml);
      placeCaretInEditorLine(columnId, replacement.lineIndex, formattedText.length);
      return;
    }

    const nextValue = replaceCurrentLine(column.content, caretPosition, command.insertText);
    const replacement = replaceLineInEditorHtml(
      getCurrentEditorHtml(columnId, column.html ?? textToEditorHtml(column.content)),
      column.content,
      caretPosition,
      htmlForEditorLine(command.insertText),
    );
    const nextHtml = replacement.html;
    onChange(current => ({
      ...current,
      columns: current.columns.map(column => column.id === columnId ? {
        ...column,
        content: nextValue.content,
        html: nextHtml,
      } : column),
    }));
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(`[data-goal-column="${columnId}"]`);
      if (!editor) return;

      editor.innerHTML = nextHtml;
      editor.focus();
    });
    placeCaretInEditorLine(columnId, replacement.lineIndex, command.insertText.length);
  };

  return (
    <div className="mt-3 rounded-[18px] border border-[#e8e8e4] bg-white p-4 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
      <div className={`grid gap-5 ${editorGridClass(block.columns.length)}`}>
        {block.columns.map((column, columnIndex) => (
          <div
            key={column.id}
            className={`min-w-0 ${columnIndex > 0 ? 'border-t border-[#f1f0ed] pt-4 dark:border-white/8 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0' : ''}`}
          >
            <EditorColumnTextarea
              column={column}
              onChange={(content, html) => onChange(current => ({
                ...current,
                columns: current.columns.map(item => item.id === column.id ? { ...item, content, html } : item),
              }))}
              onApplyCommand={applyCommand}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorColumnTextarea({
  column,
  onChange,
  onApplyCommand,
}: {
  column: GoalEditorColumn;
  onChange: (content: string, html: string) => void;
  onApplyCommand: (command: SlashCommand, columnId: string, caretPosition: number) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const [activeLine, setActiveLine] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 34, left: 8, maxHeight: 320 });
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const currentLine = activeLine.trim();
  const matchingCommands = getMatchingSlashCommands(currentLine);
  const safeActiveCommandIndex = Math.min(activeCommandIndex, Math.max(0, matchingCommands.length - 1));
  const isSlashOpen = focused && currentLine.startsWith('/') && matchingCommands.length > 0;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextHtml = normalizeEditorHtml(column.html ?? textToEditorHtml(column.content), column.content);
    if (document.activeElement === editor && lastHtmlRef.current !== null) return;
    if (nextHtml === lastHtmlRef.current) return;

    editor.innerHTML = nextHtml;
    lastHtmlRef.current = nextHtml;
  }, [column.content, column.html]);

  const syncCaret = () => {
    if (!editorRef.current || !wrapperRef.current) return;
    const caret = getEditorCaretOffset(editorRef.current);
    const nodeInfo = getCurrentEditorNode(editorRef.current);
    setCaretPosition(caret);
    setActiveLine(nodeInfo ? nodeText(nodeInfo.node) : getCurrentLine(editorTextFromElement(editorRef.current), caret).line);
    setMenuPosition(getSelectionMenuPosition(matchingCommands.length));
  };

  const keepFocusedIfEditorIsActive = () => {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (activeElement && wrapperRef.current?.contains(activeElement)) {
        setFocused(true);
        syncCaret();
        return;
      }

      setFocused(false);
    }, 120);
  };

  const persistEditor = () => {
    if (!editorRef.current) return;
    const content = editorTextFromElement(editorRef.current);
    const html = editorRef.current.innerHTML;
    const caret = getEditorCaretOffset(editorRef.current);
    const nodeInfo = getCurrentEditorNode(editorRef.current);
    lastHtmlRef.current = html;
    onChange(content, html);
    if (document.activeElement === editorRef.current) setFocused(true);
    setCaretPosition(caret);
    setActiveLine(nodeInfo ? nodeText(nodeInfo.node) : getCurrentLine(content, caret).line);
    if (wrapperRef.current) setMenuPosition(getSelectionMenuPosition(getMatchingSlashCommands(nodeInfo ? nodeText(nodeInfo.node) : getCurrentLine(content, caret).line).length));
  };

  const commitEditorDom = (shouldSync = true) => {
    if (!editorRef.current) return;
    const content = editorTextFromElement(editorRef.current);
    const html = editorRef.current.innerHTML;
    lastHtmlRef.current = html;
    onChange(content, html);
    if (shouldSync) requestAnimationFrame(syncCaret);
  };

  const replaceEditorNodeLine = (nodeInfo: CurrentEditorNode, nextLine: string) => {
    if (!editorRef.current || nodeInfo.node.parentNode !== editorRef.current) return;

    nodeInfo.node.replaceWith(createEditorLineNode(nextLine));
    setFocused(true);
    setActiveLine(nextLine);
    commitEditorDom(false);
    placeCaretInEditorLine(column.id, nodeInfo.index, nextLine.length);
    requestAnimationFrame(() => requestAnimationFrame(syncCaret));
  };

  const insertEditorNodeAfter = (nodeInfo: CurrentEditorNode, nextLine: string) => {
    if (!editorRef.current || nodeInfo.node.parentNode !== editorRef.current) return;

    editorRef.current.insertBefore(createEditorLineNode(nextLine), nodeInfo.node.nextSibling);
    setFocused(true);
    setActiveLine(nextLine);
    commitEditorDom(false);
    placeCaretInEditorLine(column.id, nodeInfo.index + 1, nextLine.length);
    requestAnimationFrame(() => requestAnimationFrame(syncCaret));
  };

  const insertQuoteSoftBreak = (quoteElement: HTMLElement) => {
    if (!editorRef.current || quoteElement.parentNode !== editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!quoteElement.contains(range.startContainer)) return;

    const lineBreak = document.createElement('br');
    range.deleteContents();
    range.insertNode(lineBreak);
    range.setStartAfter(lineBreak);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    setFocused(true);
    setActiveLine(nodeText(quoteElement));
    commitEditorDom(false);
    requestAnimationFrame(() => requestAnimationFrame(syncCaret));
  };

  const toggleEditorCheckboxLine = (lineElement: HTMLElement) => {
    if (!editorRef.current || lineElement.parentNode !== editorRef.current) return;

    const lineIndex = Array.from(editorRef.current.childNodes).indexOf(lineElement);
    const isChecked = lineElement.dataset.goalLine === 'checkbox-checked';
    const nextLine = `${isChecked ? '☐' : '☑'} ${(lineElement.textContent ?? '').replace(/\u00a0/g, ' ')}`;

    lineElement.replaceWith(createEditorLineNode(nextLine));
    setFocused(true);
    setActiveLine(nextLine);
    commitEditorDom(false);
    placeCaretInEditorLine(column.id, lineIndex, nextLine.length);
    requestAnimationFrame(() => requestAnimationFrame(syncCaret));
  };

  const handleEditorMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-goal-line="checkbox"], [data-goal-line="checkbox-checked"]')
      : null;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const isMarkerClick =
      event.clientX >= rect.left - 2 &&
      event.clientX <= rect.left + 28 &&
      event.clientY >= rect.top &&
      event.clientY <= Math.min(rect.bottom, rect.top + 28);
    if (!isMarkerClick) return;

    event.preventDefault();
    toggleEditorCheckboxLine(target);
  };

  const applyActiveCommand = () => {
    if (!matchingCommands[safeActiveCommandIndex]) return;
    onApplyCommand(matchingCommands[safeActiveCommandIndex], column.id, caretPosition);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isSlashOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveCommandIndex(index => (index + 1) % matchingCommands.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveCommandIndex(index => (index - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        applyActiveCommand();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setFocused(false);
      }
      return;
    }

    if (event.key === 'Enter') {
      const nodeInfo = editorRef.current ? getCurrentEditorNode(editorRef.current) : null;
      if (nodeInfo && isQuoteNode(nodeInfo.node)) {
        event.preventDefault();
        if (event.shiftKey) {
          insertQuoteSoftBreak(nodeInfo.node);
          return;
        }

        insertEditorNodeAfter(nodeInfo, '');
        return;
      }
    }

    if (event.key === 'Tab' && event.shiftKey) {
      const nodeInfo = editorRef.current ? getCurrentEditorNode(editorRef.current) : null;
      const line = nodeInfo ? nodeText(nodeInfo.node) : getCurrentLine(column.content, caretPosition).line;
      const nextLine = getLineWithoutListPrefix(line);
      if (nodeInfo && nextLine !== null) {
        event.preventDefault();
        replaceEditorNodeLine(nodeInfo, nextLine);
      }
      return;
    }

    if (event.key === 'Backspace') {
      const nodeInfo = editorRef.current ? getCurrentEditorNode(editorRef.current) : null;
      const line = nodeInfo ? nodeText(nodeInfo.node) : getCurrentLine(column.content, caretPosition).line;
      if (nodeInfo && isEmptyListLine(line)) {
        event.preventDefault();
        replaceEditorNodeLine(nodeInfo, '');
      }
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const nodeInfo = editorRef.current ? getCurrentEditorNode(editorRef.current) : null;
      const line = nodeInfo ? nodeText(nodeInfo.node) : getCurrentLine(column.content, caretPosition).line;
      if (nodeInfo && isEmptyListLine(line)) {
        event.preventDefault();
        replaceEditorNodeLine(nodeInfo, '');
        return;
      }

      const prefix = getContinuationPrefix(line);
      if (!nodeInfo || !prefix) return;

      event.preventDefault();
      insertEditorNodeAfter(nodeInfo, prefix);
    }
  };

  return (
    <div ref={wrapperRef} className="group relative">
      <div
        ref={editorRef}
        data-goal-column={column.id}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Pisz..."
        onFocus={() => {
          setFocused(true);
          syncCaret();
        }}
        onBlur={keepFocusedIfEditorIsActive}
        onInput={persistEditor}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onKeyDown={handleKeyDown}
        onMouseDown={handleEditorMouseDown}
        onMouseUp={syncCaret}
        className="mf-goal-editor min-h-[150px] w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-[13px] leading-6 text-[#3a3f47] outline-none transition-[background-color,border-color,box-shadow] duration-200 ease hover:bg-[#f7f7f4] focus:border-[#e8e8e4] focus:bg-white focus:ring-2 focus:ring-[#f1f0ed] dark:text-gray-300 dark:hover:bg-white/5 dark:focus:border-white/15 dark:focus:bg-white/5 dark:focus:ring-white/10"
      />

      {isSlashOpen && (
        <div
          className="fixed z-50 w-52 overflow-y-auto rounded-xl border border-[#e8e8e4] bg-white p-1 shadow-[0_14px_32px_-12px_rgba(15,17,21,.28)] dark:border-white/10 dark:bg-[#232326]"
          style={{ top: menuPosition.top, left: menuPosition.left, maxHeight: menuPosition.maxHeight }}
        >
          {matchingCommands.map((command, index) => (
            <button
              key={command.label}
              type="button"
              onMouseEnter={() => setActiveCommandIndex(index)}
              onMouseDown={event => {
                event.preventDefault();
                onApplyCommand(command, column.id, caretPosition);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors duration-200 ease ${
                index === safeActiveCommandIndex
                  ? 'bg-[#f7f7f4] text-[#0f1115] dark:bg-white/10 dark:text-white'
                  : 'text-[#3a3f47] hover:bg-[#f7f7f4] dark:text-gray-300 dark:hover:bg-white/8'
              }`}
            >
              {command.label}
              <Plus className="h-3.5 w-3.5 text-[#9098a4]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCheckRow({
  item,
  checked,
  onToggle,
  onTextChange,
  compact = false,
}: {
  item: GoalCheckItem;
  checked: boolean;
  onToggle: (id: string) => void;
  onTextChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`group flex w-full items-start gap-2 rounded-lg text-left transition-colors duration-200 ease hover:bg-[#f7f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/5 ${
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border transition-colors duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
          checked
            ? 'border-[#2f7a52] bg-[#2f7a52] text-white'
            : 'border-[#c0c5cc] bg-white text-transparent group-hover:border-[#9098a4] dark:border-white/20 dark:bg-[#232326]'
        }`}
        aria-label={checked ? 'Odznacz cel' : 'Oznacz cel'}
      >
        <Check className="h-3 w-3" />
      </button>
      <EditableText
        value={item.text}
        onChange={onTextChange}
        className={`min-w-0 text-[13px] leading-5 ${checked ? 'text-[#9098a4] line-through' : 'text-[#3a3f47] dark:text-gray-300'}`}
        placeholder="Punkt celu"
      />
    </div>
  );
}

function EditableText({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
  autoFocusSignal,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder: string;
  multiline?: boolean;
  autoFocusSignal?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const baseClass = `w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 -mx-1 transition-[background-color,border-color,box-shadow] duration-200 ease placeholder:text-[#b0b5be] hover:bg-[#f7f7f4] focus:border-[#e8e8e4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f1f0ed] dark:hover:bg-white/5 dark:focus:border-white/15 dark:focus:bg-white/5 dark:focus:ring-white/10 ${className}`;

  useEffect(() => {
    if (!multiline || !textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [multiline, value]);

  useEffect(() => {
    if (!autoFocusSignal) return;
    const target = multiline ? textareaRef.current : inputRef.current;
    target?.focus();
    target?.select();
  }, [autoFocusSignal, multiline]);

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={1}
        className={`${baseClass} resize-none overflow-hidden`}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className={baseClass}
    />
  );
}

function EditorTaskPickerModal({
  tasks,
  onClose,
  onSelect,
}: {
  tasks: AssignableTask[];
  onClose: () => void;
  onSelect: (task: AssignableTask) => void;
}) {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriorityValue>('all');
  const [sortMode, setSortMode] = useState<TaskSortMode>('default');

  const projectOptions = useMemo(() => {
    const names = new Set(tasks.map(task => task.projectName || 'Bez projektu'));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = tasks.filter(task => {
      const matchesSearch = !query ||
        task.content.toLowerCase().includes(query) ||
        task.projectName?.toLowerCase().includes(query) ||
        task.tags?.some(tag => tag.toLowerCase().includes(query));
      const matchesProject = projectFilter === 'all' || (task.projectName || 'Bez projektu') === projectFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesSearch && matchesProject && matchesPriority;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'priority') return priorityRank(a.priority) - priorityRank(b.priority);
      if (sortMode === 'date-asc') return parseTaskDate(a.dueDate) - parseTaskDate(b.dueDate);
      if (sortMode === 'date-desc') return parseTaskDate(b.dueDate) - parseTaskDate(a.dueDate);
      if (sortMode === 'project') return (a.projectName || 'Bez projektu').localeCompare(b.projectName || 'Bez projektu', 'pl');
      return Number(a.isCompleted) - Number(b.isCompleted);
    });
  }, [priorityFilter, projectFilter, search, sortMode, tasks]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f1115]/20 backdrop-blur-sm animate-fade-in dark:bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] animate-scale-in dark:border-white/10 dark:bg-[#1C1C1E] dark:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#9098a4]">Wstaw task</p>
            <h3 className="mt-1 truncate text-[18px] font-semibold text-[#0f1115] dark:text-white">Wybierz zadanie</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-[#f1f0ed] px-5 py-3 dark:border-white/8">
          <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2 text-[#5a606b] transition-colors duration-200 ease focus-within:border-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            <Search className="h-4 w-4 flex-none" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Szukaj tasków..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0f1115] outline-none placeholder:text-[#b0b5be] dark:text-white"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <FilterControl
              label="Projekt"
              value={projectFilter}
              onChange={setProjectFilter}
              options={[
                { value: 'all', label: 'Wszystkie' },
                ...projectOptions.map(projectName => ({ value: projectName, label: projectName })),
              ]}
            />
            <FilterControl
              label="Priorytet"
              value={priorityFilter}
              onChange={value => setPriorityFilter(value as 'all' | TaskPriorityValue)}
              options={[
                { value: 'all', label: 'Wszystkie' },
                { value: TaskPriority.P1, label: 'P1' },
                { value: TaskPriority.P2, label: 'P2' },
                { value: TaskPriority.P3, label: 'P3' },
                { value: TaskPriority.P4, label: 'P4' },
              ]}
            />
            <FilterControl
              label="Sort"
              value={sortMode}
              onChange={value => setSortMode(value as TaskSortMode)}
              options={[
                { value: 'default', label: 'Domyślnie' },
                { value: 'priority', label: 'Priorytet' },
                { value: 'date-asc', label: 'Data rosnąco' },
                { value: 'date-desc', label: 'Data malejąco' },
                { value: 'project', label: 'Projekt' },
              ]}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          <div className="space-y-1">
            {visibleTasks.map(task => {
              const dueDate = formatTaskDate(task.dueDate);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelect(task)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-200 ease hover:bg-[#f7f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/5"
                >
                  <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border transition-colors duration-200 ease ${
                    task.isCompleted
                      ? 'border-[#2f7a52] bg-[#2f7a52] text-white'
                      : 'border-[#c0c5cc] bg-white text-transparent dark:border-white/20 dark:bg-[#232326]'
                  }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] font-medium leading-5 ${task.isCompleted ? 'text-[#9098a4] line-through' : 'text-[#0f1115] dark:text-white'}`}>
                      {task.content}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#9098a4]">
                      {task.projectName && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-[#9098a4]" style={{ backgroundColor: task.projectColor ?? '#9098a4' }} />
                          {task.projectName}
                        </span>
                      )}
                      {dueDate && <span>{dueDate}</span>}
                      {task.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="rounded-md bg-[#f1f0ed] px-1.5 py-0.5 text-[11px] text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                          #{tag}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="rounded-md bg-[#f1f0ed] px-2 py-1 text-[11px] font-semibold text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                    {priorityLabel(task.priority)}
                  </span>
                </button>
              );
            })}

            {visibleTasks.length === 0 && (
              <div className="px-3 py-10 text-center text-[13px] font-medium text-[#9098a4]">
                Brak pasujących tasków.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GoalsRightRail({
  completion,
  linkedTasks,
  completedLinkedTasks,
  onAssign,
}: {
  completion: { completed: number; total: number; percent: number };
  linkedTasks: AssignableTask[];
  completedLinkedTasks: number;
  onAssign: () => void;
}) {
  return (
    <aside className="space-y-4">
      <div className="rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0f1115] dark:text-white">Postęp dnia</h3>
          <span className="text-[13px] font-medium text-[#3a3f47] dark:text-gray-300">{completion.completed} / {completion.total} ukończone</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#f1f0ed] dark:bg-white/8">
          <div className="h-full rounded-full bg-[#2f7a52] transition-all duration-300 ease" style={{ width: `${completion.percent}%` }} />
        </div>
        <p className="mt-3 text-right text-[12px] font-medium text-[#5a606b] dark:text-gray-400">{completion.percent}%</p>
      </div>

      <div className="rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-[#0f1115] dark:text-white">Powiązane taski</h3>
          <button
            type="button"
            onClick={onAssign}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[#e8e8e4] text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Przypisz taski"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {linkedTasks.length > 0 ? linkedTasks.slice(0, 5).map(task => (
            <div key={task.id} className="flex min-w-0 items-center gap-2 text-[13px] text-[#3a3f47] dark:text-gray-300">
              <span className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                task.isCompleted
                  ? 'border-[#2f7a52] bg-[#2f7a52] text-white'
                  : 'border-[#c0c5cc] bg-white text-transparent dark:border-white/20 dark:bg-[#232326]'
              }`}
              >
                <Check className="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1 truncate">{task.content}</span>
            </div>
          )) : (
            <p className="text-[13px] leading-5 text-[#9098a4]">Brak tasków dla tego dnia.</p>
          )}
        </div>

        <button
          type="button"
          onClick={onAssign}
          className="mt-4 inline-flex items-center gap-2 rounded-lg text-[13px] font-medium text-[#5a606b] transition-colors duration-200 ease hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:text-gray-400 dark:hover:text-white"
        >
          {completedLinkedTasks} z {linkedTasks.length} zamkniętych
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#0f1115] dark:text-white">Aktywność</h3>
          <span className="text-[12px] font-medium text-[#9098a4]">maj</span>
        </div>
        <MiniHeatmap />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border border-[#e8e8e4] bg-white p-4 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#edf5ee] text-[#2f7a52] dark:bg-[#2f7a52]/15">
            <Flame className="h-4 w-4" />
          </div>
          <p className="text-[12px] font-medium text-[#9098a4]">Streak</p>
          <p className="text-[20px] font-semibold text-[#0f1115] dark:text-white">4 dni</p>
        </div>
        <div className="rounded-[18px] border border-[#e8e8e4] bg-white p-4 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#edf5ee] text-[#2f7a52] dark:bg-[#2f7a52]/15">
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="text-[12px] font-medium text-[#9098a4]">Skuteczność</p>
          <p className="text-[20px] font-semibold text-[#0f1115] dark:text-white">78%</p>
        </div>
      </div>
    </aside>
  );
}

function MiniHeatmap() {
  const rows = ['Pn', 'Wt', 'Sr', 'Czw', 'Pt', 'Sob', 'Nd'];
  return (
    <div>
      <div className="grid grid-cols-[28px_repeat(8,12px)] gap-1.5">
        {rows.map((row, rowIndex) => (
          <div key={row} className="contents">
            <span className="text-[11px] font-medium text-[#5a606b] dark:text-gray-400">{row}</span>
            {Array.from({ length: 8 }).map((_, columnIndex) => {
              const level = HEATMAP_LEVELS[(columnIndex * rows.length + rowIndex) % HEATMAP_LEVELS.length];
              return <span key={`${row}-${columnIndex}`} className={`h-3 w-3 rounded-[4px] ${heatmapClass(level)}`} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#9098a4]">
        <span>Mniej</span>
        {[0, 1, 2, 3, 4].map(level => (
          <span key={level} className={`h-2.5 w-2.5 rounded-[3px] ${heatmapClass(level as 0 | 1 | 2 | 3 | 4)}`} />
        ))}
        <span>Więcej</span>
      </div>
    </div>
  );
}

function HeatmapPanel({ selectedDay, onSelectDay }: { selectedDay: GoalDay; onSelectDay: (dayId: string) => void }) {
  const rows = ['Pn', 'Wt', 'Sr', 'Czw', 'Pt', 'Sob', 'Nd'];
  const monthDays = Array.from({ length: 35 }).map((_, index) => ({
    id: GOAL_DAYS[index % GOAL_DAYS.length].id,
    dayNumber: index + 1,
    level: HEATMAP_LEVELS[index % HEATMAP_LEVELS.length],
  }));

  return (
    <section className="rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#5a606b] dark:text-gray-400">
            <CalendarDays className="h-4 w-4" />
            Miesięczny tracker
          </div>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0f1115] dark:text-white">Maj - postęp celów</h2>
        </div>
        <div className="rounded-lg bg-[#f7f7f4] px-3 py-2 text-[13px] font-medium text-[#3a3f47] dark:bg-white/5 dark:text-gray-300">
          Wybrany: {selectedDay.dayShort}, {selectedDay.dateLabel}
        </div>
      </div>

      <div className="overflow-x-auto pb-2 no-scrollbar">
        <div className="grid min-w-[250px] grid-cols-[34px_repeat(5,32px)] gap-2">
          {rows.map((row, rowIndex) => (
            <div key={row} className="contents">
              <span className="pt-2 text-[12px] font-medium text-[#5a606b] dark:text-gray-400">{row}</span>
              {monthDays
                .filter((_, index) => index % 7 === rowIndex)
                .map(day => {
                  const isSelected = day.id === selectedDay.id;
                  return (
                    <button
                      key={`${row}-${day.dayNumber}`}
                      type="button"
                      onClick={() => onSelectDay(day.id)}
                      className={`flex aspect-square w-8 items-center justify-center rounded-[7px] border text-[11px] font-medium transition-[border-color,transform,box-shadow] duration-200 ease hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
                        isSelected
                          ? 'border-[#0f1115] shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] dark:border-white dark:shadow-none'
                          : 'border-transparent'
                      } ${heatmapClass(day.level)}`}
                    >
                      {day.dayNumber}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Najlepszy tydzień', '19-25 maja'],
          ['Średnia realizacja', '78%'],
          ['Dni bez zera', '18 / 31'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#f1f0ed] bg-[#fcfcfa] px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
            <p className="text-[12px] font-medium text-[#9098a4]">{label}</p>
            <p className="mt-1 text-[18px] font-semibold text-[#0f1115] dark:text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = 'default',
  onClose,
  onConfirm,
}: ConfirmDialogState & {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const isDanger = tone === 'danger';

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f1115]/24 backdrop-blur-sm animate-fade-in dark:bg-black/55" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-confirm-title"
        aria-describedby="goal-confirm-description"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] animate-scale-in dark:border-white/10 dark:bg-[#1C1C1E] dark:shadow-none"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
            isDanger
              ? 'bg-red-50 text-red-600 dark:bg-red-500/12 dark:text-red-300'
              : 'bg-[#f7f7f4] text-[#2f7a52] dark:bg-white/8 dark:text-[#93b59b]'
          }`}>
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id="goal-confirm-title" className="text-[18px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {title}
            </h3>
            <p id="goal-confirm-description" className="mt-1 text-[13px] leading-5 text-[#5a606b] dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white px-3 text-[13px] font-medium text-[#3a3f47] transition-colors duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-white transition-[background-color,box-shadow] duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0f1115] hover:bg-[#2a2d33] dark:bg-white dark:text-[#0f1115] dark:hover:bg-gray-100'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
        <Filter className="h-3 w-3" />
        {label}
      </span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-[#e8e8e4] bg-white px-2.5 text-[12.5px] font-medium text-[#0f1115] outline-none transition-[background-color,border-color,box-shadow] duration-200 ease hover:bg-[#f7f7f4] focus:border-[#c0c5cc] focus:ring-2 focus:ring-[#e8e8e4] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:focus:border-white/20 dark:focus:ring-white/10"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssignTasksModal({
  dayTitle,
  tasks,
  initialSelectedIds,
  onClose,
  onSave,
}: {
  dayTitle: string;
  tasks: AssignableTask[];
  initialSelectedIds: string[];
  onClose: () => void;
  onSave: (taskIds: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriorityValue>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortMode, setSortMode] = useState<TaskSortMode>('default');
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds));

  const projectOptions = useMemo(() => {
    const names = new Set(tasks.map(task => task.projectName || 'Bez projektu'));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [tasks]);

  const tagOptions = useMemo(() => {
    const tags = new Set(tasks.flatMap(task => task.tags ?? []));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = tasks.filter(task => {
      const matchesSearch = !query ||
        task.content.toLowerCase().includes(query) ||
        task.projectName?.toLowerCase().includes(query) ||
        task.tags?.some(tag => tag.toLowerCase().includes(query));
      const matchesProject = projectFilter === 'all' || (task.projectName || 'Bez projektu') === projectFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesTag = tagFilter === 'all' || task.tags?.includes(tagFilter);
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'with-date' && Boolean(task.dueDate)) ||
        (dateFilter === 'no-date' && !task.dueDate) ||
        (dateFilter === 'completed' && task.isCompleted);

      return matchesSearch && matchesProject && matchesPriority && matchesTag && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      const selectedDiff = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
      if (selectedDiff !== 0) return selectedDiff;
      if (sortMode === 'priority') return priorityRank(a.priority) - priorityRank(b.priority);
      if (sortMode === 'date-asc') return parseTaskDate(a.dueDate) - parseTaskDate(b.dueDate);
      if (sortMode === 'date-desc') return parseTaskDate(b.dueDate) - parseTaskDate(a.dueDate);
      if (sortMode === 'project') return (a.projectName || 'Bez projektu').localeCompare(b.projectName || 'Bez projektu', 'pl');
      return 0;
    });
  }, [dateFilter, priorityFilter, projectFilter, search, selectedIds, sortMode, tagFilter, tasks]);

  const toggleTask = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f1115]/20 backdrop-blur-sm animate-fade-in dark:bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] animate-scale-in dark:border-white/10 dark:bg-[#1C1C1E] dark:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#9098a4]">Powiązania dnia</p>
            <h3 className="mt-1 truncate text-[18px] font-semibold text-[#0f1115] dark:text-white">{dayTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-[#f1f0ed] px-5 py-3 dark:border-white/8">
          <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2 text-[#5a606b] transition-colors duration-200 ease focus-within:border-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            <Search className="h-4 w-4 flex-none" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Szukaj tasków..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0f1115] outline-none placeholder:text-[#b0b5be] dark:text-white"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <FilterControl
              label="Projekt"
              value={projectFilter}
              onChange={setProjectFilter}
              options={[
                { value: 'all', label: 'Wszystkie' },
                ...projectOptions.map(projectName => ({ value: projectName, label: projectName })),
              ]}
            />
            <FilterControl
              label="Priorytet"
              value={priorityFilter}
              onChange={value => setPriorityFilter(value as 'all' | TaskPriorityValue)}
              options={[
                { value: 'all', label: 'Wszystkie' },
                { value: TaskPriority.P1, label: 'P1' },
                { value: TaskPriority.P2, label: 'P2' },
                { value: TaskPriority.P3, label: 'P3' },
                { value: TaskPriority.P4, label: 'P4' },
              ]}
            />
            <FilterControl
              label="Data"
              value={dateFilter}
              onChange={value => setDateFilter(value as DateFilterMode)}
              options={[
                { value: 'all', label: 'Wszystkie' },
                { value: 'with-date', label: 'Z datą' },
                { value: 'no-date', label: 'Bez daty' },
                { value: 'completed', label: 'Ukończone' },
              ]}
            />
            <FilterControl
              label="Tag"
              value={tagFilter}
              onChange={setTagFilter}
              options={[
                { value: 'all', label: 'Wszystkie' },
                ...tagOptions.map(tag => ({ value: tag, label: `#${tag}` })),
              ]}
            />
            <FilterControl
              label="Sort"
              value={sortMode}
              onChange={value => setSortMode(value as TaskSortMode)}
              options={[
                { value: 'default', label: 'Domyślnie' },
                { value: 'priority', label: 'Priorytet' },
                { value: 'date-asc', label: 'Data rosnąco' },
                { value: 'date-desc', label: 'Data malejąco' },
                { value: 'project', label: 'Projekt' },
              ]}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          <div className="space-y-1">
            {visibleTasks.map(task => {
              const selected = selectedIds.has(task.id);
              const dueDate = formatTaskDate(task.dueDate);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-200 ease hover:bg-[#f7f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:hover:bg-white/5 ${
                    selected ? 'bg-[#f7f7f4] dark:bg-white/5' : ''
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border transition-colors duration-200 ease ${
                    selected
                      ? 'border-[#2f7a52] bg-[#2f7a52] text-white'
                      : 'border-[#c0c5cc] bg-white text-transparent dark:border-white/20 dark:bg-[#232326]'
                  }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] font-medium leading-5 ${task.isCompleted ? 'text-[#9098a4] line-through' : 'text-[#0f1115] dark:text-white'}`}>
                      {task.content}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#9098a4]">
                      {task.projectName && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-[#9098a4]" style={{ backgroundColor: task.projectColor ?? '#9098a4' }} />
                          {task.projectName}
                        </span>
                      )}
                      {dueDate && <span>{dueDate}</span>}
                      {task.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="rounded-md bg-[#f1f0ed] px-1.5 py-0.5 text-[11px] text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                          #{tag}
                        </span>
                      ))}
                      {task.isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[#2f7a52]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          ukończone
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="rounded-md bg-[#f1f0ed] px-2 py-1 text-[11px] font-semibold text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                    {priorityLabel(task.priority)}
                  </span>
                </button>
              );
            })}

            {visibleTasks.length === 0 && (
              <div className="px-3 py-10 text-center text-[13px] font-medium text-[#9098a4]">
                Brak pasujących tasków.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <span className="text-[13px] font-medium text-[#5a606b] dark:text-gray-400">
            Wybrane: {selectedIds.size}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e8e8e4] px-4 py-2 text-[13px] font-medium text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => onSave(Array.from(selectedIds))}
              className="rounded-lg bg-[#0f1115] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-200 ease hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:bg-white dark:text-black dark:hover:bg-[#f1f0ed]"
            >
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
