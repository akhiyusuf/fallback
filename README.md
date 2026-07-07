# Fallback

A fully offline habit and task tracker for Android and iOS, built with
React Native / Expo. No backend, no accounts, no network calls — all state
lives in local storage on the device.

## The idea

Every commitment has two versions:

- **Ideal** — the full version of the task (credit **1.0**)
- **Fallback** — a minimum backup version (credit **0.5**)

On a hard day you do the fallback instead of skipping, so consistency is
preserved and there is never a forced empty day. A rolling 30-day
**discipline score** is derived from the credit you earn.

## Commitment types

| Type | What it is | Timing | End |
|------|-----------|--------|-----|
| **Routine** | Repeating habit | Daily or chosen weekdays, 1–10×/day, optional time per occurrence | Never |
| **Event** | One-off appointment | Single date + optional time | That date |
| **Regimen** | Repeating program toward a goal | Same scheduling as routines | Deadline date or indefinite |

Plus a lightweight **to-do bucket** for unscheduled quick tasks (on the
Events tab).

- **Routines tab** — the main daily screen: date strip, month calendar,
  routines *and* regimen occurrences for the selected day.
- **Events tab** — timed one-off events, regimen deadlines (read-only), and
  the to-do bottom sheet.
- **Regimens tab** — read-only overview of programs ("N days left" /
  "Ongoing"); completion happens on the Routines tab.
- **Settings tab** — real preference toggles (Reminders, Dark Mode,
  Auto-complete steps), category color editor, search/manage/edit/delete for
  every commitment, JSON backup to clipboard, and full wipe.

## Features

- Per-day task instances generated on demand with a rolling 7-day window,
  de-duplication, orphan cleanup, and schedule reconciliation.
- Expandable ideal/fallback step checklists; checking every step in a group
  auto-completes the task at the matching credit level (toggleable).
- Local notifications for timed items: at-time reminder plus a configurable
  lead-time reminder (default 15 min) carrying both the ideal and fallback
  text.
- Android home-screen widget with today's progress (non-fatal when
  unavailable; requires a development build, not Expo Go).
- Light and dark themes with a manual toggle; soft, rounded visual language.
- Single JSON blob persistence with migration guards, saved on every change
  and refreshed when the app returns from the background.

## Development

```bash
npm install
npx expo start        # Expo Go / dev client
```

Type checking:

```bash
npx tsc --noEmit
```

The Android widget uses a config plugin (`react-native-android-widget`), so
widgets only work in a development build (`npx expo prebuild` / EAS build),
not in Expo Go. Notifications are also limited in Expo Go on recent SDKs —
use a development build to test them.

## Architecture

See [DESIGN.md](./DESIGN.md) for the full module contracts.

- `src/types.ts` — shared types for the whole app
- `src/constants/theme.ts` — centralized design tokens (light + dark)
- `src/lib/` — persistence, migrations, task generation, scoring,
  notifications, widgets, date helpers
- `src/store/AppContext.tsx` — single state provider exposing all CRUD and
  task operations
- `src/components/` — UI kit primitives and feature components
- `src/app/` — expo-router screens (tabs, onboarding, create/edit modal)
