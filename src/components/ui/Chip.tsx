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

/**
 * WCAG relative luminance of a '#RRGGBB' color (0 = black, 1 = white).
 * Falls back to "dark" for unparseable strings.
 */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const chan = (i: number) => {
    const c = parseInt(m[1].slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(0) + 0.7152 * chan(1) + 0.0722 * chan(2);
}

/** Tag pill: tinted background with the label in the tag color. */
export function Chip({ label, color, selected = false, onPress, small = false }: ChipProps) {
  const theme = useTheme();
  const accent = color ?? theme.colors.primary;
  // Tag accents are arbitrary user colors, so the filled-state label color
  // must follow the accent's luminance, not the theme's onPrimary (white on
  // the amber/sage swatches is unreadable in light mode).
  const onAccent = luminance(accent) > 0.4 ? '#1C201D' : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      hitSlop={onPress ? (small ? 10 : 6) : undefined}
      style={({ pressed }) => ({
        backgroundColor: selected ? accent : accent + '26',
        borderRadius: theme.radius.full,
        paddingVertical: small ? 4 : 6,
        paddingHorizontal: small ? theme.spacing.sm : theme.spacing.md,
        alignSelf: 'flex-start',
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: selected ? onAccent : accent,
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
