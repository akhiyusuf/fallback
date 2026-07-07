import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface ProgressBarProps {
  /** Progress from 0 to 1; clamped, NaN treated as 0. */
  value: number;
  /** Fill color. Defaults to the theme primary. */
  color?: string;
}

/** Slim rounded progress bar on a recessed track. */
export function ProgressBar({ value, color }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      style={{
        height: 8,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: theme.radius.full,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
}
