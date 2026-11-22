import { useCallback, useState } from 'react';
import { ActionSheetIOS, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Empty, Field, Row, Screen, Stat, T } from '@/components/ui';
import { ExerciseAvatar, Icon, LineChart, muscleStyle } from '@/components/visuals';
import { NextTargetCard } from '@/components/NextTargetCard';
import { useAppData } from '@/hooks/AppData';
import { getExercise, setExercisePhoto, updateExerciseSettings, type Exercise } from '@/db/repo';
import { deletePhoto, pickPhoto } from '@/services/photos';
import { e1rm, e1rmSeries } from '@/services/training/progression';
import { loadNextTarget, type NextTarget } from '@/services/training/next';
import { colors, rtl, spacing } from '@/theme/colors';
import { formatDateAr } from '@/utils/date';
import { fmt, parseNumber } from '@/utils/number';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exId = Number(id);
  const db = useSQLiteContext();
  const { profile, bumpData } = useAppData();
  const { width } = useWindowDimensions();
  const [ex, setEx] = useState<Exercise | null>(null);
  const [next, setNext] = useState<NextTarget | null>(null);
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');
  const [inc, setInc] = useState('');

  const load = useCallback(async () => {
    const e = await getExercise(db, exId);
    setEx(e);
    if (!e) return;
    setRepMin(String(e.rep_min ?? 8));
    setRepMax(String(e.rep_max ?? 12));
    setInc(String(e.increment_kg ?? 2.5));
    setNext(await loadNextTarget(db, e, profile));
  }, [db, exId, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!ex) return <Screen><T muted>التمرين غير موجود.</T></Screen>;

  async function changePhoto(source: 'camera' | 'library') {
    const r = await pickPhoto(source, `ex${exId}`);
    if (r.denied) {
      appAlert('الصلاحية مرفوضة', 'اسمح بالوصول من الإعدادات ← My Gym.');
      return;
    }
    if (!r.fileName) return;
    deletePhoto(ex!.photo);
    await setExercisePhoto(db, exId, r.fileName);
    await load();
    bumpData();
  }

  function photoMenu() {
    const opts = ['التقاط صورة', 'اختيار من الصور', ...(ex!.photo ? ['حذف الصورة'] : []), 'إلغاء'];
    const handle = async (i: number) => {
      if (opts[i] === 'التقاط صورة') changePhoto('camera');
      else if (opts[i] === 'اختيار من الصور') changePhoto('library');
      else if (opts[i] === 'حذف الصورة') {
        deletePhoto(ex!.photo);
        await setExercisePhoto(db, exId, null);
        await load();
        bumpData();
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: opts.length - 1, destructiveButtonIndex: ex!.photo ? 2 : undefined },
        handle,
      );
    } else {
      appAlert('صورة التمرين', '', opts.slice(0, -1).map((o, i) => ({ text: o, onPress: () => handle(i) })));
    }
  }

  async function saveSettings() {
    const a = parseNumber(repMin);
    const b = parseNumber(repMax);
    const c = parseNumber(inc);
    if (a == null || b == null || a < 1 || b < a || b > 50) return appAlert('نطاق التكرار غير صحيح');
    if (c == null || c < 0 || c > 50) return appAlert('مقدار الزيادة غير صحيح');
    await updateExerciseSettings(db, exId, { rep_min: Math.round(a), rep_max: Math.round(b), increment_kg: c });
    await load();
    appAlert('تم الحفظ');
  }

  const history = next?.history ?? [];
  const series = e1rmSeries(history.slice(0, 20)).map((p) => ({ label: p.date.slice(5), value: p.value }));
  const best = history.reduce(
    (b, h) => {
      for (const s of h.sets) {
        const v = e1rm(s.weight, s.reps);
        if (v > b.e1rm) b = { e1rm: v, weight: s.weight, reps: s.reps, date: h.date };
      }
      return b;
    },
    { e1rm: 0, weight: 0, reps: 0, date: '' },
  );
  const st = muscleStyle(ex.muscle);

  return (
    <Screen>
      <Stack.Screen options={{ title: ex.name }} />

      <Card>
        <Row gap={spacing.lg}>
          <Pressable onPress={photoMenu}>
            <ExerciseAvatar muscle={ex.muscle} photo={ex.photo} size={96} />
            <View style={{ position: 'absolute', bottom: -4, left: -4, backgroundColor: colors.surface, borderRadius: 999, padding: 5 }}>
              <Icon name="camera.fill" size={14} color={colors.text} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <T bold size={20}>
              {ex.name}
            </T>
            <T size={13} color={st.color}>
              {ex.muscle}
              {ex.equipment ? ` · ${ex.equipment}` : ''}
            </T>
            <T muted size={12}>
              نطاق {ex.rep_min}–{ex.rep_max} تكرار · زيادة {fmt(ex.increment_kg, 2)} كغ
            </T>
          </View>
        </Row>
      </Card>

      {next && <NextTargetCard s={next.suggestion} />}

      <Card title="تطور القوة" icon="chart.line.uptrend.xyaxis" right={<T muted size={11}>أقصى وزن لتكرار واحد (تقديري)</T>}>
        <LineChart data={series} width={width - 32 - 34} unit=" كغ" />
        {best.e1rm > 0 && (
          <Row style={{ marginTop: spacing.md }}>
            <Stat label="أفضل تقدير" value={fmt(best.e1rm, 1)} unit="كغ" color={colors.primary} />
            <Stat label="أفضل مجموعة" value={`${fmt(best.weight, 1)}×${best.reps}`} />
            <Stat label="الجلسات" value={String(history.length)} />
          </Row>
        )}
      </Card>

      <Card title="السجل" icon="clock.arrow.circlepath" iconColor={colors.accent}>
        {history.length ? (
          history.map((h) => (
            <View key={h.sessionId} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <T size={13} bold>
                {formatDateAr(h.date)}
              </T>
              <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={6}>
                {h.sets.map((s, i) => (
                  <View key={i} style={{ backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <T size={12}>
                      {s.weight > 0 ? fmt(s.weight, 2) : 'وزن الجسم'} × {s.reps}
                    </T>
                  </View>
                ))}
              </Row>
            </View>
          ))
        ) : (
          <Empty text="لم تسجّل هذا التمرين بعد." />
        )}
      </Card>

      <Card title="إعدادات التطور" icon="gearshape.fill" iconColor={colors.textMuted}>
        <Row>
          <Field label="أقل تكرار" value={repMin} onChangeText={setRepMin} keyboardType="number-pad" />
          <Field label="أعلى تكرار" value={repMax} onChangeText={setRepMax} keyboardType="number-pad" />
          <Field label="الزيادة" suffix="كغ" value={inc} onChangeText={setInc} keyboardType="decimal-pad" />
        </Row>
        <T muted size={12} style={{ marginTop: 6 }}>
          عندما تصل لأعلى تكرار في كل المجموعات، يقترح التطبيق رفع الوزن بمقدار الزيادة. ضع 0 لتمارين وزن الجسم.
        </T>
        <Button title="حفظ" variant="secondary" small onPress={saveSettings} style={{ marginTop: spacing.sm, alignSelf: rtl.alignStart }} />
      </Card>
    </Screen>
  );
}
