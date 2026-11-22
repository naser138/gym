import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card, Field, Row, Screen, T } from '@/components/ui';
import { ExerciseAvatar, Icon, MUSCLE_STYLE } from '@/components/visuals';
import { useAppData } from '@/hooks/AppData';
import { getExercisesWithStats, type ExerciseWithStats } from '@/db/repo';
import { colors, radius, spacing } from '@/theme/colors';
import { formatDateAr } from '@/utils/date';
import { fmt } from '@/utils/number';

export default function Library() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { dataVersion } = useAppData();
  const [all, setAll] = useState<ExerciseWithStats[]>([]);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getExercisesWithStats(db).then(setAll);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion reloads after edits on other screens
    }, [db, dataVersion]),
  );

  const muscles = useMemo(() => [...new Set(all.map((e) => e.muscle).filter(Boolean))], [all]);
  const list = all.filter((e) => (!muscle || e.muscle === muscle) && (!q.trim() || e.name.includes(q.trim())));
  const groups = muscles.filter((m) => list.some((e) => e.muscle === m));
  const other = list.filter((e) => !e.muscle);

  return (
    <Screen>
      <Field placeholder="ابحث عن تمرين" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row gap={6}>
          {[null, ...muscles].map((m) => {
            const active = muscle === m;
            const c = m ? (MUSCLE_STYLE[m]?.color ?? colors.textMuted) : colors.primary;
            return (
              <Pressable
                key={m ?? 'all'}
                onPress={() => setMuscle(m)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? c : colors.surface2,
                }}
              >
                <T size={13} bold={active} color={active ? '#06110B' : colors.text}>
                  {m ?? 'الكل'}
                </T>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>

      {[...groups, ...(other.length ? [''] : [])].map((m) => (
        <Card key={m || 'other'} title={m || 'أخرى'}>
          {list
            .filter((e) => e.muscle === m)
            .map((e) => (
              <Pressable
                key={e.id}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(e.id) } })}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Row gap={spacing.md} style={{ paddingVertical: 8 }}>
                  <ExerciseAvatar muscle={e.muscle} photo={e.photo} size={46} />
                  <View style={{ flex: 1 }}>
                    <T bold>{e.name}</T>
                    <T muted size={12}>
                      {e.best_weight != null
                        ? `أعلى ${fmt(e.best_weight, 1)} كغ · أقصى تكرار ${fmt(e.best_1rm, 1)}`
                        : `${e.equipment || ''}${e.equipment ? ' · ' : ''}${e.rep_min ?? 8}–${e.rep_max ?? 12} تكرار`}
                    </T>
                    {e.last_date && (
                      <T muted size={11}>
                        آخر مرة {formatDateAr(e.last_date)}
                      </T>
                    )}
                  </View>
                  <Icon name="chevron.left" size={14} color={colors.textMuted} />
                </Row>
              </Pressable>
            ))}
        </Card>
      ))}
      {!list.length && (
        <View style={{ padding: spacing.xl, borderRadius: radius.md }}>
          <T muted style={{ textAlign: 'center' }}>لا توجد نتائج. أضف تمرينًا جديدًا من جدول التمارين.</T>
        </View>
      )}
    </Screen>
  );
}
