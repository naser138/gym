import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Field, Row, T } from './ui';
import { ExerciseAvatar } from './visuals';
import { addExercise, getExercises, type Exercise } from '@/db/repo';
import { colors, radius, rtl, spacing } from '@/theme/colors';

/** Search existing exercises or create a new one. */
export function ExercisePicker({ onPick, excludeIds = [] }: { onPick: (e: Exercise) => void; excludeIds?: number[] }) {
  const db = useSQLiteContext();
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');

  useEffect(() => {
    getExercises(db).then(setAll);
  }, [db]);

  const filtered = useMemo(() => {
    const s = q.trim();
    return all.filter((e) => !excludeIds.includes(e.id) && (!s || e.name.includes(s) || e.muscle.includes(s))).slice(0, 30);
  }, [all, q, excludeIds]);

  async function create() {
    const name = q.trim();
    if (!name) return appAlert('اكتب اسم التمرين في خانة البحث');
    const id = await addExercise(db, name, muscle.trim());
    const ex = { id, name, muscle: muscle.trim() };
    setAll((a) => [...a.filter((x) => x.id !== id), ex]);
    setQ('');
    setMuscle('');
    onPick(ex);
  }

  const exact = all.some((e) => e.name === q.trim());

  return (
    <View style={{ gap: spacing.sm }}>
      <Field placeholder="ابحث أو اكتب اسم تمرين جديد" value={q} onChangeText={setQ} />
      <Row style={{ flexWrap: 'wrap' }} gap={6}>
        {filtered.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => onPick(e)}
            style={{
              flexDirection: rtl.row,
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.surface2,
              borderRadius: radius.md,
              paddingVertical: 6,
              paddingHorizontal: 8,
            }}
          >
            <ExerciseAvatar muscle={e.muscle} photo={e.photo} size={28} />
            <View>
              <T size={13}>{e.name}</T>
              {e.muscle ? (
                <T muted size={10}>
                  {e.muscle}
                </T>
              ) : null}
            </View>
          </Pressable>
        ))}
      </Row>
      {q.trim() && !exact ? (
        <Row>
          <Field placeholder="العضلة (اختياري)" value={muscle} onChangeText={setMuscle} />
          <Button title={`إضافة "${q.trim()}"`} small variant="secondary" onPress={create} />
        </Row>
      ) : null}
    </View>
  );
}
