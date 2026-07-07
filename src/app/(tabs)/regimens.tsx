/**
 * Regimens tab — a read-only overview of every regimen, always anchored to
 * today (no date strip). Each card shows the name, a deadline line
 * ("N days left · Jul 20, 2026" / "Due today" / "Ended Jul 1, 2026" /
 * "Ongoing"), the importance + necessity tag chips, and a done/total hint
 * for today's generated tasks.
 *
 * Completion happens on the Routines tab — no action buttons here.
 */

import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FilterBar } from '@/components/FilterBar';
import { Card, Chip, EmptyState, IconButton, Screen } from '@/components/ui';
import {
  compareKeys,
  daysBetween,
  formatDisplayDate,
  formatMediumDate,
  todayKey,
} from '@/lib/dates';
import { dayCompletion } from '@/lib/score';
import { tasksOn } from '@/lib/taskGeneration';
import { useApp, useTheme } from '@/store/AppContext';
import { getParentId, type Commitment } from '@/types';

/** True when the regimen's deadline is strictly in the past. */
function isEnded(c: Commitment, today: string): boolean {
  return c.targetDate != null && compareKeys(c.targetDate, today) < 0;
}

/** Active first; among active, nearest deadline first (ongoing last); then name. */
function byUrgency(a: Commitment, b: Commitment, today: string): number {
  const endedDiff = Number(isEnded(a, today)) - Number(isEnded(b, today));
  if (endedDiff !== 0) return endedDiff;
  const da = a.targetDate ?? null;
  const db = b.targetDate ?? null;
  if (da !== null && db !== null && da !== db) return compareKeys(da, db);
  if (da !== null && db === null) return -1;
  if (da === null && db !== null) return 1;
  return a.name.localeCompare(b.name);
}

export default function RegimensScreen() {
  const { data, ensureTasksFor } = useApp();
  const theme = useTheme();
  const { colors, spacing } = theme;

  const today = todayKey();
  const [category, setCategory] = useState<string | null>(null);

  // Make sure today's tasks exist so the done/total hints are accurate.
  useEffect(() => {
    ensureTasksFor(todayKey());
  }, [ensureTasksFor]);

  const regimens = useMemo(
    () =>
      data.commitments
        .filter((c) => c.type === 'regimen')
        .sort((a, b) => byUrgency(a, b, today)),
    [data.commitments, today]
  );

  const todayTasks = useMemo(
    () => tasksOn(data.tasks, today),
    [data.tasks, today]
  );

  // Categories = All + every importance/necessity tag among the regimens.
  const categories = useMemo(() => {
    const names: string[] = [];
    for (const c of regimens) {
      for (const tag of [c.importance, c.necessity]) {
        if (tag && !names.includes(tag)) names.push(tag);
      }
    }
    return names;
  }, [regimens]);

  // A stale selection (tags changed) silently falls back to All.
  const activeCategory =
    category !== null && categories.includes(category) ? category : null;

  const visible = regimens.filter(
    (c) =>
      activeCategory === null ||
      c.importance === activeCategory ||
      c.necessity === activeCategory
  );

  // Today's completion across the visible regimens' tasks.
  const { done, total } = dayCompletion(
    todayTasks.filter((t) =>
      visible.some((c) => c.id === getParentId(t))
    )
  );

  const cycleCategory = (dir: 1 | -1) => {
    const list: (string | null)[] = [null, ...categories];
    const current = list.indexOf(activeCategory);
    const next = list[(current + dir + list.length) % list.length] ?? null;
    setCategory(next);
  };

  const openAddRegimen = () => {
    router.push({ pathname: '/edit', params: { type: 'regimen' } });
  };

  /** "N days left · Jul 20, 2026" / "Due today" / "Ended …" / "Ongoing". */
  const deadlineLine = (c: Commitment): { text: string; color: string } => {
    if (c.targetDate == null) {
      return { text: 'Ongoing', color: colors.textSecondary };
    }
    const cmp = compareKeys(c.targetDate, today);
    if (cmp < 0) {
      return {
        text: `Ended ${formatMediumDate(c.targetDate)}`,
        color: colors.textMuted,
      };
    }
    if (cmp === 0) {
      return { text: 'Due today', color: colors.fallback };
    }
    const left = daysBetween(today, c.targetDate);
    return {
      text: `${left} ${left === 1 ? 'day' : 'days'} left · ${formatMediumDate(c.targetDate)}`,
      color: colors.textSecondary,
    };
  };

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
            {formatDisplayDate(today)}
          </Text>
          <Text style={{ ...theme.type.title, color: colors.text }}>
            Regimens
          </Text>
        </View>
        <IconButton
          icon="add"
          size={26}
          color={colors.text}
          onPress={openAddRegimen}
          accessibilityLabel="Add a regimen"
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <FilterBar
          done={done}
          total={total}
          category={activeCategory}
          onPrev={() => cycleCategory(-1)}
          onNext={() => cycleCategory(1)}
        />
      </View>

      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        {visible.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="No regimens"
            message="A regimen is a routine with a finish line — daily work toward a deadline, or ongoing."
            actionLabel="Add a regimen"
            onAction={openAddRegimen}
          />
        ) : (
          visible.map((c) => {
            const deadline = deadlineLine(c);
            const mine = todayTasks.filter((t) => getParentId(t) === c.id);
            const completion = dayCompletion(mine);
            return (
              <Card key={c.id}>
                <Text
                  numberOfLines={2}
                  style={{ ...theme.type.subheading, color: colors.text }}
                >
                  {c.name}
                </Text>
                <Text
                  style={{
                    ...theme.type.caption,
                    ...theme.type.num,
                    color: deadline.color,
                    marginTop: spacing.xs,
                  }}
                >
                  {deadline.text}
                </Text>

                <View
                  style={[
                    styles.chipRow,
                    { gap: spacing.xs, marginTop: spacing.sm },
                  ]}
                >
                  {c.importance ? (
                    <Chip
                      small
                      label={c.importance}
                      color={data.importanceMap[c.importance]}
                    />
                  ) : null}
                  {c.necessity ? (
                    <Chip
                      small
                      label={c.necessity}
                      color={data.necessityMap[c.necessity]}
                    />
                  ) : null}
                </View>

                {completion.total > 0 ? (
                  <Text
                    style={{
                      ...theme.type.caption,
                      ...theme.type.num,
                      color:
                        completion.done === completion.total
                          ? colors.primary
                          : colors.textMuted,
                      marginTop: spacing.sm,
                    }}
                  >
                    Today · {completion.done}/{completion.total} done
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
