import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Empty, Field, Row, Screen, T } from '@/components/ui';
import { ExercisePicker } from '@/components/ExercisePicker';
import { useAppData } from '@/hooks/AppData';
import {
  addPlanExercise,
  getPlanDays,
  getPlanExercises,
  removePlanExercise,
  setPlanDayTitle,
  type Exercise,
  type PlanExercise,
} from '@/db/repo';
import { colors, spacing } from '@/theme/colors';
import { ExerciseAvatar } from '@/components/visuals';
import { weekdayNameAr } from '@/utils/date';
import { parseNumber } from '@/utils/number';

export default function PlanDayScreen() {
  const { weekday: wdParam } = useLocalSearchParams<{ weekday: string }>();
  const weekday = Number(wdParam);
  const db = useSQLiteContext();
  const { bumpData } = useAppData();
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<PlanExercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8-12');

  const load = useCallback(async () => {
    const [days, ex] = await Promise.all([getPlanDays(db), getPlanExercises(db, weekday)]);
    setTitle(days.find((d) => d.weekday === weekday)?.title ?? '');
    setItems(ex);
  }, [db, weekday]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function add() {
    if (!selected) return;
    const s = parseNumber(sets);
    if (s == null || s < 1 || s > 20) return appAlert('عدد المجموعات بين 1 و20');
    await addPlanExercise(db, weekday, selected.id, Math.round(s), reps.trim() || '8-12');
    setSelected(null);
    await load();
    bumpData();
  }

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return <Screen><T>يوم غير صالح</T></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: weekdayNameAr(weekday) }} />
      <Card title="اسم اليوم" icon="pencil" iconColor={colors.accent}>
        <Row>
          <Field value={title} onChangeText={setTitle} placeholder="مثال: صدر وتراي" />
          <Button
            title="حفظ"
            small
            onPress={async () => {
              await setPlanDayTitle(db, weekday, title.trim());
              bumpData();
            }}
          />
        </Row>
      </Card>

      <Card title="التمارين" icon="dumbbell.fill">
        {items.length ? (
          items.map((e) => (
            <Row key={e.id} gap={spacing.md} style={{ marginBottom: spacing.sm }}>
              <ExerciseAvatar muscle={e.muscle} photo={e.photo} size={40} />
              <View style={{ flex: 1 }}>
                <T weight="medium">{e.name}</T>
                <T muted size={12}>
                  {e.target_sets} مجموعات × {e.target_reps} تكرار
                </T>
              </View>
              <Button
                title="حذف"
                icon="trash"
                small
                variant="danger"
                onPress={async () => {
                  await removePlanExercise(db, e.id);
                  await load();
                  bumpData();
                }}
              />
            </Row>
          ))
        ) : (
          <Empty text="يوم راحة — أضف تمارين لتحويله ليوم تمرين." />
        )}
      </Card>

      <Card title={selected ? `إضافة: ${selected.name}` : 'إضافة تمرين'} icon="plus.circle.fill">
        {selected ? (
          <Row style={{ marginBottom: spacing.sm }}>
            <Field label="مجموعات" value={sets} onChangeText={setSets} keyboardType="number-pad" />
            <Field label="تكرارات" value={reps} onChangeText={setReps} />
            <Button title="إضافة" small onPress={add} style={{ alignSelf: 'flex-end' }} />
            <Button title="إلغاء" small variant="ghost" onPress={() => setSelected(null)} style={{ alignSelf: 'flex-end' }} />
          </Row>
        ) : (
          <ExercisePicker onPick={setSelected} excludeIds={items.map((i) => i.exercise_id)} />
        )}
      </Card>
    </Screen>
  );
}
