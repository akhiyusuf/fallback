/**
 * Settings tab — five sections:
 *
 * 1. Score       — 30-day discipline % + progress bar.
 * 2. Preferences — real switches for Reminders / Dark Mode / Auto-complete
 *                  steps, plus a reminder lead-time row cycling 5/10/15/30/60.
 * 3. Categories  — tag color editor for both tag maps: tap a tag to expand a
 *                  swatch row, "+ Add tag" for an inline name + color flow.
 * 4. Manage      — search + Routines/Events/Regimens switcher; each row edits
 *                  (pencil) or deletes (trash, confirm alert) a commitment.
 * 5. Data        — backup-to-clipboard and the destructive Wipe Everything
 *                  flow (confirm → wipeAll → replace to /onboarding).
 */

import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { TAG_COLOR_CHOICES } from '@/constants/theme';
import {
  AppButton,
  Card,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import { formatMediumDate, formatTime, weekdayShort } from '@/lib/dates';
import { useApp, useTheme } from '@/store/AppContext';
import type { Commitment, CommitmentType, TagColorMap, TagKind } from '@/types';

const LEAD_CHOICES = [5, 10, 15, 30, 60];

const MANAGE_OPTIONS: { label: string; value: CommitmentType }[] = [
  { label: 'Routines', value: 'routine' },
  { label: 'Events', value: 'event' },
  { label: 'Regimens', value: 'regimen' },
];

const MANAGE_EMPTY: Record<CommitmentType, string> = {
  routine: 'No routines here.',
  event: 'No events here.',
  regimen: 'No regimens here.',
};

/**
 * Destructive confirm. Alert.alert is a no-op on react-native-web, so the
 * web build falls back to window.confirm to keep the flow functional.
 */
function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } catch {
      // no confirm available — do nothing rather than destroy data silently
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Info popup; window.alert on web where Alert.alert is a no-op. */
function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    } catch {
      // ignore
    }
    return;
  }
  Alert.alert(title, message);
}

/** One-line schedule summary for the Manage list. */
function scheduleSummary(c: Commitment): string {
  if (c.type === 'event') {
    const date = c.targetEventDate
      ? formatMediumDate(c.targetEventDate)
      : 'No date';
    const time = formatTime(c.targetTime);
    return time ? `${date} · ${time}` : date;
  }
  const parts: string[] = [];
  if (c.frequency === 'weekly') {
    const days = [...(c.targetDays ?? [])]
      .sort((a, b) => a - b)
      .map((d) => weekdayShort(d));
    parts.push(days.length > 0 ? days.join(' ') : 'Weekly');
  } else {
    parts.push('Daily');
  }
  const perDay = Math.floor(c.dailyFrequency ?? 1);
  if (perDay > 1) parts.push(`${perDay}×/day`);
  if (c.type === 'regimen') {
    parts.push(c.targetDate ? `until ${formatMediumDate(c.targetDate)}` : 'ongoing');
  }
  return parts.join(' · ');
}

/** Row of tappable tag-color swatches (TAG_COLOR_CHOICES). */
function SwatchRow({
  selected,
  onPick,
}: {
  selected?: string;
  onPick: (color: string) => void;
}) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        paddingBottom: spacing.sm,
      }}
    >
      {TAG_COLOR_CHOICES.map((color) => {
        const isSelected = color === selected;
        return (
          <Pressable
            key={color}
            onPress={() => onPick(color)}
            accessibilityRole="button"
            accessibilityLabel={`Use color ${color}`}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => ({
              width: 30,
              height: 30,
              borderRadius: radius.full,
              backgroundColor: color,
              borderWidth: 2,
              borderColor: isSelected ? colors.text : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          />
        );
      })}
    </View>
  );
}

/** Small colored dot shown at the right edge of a tag row. */
function ColorDot({ color }: { color: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: theme.radius.full,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    />
  );
}

export default function SettingsScreen() {
  const {
    data,
    score30,
    setSettings,
    addTag,
    setTagColor,
    deleteCommitment,
    exportBackup,
    wipeAll,
  } = useApp();
  const theme = useTheme();
  const { colors, spacing } = theme;

  // -- Categories section state --
  const [expandedTag, setExpandedTag] = useState<
    { kind: TagKind; name: string } | null
  >(null);
  const [addingKind, setAddingKind] = useState<TagKind | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLOR_CHOICES[0]);

  // -- Manage section state --
  const [search, setSearch] = useState('');
  const [manageType, setManageType] = useState<CommitmentType>('routine');

  const settings = data.settings;

  // ---------- preferences ----------

  const cycleLeadTime = () => {
    const idx = LEAD_CHOICES.indexOf(settings.reminderLeadMinutes);
    // Unknown stored value → indexOf is -1 and the cycle restarts at 5.
    const next = LEAD_CHOICES[(idx + 1) % LEAD_CHOICES.length];
    setSettings({ reminderLeadMinutes: next });
  };

  const switchColors = {
    trackColor: { false: colors.borderStrong, true: colors.primary },
    thumbColor: colors.surface,
    ios_backgroundColor: colors.borderStrong,
  } as const;

  // ---------- categories ----------

  const tagKinds: { kind: TagKind; label: string; map: TagColorMap }[] = [
    { kind: 'importance', label: 'Importance', map: data.importanceMap },
    { kind: 'necessity', label: 'Necessity', map: data.necessityMap },
  ];

  const toggleExpandedTag = (kind: TagKind, name: string) => {
    setExpandedTag((prev) =>
      prev && prev.kind === kind && prev.name === name ? null : { kind, name }
    );
  };

  const startAddTag = (kind: TagKind) => {
    setAddingKind(kind);
    setNewTagName('');
    setNewTagColor(TAG_COLOR_CHOICES[0]);
    setExpandedTag(null);
  };

  const confirmAddTag = () => {
    const name = newTagName.trim();
    if (!addingKind || !name) return;
    addTag(addingKind, name, newTagColor);
    setAddingKind(null);
    setNewTagName('');
  };

  // ---------- manage ----------

  const managed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.commitments
      .filter((c) => c.type === manageType)
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.commitments, manageType, search]);

  const openEdit = (c: Commitment) => {
    router.push({ pathname: '/edit', params: { type: c.type, id: c.id } });
  };

  const onDelete = (c: Commitment) => {
    confirmAction(
      `Delete “${c.name}”?`,
      'This removes the commitment and all of its tasks. This cannot be undone.',
      'Delete',
      () => deleteCommitment(c.id)
    );
  };

  // ---------- data ----------

  const onBackup = async () => {
    const json = exportBackup();
    try {
      await Clipboard.setStringAsync(json);
      notify('Backup copied', 'All your data was copied to the clipboard as JSON.');
    } catch {
      notify('Backup failed', 'Could not copy to the clipboard on this device.');
    }
  };

  const onWipe = () => {
    confirmAction(
      'Wipe everything?',
      'This permanently deletes every commitment, task, tag and setting. This cannot be undone.',
      'Wipe',
      () => {
        void (async () => {
          await wipeAll();
          router.replace('/onboarding');
        })();
      }
    );
  };

  return (
    <Screen scroll>
      <View style={{ paddingTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text style={{ ...theme.type.title, color: colors.text }}>
          Settings
        </Text>
      </View>

      {/* 1 — Score */}
      <SectionLabel>Score</SectionLabel>
      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={{ ...theme.type.caption, color: colors.textSecondary }}>
          30-day discipline
        </Text>
        <Text
          style={{
            ...theme.type.title,
            ...theme.type.num,
            color: score30 !== null ? colors.primary : colors.textMuted,
            marginTop: spacing.xs,
            marginBottom: spacing.md,
          }}
        >
          {score30 !== null ? `${score30}%` : '—'}
        </Text>
        <ProgressBar value={(score30 ?? 0) / 100} />
      </Card>

      {/* 2 — Preferences */}
      <SectionLabel>Preferences</SectionLabel>
      <Card style={{ marginBottom: spacing.xl, paddingVertical: spacing.xs }}>
        <Row
          label="Reminders"
          sub="Notify at task time and shortly before"
          right={
            <Switch
              value={settings.remindersEnabled}
              onValueChange={(v) => setSettings({ remindersEnabled: v })}
              {...switchColors}
            />
          }
        />
        <Row
          label="Reminder lead time"
          sub="Tap to cycle the heads-up delay"
          onPress={cycleLeadTime}
          right={
            <Text
              style={{
                ...theme.type.caption,
                ...theme.type.num,
                color: colors.primary,
              }}
            >
              {settings.reminderLeadMinutes} min
            </Text>
          }
        />
        <Row
          label="Dark Mode"
          right={
            <Switch
              value={settings.darkMode}
              onValueChange={(v) => setSettings({ darkMode: v })}
              {...switchColors}
            />
          }
        />
        <Row
          label="Auto-complete steps"
          sub="Checking every step completes the task"
          right={
            <Switch
              value={settings.autoCompleteSteps}
              onValueChange={(v) => setSettings({ autoCompleteSteps: v })}
              {...switchColors}
            />
          }
        />
      </Card>

      {/* 3 — Categories */}
      <SectionLabel>Categories</SectionLabel>
      {tagKinds.map(({ kind, label, map }) => (
        <Card
          key={kind}
          style={{ marginBottom: spacing.md, paddingVertical: spacing.sm }}
        >
          <Text
            style={{
              ...theme.type.subheading,
              color: colors.text,
              marginBottom: spacing.xs,
            }}
          >
            {label}
          </Text>
          {Object.entries(map).map(([name, color]) => {
            const expanded =
              expandedTag?.kind === kind && expandedTag.name === name;
            return (
              <View key={name}>
                <Row
                  label={name}
                  onPress={() => toggleExpandedTag(kind, name)}
                  right={<ColorDot color={color} />}
                />
                {expanded ? (
                  <SwatchRow
                    selected={color}
                    onPick={(picked) => {
                      setTagColor(kind, name, picked);
                      setExpandedTag(null);
                    }}
                  />
                ) : null}
              </View>
            );
          })}
          {addingKind === kind ? (
            <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
              <TextField
                placeholder="New tag name"
                value={newTagName}
                onChangeText={setNewTagName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmAddTag}
              />
              <SwatchRow selected={newTagColor} onPick={setNewTagColor} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <AppButton
                  label="Add tag"
                  size="sm"
                  onPress={confirmAddTag}
                  disabled={!newTagName.trim()}
                />
                <AppButton
                  label="Cancel"
                  size="sm"
                  variant="ghost"
                  onPress={() => setAddingKind(null)}
                />
              </View>
            </View>
          ) : (
            <Row label="+ Add tag" onPress={() => startAddTag(kind)} />
          )}
        </Card>
      ))}

      {/* 4 — Manage */}
      <View style={{ marginTop: spacing.sm }}>
        <SectionLabel>Manage</SectionLabel>
      </View>
      <TextField
        placeholder="Search by name…"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={{ marginTop: spacing.sm }}>
        <SegmentedControl
          options={MANAGE_OPTIONS}
          value={manageType}
          onChange={(v) => setManageType(v as CommitmentType)}
        />
      </View>
      <Card
        style={{
          marginTop: spacing.sm,
          marginBottom: spacing.xl,
          paddingVertical: spacing.xs,
        }}
      >
        {managed.length === 0 ? (
          <Text
            style={{
              ...theme.type.body,
              color: colors.textMuted,
              paddingVertical: spacing.md,
              textAlign: 'center',
            }}
          >
            {search.trim()
              ? 'Nothing matches your search.'
              : MANAGE_EMPTY[manageType]}
          </Text>
        ) : (
          managed.map((c) => (
            <Row
              key={c.id}
              label={c.name}
              sub={scheduleSummary(c)}
              onPress={() => openEdit(c)}
              right={
                <View style={styles.rowActions}>
                  <IconButton
                    icon="pencil"
                    size={18}
                    onPress={() => openEdit(c)}
                    accessibilityLabel={`Edit ${c.name}`}
                  />
                  <IconButton
                    icon="trash-outline"
                    size={18}
                    color={colors.danger}
                    onPress={() => onDelete(c)}
                    accessibilityLabel={`Delete ${c.name}`}
                  />
                </View>
              }
            />
          ))
        )}
      </Card>

      {/* 5 — Data */}
      <SectionLabel>Data</SectionLabel>
      <Card style={{ paddingVertical: spacing.xs }}>
        <Row
          label="Backup Data"
          sub="Copy everything as JSON"
          onPress={() => void onBackup()}
          right={
            <IconButton
              icon="copy-outline"
              size={18}
              onPress={() => void onBackup()}
              accessibilityLabel="Backup data"
            />
          }
        />
        <Row
          label="Wipe Everything"
          sub="Delete all data and start over"
          danger
          onPress={onWipe}
          right={
            <IconButton
              icon="warning-outline"
              size={18}
              color={colors.danger}
              onPress={onWipe}
              accessibilityLabel="Wipe everything"
            />
          }
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
