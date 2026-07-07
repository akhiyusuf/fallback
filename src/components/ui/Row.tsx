import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface RowProps {
  label: string;
  sub?: string;
  /** Trailing accessory (Switch, value text, icon, …). */
  right?: React.ReactNode;
  onPress?: () => void;
  /** Render the label in the danger color (destructive rows). */
  danger?: boolean;
}

/** Settings-style row: label + optional sub line, trailing accessory. */
export function Row({ label, sub, right, onPress, danger = false }: RowProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        minHeight: 48,
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: danger ? colors.danger : colors.text,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            numberOfLines={2}
            style={{
              ...theme.type.caption,
              fontWeight: '400',
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </Pressable>
  );
}
