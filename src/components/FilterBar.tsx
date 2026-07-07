/**
 * Day-progress counter + category cycler row.
 *
 * Left: "done/total done" in tabular numerals. Right: ◀ category ▶ where the
 * chevrons cycle through the available categories ('All' when category is
 * null).
 */

import React from 'react';
import { Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { useTheme } from '@/store/AppContext';

export interface FilterBarProps {
  done: number;
  total: number;
  /** Active category name, or null for 'All'. */
  category: string | null;
  onPrev: () => void;
  onNext: () => void;
}

export function FilterBar({
  done,
  total,
  category,
  onPrev,
  onNext,
}: FilterBarProps) {
  const { colors, spacing, type } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
      }}
    >
      <Text
        style={{
          ...type.caption,
          ...type.num,
          color: colors.textSecondary,
        }}
      >
        {done}/{total} done
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton
          icon="chevron-back"
          size={18}
          onPress={onPrev}
          accessibilityLabel="Previous category"
        />
        <Text
          numberOfLines={1}
          style={{
            ...type.caption,
            fontWeight: '600',
            color: colors.text,
            minWidth: 72,
            textAlign: 'center',
            marginHorizontal: spacing.xs,
          }}
        >
          {category ?? 'All'}
        </Text>
        <IconButton
          icon="chevron-forward"
          size={18}
          onPress={onNext}
          accessibilityLabel="Next category"
        />
      </View>
    </View>
  );
}
