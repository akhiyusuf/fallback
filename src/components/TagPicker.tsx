/**
 * Tag selector for a commitment's importance or necessity.
 *
 * Chip row of the existing tags for the kind (selected = filled), plus a
 * trailing "+ New" chip that expands an inline name field with color
 * swatches; confirming calls `addTag` on the store and selects the new tag.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, IconButton, SectionLabel, TextField } from '@/components/ui';
import { TAG_COLOR_CHOICES } from '@/constants/theme';
import { useApp, useTheme } from '@/store/AppContext';
import type { TagKind } from '@/types';

export interface TagPickerProps {
  kind: TagKind;
  label: string;
  value: string;
  onChange: (name: string) => void;
}

export function TagPicker({ kind, label, value, onChange }: TagPickerProps) {
  const { data, addTag } = useApp();
  const theme = useTheme();
  const { colors, spacing, radius } = theme;

  const map = kind === 'importance' ? data.importanceMap : data.necessityMap;

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(TAG_COLOR_CHOICES[0]);

  const confirm = () => {
    const name = draft.trim();
    if (!name) return;
    addTag(kind, name, color);
    onChange(name);
    setDraft('');
    setCreating(false);
  };

  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {Object.entries(map).map(([name, tagColor]) => (
          <Chip
            key={name}
            label={name}
            color={tagColor}
            selected={name === value}
            onPress={() => onChange(name)}
          />
        ))}
        <Chip
          label="+ New"
          color={colors.textMuted}
          selected={creating}
          onPress={() => setCreating((c) => !c)}
        />
      </View>

      {creating ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <TextField
                value={draft}
                onChangeText={setDraft}
                placeholder="Tag name"
                autoFocus
                onSubmitEditing={confirm}
                returnKeyType="done"
              />
            </View>
            <IconButton
              icon="checkmark-circle"
              size={28}
              color={color}
              onPress={confirm}
              accessibilityLabel="Add tag"
            />
          </View>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
          >
            {TAG_COLOR_CHOICES.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => setColor(choice)}
                accessibilityRole="button"
                accessibilityLabel={`Tag color ${choice}`}
                accessibilityState={{ selected: choice === color }}
                style={({ pressed }) => ({
                  width: 26,
                  height: 26,
                  borderRadius: radius.full,
                  backgroundColor: choice,
                  borderWidth: 2,
                  borderColor:
                    choice === color ? colors.text : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
