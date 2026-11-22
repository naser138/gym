/** Web dialog host for appAlert(). Renders nothing on native. */
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { T } from './ui';
import { setAlertListener, type AlertRequest } from '@/utils/alert';
import { colors, radius, spacing } from '@/theme/colors';

export function AlertHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setAlertListener((req) => setQueue((q) => [...q, req]));
    return () => setAlertListener(null);
  }, []);

  const current = queue[0];
  if (!current) return null;

  const close = (onPress?: () => void) => {
    setQueue((q) => q.slice(1));
    // Run after closing so a follow-up alert can open.
    setTimeout(() => onPress?.(), 0);
  };

  const cancel = current.buttons.find((b) => b.style === 'cancel');
  const stacked = current.buttons.length > 2;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancel?.onPress as (() => void) | undefined)}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <T weight="bold" size={17} center>
            {current.title}
          </T>
          {current.message ? (
            <T muted size={14} center style={{ marginTop: spacing.sm }}>
              {current.message}
            </T>
          ) : null}
          <View style={[styles.buttons, stacked && { flexDirection: 'column' }]}>
            {current.buttons.map((b, i) => {
              const destructive = b.style === 'destructive';
              const isCancel = b.style === 'cancel';
              return (
                <Pressable
                  key={i}
                  onPress={() => close(b.onPress as (() => void) | undefined)}
                  style={({ pressed }) => [
                    styles.btn,
                    !stacked && { flex: 1 },
                    { backgroundColor: isCancel ? colors.surface2 : destructive ? colors.danger + '26' : colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <T weight="semibold" center color={isCancel ? colors.text : destructive ? colors.danger : colors.onPrimary}>
                    {b.text ?? 'حسنًا'}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  box: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  buttons: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.xl },
  btn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md },
});
