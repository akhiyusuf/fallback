# Fallback — Architecture & Module Contracts

Offline-only habit/task tracker. Expo SDK 57 + expo-router + TypeScript (strict).
Every commitment has an **ideal** version (credit 1.0) and a **fallback** version
(credit 0.5); skipping scores 0. A rolling 30-day "discipline score" is derived
from credit. See `SPEC` summary at the bottom for product behavior.

**Ground rules for all modules**

- TypeScript strict; zero type errors. Import project code via the `@/` alias
  (`@/types`, `@/constants/theme`, `@/lib/dates`, …).
- Use ONLY installed deps: expo (57), expo-router, react-native, @expo/vector-icons
  (Ionicons), @react-native-async-storage/async-storage, expo-notifications,
  expo-haptics, expo-clipboard, @react-native-community/datetimepicker,
  react-native-android-widget, react-native-safe-area-context. **No new deps.**
- Everything must run without crashing on web/Expo Go where a native module is
  unavailable: wrap Haptics/Notifications/widget calls in try/catch and no-op on
  `Platform.OS === 'web'` where sensible.
- All UI reads tokens from `useTheme()` — never hardcode colors. Create styles
  with `StyleSheet.create` for static parts and inline token-driven styles for
  themed parts (or a `makeStyles(theme)` memo). Rounded corners via
  `theme.radius`, spacing via `theme.spacing`.
- Dates: `'YYYY-MM-DD'` keys, times `'HH:mm'` (24h), weekdays 0=Sun…6=Sat.
  Always use helpers from `@/lib/dates` — never format dates by hand.

## Already-written foundation (read these files first)

- `src/types.ts` — all shared types (`Commitment`, `Step`, `Task`, `AppData`,
  `AppSettings`, `CREDIT`, `getParentId`, `parentIdField`, defaults).
- `src/constants/theme.ts` — `Theme`, `getTheme(dark)`, tokens, `TAG_COLOR_CHOICES`.
- `src/lib/dates.ts` — every date/time helper.
- `src/lib/ids.ts` — `newId(prefix)`.

## Module contracts

### `src/lib/storage.ts`

```ts
export const STORAGE_KEY = 'fallback.appData.v1';
export function createDefaultAppData(): AppData;
/** Never throws; coerces any legacy/corrupt shape into a valid AppData. */
export function migrateAppData(raw: unknown): AppData;
export async function loadAppData(): Promise<AppData>;   // defaults on missing/corrupt
export async function saveAppData(data: AppData): Promise<void>;
export async function clearAppData(): Promise<void>;
```

Migration guards (`migrateAppData`):
- Non-object / null → `createDefaultAppData()`.
- Steps stored as plain strings (legacy) → `{ id: newId('step'), title, frequency: 'daily' }`.
- Legacy commitment fields: `task`→`idealTask`, `subtasks`→`idealSubtasks`,
  `fallback`→`fallbackTask`, `fallbackSteps`→`fallbackSubtasks`.
- Missing `type`: infer — has `targetEventDate` → 'event'; has `targetDate` →
  'regimen'; else 'routine'.
- Clamp `dailyFrequency` to 1–10 integer; default 1. `frequency` not
  'daily'/'weekly' → 'daily'. Filter `targetDays` to integers 0–6.
- Task `status` not one of the four values → 'pending'; `completedSubtasks`
  default `[]`; drop tasks without a parseable `date` or any parent id.
- Merge `importanceMap`/`necessityMap` over the DEFAULT_* maps; merge `settings`
  over `DEFAULT_SETTINGS`; coerce `hasCompletedOnboarding` to boolean.
- Ensure commitments referenced tags exist in the maps (add with a
  `TAG_COLOR_CHOICES` color if missing).
- Stamp `version: SCHEMA_VERSION`.

### `src/lib/taskGeneration.ts`

```ts
/** True if the commitment has an occurrence on dateKey (respects createdAt date,
 *  frequency/targetDays, event targetEventDate, regimen targetDate deadline —
 *  occurrences run up to AND INCLUDING the deadline; indefinite when null). */
export function occursOnDate(c: Commitment, dateKey: string): boolean;
/** True if a step is due on dateKey (daily, or weekly + targetDays match). */
export function stepDueOnDate(step: Step, dateKey: string): boolean;
/** Occurrence count per day: events → 1; else clamp(dailyFrequency,1,10). */
export function instancesForDate(c: Commitment): number;
/** 'HH:mm' for an instance: events → c.targetTime; else c.targetTimes?.[i] ?? null. */
export function targetTimeFor(c: Commitment, instanceIndex: number): string | null;
/** Core reconciler — see rules below. Pure: returns a NEW tasks array. */
export function syncTasksForDates(
  data: AppData, dateKeys: string[], today: string
): { tasks: Task[]; changed: boolean };
/** pending + date < today → 'missed'; otherwise the stored status. */
export function effectiveStatus(task: Task, today: string): TaskStatus;
export function taskCredit(task: Task): number;            // CREDIT[status]
export function tasksOn(tasks: Task[], dateKey: string): Task[];
```

`syncTasksForDates` rules (implement carefully, in this order):
1. **Drop orphans** (any date): parent commitment no longer exists.
2. **De-duplicate** (any date): for identical `(parentId, date, instanceIndex)`,
   keep the completed one if any (ideal > fallback), else the first; drop rest.
3. **Reconcile future/pending** (only tasks with `status === 'pending'` and
   `date >= today`): drop if `!occursOnDate(parent, date)` or
   `instanceIndex >= instancesForDate(parent)`; else set
   `targetTime = targetTimeFor(parent, instanceIndex)` when different.
   Completed/past tasks are history — never dropped or retimed by this rule.
4. **Generate**: for each `dateKey` in `dateKeys`, each commitment with
   `occursOnDate` true and `dateKey >= dateKeyOfIso(c.createdAt)`: create any
   missing instances `0..instancesForDate-1` as
   `{ id: newId('task'), [parentIdField(c.type)]: c.id, date, targetTime,
      instanceIndex, status: 'pending', completedSubtasks: [] }`.
5. `changed` is false iff nothing was added/removed/modified (avoid save loops).
   Task ids of surviving tasks must be preserved.

### `src/lib/score.ts`

```ts
/** Rolling window [today-(windowDays-1) .. today]; null when no tasks in window.
 *  Score = round(100 * Σ CREDIT[status] / count). Pending past tasks count 0. */
export function disciplineScore(tasks: Task[], today: string, windowDays?: number): number | null;
/** done = ideal+fallback completed; total = all tasks that day. */
export function dayCompletion(dayTasks: Task[]): { done: number; total: number };
export type DayDot = 'none' | 'pending' | 'ideal' | 'fallback' | 'missed';
/** none if empty; 'ideal' if every task completed_ideal; 'fallback' if every
 *  task completed (mixed levels ok); 'missed' if any effective status is
 *  missed; else 'pending'. */
export function dayDot(dayTasks: Task[], today: string): DayDot;
```

### `src/lib/notifications.ts`

```ts
/** Sets the foreground notification handler + Android channel. Safe on web. */
export function initNotifications(): void;
export async function ensurePermissions(): Promise<boolean>;
/** Cancel everything, then (if settings.remindersEnabled) schedule for every
 *  PENDING task dated [today .. today+6] that has a targetTime:
 *  - at-time: title = commitment name, body = `Ideal: {idealTask} · Fallback: {fallbackTask}`
 *  - lead: fires reminderLeadMinutes earlier, title = `{name} in {N} min`, same body.
 *  Skip fire times in the past; cap at 50 scheduled notifications; try/catch
 *  everything (no-op on web / missing permissions). */
export async function rescheduleAllNotifications(data: AppData): Promise<void>;
```

Use `Notifications.scheduleNotificationAsync` with a date trigger
(`{ type: SchedulableTriggerInputTypes.DATE, date }`). Android channel id
`'reminders'`, importance HIGH.

### Widgets (Android, non-fatal everywhere else)

- `src/widgets/TodayWidget.tsx` — pure widget UI using `FlexWidget`/`TextWidget`
  from react-native-android-widget. Props:
  `{ done: number; total: number; score: number | null;
     items: { name: string; time: string | null; status: TaskStatus }[]; dark: boolean }`.
  Rounded card look, sage/amber status dots, "done/total" counter (max ~5 items).
- `src/widgets/widget-task-handler.tsx` —
  `export async function widgetTaskHandler(props: WidgetTaskHandlerProps)`:
  loads storage, computes today's tasks via `syncTasksForDates` (read-only),
  renders `TodayWidget` via `props.renderWidget(...)` for widget name `'FallbackToday'`.
- `src/lib/widgets.ts` — `export async function updateWidgets(data: AppData): Promise<void>`
  — no-op unless `Platform.OS === 'android'`; `requestWidgetUpdate({ widgetName: 'FallbackToday', renderWidget: ... })`
  in try/catch.
- Root `index.ts`: `import 'expo-router/entry';` then guarded
  `registerWidgetTaskHandler(widgetTaskHandler)` (try/catch, Android only).
  `package.json` `"main"` → `"index.ts"`.
- `app.json` plugins gains:
  `["react-native-android-widget", { "widgets": [{ "name": "FallbackToday", "label": "Fallback — Today", "description": "Today's tasks and progress", "minWidth": "180dp", "minHeight": "120dp", "targetCellWidth": 3, "targetCellHeight": 2, "updatePeriodMillis": 1800000 }] }]`

### `src/store/AppContext.tsx` — the single state provider

```ts
export function AppProvider(props: { children: React.ReactNode }): React.ReactElement;
export function useApp(): AppStore;      // throws outside provider
export function useTheme(): Theme;       // shorthand for useApp().theme

export type NewCommitmentInput = Omit<Commitment, 'id' | 'createdAt'>;

export interface AppStore {
  ready: boolean;                        // storage finished loading
  data: AppData;
  theme: Theme;                          // getTheme(data.settings.darkMode)
  score30: number | null;                // disciplineScore(data.tasks, todayKey())

  addCommitment(input: NewCommitmentInput): void;
  updateCommitment(id: string, patch: Partial<Commitment>): void;
  deleteCommitment(id: string): void;    // sync drops its tasks
  duplicateCommitment(id: string): void; // deep copy, new ids (incl. step ids), name + ' copy'
  getCommitment(id: string): Commitment | undefined;

  ensureTasksFor(dateKey: string): void; // syncTasksForDates over [dateKey .. dateKey+6]
  completeTask(taskId: string, level: 'ideal' | 'fallback'): void;
  reopenTask(taskId: string): void;      // status → 'pending' (checks kept)
  toggleSubtask(taskId: string, stepId: string, group: 'ideal' | 'fallback'): void;

  addTodo(title: string): void;          // ignore blank titles
  toggleTodo(id: string): void;
  deleteTodo(id: string): void;

  addTag(kind: TagKind, name: string, color: string): void;
  setTagColor(kind: TagKind, name: string, color: string): void;

  setSettings(patch: Partial<AppSettings>): void;
  completeOnboarding(): void;
  wipeAll(): Promise<void>;              // clear storage → fresh defaults (ready stays true)
  exportBackup(): string;                // JSON.stringify(data, null, 2)
}
```

Behavior:
- Load on mount (`loadAppData`), then `ensureTasksFor(todayKey())`, set `ready`.
- Every data change: debounce ~250ms → `saveAppData`. On AppState →
  'background'/'inactive': flush pending save immediately. On → 'active':
  reload from disk, then `ensureTasksFor(todayKey())` (date may have rolled over).
- Every data change (debounced ~1s): `rescheduleAllNotifications(data)` and
  `updateWidgets(data)` — fire-and-forget.
- After any commitment add/update/delete/duplicate: re-run
  `syncTasksForDates` over `[today .. today+6]` so tasks stay reconciled.
- `toggleSubtask`: toggle `stepId` in `completedSubtasks`. Then, when
  `settings.autoCompleteSteps`:
  - all DUE (per `stepDueOnDate` on task.date) ideal steps checked & non-empty
    → status 'completed_ideal';
  - else all due fallback steps checked & non-empty and status isn't
    'completed_ideal' → 'completed_fallback';
  - if a step is UNchecked and the task was completed at that group's level →
    status back to 'pending'.
- `completeTask`/`reopenTask`/`toggleSubtask` trigger light haptic
  (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`, try/catch, skip web).
- `setSettings({ remindersEnabled: true })` should fire `ensurePermissions()`
  (fire-and-forget).
- Keep `data` in a ref alongside state so debounced/save callbacks never write
  stale state.

### UI kit — `src/components/ui/` (one file per component + `index.ts` barrel)

All take theme from `useTheme()`. Exact prop contracts:

```ts
Screen:    { children; scroll?: boolean; padded?: boolean }         // SafeArea top, bg background
Card:      ViewProps & { padded?: boolean }                          // surface, radius.md, 1px border, faint shadow
AppButton: { label: string; onPress(): void; sub?: string;           // sub = smaller 2nd line
             variant?: 'primary'|'fallback'|'secondary'|'ghost'|'danger';
             size?: 'sm'|'md'|'lg'; disabled?: boolean; style?: StyleProp<ViewStyle> }
Chip:      { label: string; color?: string; selected?: boolean;      // tag pill: tinted bg color+'26', label in color
             onPress?(): void; small?: boolean }
IconButton:{ icon: ComponentProps<typeof Ionicons>['name']; onPress(): void;
             size?: number; color?: string; badge?: number;          // badge: small count bubble
             accessibilityLabel?: string }
EmptyState:{ icon?: Ionicons name; title: string; message?: string;
             actionLabel?: string; onAction?(): void }
TextField: TextInputProps & { label?: string; error?: string }       // surfaceAlt bg, radius.sm
SectionLabel: { children: string }                                   // tiny uppercase muted
BottomSheet: { visible: boolean; onClose(): void; title?: string; children }
           // RN Modal, overlay tap closes, top-rounded sheet, drag-handle bar, KeyboardAvoidingView
Checkbox:  { checked: boolean; onToggle(): void; color?: string; label?: string;
             badge?: string; strike?: boolean }
SegmentedControl: { options: { label: string; value: string }[]; value: string;
             onChange(v: string): void }
ProgressBar: { value: number /* 0..1 */; color?: string }
Row:       { label: string; sub?: string; right?: React.ReactNode; onPress?(): void;
             danger?: boolean }                                      // settings-style row
```

Buttons: primary = filled `colors.primary`/`onPrimary`; fallback = filled
`colors.fallbackSoft` with `colors.fallback` text + border; secondary =
`surfaceAlt` fill, `text`; ghost = transparent, `textSecondary`; danger =
`dangerSoft` fill, `danger` text. Radius `radius.sm`–`md`, generous padding.

### Screens & feature components (wave 2)

**`src/components/TaskCard.tsx`** —
`{ task: Task; commitment: Commitment; readOnly?: boolean; hideActions?: boolean }`.
Title; meta row: `formatTime(task.targetTime)` and instance " · 2/3" when
dailyFrequency > 1 (or for regimens "N days left"/"Ongoing"); importance +
necessity Chips (colors from the maps). Pending/missed: large primary
AppButton `Done` with `sub: commitment.idealTask`, then smaller fallback-variant
AppButton `Fallback` with `sub: commitment.fallbackTask`. Missed (effective)
shows a small red "Missed" tag but buttons still work (retro-complete allowed).
Completed: dimmed, strikethrough title, level tag ("Done · ideal" green /
"Done · fallback" amber), ghost `Re-open` button. If any due steps exist
(`stepDueOnDate` on `task.date`): chevron IconButton expands ideal checklist
(primary accent) + fallback checklist (amber accent, visually distinct panel);
Checkbox per step with optional badge; toggling calls `toggleSubtask`.
Edit (pencil → `router.push({ pathname: '/edit', params: { type, id } })`) and
duplicate (copy icon → `duplicateCommitment`) icons; hidden when
readOnly/hideActions. `readOnly` also disables all buttons/checkboxes.

**`src/components/DateStrip.tsx`** —
`{ selected: string; onSelect(key: string): void; onOpenCalendar(): void }`.
Horizontal FlatList of todayKey()-30 … +30; item = weekday short over day
number; today gets an outline/dot, selected gets filled primary pill.
`getItemLayout` + `initialScrollIndex` centering the selected date; calendar
IconButton pinned at the right edge.

**`src/components/FilterBar.tsx`** —
`{ done: number; total: number; category: string | null; onPrev(): void; onNext(): void }`.
Left: "done/total done" in tabular nums; right: ◀ `category ?? 'All'` ▶.

**`src/components/MonthCalendar.tsx`** —
`{ visible: boolean; onClose(): void; selected: string; onSelectDay(key: string): void }`.
Modal overlay, centered Card: month header with ◀ ▶ nav; weekday row; grid via
`daysInMonth`/`firstWeekdayOfMonth`/`makeDateKey`; per-day dot colored by
`dayDot(tasksOn(data.tasks, key), today)` (statusPending/Ideal/Fallback/Missed);
small diamond (◆) under days where any regimen `targetDate === key`; selected
day ring; legend row; `Back to Today` AppButton → `onSelectDay(todayKey())`.
Tapping a day selects + closes.

**`src/components/TodoSheet.tsx`** — `{ visible: boolean; onClose(): void }`.
BottomSheet titled "To-dos": TextField + add IconButton; "X/Y finished"
caption (tabular nums); open items (Checkbox toggle, trash IconButton);
"Completed" SectionLabel + struck-through items. Uses `useApp()` todos API.

**`src/app/(tabs)/index.tsx`** — Routines tab (main daily screen).
State: `selected` date (default today), category cursor. On `selected` change →
`ensureTasksFor(selected)`. Day tasks = tasks on `selected` whose parent type is
'routine' **or** 'regimen', sorted by targetTime (nulls last) then name.
Header: caption `formatDisplayDate(selected)`, title "Routines", small score
chip (`score30` ≠ null → "30d · {score}%"), add IconButton →
`/edit?type=routine`. DateStrip; FilterBar (categories cycle All + every
importance/necessity tag present among the day's tasks; filter matches either
tag); TaskCard list; EmptyState ("Nothing scheduled", action "Add a routine").

**`src/app/(tabs)/events.tsx`** — Events tab. Same skeleton as Routines
(own `selected` date + strip + calendar). Shows event-type tasks for the day
(timed first) **plus** read-only TaskCards for regimen tasks whose parent
`targetDate === selected` (deadline day). Header has todo IconButton with
unfinished-count badge → TodoSheet; add IconButton → `/edit?type=event`.
EmptyState with create action.

**`src/app/(tabs)/regimens.tsx`** — read-only overview, always today (no date
strip). One card per regimen commitment: name, deadline line ("N days left ·
Jul 20, 2026", "Due today", "Ended Jul 1, 2026" when past, or "Ongoing"), tag
chips, today's completion hint (done/total of its today tasks). FilterBar over
regimen tags; add IconButton → `/edit?type=regimen`; EmptyState. Completion
happens on the Routines tab — no action buttons here.

**`src/app/(tabs)/settings.tsx`** — sections with SectionLabels:
1. *Score*: Card with "30-day discipline" + big % (or "—") + ProgressBar.
2. *Preferences*: Rows with Switch: Reminders (on-enable → permissions via
   store), Dark Mode, Auto-complete steps; "Reminder lead time" row cycling
   5/10/15/30/60 min on press.
3. *Categories*: for each kind (Importance, Necessity): rows of tag name +
   color dot; tapping a row expands a swatch row (TAG_COLOR_CHOICES) →
   `setTagColor`; "+ Add tag" row → inline TextField + swatch row → `addTag`.
4. *Manage*: search TextField; SegmentedControl Routines/Events/Regimens;
   filtered list rows (name + schedule summary) with pencil (→ `/edit?type=X&id=Y`)
   and trash (Alert confirm → `deleteCommitment`).
5. *Data*: Row "Backup Data" (sub: "Copy everything as JSON") →
   `Clipboard.setStringAsync(exportBackup())` + confirmation Alert; danger Row
   "Wipe Everything" → Alert confirm → `await wipeAll()` →
   `router.replace('/onboarding')`.

**`src/app/edit.tsx`** — create/edit form, modal presentation. Params via
`useLocalSearchParams<{ type?: string; id?: string }>`; editing when `id`
resolves via `getCommitment`. Own header row (title "New routine"/"Edit
routine"/…, Cancel ghost button → `router.back()`, Save primary button).
Fields: name TextField; "Ideal" Card (primary accent): idealTask TextField +
StepsEditor; "Fallback" Card (amber `fallbackSoft` background — visually
distinct): fallbackTask TextField + StepsEditor accent fallback; TagPicker
importance; TagPicker necessity; timing per type:
- routine: SegmentedControl Daily/Weekly (weekly → weekday multi-select chips
  Sun–Sat); dailyFrequency stepper (− count +, 1–10); per-instance time rows —
  "Time N" with DateTimePicker (mode time, show on press) + clear ✕ →
  `targetTimes[i]` nullable.
- event: date row (DateTimePicker mode date) required + optional time row.
- regimen: routine controls + deadline: Switch "Has deadline" → date picker,
  off → `targetDate: null`.
Validation before save (Alert on failure): name, idealTask, fallbackTask
required; weekly needs ≥1 day; event needs a date. Save → add/updateCommitment
→ back. Editing: danger AppButton "Delete" (Alert confirm → deleteCommitment →
back). DateTimePicker: render only while picking on Android (`onChange` hides),
inline spinner on iOS is fine.

**`src/components/StepsEditor.tsx`** —
`{ steps: Step[]; onChange(steps: Step[]): void; accent?: 'primary' | 'fallback' }`.
Add row (TextField "Add a step…" + add IconButton); per step: title (inline
TextField), optional badge text (small TextField, placeholder "badge"),
frequency chip Daily→tap→Weekly (weekday chips appear), remove ✕.

**`src/components/TagPicker.tsx`** —
`{ kind: TagKind; label: string; value: string; onChange(name: string): void }`.
Chip row of existing tags (selected = filled); trailing "+ New" Chip → inline
TextField + TAG_COLOR_CHOICES swatches + confirm → `addTag` + `onChange`.

**`src/app/onboarding.tsx`** — centered: leaf/shield Ionicon in primarySoft
circle, title "Fallback", copy: "Every commitment has two versions — the ideal
and a minimum fallback. On hard days, do the fallback instead of skipping.";
three short value rows (1.0 / 0.5 / score); primary AppButton "Get started" →
`completeOnboarding()` + `router.replace('/(tabs)')`. If already onboarded,
`<Redirect href="/(tabs)" />`.

**`src/app/_layout.tsx`** — `initNotifications()` at module scope (guarded);
`AppProvider` wrapping an inner component that: returns null while `!ready`
(splash holds); wires react-navigation `ThemeProvider` (map our colors onto
DefaultTheme/DarkTheme incl. `colors.background/card/text/border/primary`);
`StatusBar style={theme.dark ? 'light' : 'dark'}`; Stack with `(tabs)`
(headerShown false), `onboarding` (headerShown false), `edit`
(presentation 'modal', headerShown false).

**`src/app/(tabs)/_layout.tsx`** — gate: `!ready` → null;
`!data.hasCompletedOnboarding` → `<Redirect href="/onboarding" />`. Tabs
(headerShown false) themed via tokens: index "Routines" (icon 'repeat'),
events "Events" ('calendar-outline'), regimens "Regimens" ('flag-outline'),
settings "Settings" ('options-outline').

## Product spec summary (source of truth for behavior)

- Credit: ideal 1.0 · fallback 0.5 · skip 0; 30-day rolling score.
- Routines: repeat daily/weekdays, 1–10×/day, optional time per occurrence, no
  end. Events: single date + optional time. Regimens: routine scheduling +
  deadline date or indefinite; completed from the Routines tab; Regimens tab is
  a read-only overview; deadline-day tasks also appear (read-only) on Events tab.
- To-do bucket: unscheduled quick tasks, bottom sheet on Events tab.
- Task generation on demand for viewed date + 7-day rolling window; never
  before the commitment's createdAt date; never duplicate
  (parent,date,instanceIndex); orphans dropped; excess instances trimmed when
  dailyFrequency shrinks; task times follow the parent's times.
- Persistence: one JSON blob, save on every change, reload+refresh on
  foreground. Migration guards on load.
- Notifications: at-time + lead-time (default 15 min) for timed items, both
  texts included, respect Reminders toggle, reschedule on changes.
- Settings toggles are real: Reminders, Dark Mode, Auto-complete steps.
- Backup = copy JSON to clipboard. Wipe = confirm → clear → onboarding.
