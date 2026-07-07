import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface SectionLabelProps {
  children: string;
}

/** Tiny uppercase muted section heading. */
export function SectionLabel({ children }: SectionLabelProps) {
  const theme = useTheme();
  return (
    <Text
      style={{
        ...theme.type.tiny,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: theme.spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}
