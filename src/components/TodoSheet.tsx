/**
 * TodoSheet — bottom sheet for the unscheduled to-do bucket.
 *
 * Quick capture: a text field + add button on top, an "X/Y finished"
 * counter, the open items (checkbox to finish, trash to delete) and a
 * struck-through "Completed" section below. All state lives in the app
 * store's todo API (`addTodo` / `toggleTodo` / `deleteTodo`).
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BottomSheet,
  Checkbox,
  IconButton,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { useApp, useTheme } from '@/store/AppContext';
import type { TodoItem } from '@/types';

export interface TodoSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function TodoSheet({ visible, onClose }: TodoSheetProps) {
  const { data, addTodo, toggleTodo, deleteTodo } = useApp();
  const theme = useTheme();
  const { colors, spacing } = theme;

  const [draft, setDraft] = useState('');

  const todos = data.todoBucket;
  const openItems = todos.filter((t) => !t.completed);
  const finishedItems = todos.filter((t) => t.completed);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    addTodo(trimmed);
    setDraft('');
  };

  const renderItem = (todo: TodoItem) => (
    <View key={todo.id} style={styles.itemRow}>
      <View style={styles.itemLabel}>
        <Checkbox
          checked={todo.completed}
          strike={todo.completed}
          label={todo.title}
          onToggle={() => toggleTodo(todo.id)}
        />
      </View>
      <IconButton
        icon="trash-outline"
        size={18}
        color={colors.textMuted}
        onPress={() => deleteTodo(todo.id)}
        accessibilityLabel={`Delete ${todo.title}`}
      />
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="To-dos">
      {/* Add row */}
      <View style={[styles.addRow, { gap: spacing.sm }]}>
        <View style={styles.itemLabel}>
          <TextField
            placeholder="Add a to-do…"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
        </View>
        <IconButton
          icon="add-circle"
          size={30}
          color={colors.primary}
          onPress={submit}
          accessibilityLabel="Add to-do"
        />
      </View>

      {/* Finished counter */}
      {todos.length > 0 ? (
        <Text
          style={{
            ...theme.type.caption,
            ...theme.type.num,
            color: colors.textMuted,
            marginTop: spacing.md,
          }}
        >
          {finishedItems.length}/{todos.length} finished
        </Text>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        style={{ marginTop: spacing.sm }}
      >
        {todos.length === 0 ? (
          <Text
            style={{
              ...theme.type.body,
              color: colors.textMuted,
              paddingVertical: spacing.lg,
              textAlign: 'center',
            }}
          >
            Nothing here yet — add a quick task above.
          </Text>
        ) : null}

        {/* Open items */}
        {openItems.map(renderItem)}

        {/* Completed section */}
        {finishedItems.length > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <SectionLabel>Completed</SectionLabel>
            {finishedItems.map(renderItem)}
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLabel: {
    flex: 1,
  },
});
