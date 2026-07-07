/**
 * Home-screen widget refresh.
 *
 * Android-only. The react-native-android-widget package resolves its native
 * module when first imported, so it (and the widget tree that pulls it in)
 * is required lazily inside try/catch — a missing native module (Expo Go,
 * iOS, web) makes this a silent no-op.
 */

import { Platform } from 'react-native';

import type { AppData } from '@/types';

/** Redraws the "FallbackToday" widget from the given data. Never throws. */
export async function updateWidgets(data: AppData): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const widgetLib =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-android-widget') as typeof import('react-native-android-widget');
    const handlerModule =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/widgets/widget-task-handler') as typeof import('@/widgets/widget-task-handler');

    await widgetLib.requestWidgetUpdate({
      widgetName: handlerModule.TODAY_WIDGET_NAME,
      renderWidget: () => handlerModule.renderTodayWidget(data),
    });
  } catch {
    // Widget native module unavailable — ignore.
  }
}
