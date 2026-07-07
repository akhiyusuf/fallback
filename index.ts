/**
 * App entry point. Boots expo-router, then registers the Android widget
 * task handler. Widget registration is Android-only and fully guarded:
 * react-native-android-widget resolves its native module at import time,
 * so both requires stay inside the try/catch — Expo Go / iOS / web simply
 * skip widget support instead of crashing.
 */

import 'expo-router/entry';

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { widgetTaskHandler } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./src/widgets/widget-task-handler') as typeof import('./src/widgets/widget-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Widget native module unavailable (Expo Go) — run without widgets.
  }
}
