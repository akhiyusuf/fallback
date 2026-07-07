import React, { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/store/AppContext';

export interface IconButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  /** Icon size in px. Defaults to 22. */
  size?: number;
  /** Icon color. Defaults to textSecondary. */
  color?: string;
  /** Small count bubble at the top-right; hidden when 0 or undefined. */
  badge?: number;
  accessibilityLabel?: string;
}

/** Bare icon tap target with an optional count badge. */
export function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  badge,
  accessibilityLabel,
}: IconButtonProps) {
  const theme = useTheme();
  const showBadge = typeof badge === 'number' && badge > 0;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        padding: theme.spacing.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={size} color={color ?? theme.colors.textSecondary} />
      {showBadge ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            minWidth: 17,
            height: 17,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
            borderWidth: 1.5,
            borderColor: theme.colors.background,
          }}
        >
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontSize: 10,
              fontWeight: '700',
              ...theme.type.num,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
