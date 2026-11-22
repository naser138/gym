import { useCallback, useState } from 'react';
import { Keyboard, Pressable, useWindowDimensions, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Empty, Field, H1, Row, Screen, Stat, T } from '@/components/ui';
import { LineChart } from '@/components/visuals';
import { useAppData } from '@/hooks/AppData';
import {
  deleteWeight,
  getDailyLogs,
  getFoodTotalsRange,
  getWeights,
  setDailyNote,
  upsertWeight,
  type BodyWeight,
  type DailyLog,
  type DayTotals,
} from '@/db/repo';
import { colors, spacing } from '@/theme/colors';
import { formatDateAr, shiftDateKey, toDateKey } from '@/utils/date';
import { fmt, parseNumber } from '@/utils/number';

/** Average of weights within the 7 days ending at `date` (inclusive). */
function trailingAvg(weights: BodyWeight[], date: string): number | null {
  const from = shiftDateKey(date, -6);
  const w = weights.filter((x) => x.date >= from && x.date <= date);
  return w.length ? w.reduce((a, x) => a + x.weight_kg, 0) / w.length : null;
}

export default function Progress() {
  const db = useSQLiteContext();
  const { profile, updateProfile, dataVersion, bumpData } = useAppData();
  const { width } = useWindowDimensions();
  const [weights, setWeights] = useState<BodyWeight[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [food, setFood] = useState<DayTotals[]>([]);
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const today = toDateKey();
    const [w, l, f] = await Promise.all([getWeights(db, 180), getDailyLogs(db, 30), getFoodTotalsRange(db, shiftDateKey(today, -29), today)]);
    setWeights(w);
    setLogs(l);
    setFood(f);
    setNote(l.find((x) => x.date === today)?.note ?? '');
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion reloads after edits on other screens
    }, [load, dataVersion]),
  );

  async function addWeight() {
    const kg = parseNumber(input);
    if (kg == null || kg < 30 || kg > 300) return appAlert('أدخل وزنًا بين 30 و300 كغ');
    const today = toDateKey();
    await upsertWeight(db, today, kg, 'manual');
    // Keep the profile weight current so BMR and macros follow your weight.
    if (profile) await updateProfile({ ...profile, weightKg: kg });
    Keyboard.dismiss();
    setInput('');
    await load();
    bumpData();
  }

  const today = toDateKey();
  const avgNow = trailingAvg(weights, today);
  const avgPrev = trailingAvg(weights, shiftDateKey(today, -7));
  const weeklyChange = avgNow != null && avgPrev != null ? avgNow - avgPrev : null;
  const first = weights.length ? weights[weights.length - 1] : null;
  const latest = weights[0] ?? null;
  const chart = [...weights.slice(0, 60)].reverse().map((w) => ({ label: w.date.slice(5), value: w.weight_kg }));

  // Last 7 complete days: intake vs estimated burn
  const last7 = logs.filter((l) => l.date < today).slice(0, 7);
  const intake7 = last7.map((l) => food.find((f) => f.date === l.date)?.calories ?? 0);
  const loggedDays = intake7.filter((x) => x > 0).length;
  const avgIntake = loggedDays ? intake7.reduce((a, b) => a + b, 0) / loggedDays : null;
  const avgTdee = last7.length ? last7.reduce((a, l) => a + (l.tdee_kcal ?? 0), 0) / last7.length : null;

  return (
    <Screen>
      <H1 subtitle="الوزن والسجل اليومي">التطور</H1>

      <Card title="الوزن" icon="scalemass.fill" iconColor={colors.accent}>
        <Row>
          <Stat label="الحالي" value={fmt(latest?.weight_kg, 1)} unit="كغ" />
          <Stat label="متوسط 7 أيام" value={fmt(avgNow, 1)} unit="كغ" />
          <Stat
            label="تغيّر أسبوعي"
            value={weeklyChange == null ? '—' : `${weeklyChange > 0 ? '+' : ''}${fmt(weeklyChange, 2)}`}
            color={weeklyChange == null ? undefined : weeklyChange > 0 ? colors.warning : colors.primary}
          />
        </Row>
        {first && latest && first.id !== latest.id && (
          <T muted size={12} style={{ marginTop: 6, textAlign: 'center' }}>
            منذ {formatDateAr(first.date)}: {latest.weight_kg - first.weight_kg > 0 ? '+' : ''}
            {fmt(latest.weight_kg - first.weight_kg, 1)} كغ
          </T>
        )}
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <LineChart data={chart} width={width - 66} height={120} color={colors.accent} unit=" كغ" />
        </View>
        <Row style={{ marginTop: spacing.md }}>
          <Field placeholder="وزن اليوم" suffix="كغ" value={input} onChangeText={setInput} keyboardType="decimal-pad" />
          <Button title="تسجيل" onPress={addWeight} />
        </Row>
      </Card>

      <Card title="آخر 7 أيام مكتملة" icon="calendar" iconColor={colors.warning}>
        <Row>
          <Stat label="متوسط الأكل" value={fmt(avgIntake)} />
          <Stat label="متوسط الحرق المقدر" value={fmt(avgTdee)} />
          <Stat
            label="الفرق اليومي"
            value={avgIntake != null && avgTdee ? fmt(avgIntake - avgTdee) : '—'}
          />
        </Row>
        <T muted size={12} style={{ marginTop: 6 }}>
          محسوب من {loggedDays} يوم مسجّل. سجّل أكلك يوميًا لتقدير أدق.
        </T>
      </Card>

      <Card title="ملاحظة اليوم" icon="note.text" iconColor={colors.textMuted}>
        <Row>
          <Field value={note} onChangeText={setNote} placeholder="نوم، طاقة، جوع…" />
          <Button
            title="حفظ"
            small
            onPress={async () => {
              await setDailyNote(db, today, note.trim());
              await load();
            }}
          />
        </Row>
      </Card>

      <Card title="السجل اليومي" icon="list.bullet">
        {logs.length ? (
          logs.map((l) => {
            const eaten = food.find((f) => f.date === l.date)?.calories;
            return (
              <View key={l.date} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={13}>{formatDateAr(l.date)}</T>
                  <T muted size={12}>
                    {l.steps != null ? `${fmt(l.steps)} خطوة` : ''}
                  </T>
                </Row>
                <T muted size={12}>
                  أكل {fmt(eaten ?? 0)} · هدف {fmt(l.target_kcal)} · حرق مقدر {fmt(l.tdee_kcal)}
                </T>
                {l.note ? <T size={12}>📝 {l.note}</T> : null}
              </View>
            );
          })
        ) : (
          <Empty text="لا يوجد سجل بعد." />
        )}
      </Card>

      <Card title="سجل الأوزان" icon="clock.arrow.circlepath" iconColor={colors.accent}>
        {weights.length ? (
          weights.slice(0, 60).map((w) => (
            <Pressable
              key={w.id}
              onLongPress={() =>
                appAlert('حذف القياس؟', `${w.weight_kg} كغ - ${w.date}`, [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteWeight(db, w.id);
                      await load();
                    },
                  },
                ])
              }
            >
              <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <T size={13}>{formatDateAr(w.date)}</T>
                <T size={13}>
                  {fmt(w.weight_kg, 1)} كغ <T muted size={11}>{w.source === 'health' ? '(الصحة)' : ''}</T>
                </T>
              </Row>
            </Pressable>
          ))
        ) : (
          <Empty text="لا توجد قياسات." />
        )}
      </Card>
    </Screen>
  );
}
