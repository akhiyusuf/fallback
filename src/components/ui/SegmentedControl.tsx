import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}

/** Soft pill segmented control on a recessed track. */
export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.sm,
        padding: 3,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm - 2,
              backgroundColor: selected ? colors.surface : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed && !selected ? 0.7 : 1,
              ...(selected
                ? {
                    shadowColor: colors.shadow,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 1,
                    shadowRadius: 3,
                    elevation: 1,
                  }
                : null),
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: selected ? '600' : '500',
                color: selected ? colors.text : colors.textSecondary,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
