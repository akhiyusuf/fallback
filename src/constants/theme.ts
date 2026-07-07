/**
 * Centralized design tokens for Fallback.
 *
 * Identity: light-first, soft and calm. Warm off-white surfaces (or deep
 * charcoal in dark mode), rounded corners, sage green for the ideal path,
 * warm amber for the fallback path, muted red for destructive actions.
 * System font throughout; use `type.num`'s tabular numerals for counts.
 */

import { TextStyle } from 'react-native';

export interface ThemeColors {
  background: string;
  surface: string;
  /** Slightly recessed surface (inputs, wells, secondary rows). */
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  /** Ideal / primary action (sage green). */
  primary: string;
  onPrimary: string;
  /** Tinted background for primary-soft fills. */
  primarySoft: string;

  /** Fallback action (warm amber). */
  fallback: string;
  onFallback: string;
  fallbackSoft: string;

  /** Destructive (muted red). */
  danger: string;
  onDanger: string;
  dangerSoft: string;

  /** Calendar/status dots. */
  statusPending: string;
  statusIdeal: string;
  statusFallback: string;
  statusMissed: string;

  overlay: string;
  shadow: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
}

export const lightColors: ThemeColors = {
  background: '#F6F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0EB',
  border: '#E4E7E1',
  borderStrong: '#C9CFC6',

  text: '#1C201D',
  textSecondary: '#4E564F',
  textMuted: '#8B948C',

  primary: '#3F8F63',
  onPrimary: '#FFFFFF',
  primarySoft: '#E4F1E9',

  // Dark enough for 4.5:1 text on fallbackSoft/white (the fallback-variant
  // button label and sub line are body-size text).
  fallback: '#8F621B',
  onFallback: '#FFFFFF',
  fallbackSoft: '#F8ECD4',

  danger: '#C4574A',
  onDanger: '#FFFFFF',
  dangerSoft: '#F8E4E0',

  statusPending: '#A8B0A9',
  statusIdeal: '#3F8F63',
  statusFallback: '#C98F2E',
  statusMissed: '#C4574A',

  overlay: 'rgba(22, 26, 23, 0.45)',
  shadow: 'rgba(28, 32, 29, 0.08)',
  tabBar: '#FFFFFF',
  tabActive: '#3F8F63',
  tabInactive: '#8B948C',
};

export const darkColors: ThemeColors = {
  background: '#141715',
  surface: '#1D211E',
  surfaceAlt: '#262B27',
  border: '#31372F',
  borderStrong: '#48504A',

  text: '#ECEFEA',
  textSecondary: '#B5BDB4',
  textMuted: '#7F887F',

  primary: '#6FBF92',
  onPrimary: '#0F2418',
  primarySoft: '#22382B',

  fallback: '#E0AE5C',
  onFallback: '#2A1F0B',
  fallbackSoft: '#3A301A',

  danger: '#E0857A',
  onDanger: '#2B120E',
  dangerSoft: '#3C2521',

  statusPending: '#5C665D',
  statusIdeal: '#6FBF92',
  statusFallback: '#E0AE5C',
  statusMissed: '#E0857A',

  overlay: 'rgba(0, 0, 0, 0.55)',
  shadow: 'rgba(0, 0, 0, 0.35)',
  tabBar: '#1D211E',
  tabActive: '#6FBF92',
  tabInactive: '#7F887F',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  full: 999,
} as const;

/** Tabular numerals for counts, scores and times so digits align. */
const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 } as TextStyle,
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 } as TextStyle,
  subheading: { fontSize: 16, fontWeight: '600' } as TextStyle,
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 } as TextStyle,
  caption: { fontSize: 13, fontWeight: '500' } as TextStyle,
  tiny: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 } as TextStyle,
  /** Numeric text (counts, times, scores). */
  num: tabularNums,
} as const;

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
}

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  type,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  type,
};

export function getTheme(dark: boolean): Theme {
  return dark ? darkTheme : lightTheme;
}

/** Preset palette offered when creating a new tag. */
export const TAG_COLOR_CHOICES: string[] = [
  '#E07856',
  '#E3A857',
  '#8FB573',
  '#3F8F63',
  '#6D8FC9',
  '#9B85C4',
  '#C4574A',
  '#8A9BA8',
  '#5FA8A0',
  '#C77BA2',
];
