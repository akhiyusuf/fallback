import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/store/AppContext';

export interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  /** Accent color for the checked box. Defaults to the theme primary. */
  color?: string;
  label?: string;
  /** Small pill of extra text next to the label (e.g. "5 min"). */
  badge?: string;
  /** Strike the label through (completed look). */
  strike?: boolean;
}

/** Rounded checkbox row with optional label, badge and strikethrough. */
export function Checkbox({
  checked,
  onToggle,
  color,
  label,
  badge,
  strike = false,
}: CheckboxProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const accent = color ?? colors.primary;

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={4}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs + 2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.xs,
          borderWidth: 1.5,
          borderColor: checked ? accent : colors.borderStrong,
          backgroundColor: checked ? accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
        ) : null}
      </View>
      {label ? (
        <Text
          numberOfLines={2}
          style={{
            ...theme.type.body,
            color: strike
              ? colors.textMuted
              : checked
                ? colors.textSecondary
                : colors.text,
            textDecorationLine: strike ? 'line-through' : 'none',
            marginLeft: spacing.md,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      ) : null}
      {badge ? (
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            marginLeft: spacing.sm,
          }}
        >
          <Text style={{ ...theme.type.tiny, color: colors.textSecondary }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
