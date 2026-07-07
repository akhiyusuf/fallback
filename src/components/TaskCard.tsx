/**
 * TaskCard — the reusable card for one generated task instance.
 *
 * Shows the commitment name, a meta row (time, instance counter, regimen
 * deadline), importance/necessity tags and the two completion paths:
 * a large primary "Done" button (ideal, credit 1.0) and a smaller amber
 * "Fallback" button (credit 0.5), each with its task text as a sub-line.
 *
 * Effectively-missed tasks show a red "Missed" tag but stay completable
 * (retro-complete is allowed). Completed tasks dim, strike the title, show
 * a level tag and offer a ghost "Re-open". When any ideal/fallback steps are
 * due on the task's date, a chevron expands the checklists (fallback group
 * in a visually distinct amber panel).
 *
 * `hideActions` hides the edit + duplicate icons; `readOnly` hides them AND
 * disables every button/checkbox (used for the Events-tab regimen preview).
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton, Card, Checkbox, Chip, IconButton } from '@/components/ui';
import { daysBetween, formatTime, todayKey } from '@/lib/dates';
import {
  effectiveStatus,
  instancesForDate,
  stepDueOnDate,
} from '@/lib/taskGeneration';
import { useApp, useTheme } from '@/store/AppContext';
import type { Commitment, Step, Task } from '@/types';

export interface TaskCardProps {
  task: Task;
  commitment: Commitment;
  /** Hides edit/duplicate AND disables every button/checkbox. */
  readOnly?: boolean;
  /** Hides the edit + duplicate icons but keeps completion interactive. */
  hideActions?: boolean;
}

/** Light impact haptic; no-op on web and on any native failure. */
function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // native module unavailable — ignore
  }
}

/** "N days left" / "Due today" / "Ongoing" for a regimen task's meta row. */
function regimenDeadlineText(commitment: Commitment, dateKey: string): string {
  if (commitment.targetDate == null) return 'Ongoing';
  const days = daysBetween(dateKey, commitment.targetDate);
  if (days <= 0) return 'Due today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export function TaskCard({
  task,
  commitment,
  readOnly = false,
  hideActions = false,
}: TaskCardProps) {
  const { data, completeTask, reopenTask, toggleSubtask, duplicateCommitment } =
    useApp();
  const theme = useTheme();
  const { colors, spacing, radius, type } = theme;

  const [expanded, setExpanded] = useState(false);

  const completed =
    task.status === 'completed_ideal' || task.status === 'completed_fallback';
  const missed = !completed && effectiveStatus(task, todayKey()) === 'missed';

  // Only steps actually due on this task's date appear in the checklists.
  const dueIdeal = useMemo(
    () => commitment.idealSubtasks.filter((s) => stepDueOnDate(s, task.date)),
    [commitment.idealSubtasks, task.date]
  );
  const dueFallback = useMemo(
    () =>
      commitment.fallbackSubtasks.filter((s) => stepDueOnDate(s, task.date)),
    [commitment.fallbackSubtasks, task.date]
  );
  const hasSteps = dueIdeal.length > 0 || dueFallback.length > 0;

  // Meta line: "7:30 AM · 2/3 · 12 days left".
  const metaParts: string[] = [];
  const time = formatTime(task.targetTime);
  if (time) metaParts.push(time);
  const instanceCount = instancesForDate(commitment);
  if (instanceCount > 1) {
    metaParts.push(`${task.instanceIndex + 1}/${instanceCount}`);
  }
  if (commitment.type === 'regimen') {
    metaParts.push(regimenDeadlineText(commitment, task.date));
  }
  const meta = metaParts.join(' · ');

  const showEditIcons = !readOnly && !hideActions;

  const onToggleExpand = () => {
    lightHaptic();
    setExpanded((e) => !e);
  };

  const onEdit = () => {
    router.push({
      pathname: '/edit',
      params: { type: commitment.type, id: commitment.id },
    });
  };

  const renderStep = (
    step: Step,
    group: 'ideal' | 'fallback',
    accent: string
  ) => {
    const checked = task.completedSubtasks.includes(step.id);
    return (
      <Checkbox
        key={step.id}
        checked={checked}
        color={accent}
        label={step.title}
        badge={step.badge}
        strike={checked}
        onToggle={() => {
          if (readOnly) return;
          toggleSubtask(task.id, step.id, group);
        }}
      />
    );
  };

  return (
    <Card style={completed ? styles.dimmed : undefined}>
      {/* Header: title + chevron / edit / duplicate */}
      <View style={styles.headerRow}>
        <Text
          numberOfLines={2}
          style={{
            ...type.subheading,
            color: completed ? colors.textMuted : colors.text,
            textDecorationLine: completed ? 'line-through' : 'none',
            flex: 1,
            marginRight: spacing.sm,
          }}
        >
          {commitment.name}
        </Text>
        {hasSteps ? (
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            onPress={onToggleExpand}
            size={20}
            accessibilityLabel={expanded ? 'Hide steps' : 'Show steps'}
          />
        ) : null}
        {showEditIcons ? (
          <>
            <IconButton
              icon="pencil"
              onPress={onEdit}
              size={18}
              accessibilityLabel={`Edit ${commitment.name}`}
            />
            <IconButton
              icon="copy-outline"
              onPress={() => duplicateCommitment(commitment.id)}
              size={18}
              accessibilityLabel={`Duplicate ${commitment.name}`}
            />
          </>
        ) : null}
      </View>

      {/* Meta row: time · instance · regimen deadline */}
      {meta ? (
        <Text
          style={{
            ...type.caption,
            ...type.num,
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          {meta}
        </Text>
      ) : null}

      {/* Tags: importance, necessity, status */}
      <View style={[styles.tagRow, { marginTop: spacing.sm, gap: spacing.xs + 2 }]}>
        {commitment.importance ? (
          <Chip
            label={commitment.importance}
            color={data.importanceMap[commitment.importance]}
            small
          />
        ) : null}
        {commitment.necessity ? (
          <Chip
            label={commitment.necessity}
            color={data.necessityMap[commitment.necessity]}
            small
          />
        ) : null}
        {missed ? <Chip label="Missed" color={colors.danger} small /> : null}
        {completed ? (
          <Chip
            label={
              task.status === 'completed_ideal'
                ? 'Done · ideal'
                : 'Done · fallback'
            }
            color={
              task.status === 'completed_ideal'
                ? colors.primary
                : colors.fallback
            }
            small
          />
        ) : null}
      </View>

      {/* Step checklists (only due steps) */}
      {expanded && hasSteps ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {dueIdeal.length > 0 ? (
            <View
              style={{
                borderRadius: radius.sm,
                backgroundColor: colors.surfaceAlt,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text
                style={{
                  ...type.tiny,
                  color: colors.primary,
                  textTransform: 'uppercase',
                  marginBottom: spacing.xs,
                }}
              >
                Ideal
              </Text>
              {dueIdeal.map((s) => renderStep(s, 'ideal', colors.primary))}
            </View>
          ) : null}
          {dueFallback.length > 0 ? (
            <View
              style={{
                borderRadius: radius.sm,
                backgroundColor: colors.fallbackSoft,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text
                style={{
                  ...type.tiny,
                  color: colors.fallback,
                  textTransform: 'uppercase',
                  marginBottom: spacing.xs,
                }}
              >
                Fallback
              </Text>
              {dueFallback.map((s) =>
                renderStep(s, 'fallback', colors.fallback)
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Actions: complete either way, or re-open */}
      {!completed ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <AppButton
            label="Done"
            sub={commitment.idealTask}
            onPress={() => completeTask(task.id, 'ideal')}
            variant="primary"
            size="lg"
            disabled={readOnly}
          />
          <AppButton
            label="Fallback"
            sub={commitment.fallbackTask}
            onPress={() => completeTask(task.id, 'fallback')}
            variant="fallback"
            size="md"
            disabled={readOnly}
          />
        </View>
      ) : (
        <AppButton
          label="Re-open"
          onPress={() => reopenTask(task.id)}
          variant="ghost"
          size="sm"
          disabled={readOnly}
          style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  dimmed: {
    opacity: 0.65,
  },
});
