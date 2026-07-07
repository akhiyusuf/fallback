/**
 * Routines tab — the main daily screen.
 *
 * A selected date (default today) drives everything: changing it re-runs
 * `ensureTasksFor` so the 7-day task window stays generated. The day's
 * routine + regimen tasks are sorted by target time (untimed last) then
 * name, filterable by any importance/necessity tag present that day via the
 * FilterBar cycler. Header shows the date, a 30-day score chip and an add
 * button; the DateStrip's calendar button opens the MonthCalendar overlay.
 */

import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DateStrip } from '@/components/DateStrip';
import { FilterBar } from '@/components/FilterBar';
import { MonthCalendar } from '@/components/MonthCalendar';
import { TaskCard } from '@/components/TaskCard';
import { Chip, EmptyState, IconButton, Screen } from '@/components/ui';
import { formatDisplayDate, todayKey } from '@/lib/dates';
import { dayCompletion } from '@/lib/score';
import { tasksOn } from '@/lib/taskGeneration';
import { useApp, useTheme } from '@/store/AppContext';
import type { Commitment, Task } from '@/types';
import { getParentId } from '@/types';

interface DayItem {
  task: Task;
  commitment: Commitment;
}

/** Sort by targetTime (nulls last), then commitment name, then instance. */
function compareDayItems(a: DayItem, b: DayItem): number {
  const ta = a.task.targetTime ?? null;
  const tb = b.task.targetTime ?? null;
  if (ta !== tb) {
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta < tb ? -1 : 1;
  }
  const byName = a.commitment.name.localeCompare(b.commitment.name);
  if (byName !== 0) return byName;
  return a.task.instanceIndex - b.task.instanceIndex;
}

export default function RoutinesScreen() {
  const { data, ensureTasksFor, score30 } = useApp();
  const { colors, spacing, type } = useTheme();

  const [selected, setSelected] = useState<string>(() => todayKey());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Keep the rolling task window generated for whatever date is viewed.
  useEffect(() => {
    ensureTasksFor(selected);
  }, [selected, ensureTasksFor]);

  // The day's routine + regimen tasks, paired with their parent commitment.
  const dayItems = useMemo<DayItem[]>(() => {
    const byId = new Map<string, Commitment>();
    for (const c of data.commitments) byId.set(c.id, c);

    const items: DayItem[] = [];
    for (const task of tasksOn(data.tasks, selected)) {
      const commitment = byId.get(getParentId(task));
      if (!commitment) continue;
      if (commitment.type !== 'routine' && commitment.type !== 'regimen') {
        continue;
      }
      items.push({ task, commitment });
    }
    items.sort(compareDayItems);
    return items;
  }, [data.commitments, data.tasks, selected]);

  // 'All' (null) + every importance/necessity tag present among the day's tasks.
  const categories = useMemo<(string | null)[]>(() => {
    const present = new Set<string>();
    for (const { commitment } of dayItems) {
      if (commitment.importance) present.add(commitment.importance);
    }
    for (const { commitment } of dayItems) {
      if (commitment.necessity) present.add(commitment.necessity);
    }
    return [null, ...present];
  }, [dayItems]);

  // The cursor is the tag NAME, not a position: when the selected day changes
  // and the tag isn't present there, fall back to All instead of silently
  // remapping onto whatever tag happens to share the old index.
  const category =
    selectedCategory !== null && categories.includes(selectedCategory)
      ? selectedCategory
      : null;

  const cycleCategory = useCallback(
    (step: 1 | -1) => {
      setSelectedCategory((prev) => {
        const active = prev !== null && categories.includes(prev) ? prev : null;
        const current = categories.indexOf(active);
        return (
          categories[(current + step + categories.length) % categories.length] ??
          null
        );
      });
    },
    [categories]
  );

  // A category matches either tag of the parent commitment.
  const visibleItems = useMemo(
    () =>
      category === null
        ? dayItems
        : dayItems.filter(
            ({ commitment }) =>
              commitment.importance === category ||
              commitment.necessity === category
          ),
    [dayItems, category]
  );

  const { done, total } = useMemo(
    () => dayCompletion(dayItems.map(({ task }) => task)),
    [dayItems]
  );

  const goAddRoutine = useCallback(() => {
    router.push({ pathname: '/edit', params: { type: 'routine' } });
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DayItem>) => (
      <TaskCard task={item.task} commitment={item.commitment} />
    ),
    []
  );

  return (
    <Screen>
      {/* Header: date caption + title, score chip, add button */}
      <View style={[styles.headerRow, { paddingTop: spacing.md }]}>
        <View style={styles.headerText}>
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            {formatDisplayDate(selected)}
          </Text>
          <Text style={{ ...type.title, color: colors.text, marginTop: 2 }}>
            Routines
          </Text>
        </View>
        <View style={[styles.headerActions, { gap: spacing.sm }]}>
          {score30 !== null ? (
            <Chip label={`30d · ${score30}%`} color={colors.primary} small />
          ) : null}
          <IconButton
            icon="add"
            size={26}
            color={colors.primary}
            onPress={goAddRoutine}
            accessibilityLabel="Add a routine"
          />
        </View>
      </View>

      <DateStrip
        selected={selected}
        onSelect={setSelected}
        onOpenCalendar={() => setCalendarVisible(true)}
      />

      <FilterBar
        done={done}
        total={total}
        category={category}
        onPrev={() => cycleCategory(-1)}
        onNext={() => cycleCategory(1)}
      />

      <FlatList
        data={visibleItems}
        keyExtractor={({ task }) => task.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={{
          paddingTop: spacing.xs,
          paddingBottom: spacing.xxl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            title="Nothing scheduled"
            message="No routines or regimens land on this day."
            actionLabel="Add a routine"
            onAction={goAddRoutine}
          />
        }
      />

      <MonthCalendar
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selected={selected}
        onSelectDay={setSelected}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  list: {
    flex: 1,
  },
});
