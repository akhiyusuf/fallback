import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface CardProps extends ViewProps {
  /** Apply inner padding. Defaults to true. */
  padded?: boolean;
}

/** Soft rounded surface card: 1px border and a faint shadow. */
export function Card({ padded = true, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 1,
        },
        padded ? { padding: theme.spacing.lg } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
