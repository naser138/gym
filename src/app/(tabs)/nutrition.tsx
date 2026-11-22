import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card, H1, ProgressBar, Row, Screen, T } from '@/components/ui';
import { Icon } from '@/components/visuals';
import { DateStrip } from '@/components/DateStrip';
import { useAppData } from '@/hooks/AppData';
import { copyMeal, countMealEntries, deleteFood, getFoodForDate, MEAL_LABELS_AR, type FoodEntry, type Meal } from '@/db/repo';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { formatDateAr, shiftDateKey, toDateKey } from '@/utils/date';
import { fmt } from '@/utils/number';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_ICONS: Record<Meal, { icon: 'sunrise.fill' | 'sun.max.fill' | 'moon.stars.fill' | 'leaf.fill'; color: string }> = {
  breakfast: { icon: 'sunrise.fill', color: colors.warning },
  lunch: { icon: 'sun.max.fill', color: '#FB923C' },
  dinner: { icon: 'moon.stars.fill', color: colors.accent },
  snack: { icon: 'leaf.fill', color: colors.primary },
};

/** Default meal by time of day, like MyFitnessPal. */
function mealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

function amountText(e: FoodEntry): string | null {
  if (!e.amount || !e.unit) return null;
  const a = Math.round(e.amount * 100) / 100;
  if (e.unit === 'serving') return `${a} حصة`;
  return `${a} ${e.unit === 'ml' ? 'مل' : 'غ'}`;
}

export default function Nutrition() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { targets, bumpData, dataVersion, selectedDate: date } = useAppData();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [prevCounts, setPrevCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [e, prev] = await Promise.all([getFoodForDate(db, date), countMealEntries(db, shiftDateKey(date, -1))]);
    setEntries(e);
    setPrevCounts(prev);
  }, [db, date]);

  async function copyFromYesterday(m: Meal) {
    const n = await copyMeal(db, shiftDateKey(date, -1), date, m);
    if (n) {
      await load();
      bumpData();
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion reloads after edits on other screens
    }, [load, dataVersion]),
  );

  const totals = entries.reduce(
    (a, e) => ({ calories: a.calories + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const isToday = date === toDateKey();
  const remaining = targets ? targets.calories - totals.calories : 0;

  const openAdd = (meal: Meal) => router.push({ pathname: '/food/add', params: { date, meal } });
  const openEntry = (e: FoodEntry) =>
    e.food_id
      ? router.push({ pathname: '/food/[id]', params: { id: String(e.food_id), entryId: String(e.id), date } })
      : router.push({ pathname: '/food/quick', params: { entryId: String(e.id), date } });

  function onDelete(e: FoodEntry) {
    appAlert('حذف', `حذف "${e.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteFood(db, e.id);
          await load();
          bumpData();
        },
      },
    ]);
  }

  return (
    <Screen>
      <H1 subtitle={isToday ? 'سجل الأكل اليومي' : formatDateAr(date)}>التغذية</H1>

      <DateStrip />

      {/* MyFitnessPal-style equation: goal − food = remaining */}
      {targets && (
        <Card>
          <Row between>
            {[
              ['الهدف', fmt(targets.calories), colors.text],
              ['−', '', colors.textMuted],
              ['الأكل', fmt(totals.calories), colors.accent],
              ['=', '', colors.textMuted],
              [remaining >= 0 ? 'المتبقي' : 'زيادة', fmt(Math.abs(remaining)), remaining >= 0 ? colors.primary : colors.danger],
            ].map(([l, v, c], i) =>
              v === '' ? (
                <T key={i} muted size={20}>
                  {l}
                </T>
              ) : (
                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                  <T weight="bold" size={20} color={c} center>
                    {v}
                  </T>
                  <T muted size={11} center>
                    {l}
                  </T>
                </View>
              ),
            )}
          </Row>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar value={totals.calories} max={targets.calories} height={8} />
          </View>
          <Row gap={spacing.md} style={{ marginTop: spacing.lg }}>
            {(
              [
                ['بروتين', totals.protein, targets.macros.protein, colors.protein],
                ['كربوهيدرات', totals.carbs, targets.macros.carbs, colors.carbs],
                ['دهون', totals.fat, targets.macros.fat, colors.fat],
              ] as const
            ).map(([l, v, max, c]) => (
              <View key={l} style={{ flex: 1, gap: 6 }}>
                <Row between>
                  <T size={12} weight="medium" color={c}>
                    {l}
                  </T>
                  <T muted size={11}>
                    {fmt(v)}/{fmt(max)}
                  </T>
                </Row>
                <ProgressBar value={v} max={max} color={c} height={6} />
              </View>
            ))}
          </Row>
        </Card>
      )}

      <Row gap={spacing.sm}>
        <Pressable onPress={() => openAdd(mealForNow())} style={({ pressed }) => [styles.bigBtn, styles.bigPrimary, pressed && { opacity: 0.85 }]}>
          <Icon name="magnifyingglass" color={colors.onPrimary} size={18} />
          <T weight="bold" color={colors.onPrimary}>
            إضافة طعام
          </T>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/scan', params: { date, meal: mealForNow() } })}
          style={({ pressed }) => [styles.bigBtn, styles.bigSecondary, pressed && { opacity: 0.85 }]}
        >
          <Icon name="barcode.viewfinder" color={colors.primary} size={20} />
          <T weight="bold" color={colors.primary}>
            الباركود
          </T>
        </Pressable>
      </Row>

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m);
        const sum = list.reduce((a, e) => a + e.calories, 0);
        return (
          <Card
            key={m}
            title={MEAL_LABELS_AR[m]}
            icon={MEAL_ICONS[m].icon}
            iconColor={MEAL_ICONS[m].color}
            right={
              <T muted size={13} weight="semibold">
                {fmt(sum)} سعرة
              </T>
            }
          >
            {list.map((e, i) => {
              const amt = amountText(e);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => openEntry(e)}
                  onLongPress={() => onDelete(e)}
                  style={({ pressed }) => [styles.foodRow, i > 0 && styles.foodRowBorder, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <T weight="medium" numberOfLines={1}>
                      {e.name}
                    </T>
                    <T muted size={12} numberOfLines={1}>
                      {amt ? `${amt} · ` : ''}ب {fmt(e.protein)} · ك {fmt(e.carbs)} · د {fmt(e.fat)}
                    </T>
                  </View>
                  <T weight="bold">{fmt(e.calories)}</T>
                </Pressable>
              );
            })}
            <Row between style={list.length > 0 ? styles.foodRowBorder : undefined}>
              <Pressable onPress={() => openAdd(m)} style={styles.addRow} hitSlop={4}>
                <Icon name="plus.circle.fill" color={colors.primary} size={18} />
                <T weight="semibold" color={colors.primary}>
                  إضافة إلى {MEAL_LABELS_AR[m]}
                </T>
              </Pressable>
              {!list.length && prevCounts[m] ? (
                <Pressable onPress={() => copyFromYesterday(m)} style={styles.addRow} hitSlop={4}>
                  <Icon name="doc.on.doc" color={colors.textMuted} size={14} />
                  <T size={12} weight="medium" muted>
                    نسخ من اليوم السابق ({prevCounts[m]})
                  </T>
                </Pressable>
              ) : null}
            </Row>
          </Card>
        );
      })}

      {entries.length > 0 && (
        <T muted size={11} center>
          اضغط على أي عنصر لتعديل الكمية، ومطولًا لحذفه
        </T>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigBtn: { flexDirection: rtl.row, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.md },
  bigPrimary: { flex: 2, backgroundColor: colors.primary },
  bigSecondary: { flex: 1, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary + '55' },
  foodRow: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  foodRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  addRow: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, marginTop: 2 },
});
