import React from 'react';
import { Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/store/AppContext';

export type AppButtonVariant =
  | 'primary'
  | 'fallback'
  | 'secondary'
  | 'ghost'
  | 'danger';

export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  /** Smaller second line under the label. */
  sub?: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Soft rounded button. Variants map onto the theme's action palettes. */
export function AppButton({
  label,
  onPress,
  sub,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
}: AppButtonProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;

  let background: string;
  let border: string;
  let labelColor: string;
  switch (variant) {
    case 'primary':
      background = colors.primary;
      border = 'transparent';
      labelColor = colors.onPrimary;
      break;
    case 'fallback':
      background = colors.fallbackSoft;
      border = colors.fallback;
      labelColor = colors.fallback;
      break;
    case 'secondary':
      background = colors.surfaceAlt;
      border = 'transparent';
      labelColor = colors.text;
      break;
    case 'ghost':
      background = 'transparent';
      border = 'transparent';
      labelColor = colors.textSecondary;
      break;
    case 'danger':
      background = colors.dangerSoft;
      border = 'transparent';
      labelColor = colors.danger;
      break;
  }

  const sizing =
    size === 'sm'
      ? {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.sm,
          fontSize: 13,
        }
      : size === 'lg'
        ? {
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.md,
            fontSize: 17,
          }
        : {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            fontSize: 15,
          };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderWidth: 1,
          borderColor: border,
          borderRadius: sizing.borderRadius,
          paddingVertical: sizing.paddingVertical,
          paddingHorizontal: sizing.paddingHorizontal,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color: labelColor,
          fontSize: sizing.fontSize,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
      {sub ? (
        <Text
          numberOfLines={1}
          style={{
            color: labelColor,
            opacity: 0.8,
            fontSize: Math.max(11, sizing.fontSize - 3),
            fontWeight: '500',
            marginTop: 2,
            textAlign: 'center',
          }}
        >
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}
