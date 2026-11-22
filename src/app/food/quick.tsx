import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { closeFlow } from '@/utils/nav';
import { useSQLiteContext } from 'expo-sqlite';

import { Banner, Button, Card, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { useAppData } from '@/hooks/AppData';
import { addFood, deleteFood, getFoodEntry, MEAL_LABELS_AR, updateFoodEntry, type Meal } from '@/db/repo';
import { spacing } from '@/theme/colors';
import { toDateKey } from '@/utils/date';
import { parseNumber } from '@/utils/number';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Quick add (or edit) of calories/macros without a food from the library – e.g. a restaurant meal. */
export default function QuickAdd() {
  const params = useLocalSearchParams<{ date?: string; meal?: string; entryId?: string }>();
  const entryId = params.entryId ? Number(params.entryId) : null;
  const db = useSQLiteContext();
  const router = useRouter();
  const { bumpData } = useAppData();
  const [meal, setMeal] = useState<Meal>(MEALS.includes(params.meal as Meal) ? (params.meal as Meal) : 'snack');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entryId) return;
    let alive = true;
    getFoodEntry(db, entryId).then((e) => {
      if (!alive || !e) return;
      setMeal(e.meal);
      setName(e.name);
      setKcal(String(e.calories));
      setP(String(e.protein));
      setC(String(e.carbs));
      setF(String(e.fat));
    });
    return () => {
      alive = false;
    };
  }, [db, entryId]);

  async function save() {
    const protein = parseNumber(p) ?? 0;
    const carbs = parseNumber(c) ?? 0;
    const fat = parseNumber(f) ?? 0;
    const calories = parseNumber(kcal) ?? Math.round(protein * 4 + carbs * 4 + fat * 9);
    if (!(calories > 0) || calories > 5000) return setError('أدخل السعرات (أو الماكروز لتُحسب تلقائيًا).');
    if ([protein, carbs, fat].some((x) => x < 0 || x > 500)) return setError('قيم الماكروز غير منطقية.');
    const entry = { meal, name: name.trim() || 'سعرات سريعة', calories, protein, carbs, fat, food_id: null, amount: null, unit: null };
    if (entryId) await updateFoodEntry(db, entryId, entry);
    else await addFood(db, { ...entry, date: params.date || toDateKey() });
    bumpData();
    closeFlow(router);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: entryId ? 'تعديل' : 'سعرات سريعة' }} />
      <Card title="القيم الإجمالية" icon="bolt.fill">
        <View style={{ gap: spacing.md }}>
          <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABELS_AR[m] }))} />
          <Field label="الوصف" value={name} onChangeText={setName} placeholder="مثال: وجبة مطعم" />
          <Row gap={spacing.md}>
            <Field label="السعرات" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" placeholder="تلقائي" />
            <Field label="بروتين" suffix="غ" value={p} onChangeText={setP} keyboardType="decimal-pad" />
          </Row>
          <Row gap={spacing.md}>
            <Field label="كربوهيدرات" suffix="غ" value={c} onChangeText={setC} keyboardType="decimal-pad" />
            <Field label="دهون" suffix="غ" value={f} onChangeText={setF} keyboardType="decimal-pad" />
          </Row>
          <T muted size={12}>
            للأكل المتكرر الأفضل إضافته كطعام جديد بالقيم لكل 100 غ، لتسجّله بعدها بالجرامات.
          </T>
        </View>
      </Card>
      {error ? <Banner tone="danger" text={error} /> : null}
      <Button title={entryId ? 'حفظ التعديل' : 'إضافة'} icon="checkmark.circle.fill" onPress={save} />
      {entryId ? (
        <Button
          title="حذف من السجل"
          icon="trash"
          variant="danger"
          onPress={() =>
            appAlert('حذف', 'حذف هذا العنصر من السجل؟', [
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
