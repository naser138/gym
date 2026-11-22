/**
 * Rest timer between sets. Starts automatically after a set is logged; based on an
 * absolute end time so it stays correct even if renders are delayed. Vibrates at zero.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from './ui';
import { Icon } from './visuals';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { formatClock } from '@/utils/time';

export function RestTimer({
  endsAt,
  total,
  onChange,
  onStop,
}: {
  /** Epoch ms when the rest ends, or null when hidden. */
  endsAt: number | null;
  total: number;
  onChange: (deltaSeconds: number) => void;
  onStop: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  const left = endsAt ? Math.ceil((endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (endsAt && left <= 0) {
      Vibration.vibrate([0, 400, 200, 400]);
      onStop();
    }
  }, [endsAt, left, onStop]);

  if (!endsAt || left <= 0) return null;
  const pct = Math.min(1, Math.max(0, left / Math.max(1, total)));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm }]}>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${pct * 100}%`, alignSelf: rtl.alignStart }]} />
        <View style={styles.content}>
          <Icon name="timer" color={colors.primary} size={20} />
          <View style={{ flex: 1 }}>
            <T muted size={11}>
              راحة
            </T>
            <T weight="bold" size={22} style={{ lineHeight: 28, fontVariant: ['tabular-nums'] }}>
              {formatClock(left)}
            </T>
          </View>
          <Pressable onPress={() => onChange(-15)} style={styles.btn} hitSlop={6}>
            <T weight="bold">−15</T>
          </Pressable>
          <Pressable onPress={() => onChange(15)} style={styles.btn} hitSlop={6}>
            <T weight="bold">+15</T>
          </Pressable>
          <Pressable onPress={onStop} style={[styles.btn, { backgroundColor: colors.primary }]} hitSlop={6}>
            <T weight="bold" color={colors.onPrimary}>
              تخطي
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md },
  bar: {
    backgroundColor: colors.surface3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary + '55',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fill: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.primary + '22' },
  content: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  btn: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
});
