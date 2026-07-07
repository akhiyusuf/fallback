/**
 * Root layout.
 *
 * Boots notifications at module scope, holds the native splash until the
 * store has loaded from disk, wraps everything in AppProvider, maps our
 * design tokens onto the react-navigation theme, and declares the Stack:
 * the (tabs) group, the onboarding intro and the edit form (modal).
 */

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';

import { initNotifications } from '@/lib/notifications';
import { AppProvider, useApp } from '@/store/AppContext';

// Foreground handler + Android channel; internally guarded, but a failure
// here must never take the whole app down.
try {
  initNotifications();
} catch {
  // notifications unavailable — ignore
}

// Keep the splash visible until the store is ready (RootNavigator hides it).
try {
  void SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // splash module unavailable (e.g. web) — ignore
}

function RootNavigator() {
  const { ready, theme } = useApp();
  const { colors } = theme;

  // Map our tokens onto the react-navigation theme so native chrome
  // (headers, modals, backgrounds) matches the app palette.
  const navTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: theme.dark,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
        notification: colors.danger,
      },
    };
  }, [theme.dark, colors]);

  useEffect(() => {
    if (!ready) return;
    try {
      void SplashScreen.hideAsync().catch(() => {});
    } catch {
      // ignore
    }
  }, [ready]);

  // Splash stays up while storage loads.
  if (!ready) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="edit"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
