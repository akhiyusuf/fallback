import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/store/AppContext';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

/** Soft recessed text input with an optional label and error line. */
export function TextField({
  label,
  error,
  style,
  placeholderTextColor,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;

  return (
    <View>
      {label ? (
        <Text
          style={{
            ...theme.type.caption,
            color: colors.textSecondary,
            marginBottom: spacing.xs,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        style={[
          {
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.sm,
            borderWidth: 1,
            // A visible default border keeps the input findable on tinted
            // cards (e.g. the amber fallback panel) where surfaceAlt blends in.
            borderColor: error ? colors.danger : colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.text,
          },
          style,
        ]}
      />
      {error ? (
        <Text
          style={{
            ...theme.type.caption,
            color: colors.danger,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
