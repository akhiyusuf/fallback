/**
 * Create/edit modal for all three commitment types (routine, event, regimen).
 *
 * Params: `/edit?type=routine|event|regimen` for create, plus `&id=…` to
 * edit an existing commitment (the commitment's own type then wins).
 *
 * Layout: header (Cancel · title · Save); name; primary-accent "Ideal" card
 * (task + StepsEditor); amber "Fallback" card (task + StepsEditor); tag
 * pickers; per-type timing controls; Delete (danger, confirm) when editing.
 *
 * DateTimePicker usage follows the package types: on Android the picker is
 * only rendered while active (a dialog opens; onValueChange/onDismiss hide
 * it), on iOS it renders inline (spinner for time, inline calendar for
 * date), and on web — where the native picker is a no-op stub — a plain
 * 'HH:mm' / 'YYYY-MM-DD' text field is used instead.
 */

import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Switch, Text, View } from 'react-native';

import { StepsEditor } from '@/components/StepsEditor';
import { TagPicker } from '@/components/TagPicker';
import {
  AppButton,
  Card,
  Chip,
  IconButton,
  Screen,
  SectionLabel,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import {
  dateAtTime,
  formatMediumDate,
  formatTime,
  makeDateKey,
  parseDateKey,
  toDateKey,
  todayKey,
  toTimeString,
  weekdayShort,
} from '@/lib/dates';
import { useApp, useTheme, type NewCommitmentInput } from '@/store/AppContext';
import type {
  CommitmentType,
  Frequency,
  Step,
  TagColorMap,
  Weekday,
} from '@/types';

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_TIME = '09:00';

// ---------- small helpers ----------

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Preferred tag if it exists in the map, else the map's first tag. */
function defaultTag(map: TagColorMap, preferred: string): string {
  if (map[preferred]) return preferred;
  const first = Object.keys(map)[0];
  return first ?? preferred;
}

function clampFrequency(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, Math.floor(n)));
}

/** Trim titles/badges and drop steps whose title became blank. */
function cleanSteps(steps: Step[]): Step[] {
  return steps
    .map((s) => {
      const badge = s.badge?.trim();
      // A weekly step with no weekdays would never be due anywhere and
      // silently vanish from every checklist — treat it as daily instead.
      const weeklyWithoutDays =
        s.frequency === 'weekly' && (s.targetDays?.length ?? 0) === 0;
      return {
        ...s,
        title: s.title.trim(),
        badge: badge ? badge : undefined,
        frequency: weeklyWithoutDays ? ('daily' as const) : s.frequency,
      };
    })
    .filter((s) => s.title.length > 0);
}

/** Alert that also works on web, where RN's Alert is a no-op. */
function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`${title}\n\n${message}`);
      }
    } catch {
      // ignore — validation still blocks the save
    }
    return;
  }
  Alert.alert(title, message);
}

/** Destructive confirm: Alert buttons on native, window.confirm on web. */
function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  if (Platform.OS === 'web') {
    let ok = true;
    try {
      if (
        typeof window !== 'undefined' &&
        typeof window.confirm === 'function'
      ) {
        ok = window.confirm(`${title}\n\n${message}`);
      }
    } catch {
      ok = true;
    }
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** '7:5' is rejected; '07:30'/'7:30' normalize to 'HH:mm'. */
function normalizeTimeText(text: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** 'YYYY-M-D' → valid 'YYYY-MM-DD' key, or null. */
function normalizeDateText(text: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!m) return null;
  const key = makeDateKey(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toDateKey(parseDateKey(key)) === key ? key : null;
}

// ---------- web fallback field (native picker is a no-op stub there) ----------

function WebValueField(props: {
  mode: 'date' | 'time';
  value: string | null;
  clearable: boolean;
  onValue: (v: string | null) => void;
}) {
  const { mode, value, clearable, onValue } = props;
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    const text = draft.trim();
    if (!text) {
      if (clearable) onValue(null);
      else setDraft(value ?? '');
      return;
    }
    const normalized =
      mode === 'time' ? normalizeTimeText(text) : normalizeDateText(text);
    if (normalized) onValue(normalized);
    else setDraft(value ?? '');
  };

  return (
    <View style={{ width: 120 }}>
      <TextField
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder={mode === 'time' ? 'HH:mm' : 'YYYY-MM-DD'}
      />
    </View>
  );
}

// ---------- date/time picker row ----------

interface PickerRowProps {
  label: string;
  mode: 'date' | 'time';
  /** 'HH:mm' for time mode, 'YYYY-MM-DD' for date mode. */
  value: string | null;
  placeholder: string;
  active: boolean;
  clearable?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onValue: (v: string | null) => void;
}

function PickerRow({
  label,
  mode,
  value,
  placeholder,
  active,
  clearable = false,
  onOpen,
  onClose,
  onValue,
}: PickerRowProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;

  const displayText =
    mode === 'time' ? formatTime(value) : value ? formatMediumDate(value) : '';
  const pickerValue =
    mode === 'time'
      ? dateAtTime(todayKey(), value ?? DEFAULT_TIME)
      : parseDateKey(value ?? todayKey());

  const commitDate = (d: Date) => {
    onValue(mode === 'time' ? toTimeString(d) : toDateKey(d));
  };

  // Never pre-commit the placeholder the picker opens on: a value is only
  // set from an actual change event, so cancelling (Android dialog) or
  // closing the iOS inline picker untouched leaves the field unset.
  const open = onOpen;

  return (
    <View>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Text style={{ ...theme.type.body, color: colors.text, flex: 1 }}>
          {label}
        </Text>
        {Platform.OS === 'web' ? (
          <WebValueField
            mode={mode}
            value={value}
            clearable={clearable}
            onValue={onValue}
          />
        ) : (
          <Pressable
            onPress={active ? onClose : open}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${displayText || placeholder}`}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.sm,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                ...theme.type.caption,
                ...theme.type.num,
                color: displayText ? colors.text : colors.textMuted,
              }}
            >
              {displayText || placeholder}
            </Text>
          </Pressable>
        )}
        {clearable && value != null ? (
          <IconButton
            icon="close-circle"
            size={18}
            onPress={() => {
              onValue(null);
              if (active) onClose();
            }}
            accessibilityLabel={`Clear ${label}`}
          />
        ) : null}
      </View>

      {active && Platform.OS === 'ios' ? (
        <DateTimePicker
          mode={mode}
          value={pickerValue}
          display={mode === 'time' ? 'spinner' : 'inline'}
          themeVariant={theme.dark ? 'dark' : 'light'}
          accentColor={colors.primary}
          onValueChange={(_e: DateTimePickerChangeEvent, d: Date) =>
            commitDate(d)
          }
        />
      ) : null}
      {active && Platform.OS === 'android' ? (
        <DateTimePicker
          mode={mode}
          value={pickerValue}
          onValueChange={(_e: DateTimePickerChangeEvent, d: Date) => {
            onClose();
            commitDate(d);
          }}
          onDismiss={onClose}
        />
      ) : null}
    </View>
  );
}

// ---------- screen ----------

export default function EditScreen() {
  const params = useLocalSearchParams();
  const {
    data,
    getCommitment,
    addCommitment,
    updateCommitment,
    deleteCommitment,
  } = useApp();
  const theme = useTheme();
  const { colors, spacing } = theme;

  const idParam = firstParam(params.id);
  const typeParam = firstParam(params.type);

  const existing = useMemo(
    () => (idParam ? getCommitment(idParam) : undefined),
    [getCommitment, idParam]
  );
  const editing = existing !== undefined;
  const type: CommitmentType =
    existing?.type ??
    (typeParam === 'event' || typeParam === 'regimen' ? typeParam : 'routine');

  // ---- form state ----
  const [name, setName] = useState(existing?.name ?? '');
  const [idealTask, setIdealTask] = useState(existing?.idealTask ?? '');
  const [idealSteps, setIdealSteps] = useState<Step[]>(
    existing?.idealSubtasks ?? []
  );
  const [fallbackTask, setFallbackTask] = useState(
    existing?.fallbackTask ?? ''
  );
  const [fallbackSteps, setFallbackSteps] = useState<Step[]>(
    existing?.fallbackSubtasks ?? []
  );
  const [importance, setImportance] = useState(
    existing?.importance ?? defaultTag(data.importanceMap, 'Medium')
  );
  const [necessity, setNecessity] = useState(
    existing?.necessity ?? defaultTag(data.necessityMap, 'Helpful')
  );

  // Routine + regimen scheduling.
  const [frequency, setFrequency] = useState<Frequency>(
    existing?.frequency ?? 'daily'
  );
  const [targetDays, setTargetDays] = useState<Weekday[]>(
    existing?.targetDays ?? []
  );
  const [dailyFrequency, setDailyFrequency] = useState<number>(
    clampFrequency(existing?.dailyFrequency ?? 1)
  );
  const [targetTimes, setTargetTimes] = useState<(string | null)[]>(
    existing?.targetTimes ?? []
  );

  // Regimen deadline.
  const [hasDeadline, setHasDeadline] = useState<boolean>(
    existing?.targetDate != null
  );
  const [deadline, setDeadline] = useState<string>(
    existing?.targetDate ?? todayKey()
  );

  // Event date/time.
  const [eventDate, setEventDate] = useState<string | null>(
    existing?.targetEventDate ?? null
  );
  const [eventTime, setEventTime] = useState<string | null>(
    existing?.targetTime ?? null
  );

  /** Which DateTimePicker is showing (only one at a time). */
  const [activePicker, setActivePicker] = useState<string | null>(null);

  // ---- handlers ----

  const toggleDay = (day: Weekday) => {
    setTargetDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const bumpDailyFrequency = (delta: number) => {
    setDailyFrequency((n) => clampFrequency(n + delta));
    setActivePicker(null);
  };

  const setTimeAt = (index: number, value: string | null) => {
    setTargetTimes((prev) => {
      const next = prev.slice();
      while (next.length <= index) next.push(null);
      next[index] = value;
      return next;
    });
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showAlert('Name required', `Give this ${type} a name.`);
      return;
    }
    if (!idealTask.trim()) {
      showAlert(
        'Ideal task required',
        'Describe the full (ideal) version — it earns 1.0 credit.'
      );
      return;
    }
    if (!fallbackTask.trim()) {
      showAlert(
        'Fallback task required',
        'Describe the minimum backup version — it earns 0.5 credit.'
      );
      return;
    }
    if (type !== 'event' && frequency === 'weekly' && targetDays.length === 0) {
      showAlert(
        'Pick at least one day',
        'A weekly schedule needs at least one weekday.'
      );
      return;
    }
    if (type === 'event' && !eventDate) {
      showAlert('Date required', 'Events need a date.');
      return;
    }

    const base = {
      type,
      name: trimmedName,
      idealTask: idealTask.trim(),
      idealSubtasks: cleanSteps(idealSteps),
      fallbackTask: fallbackTask.trim(),
      fallbackSubtasks: cleanSteps(fallbackSteps),
      importance,
      necessity,
    };

    let input: NewCommitmentInput;
    if (type === 'event') {
      input = {
        ...base,
        targetEventDate: eventDate ?? undefined,
        targetTime: eventTime,
      };
    } else {
      const times = Array.from(
        { length: dailyFrequency },
        (_, i) => targetTimes[i] ?? null
      );
      input = {
        ...base,
        frequency,
        targetDays:
          frequency === 'weekly'
            ? [...targetDays].sort((a, b) => a - b)
            : undefined,
        dailyFrequency,
        targetTimes: times,
      };
      if (type === 'regimen') {
        input.targetDate = hasDeadline ? deadline : null;
      }
    }

    if (editing && existing) {
      updateCommitment(existing.id, input);
    } else {
      addCommitment(input);
    }
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    confirmDestructive(
      `Delete “${existing.name}”?`,
      `This removes the ${existing.type} and its scheduled tasks.`,
      'Delete',
      () => {
        deleteCommitment(existing.id);
        router.back();
      }
    );
  };

  // ---- render ----

  const title = `${editing ? 'Edit' : 'New'} ${type}`;

  return (
    <Screen scroll>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
        }}
      >
        <AppButton
          label="Cancel"
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
        />
        <Text style={{ ...theme.type.heading, color: colors.text }}>
          {title}
        </Text>
        <AppButton label="Save" variant="primary" size="sm" onPress={save} />
      </View>

      <View style={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Name */}
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Morning workout"
        />

        {/* Ideal (primary accent) */}
        <Card style={{ borderColor: colors.primary }}>
          <Text
            style={{
              ...theme.type.subheading,
              color: colors.primary,
              marginBottom: 2,
            }}
          >
            Ideal
          </Text>
          <Text
            style={{
              ...theme.type.caption,
              color: colors.textSecondary,
              marginBottom: spacing.sm,
            }}
          >
            The full version · worth 1.0
          </Text>
          <TextField
            value={idealTask}
            onChangeText={setIdealTask}
            placeholder="e.g. 45-minute workout"
          />
          <View style={{ height: spacing.md }} />
          <StepsEditor
            steps={idealSteps}
            onChange={setIdealSteps}
            accent="primary"
          />
        </Card>

        {/* Fallback (amber, visually distinct) */}
        <Card
          style={{
            backgroundColor: colors.fallbackSoft,
            borderColor: colors.fallback,
          }}
        >
          <Text
            style={{
              ...theme.type.subheading,
              color: colors.fallback,
              marginBottom: 2,
            }}
          >
            Fallback
          </Text>
          <Text
            style={{
              ...theme.type.caption,
              color: colors.textSecondary,
              marginBottom: spacing.sm,
            }}
          >
            The minimum backup · worth 0.5
          </Text>
          <TextField
            value={fallbackTask}
            onChangeText={setFallbackTask}
            placeholder="e.g. 10 push-ups"
          />
          <View style={{ height: spacing.md }} />
          <StepsEditor
            steps={fallbackSteps}
            onChange={setFallbackSteps}
            accent="fallback"
          />
        </Card>

        {/* Tags */}
        <TagPicker
          kind="importance"
          label="Importance"
          value={importance}
          onChange={setImportance}
        />
        <TagPicker
          kind="necessity"
          label="Necessity"
          value={necessity}
          onChange={setNecessity}
        />

        {/* Timing — routine & regimen share routine controls */}
        {type !== 'event' ? (
          <View>
            <SectionLabel>Schedule</SectionLabel>
            <SegmentedControl
              options={[
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
              ]}
              value={frequency}
              onChange={(v) => setFrequency(v === 'weekly' ? 'weekly' : 'daily')}
            />
            {frequency === 'weekly' ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginTop: spacing.sm,
                }}
              >
                {WEEKDAYS.map((day) => (
                  <Chip
                    key={day}
                    label={weekdayShort(day)}
                    color={colors.primary}
                    selected={targetDays.includes(day)}
                    onPress={() => toggleDay(day)}
                  />
                ))}
              </View>
            ) : null}

            {/* 1–10 per-day frequency stepper */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.md,
              }}
            >
              <Text style={{ ...theme.type.body, color: colors.text, flex: 1 }}>
                Times per day
              </Text>
              <IconButton
                icon="remove-circle-outline"
                onPress={() => bumpDailyFrequency(-1)}
                color={
                  dailyFrequency <= 1 ? colors.textMuted : colors.textSecondary
                }
                accessibilityLabel="Fewer times per day"
              />
              <Text
                style={{
                  ...theme.type.subheading,
                  ...theme.type.num,
                  color: colors.text,
                  minWidth: 28,
                  textAlign: 'center',
                }}
              >
                {dailyFrequency}
              </Text>
              <IconButton
                icon="add-circle-outline"
                onPress={() => bumpDailyFrequency(1)}
                color={
                  dailyFrequency >= 10 ? colors.textMuted : colors.textSecondary
                }
                accessibilityLabel="More times per day"
              />
            </View>

            {/* Optional per-instance times */}
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {Array.from({ length: dailyFrequency }, (_, i) => (
                <PickerRow
                  key={i}
                  label={`Time ${i + 1}`}
                  mode="time"
                  value={targetTimes[i] ?? null}
                  placeholder="Set time"
                  clearable
                  active={activePicker === `time-${i}`}
                  onOpen={() => setActivePicker(`time-${i}`)}
                  onClose={() => setActivePicker(null)}
                  onValue={(v) => setTimeAt(i, v)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {type === 'event' ? (
          <View>
            <SectionLabel>When</SectionLabel>
            <View style={{ gap: spacing.sm }}>
              <PickerRow
                label="Date"
                mode="date"
                value={eventDate}
                placeholder="Pick a date"
                active={activePicker === 'eventDate'}
                onOpen={() => setActivePicker('eventDate')}
                onClose={() => setActivePicker(null)}
                onValue={setEventDate}
              />
              <PickerRow
                label="Time"
                mode="time"
                value={eventTime}
                placeholder="Optional"
                clearable
                active={activePicker === 'eventTime'}
                onOpen={() => setActivePicker('eventTime')}
                onClose={() => setActivePicker(null)}
                onValue={setEventTime}
              />
            </View>
          </View>
        ) : null}

        {type === 'regimen' ? (
          <View>
            <SectionLabel>Deadline</SectionLabel>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...theme.type.body, color: colors.text, flex: 1 }}>
                Has deadline
              </Text>
              <Switch
                value={hasDeadline}
                onValueChange={(v) => {
                  setHasDeadline(v);
                  if (!v && activePicker === 'deadline') setActivePicker(null);
                }}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.borderStrong}
                accessibilityLabel="Has deadline"
              />
            </View>
            {hasDeadline ? (
              <View style={{ marginTop: spacing.sm }}>
                <PickerRow
                  label="Deadline"
                  mode="date"
                  value={deadline}
                  placeholder="Pick a date"
                  active={activePicker === 'deadline'}
                  onOpen={() => setActivePicker('deadline')}
                  onClose={() => setActivePicker(null)}
                  onValue={(v) => {
                    if (v) setDeadline(v);
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Delete (editing only) */}
        {editing ? (
          <AppButton
            label="Delete"
            variant="danger"
            onPress={confirmDelete}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
