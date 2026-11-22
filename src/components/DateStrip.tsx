/**
 * Calendar header: a week strip (tap a day) + a full month calendar (tap the month).
 * Markers: green ✓ = finished workout, small dot = food logged. Future days are disabled.
 */
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from './ui';
import { Icon } from './visuals';
import { getActivityDates } from '@/db/repo';
import { useAppData } from '@/hooks/AppData';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { fromDateKey, monthGrid, monthNameAr, shiftDateKey, toDateKey, weekKeys } from '@/utils/date';

const DAY_LETTERS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

type Marks = { food: Set<string>; trained: Set<string> };
const EMPTY: Marks = { food: new Set(), trained: new Set() };

export function DateStrip() {
  const db = useSQLiteContext();
  const { selectedDate, setSelectedDate, dataVersion } = useAppData();
  const [marks, setMarks] = useState<Marks>(EMPTY);
  const [open, setOpen] = useState(false);
  const today = toDateKey();
  const week = weekKeys(selectedDate);
  const sel = fromDateKey(selectedDate);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getActivityDates(db, week[0], week[6]).then((m) => alive && setMarks(m));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- week is derived from selectedDate
    }, [db, selectedDate, dataVersion]),
  );

  const nextWeekStart = shiftDateKey(week[0], 7);

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Pressable onPress={() => setSelectedDate(shiftDateKey(selectedDate, -7))} hitSlop={10} style={styles.navBtn}>
          <Icon name="chevron.right" color={colors.text} size={14} />
        </Pressable>
        <Pressable onPress={() => setOpen(true)} style={styles.monthBtn} hitSlop={6}>
          <Icon name="calendar" color={colors.primary} size={16} />
          <T weight="bold" size={15}>
            {monthNameAr(sel.getMonth())} {sel.getFullYear()}
          </T>
          <Icon name="chevron.down" color={colors.textMuted} size={11} />
        </Pressable>
        <Pressable
          onPress={() => nextWeekStart <= today && setSelectedDate(shiftDateKey(selectedDate, 7))}
          hitSlop={10}
          style={[styles.navBtn, nextWeekStart > today && { opacity: 0.25 }]}
        >
          <Icon name="chevron.left" color={colors.text} size={14} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {week.map((key, i) => {
          const future = key > today;
          const active = key === selectedDate;
          const isToday = key === today;
          const trained = marks.trained.has(key);
          const ate = marks.food.has(key);
          return (
            <Pressable key={key} disabled={future} onPress={() => setSelectedDate(key)} style={[styles.day, active && styles.dayActive, future && { opacity: 0.3 }]}>
              <T size={11} color={active ? colors.onPrimary : colors.textMuted} weight="medium" center>
                {DAY_LETTERS[i]}
              </T>
              <T size={16} weight="bold" center color={active ? colors.onPrimary : isToday ? colors.primary : colors.text} style={{ lineHeight: 22 }}>
                {fromDateKey(key).getDate()}
              </T>
              <View style={styles.markRow}>
                {trained ? (
                  <Icon name="checkmark.circle.fill" color={active ? colors.onPrimary : colors.primary} size={10} />
                ) : (
                  <View style={[styles.dot, { backgroundColor: ate ? (active ? colors.onPrimary : colors.accent) : 'transparent' }]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedDate !== today && (
        <Pressable onPress={() => setSelectedDate(today)} style={styles.todayBtn} hitSlop={6}>
          <Icon name="arrow.uturn.backward" color={colors.primary} size={12} />
          <T size={12} weight="semibold" color={colors.primary}>
            العودة لليوم
          </T>
        </Pressable>
      )}

      <MonthModal
        visible={open}
        initial={selectedDate}
        onClose={() => setOpen(false)}
        onPick={(d) => {
          setSelectedDate(d);
          setOpen(false);
        }}
      />
    </View>
  );
}

function MonthModal({
  visible,
  initial,
  onClose,
  onPick,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onPick: (d: string) => void;
}) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const today = toDateKey();
  const [cursor, setCursor] = useState(() => {
    const d = fromDateKey(initial);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [marks, setMarks] = useState<Marks>(EMPTY);
  const grid = monthGrid(cursor.y, cursor.m);
  const flat = grid.flat().filter((x): x is string => !!x);

  const load = useCallback(
    (y: number, m: number) => {
      const g = monthGrid(y, m).flat().filter((x): x is string => !!x);
      getActivityDates(db, g[0], g[g.length - 1]).then(setMarks);
    },
    [db],
  );

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() };
    setCursor(next);
    load(next.y, next.m);
  };

  const now = new Date();
  const atCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  const trainedCount = flat.filter((k) => marks.trained.has(k)).length;
  const foodCount = flat.filter((k) => marks.food.has(k)).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        const d = fromDateKey(initial);
        setCursor({ y: d.getFullYear(), m: d.getMonth() });
        load(d.getFullYear(), d.getMonth());
      }}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { marginBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable onPress={() => move(-1)} hitSlop={10} style={styles.navBtn}>
              <Icon name="chevron.right" color={colors.text} size={14} />
            </Pressable>
            <T weight="bold" size={17}>
              {monthNameAr(cursor.m)} {cursor.y}
            </T>
            <Pressable onPress={() => !atCurrentMonth && move(1)} hitSlop={10} style={[styles.navBtn, atCurrentMonth && { opacity: 0.25 }]}>
              <Icon name="chevron.left" color={colors.text} size={14} />
            </Pressable>
          </View>

          <View style={[styles.week, { marginTop: spacing.md }]}>
            {DAY_LETTERS.map((l) => (
              <T key={l} muted size={12} weight="semibold" center style={{ width: 40 }}>
                {l}
              </T>
            ))}
          </View>

          {grid.map((row, ri) => (
            <View key={ri} style={[styles.week, { marginTop: 6 }]}>
              {row.map((key, ci) => {
                if (!key) return <View key={ci} style={styles.cell} />;
                const future = key > today;
                const active = key === initial;
                const trained = marks.trained.has(key);
                const ate = marks.food.has(key);
                return (
                  <Pressable
                    key={key}
                    disabled={future}
                    onPress={() => onPick(key)}
                    style={[styles.cell, trained && styles.cellTrained, active && styles.dayActive, future && { opacity: 0.25 }]}
                  >
                    <T
                      size={14}
                      weight={key === today || active ? 'bold' : 'medium'}
                      center
                      color={active ? colors.onPrimary : key === today ? colors.primary : colors.text}
                    >
                      {fromDateKey(key).getDate()}
                    </T>
                    <View style={[styles.dot, { backgroundColor: ate ? (active ? colors.onPrimary : colors.accent) : 'transparent' }]} />
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.primary + '33', borderColor: colors.primary }]} />
              <T size={12} muted>
                تمرين مكتمل ({trainedCount})
              </T>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <T size={12} muted>
                أكل مسجّل ({foodCount})
              </T>
            </View>
          </View>

          <Pressable onPress={() => onPick(today)} style={styles.todayFull}>
            <T weight="bold" color={colors.onPrimary} center>
              اليوم
            </T>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  header: { flexDirection: rtl.row, alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  monthBtn: { flexDirection: rtl.row, alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4 },
  week: { flexDirection: rtl.row, justifyContent: 'space-between', marginTop: spacing.sm },
  day: { width: 42, alignItems: 'center', paddingVertical: 6, borderRadius: 12, gap: 2 },
  dayActive: { backgroundColor: colors.primary },
  markRow: { height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  todayBtn: { flexDirection: rtl.row, alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', paddingHorizontal: spacing.md },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  cell: { width: 40, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cellTrained: { backgroundColor: colors.primary + '26' },
  legend: { flexDirection: rtl.row, justifyContent: 'center', gap: spacing.lg, marginTop: spacing.lg },
  legendItem: { flexDirection: rtl.row, alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  todayFull: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12 },
});
