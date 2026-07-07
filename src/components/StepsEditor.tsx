/**
 * Inline editor for a checklist of Steps (ideal or fallback subtasks).
 *
 * - Add row: "Add a step…" text field + add icon.
 * - Per step: inline title field, small optional badge field, a frequency
 *   chip that toggles Daily ⇄ Weekly (weekly reveals a weekday multi-select
 *   chip row) and a remove ✕.
 */

import React, { useState } from 'react';
import { View } from 'react-native';

import { Chip, IconButton, TextField } from '@/components/ui';
import { weekdayShort } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { useTheme } from '@/store/AppContext';
import type { Step, Weekday } from '@/types';

export interface StepsEditorProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  /** Accent for chips/add icon. Defaults to 'primary'. */
  accent?: 'primary' | 'fallback';
}

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function StepsEditor({
  steps,
  onChange,
  accent = 'primary',
}: StepsEditorProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const accentColor =
    accent === 'fallback' ? colors.fallback : colors.primary;

  const [draft, setDraft] = useState('');

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    onChange([...steps, { id: newId('step'), title, frequency: 'daily' }]);
    setDraft('');
  };

  const update = (id: string, patch: Partial<Step>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const remove = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  const toggleFrequency = (step: Step) => {
    if (step.frequency === 'weekly') {
      update(step.id, { frequency: 'daily', targetDays: undefined });
    } else {
      update(step.id, { frequency: 'weekly', targetDays: step.targetDays ?? [] });
    }
  };

  const toggleDay = (step: Step, day: Weekday) => {
    const days = step.targetDays ?? [];
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort((a, b) => a - b);
    update(step.id, { targetDays: next });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {steps.map((step) => (
        <View key={step.id} style={{ gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <TextField
                value={step.title}
                onChangeText={(t) => update(step.id, { title: t })}
                placeholder="Step"
              />
            </View>
            <View style={{ width: 72 }}>
              <TextField
                value={step.badge ?? ''}
                onChangeText={(t) =>
                  update(step.id, { badge: t.length > 0 ? t : undefined })
                }
                placeholder="badge"
              />
            </View>
            <Chip
              small
              label={step.frequency === 'weekly' ? 'Weekly' : 'Daily'}
              color={accentColor}
              selected={step.frequency === 'weekly'}
              onPress={() => toggleFrequency(step)}
            />
            <IconButton
              icon="close"
              size={18}
              onPress={() => remove(step.id)}
              accessibilityLabel="Remove step"
            />
          </View>
          {step.frequency === 'weekly' ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.xs,
              }}
            >
              {WEEKDAYS.map((day) => (
                <Chip
                  key={day}
                  small
                  label={weekdayShort(day)}
                  color={accentColor}
                  selected={(step.targetDays ?? []).includes(day)}
                  onPress={() => toggleDay(step, day)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a step…"
            onSubmitEditing={add}
            returnKeyType="done"
          />
        </View>
        <IconButton
          icon="add-circle"
          size={26}
          color={accentColor}
          onPress={add}
          accessibilityLabel="Add step"
        />
      </View>
    </View>
  );
}
