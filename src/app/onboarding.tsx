/**
 * First-launch intro.
 *
 * Centered leaf icon, the app's one core idea (ideal vs. fallback), three
 * short value rows (1.0 / 0.5 / score) and a "Get started" button that marks
 * onboarding complete and replaces to the tab group. Already-onboarded users
 * are redirected straight to the tabs.
 */

import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, Screen } from '@/components/ui';
import { useApp, useTheme } from '@/store/AppContext';

interface ValueRowProps {
  badge: string;
  badgeColor: string;
  badgeBackground: string;
  title: string;
  description: string;
}

function ValueRow({
  badge,
  badgeColor,
  badgeBackground,
  title,
  description,
}: ValueRowProps) {
  const { colors, spacing, radius, type } = useTheme();
  return (
    <View style={[styles.row, { marginTop: spacing.lg }]}>
      <View
        style={{
          width: 52,
          height: 36,
          borderRadius: radius.sm,
          backgroundColor: badgeBackground,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        }}
      >
        <Text
          style={{
            ...type.caption,
            ...type.num,
            fontWeight: '700',
            color: badgeColor,
          }}
        >
          {badge}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text style={{ ...type.subheading, color: colors.text }}>{title}</Text>
        <Text
          style={{ ...type.caption, color: colors.textSecondary, marginTop: 2 }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { data, completeOnboarding } = useApp();
  const { colors, spacing, radius, type } = useTheme();

  if (data.hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  const onGetStarted = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={styles.center}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: radius.full,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="leaf" size={40} color={colors.primary} />
        </View>

        <Text
          style={{ ...type.title, color: colors.text, marginTop: spacing.xl }}
        >
          Fallback
        </Text>
        <Text
          style={{
            ...type.body,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.md,
            maxWidth: 320,
          }}
        >
          Every commitment has two versions — the ideal and a minimum fallback.
          On hard days, do the fallback instead of skipping.
        </Text>

        <View style={[styles.rows, { marginTop: spacing.lg }]}>
          <ValueRow
            badge="1.0"
            badgeColor={colors.primary}
            badgeBackground={colors.primarySoft}
            title="Ideal"
            description="The full version — worth full credit."
          />
          <ValueRow
            badge="0.5"
            badgeColor={colors.fallback}
            badgeBackground={colors.fallbackSoft}
            title="Fallback"
            description="The minimum backup — half credit beats zero."
          />
          <ValueRow
            badge="30d"
            badgeColor={colors.textSecondary}
            badgeBackground={colors.surfaceAlt}
            title="Score"
            description="A rolling 30-day discipline score from your credit."
          />
        </View>
      </View>

      <AppButton
        label="Get started"
        onPress={onGetStarted}
        variant="primary"
        size="lg"
        style={{ marginBottom: spacing.xxl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    alignSelf: 'stretch',
    maxWidth: 360,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
  },
});
