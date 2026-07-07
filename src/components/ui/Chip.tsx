import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface ChipProps {
  label: string;
  /** Accent color (hex). Defaults to the theme primary. */
  color?: string;
  /** Filled when selected; tinted (color + '26') otherwise. */
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
}

/** Tag pill: tinted background with the label in the tag color. */
export function Chip({ label, color, selected = false, onPress, small = false }: ChipProps) {
  const theme = useTheme();
  const accent = color ?? theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => ({
        backgroundColor: selected ? accent : accent + '26',
        borderRadius: theme.radius.full,
        paddingVertical: small ? 3 : 6,
        paddingHorizontal: small ? theme.spacing.sm : theme.spacing.md,
        alignSelf: 'flex-start',
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: selected ? theme.colors.onPrimary : accent,
          fontSize: small ? 11 : 13,
          fontWeight: '600',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
