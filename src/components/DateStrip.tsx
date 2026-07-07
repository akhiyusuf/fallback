/**
 * Horizontal ±30-day date strip.
 *
 * A FlatList of the 61 days around today: weekday short over the day number.
 * Today is marked with an outline + dot; the selected day is a filled primary
 * pill. `getItemLayout` + `initialScrollIndex` center the selected date on
 * mount, and later selections animate into center. A calendar IconButton is
 * pinned at the right edge.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  Text,
  View,
} from 'react-native';

import { IconButton } from '@/components/ui';
import {
  addDays,
  daysBetween,
  formatDisplayDate,
  parseDateKey,
  todayKey,
  weekdayShort,
} from '@/lib/dates';
import { useTheme } from '@/store/AppContext';
import type { Weekday } from '@/types';

export interface DateStripProps {
  selected: string;
  onSelect: (key: string) => void;
  onOpenCalendar: () => void;
}

/** Days shown on each side of today. */
const DAYS_AROUND = 30;
/** Fixed cell geometry so getItemLayout can compute exact offsets. */
const ITEM_LENGTH = 54;
const PILL_WIDTH = 46;
/** Approximate width of the pinned calendar-button column. */
const BUTTON_COLUMN = 46;

interface DayCellProps {
  dateKey: string;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (key: string) => void;
}

const DayCell = memo(function DayCell({
  dateKey,
  isToday,
  isSelected,
  onSelect,
}: DayCellProps) {
  const { colors, spacing, radius, type } = useTheme();
  const date = parseDateKey(dateKey);
  const weekday = weekdayShort(date.getDay() as Weekday);

  return (
    <Pressable
      onPress={() => onSelect(dateKey)}
      accessibilityRole="button"
      accessibilityLabel={formatDisplayDate(dateKey)}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => ({
        width: ITEM_LENGTH,
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: PILL_WIDTH,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          alignItems: 'center',
          backgroundColor: isSelected ? colors.primary : 'transparent',
          borderWidth: 1,
          borderColor:
            isSelected || isToday ? colors.primary : 'transparent',
        }}
      >
        <Text
          style={{
            ...type.tiny,
            color: isSelected ? colors.onPrimary : colors.textMuted,
          }}
        >
          {weekday}
        </Text>
        <Text
          style={{
            ...type.subheading,
            ...type.num,
            marginTop: 2,
            color: isSelected ? colors.onPrimary : colors.text,
          }}
        >
          {date.getDate()}
        </Text>
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: radius.full,
            marginTop: 3,
            backgroundColor: isToday
              ? isSelected
                ? colors.onPrimary
                : colors.primary
              : 'transparent',
          }}
        />
      </View>
    </Pressable>
  );
});

/** ±30-day horizontal date picker strip with a pinned calendar button. */
export function DateStrip({ selected, onSelect, onOpenCalendar }: DateStripProps) {
  const { spacing } = useTheme();
  const today = todayKey();

  const keys = useMemo(() => {
    // Anchor on today normally; when the month calendar picks a date beyond
    // the ±30-day window, re-anchor around the selection so the strip can
    // still render and center it (otherwise no cell would appear selected).
    const anchor =
      Math.abs(daysBetween(today, selected)) <= DAYS_AROUND ? today : selected;
    const start = addDays(anchor, -DAYS_AROUND);
    return Array.from({ length: DAYS_AROUND * 2 + 1 }, (_, i) =>
      addDays(start, i)
    );
  }, [today, selected]);

  const listRef = useRef<FlatList<string>>(null);

  // Initial index chosen once so the selected date lands roughly centered.
  const initialIndexRef = useRef<number | null>(null);
  if (initialIndexRef.current === null) {
    const selectedIndex = keys.indexOf(selected);
    const centerOn = selectedIndex >= 0 ? selectedIndex : DAYS_AROUND;
    const viewport = Math.max(
      ITEM_LENGTH,
      Dimensions.get('window').width - BUTTON_COLUMN
    );
    const visibleItems = Math.max(1, Math.floor(viewport / ITEM_LENGTH));
    initialIndexRef.current = Math.min(
      Math.max(0, centerOn - Math.floor(visibleItems / 2)),
      keys.length - 1
    );
  }

  // Re-center whenever the selection changes after mount.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const index = keys.indexOf(selected);
    if (index < 0) return;
    try {
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: true,
      });
    } catch {
      // list not laid out yet — ignore
    }
  }, [selected, keys]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<string> | null | undefined, index: number) => ({
      length: ITEM_LENGTH,
      offset: ITEM_LENGTH * index,
      index,
    }),
    []
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      listRef.current?.scrollToOffset({
        offset: ITEM_LENGTH * info.index,
        animated: false,
      });
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <DayCell
        dateKey={item}
        isToday={item === today}
        isSelected={item === selected}
        onSelect={onSelect}
      />
    ),
    [today, selected, onSelect]
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <FlatList
        ref={listRef}
        data={keys}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(key) => key}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndexRef.current}
        onScrollToIndexFailed={onScrollToIndexFailed}
        extraData={`${selected}|${today}`}
        style={{ flexGrow: 1, flexShrink: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.xs }}
      />
      <View style={{ paddingLeft: spacing.xs }}>
        <IconButton
          icon="calendar-outline"
          onPress={onOpenCalendar}
          accessibilityLabel="Open calendar"
        />
      </View>
    </View>
  );
}
