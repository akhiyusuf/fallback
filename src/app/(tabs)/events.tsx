/**
 * Events tab — one-off events for a selected day, plus read-only cards for
 * regimen tasks whose deadline lands on that day.
 *
 * Same skeleton as the Routines tab: its own selected date, DateStrip,
 * month-calendar overlay and FilterBar (cycling All + every importance/
 * necessity tag present among the day's tasks). The header carries the
 * to-do bucket button (badge = unfinished count → TodoSheet) and an add
 * button that opens the event editor.
 */

import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateStrip } from '@/components/DateStrip';
import { FilterBar } from '@/components/FilterBar';
import { MonthCalendar } from '@/components/MonthCalendar';
import { TaskCard } from '@/components/TaskCard';
import { TodoSheet } from '@/components/TodoSheet';
import { EmptyState, IconButton, Screen, SectionLabel } from '@/components/ui';
import { formatDisplayDate, todayKey } from '@/lib/dates';
import { dayCompletion } from '@/lib/score';
import { tasksOn } from '@/lib/taskGeneration';
import { useApp, useTheme } from '@/store/AppContext';
import { getParentId, type Commitment, type Task } from '@/types';

interface DayItem {
  task: Task;
  commitment: Commitment;
}

/** Timed tasks first (ascending), then untimed; ties by name, then instance. */
function byTimeThenName(a: DayItem, b: DayItem): number {
  const at = a.task.targetTime ?? null;
  const bt = b.task.targetTime ?? null;
  if (at !== null && bt !== null && at !== bt) return at < bt ? -1 : 1;
  if (at !== null && bt === null) return -1;
  if (at === null && bt !== null) return 1;
  const byName = a.commitment.name.localeCompare(b.commitment.name);
  if (byName !== 0) return byName;
  return a.task.instanceIndex - b.task.instanceIndex;
}

export default function EventsScreen() {
  const { data, ensureTasksFor } = useApp();
  const theme = useTheme();
  const { colors, spacing } = theme;

  const [selected, setSelected] = useState(() => todayKey());
  const [category, setCategory] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);

  // Generate tasks for the viewed date (+ rolling window) on demand.
  useEffect(() => {
    ensureTasksFor(selected);
  }, [ensureTasksFor, selected]);

  const commitmentsById = useMemo(() => {
    const map = new Map<string, Commitment>();
    for (const c of data.commitments) map.set(c.id, c);
    return map;
  }, [data.commitments]);

  const dayTasks = useMemo(
    () => tasksOn(data.tasks, selected),
    [data.tasks, selected]
  );

  // Event-type tasks for the day, timed first.
  const eventItems = useMemo(() => {
    const items: DayItem[] = [];
    for (const task of dayTasks) {
      const commitment = commitmentsById.get(getParentId(task));
      if (commitment && commitment.type === 'event') {
        items.push({ task, commitment });
      }
    }
    return items.sort(byTimeThenName);
  }, [dayTasks, commitmentsById]);

  // Read-only regimen tasks whose parent's deadline is the selected day.
  const deadlineItems = useMemo(() => {
    const items: DayItem[] = [];
    for (const task of dayTasks) {
      const commitment = commitmentsById.get(getParentId(task));
      if (
        commitment &&
        commitment.type === 'regimen' &&
        commitment.targetDate === selected
      ) {
        items.push({ task, commitment });
      }
    }
    return items.sort(byTimeThenName);
  }, [dayTasks, commitmentsById, selected]);

  // Categories present among the day's tasks (importance + necessity tags).
  const categories = useMemo(() => {
    const names: string[] = [];
    for (const { commitment } of [...eventItems, ...deadlineItems]) {
      for (const tag of [commitment.importance, commitment.necessity]) {
        if (tag && !names.includes(tag)) names.push(tag);
      }
    }
    return names;
  }, [eventItems, deadlineItems]);

  // A stale selection (day changed) silently falls back to All.
  const activeCategory =
    category !== null && categories.includes(category) ? category : null;

  const matchesCategory = (item: DayItem): boolean =>
    activeCategory === null ||
    item.commitment.importance === activeCategory ||
    item.commitment.necessity === activeCategory;

  const visibleEvents = eventItems.filter(matchesCategory);
  const visibleDeadlines = deadlineItems.filter(matchesCategory);

  // Day summary over ALL of the day's items (not just the filtered view) —
  // same semantics as the Routines tab's counter.
  const { done, total } = dayCompletion(
    [...eventItems, ...deadlineItems].map((i) => i.task)
  );

  const cycleCategory = (dir: 1 | -1) => {
    const list: (string | null)[] = [null, ...categories];
    const current = list.indexOf(activeCategory);
    const next = list[(current + dir + list.length) % list.length] ?? null;
    setCategory(next);
  };

  const unfinishedTodos = data.todoBucket.filter((t) => !t.completed).length;

  const openAddEvent = () => {
    router.push({ pathname: '/edit', params: { type: 'event' } });
  };

  const onSelectDay = (key: string) => {
    setSelected(key);
    setCalendarOpen(false);
  };

  const empty = visibleEvents.length === 0 && visibleDeadlines.length === 0;

  return (
    <Screen padded={false}>
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
        ]}
      >
        <View style={styles.headerText}>
          <Text style={{ ...theme.type.caption, color: colors.textMuted }}>
            {formatDisplayDate(selected)}
          </Text>
          <Text style={{ ...theme.type.title, color: colors.text }}>
            Events
          </Text>
        </View>
        <View style={[styles.headerActions, { gap: spacing.xs }]}>
          <IconButton
            icon="checkbox-outline"
            size={24}
            color={colors.text}
            badge={unfinishedTodos}
            onPress={() => setTodoOpen(true)}
            accessibilityLabel="Open to-dos"
          />
          <IconButton
            icon="add"
            size={26}
            color={colors.text}
            onPress={openAddEvent}
            accessibilityLabel="Add an event"
          />
        </View>
      </View>

      {/* Date strip + filter */}
      <View style={{ marginTop: spacing.sm }}>
        <DateStrip
          selected={selected}
          onSelect={setSelected}
          onOpenCalendar={() => setCalendarOpen(true)}
        />
      </View>
      <View
        style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}
      >
        <FilterBar
          done={done}
          total={total}
          category={activeCategory}
          onPrev={() => cycleCategory(-1)}
          onNext={() => cycleCategory(1)}
        />
      </View>

      {/* Day content */}
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        {empty ? (
          <EmptyState
            icon="calendar-outline"
            title="No events"
            message="Nothing planned for this day."
            actionLabel="Add an event"
            onAction={openAddEvent}
          />
        ) : (
          <>
            {visibleEvents.map(({ task, commitment }) => (
              <TaskCard key={task.id} task={task} commitment={commitment} />
            ))}
            {visibleDeadlines.length > 0 ? (
              <View style={{ marginTop: visibleEvents.length > 0 ? spacing.sm : 0 }}>
                <SectionLabel>Regimen deadlines</SectionLabel>
                <View style={{ gap: spacing.md }}>
                  {visibleDeadlines.map(({ task, commitment }) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      commitment={commitment}
                      readOnly
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Overlays */}
      <MonthCalendar
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selected={selected}
        onSelectDay={onSelectDay}
      />
      <TodoSheet visible={todoOpen} onClose={() => setTodoOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: {
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
