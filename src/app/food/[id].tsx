import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { closeFlow } from '@/utils/nav';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Field, ProgressBar, Row, Screen, Segmented, T } from '@/components/ui';
import { Chip } from '@/components/visuals';
import { useAppData } from '@/hooks/AppData';
import { addFood, deleteFood, getFoodEntry, MEAL_LABELS_AR, updateFoodEntry, type Meal } from '@/db/repo';
import { getFood, nutritionFor, touchFood, unitLabel, type AmountUnit, type Food } from '@/services/food/foods';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { toDateKey } from '@/utils/date';
import { fmt, parseNumber } from '@/utils/number';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SOURCE_LABEL = { builtin: 'قيم تقريبية', user: 'طعامي', off: 'من الباركود' } as const;

/** Log a food (or edit a logged entry) by grams, ml or servings. */
export default function FoodAmount() {
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: string; entryId?: string }>();
  const foodId = Number(params.id);
  const entryId = params.entryId ? Number(params.entryId) : null;
  const db = useSQLiteContext();
  const router = useRouter();
  const { targets, bumpData } = useAppData();

  const [food, setFood] = useState<Food | null>(null);
  const [unit, setUnit] = useState<AmountUnit>('g');
  const [amount, setAmount] = useState('');
  const [meal, setMeal] = useState<Meal>(MEALS.includes(params.meal as Meal) ? (params.meal as Meal) : 'snack');
  const [date, setDate] = useState(params.date || toDateKey());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const f = await getFood(db, foodId);
        if (!alive) return;
        setFood(f);
        if (!f || initialized) return;
        // First load: take amount from the entry being edited, else default to one serving or 100.
        const entry = entryId ? await getFoodEntry(db, entryId) : null;
        if (!alive) return;
        if (entry?.amount && entry.unit) {
          setUnit(entry.unit);
          setAmount(String(entry.amount));
          setMeal(entry.meal);
          setDate(entry.date);
        } else if (f.serving_size) {
          setUnit('serving');
          setAmount('1');
        } else {
          setUnit(f.per_unit);
          setAmount('100');
        }
        setInitialized(true);
      })();
      return () => {
        alive = false;
      };
    }, [db, foodId, entryId, initialized]),
  );

  if (!food) {
    return (
      <Screen>
        <T muted>جارٍ التحميل…</T>
      </Screen>
    );
  }

  const u = unitLabel(food.per_unit);
  const amt = parseNumber(amount) ?? 0;
  const n = nutritionFor(food, amt, unit);
  const servingName = food.serving_name || 'حصة';
  const presets: number[] =
    unit === 'serving' ? [0.5, 1, 1.5, 2, 3] : [...new Set([50, 100, 150, 200, food.serving_size ?? 0].filter((x) => x > 0))].sort((a, b) => a - b);
  const pctOfDay = targets && targets.calories > 0 ? Math.round((n.calories / targets.calories) * 100) : null;

  async function submit() {
    if (!food || n.base <= 0) return;
    if (n.base > 5000) return appAlert('الكمية كبيرة جدًا', 'تحقق من الكمية.');
    setSaving(true);
    try {
      const entry = {
        meal,
        name: food.name,
        calories: n.calories,
        protein: n.protein,
        carbs: n.carbs,
        fat: n.fat,
        food_id: food.id,
        amount: amt,
        unit,
      };
      if (entryId) await updateFoodEntry(db, entryId, entry);
      else await addFood(db, { ...entry, date });
      await touchFood(db, food.id);
      bumpData();
      closeFlow(router);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: entryId ? 'تعديل الكمية' : 'إضافة طعام' }} />

      <Card>
        <Row between style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T weight="bold" size={20}>
              {food.name}
            </T>
            {food.brand ? <T muted>{food.brand}</T> : null}
          </View>
          <Chip text={SOURCE_LABEL[food.source]} color={food.source === 'builtin' ? colors.textMuted : colors.primary} />
        </Row>
        <View style={styles.per100}>
          {[
            ['سعرات', fmt(food.kcal_100), colors.warning],
            ['بروتين', fmt(food.protein_100, 1), colors.protein],
            ['كارب', fmt(food.carbs_100, 1), colors.carbs],
            ['دهون', fmt(food.fat_100, 1), colors.fat],
          ].map(([l, v, c]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <T weight="bold" color={c} center>
                {v}
              </T>
              <T muted size={11} center>
                {l}
              </T>
            </View>
          ))}
        </View>
        <Row between>
          <T muted size={11}>
            لكل 100 {u}
            {food.serving_size ? ` · ${servingName} = ${fmt(food.serving_size)} ${u}` : ''}
          </T>
          <Pressable onPress={() => router.push({ pathname: '/food/edit', params: { id: String(food.id) } })} hitSlop={8}>
            <T size={12} weight="semibold" color={colors.accent}>
              تعديل القيم
            </T>
          </Pressable>
        </Row>
      </Card>

      <Card title="الكمية" icon="scalemass.fill" iconColor={colors.accent}>
        {food.serving_size ? (
          <Segmented
            value={unit === 'serving' ? 'serving' : food.per_unit}
            onChange={(v) => {
              // Convert the current amount so switching units keeps the same quantity.
              if (v === 'serving' && unit !== 'serving' && food.serving_size) setAmount(String(Math.round((amt / food.serving_size) * 100) / 100 || 1));
              if (v !== 'serving' && unit === 'serving') setAmount(String(Math.round(n.base) || 100));
              setUnit(v as AmountUnit);
            }}
            options={[
              { value: food.per_unit, label: food.per_unit === 'ml' ? 'مليلتر' : 'غرام' },
              { value: 'serving', label: `${servingName} (${fmt(food.serving_size)} ${u})` },
            ]}
          />
        ) : null}

        <Field
          label={unit === 'serving' ? `عدد ${servingName}` : `الكمية بال${food.per_unit === 'ml' ? 'مليلتر' : 'غرام'}`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          suffix={unit === 'serving' ? servingName : u}
          style={{ marginTop: spacing.md }}
        />

        <Row gap={spacing.sm} style={{ marginTop: spacing.md, flexWrap: 'wrap' }}>
          {presets.map((p) => {
            const active = amt === p;
            return (
              <Pressable key={p} onPress={() => setAmount(String(p))} style={[styles.preset, active && { backgroundColor: colors.primary }]}>
                <T size={13} weight="semibold" color={active ? colors.onPrimary : colors.text}>
                  {unit === 'serving' ? `${p}` : `${p} ${u}`}
                </T>
              </Pressable>
            );
          })}
        </Row>

        <View style={styles.total}>
          <T muted size={12} center>
            {unit === 'serving' ? `${fmt(amt, 2)} ${servingName} = ${fmt(n.base)} ${u}` : `${fmt(n.base)} ${u}`}
          </T>
          <T weight="bold" size={36} center color={colors.primary} style={{ lineHeight: 46 }}>
            {fmt(n.calories)}
            <T muted size={14}> سعرة</T>
          </T>
          {pctOfDay != null && (
            <T muted size={12} center>
              {pctOfDay}% من هدفك اليومي
            </T>
          )}
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {[
              ['بروتين', n.protein, targets?.macros.protein ?? 0, colors.protein],
              ['كربوهيدرات', n.carbs, targets?.macros.carbs ?? 0, colors.carbs],
              ['دهون', n.fat, targets?.macros.fat ?? 0, colors.fat],
            ].map(([l, v, max, c]) => (
              <View key={l as string} style={{ gap: 4 }}>
                <Row between>
                  <T size={13} color={c as string} weight="semibold">
                    {l}
                  </T>
                  <T size={13} weight="semibold">
                    {fmt(v as number, 1)} غ
                  </T>
                </Row>
                <ProgressBar value={v as number} max={(max as number) || 1} color={c as string} height={5} />
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABELS_AR[m] }))} />
        </View>
      </Card>

      <Button title={entryId ? 'حفظ التعديل' : 'إضافة للسجل'} icon={entryId ? 'checkmark.circle.fill' : 'plus'} loading={saving} disabled={n.base <= 0} onPress={submit} />
      {entryId ? (
        <Button
          title="حذف من السجل"
          icon="trash"
          variant="danger"
          onPress={() =>
            appAlert('حذف', `حذف "${food.name}" من السجل؟`, [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'حذف',
                style: 'destructive',
                onPress: async () => {
                  await deleteFood(db, entryId);
                  bumpData();
                  closeFlow(router);
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  per100: {
    flexDirection: rtl.row,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginVertical: spacing.md,
  },
  preset: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  total: { marginTop: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.lg },
});
