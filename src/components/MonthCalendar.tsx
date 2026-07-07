/**
 * Modal month calendar.
 *
 * Centered Card over a dimmed overlay: ◀ ▶ month navigation, weekday header,
 * day grid with a per-day status dot (via `dayDot`), a small diamond under
 * days on which any regimen's deadline falls, a ring on the selected day, a
 * legend row, and a "Back to Today" button. Tapping a day selects it and
 * closes the modal.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { AppButton, Card, IconButton } from '@/components/ui';
import {
  daysInMonth,
  firstWeekdayOfMonth,
  formatDisplayDate,
  formatMonthYear,
  makeDateKey,
  parseDateKey,
  todayKey,
  weekdayShort,
} from '@/lib/dates';
import { dayDot, type DayDot } from '@/lib/score';
import { tasksOn } from '@/lib/taskGeneration';
import { useApp, useTheme } from '@/store/AppContext';
import type { Weekday } from '@/types';

export interface MonthCalendarProps {
  visible: boolean;
  onClose: () => void;
  selected: string;
  onSelectDay: (key: string) => void;
}

interface MonthView {
  year: number;
  month0: number;
}

const CELL_WIDTH = `${100 / 7}%` as const;
const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function monthViewOf(key: string): MonthView {
  const d = parseDateKey(key);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

export function MonthCalendar({
  visible,
  onClose,
  selected,
  onSelectDay,
}: MonthCalendarProps) {
  const { data } = useApp();
  const { colors, spacing, radius, type } = useTheme();
  const today = todayKey();

  const [view, setView] = useState<MonthView>(() => monthViewOf(selected));

  // Whenever the calendar opens, jump back to the selected date's month.
  useEffect(() => {
    if (visible) setView(monthViewOf(selected));
  }, [visible, selected]);

  const goPrevMonth = () =>
    setView((v) =>
      v.month0 === 0
        ? { year: v.year - 1, month0: 11 }
        : { year: v.year, month0: v.month0 - 1 }
    );
  const goNextMonth = () =>
    setView((v) =>
      v.month0 === 11
        ? { year: v.year + 1, month0: 0 }
        : { year: v.year, month0: v.month0 + 1 }
    );

  /** Days of the viewed month with their date key and status dot. */
  const days = useMemo(() => {
    const total = daysInMonth(view.year, view.month0);
    const result: { day: number; key: string; dot: DayDot }[] = [];
    for (let day = 1; day <= total; day++) {
      const key = makeDateKey(view.year, view.month0, day);
      result.push({ day, key, dot: dayDot(tasksOn(data.tasks, key), today) });
    }
    return result;
  }, [view, data.tasks, today]);

  const leadingBlanks = firstWeekdayOfMonth(view.year, view.month0);

  /** Every date key on which some regimen's deadline lands. */
  const deadlineKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of data.commitments) {
      if (c.type === 'regimen' && c.targetDate) set.add(c.targetDate);
    }
    return set;
  }, [data.commitments]);

  const dotColors: Record<DayDot, string> = {
    none: 'transparent',
    pending: colors.statusPending,
    ideal: colors.statusIdeal,
    fallback: colors.statusFallback,
    missed: colors.statusMissed,
  };

  const legendItems: { label: string; color: string }[] = [
    { label: 'Pending', color: colors.statusPending },
    { label: 'Ideal', color: colors.statusIdeal },
    { label: 'Fallback', color: colors.statusFallback },
    { label: 'Missed', color: colors.statusMissed },
  ];

  const pickDay = (key: string) => {
    onSelectDay(key);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close calendar"
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        {/* Swallow taps inside the card so they don't close the modal. */}
        <Pressable
          onPress={() => {}}
          style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}
        >
          <Card>
            {/* Month header + navigation */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.md,
              }}
            >
              <IconButton
                icon="chevron-back"
                onPress={goPrevMonth}
                accessibilityLabel="Previous month"
              />
              <Text style={{ ...type.subheading, color: colors.text }}>
                {formatMonthYear(view.year, view.month0)}
              </Text>
              <IconButton
                icon="chevron-forward"
                onPress={goNextMonth}
                accessibilityLabel="Next month"
              />
            </View>

            {/* Weekday header */}
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((d) => (
                <Text
                  key={d}
                  style={{
                    ...type.tiny,
                    width: CELL_WIDTH,
                    textAlign: 'center',
                    color: colors.textMuted,
                  }}
                >
                  {weekdayShort(d).slice(0, 2)}
                </Text>
              ))}
            </View>

            {/* Day grid */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: spacing.xs,
              }}
            >
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <View key={`blank-${i}`} style={{ width: CELL_WIDTH }} />
              ))}
              {days.map(({ day, key, dot }) => {
                const isSelected = key === selected;
                const isToday = key === today;
                return (
                  <Pressable
                    key={key}
                    onPress={() => pickDay(key)}
                    accessibilityRole="button"
                    accessibilityLabel={formatDisplayDate(key)}
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => ({
                      width: CELL_WIDTH,
                      alignItems: 'center',
                      paddingVertical: spacing.xs,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: isSelected
                          ? colors.primary
                          : 'transparent',
                        backgroundColor: isToday
                          ? colors.primarySoft
                          : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          ...type.body,
                          ...type.num,
                          color: isToday ? colors.primary : colors.text,
                          fontWeight: isToday ? '700' : '400',
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                    {/* Status dot */}
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: radius.full,
                        marginTop: 3,
                        backgroundColor: dotColors[dot],
                      }}
                    />
                    {/* Regimen-deadline diamond */}
                    <View
                      style={{
                        height: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {deadlineKeys.has(key) ? (
                        <Text
                          style={{
                            fontSize: 8,
                            lineHeight: 10,
                            color: colors.fallback,
                          }}
                        >
                          ◆
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Legend */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: spacing.sm,
                marginTop: spacing.md,
              }}
            >
              {legendItems.map(({ label, color }) => (
                <View
                  key={label}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: radius.full,
                      backgroundColor: color,
                      marginRight: spacing.xs,
                    }}
                  />
                  <Text style={{ ...type.tiny, color: colors.textSecondary }}>
                    {label}
                  </Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 8,
                    color: colors.fallback,
                    marginRight: spacing.xs,
                  }}
                >
                  ◆
                </Text>
                <Text style={{ ...type.tiny, color: colors.textSecondary }}>
                  Deadline
                </Text>
              </View>
            </View>

            <AppButton
              label="Back to Today"
              variant="secondary"
              size="sm"
              onPress={() => pickDay(todayKey())}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
