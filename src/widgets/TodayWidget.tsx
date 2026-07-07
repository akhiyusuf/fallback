'use no memo';
/**
 * Android home-screen widget UI for today's tasks.
 *
 * Pure react-native-android-widget markup — no hooks, no react-native
 * imports. Colors come from the shared theme tokens via `getTheme(dark)`
 * (widgets render outside the app, so useTheme() is unavailable).
 *
 * The 'use no memo' directive is load-bearing: the React Compiler
 * (app.json experiments.reactCompiler) would otherwise inject a memo-cache
 * hook call, and react-native-android-widget invokes this component as a
 * plain function outside any React render, which would throw.
 */

import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { getTheme, radius, spacing } from '@/constants/theme';
import type { TaskStatus } from '@/types';

export interface TodayWidgetItem {
  name: string;
  time: string | null;
  status: TaskStatus;
}

export interface TodayWidgetProps {
  done: number;
  total: number;
  score: number | null;
  items: TodayWidgetItem[];
  dark: boolean;
}

const MAX_ITEMS = 5;

/** Theme colors are plain hex strings; widget styles want a ColorProp. */
function hex(color: string): ColorProp {
  return color as ColorProp;
}

export function TodayWidget(props: TodayWidgetProps): React.JSX.Element {
  const { done, total, score, dark } = props;
  const { colors } = getTheme(dark);
  const items = props.items.slice(0, MAX_ITEMS);

  const dotColor: Record<TaskStatus, string> = {
    pending: colors.statusPending,
    completed_ideal: colors.statusIdeal,
    completed_fallback: colors.statusFallback,
    missed: colors.statusMissed,
  };

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: hex(colors.surface),
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: hex(colors.border),
        padding: spacing.lg,
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget
          text="Today"
          style={{
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.3,
            color: hex(colors.textMuted),
          }}
        />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          {score !== null ? (
            <TextWidget
              text={`30d · ${score}%`}
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: hex(colors.primary),
                backgroundColor: hex(colors.primarySoft),
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                marginRight: spacing.sm,
              }}
            />
          ) : null}
          <TextWidget
            text={`${done}/${total}`}
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: hex(colors.text),
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {items.length === 0 ? (
        <TextWidget
          text="Nothing scheduled today"
          style={{
            fontSize: 13,
            color: hex(colors.textMuted),
            marginTop: spacing.md,
          }}
        />
      ) : (
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'column',
            marginTop: spacing.xs,
          }}
        >
          {items.map((item, index) => {
            const completed =
              item.status === 'completed_ideal' ||
              item.status === 'completed_fallback';
            return (
              <FlexWidget
                key={`item-${index}`}
                style={{
                  width: 'match_parent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing.sm,
                }}
              >
                <FlexWidget
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.full,
                    backgroundColor: hex(dotColor[item.status]),
                    marginRight: spacing.sm,
                  }}
                />
                <FlexWidget style={{ flex: 1, alignItems: 'flex-start' }}>
                  <TextWidget
                    text={item.name}
                    truncate="END"
                    maxLines={1}
                    style={{
                      fontSize: 13,
                      fontWeight: completed ? '400' : '600',
                      color: hex(completed ? colors.textMuted : colors.text),
                    }}
                  />
                </FlexWidget>
                {item.time ? (
                  <TextWidget
                    text={item.time}
                    style={{
                      fontSize: 12,
                      color: hex(colors.textSecondary),
                      marginLeft: spacing.sm,
                    }}
                  />
                ) : null}
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
