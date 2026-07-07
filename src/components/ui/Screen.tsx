import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/store/AppContext';

export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap children in a ScrollView. Defaults to false. */
  scroll?: boolean;
  /** Apply horizontal padding. Defaults to true. */
  padded?: boolean;
}

/** Top-safe-area screen container with the app background color. */
export function Screen({ children, scroll = false, padded = true }: ScreenProps) {
  const theme = useTheme();
  const padding = padded
    ? { paddingHorizontal: theme.spacing.lg }
    : undefined;

  if (scroll) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[padding, { paddingBottom: theme.spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          // iOS does not auto-scroll focused inputs into view; Android's
          // resize soft-input mode makes this a no-op there.
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.flex, { backgroundColor: theme.colors.background }, padding]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
