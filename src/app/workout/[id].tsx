import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '@/utils/nav';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Field, Row, Screen, Stat, T } from '@/components/ui';
import { Chip, ExerciseAvatar, Icon } from '@/components/visuals';
import { ExercisePicker } from '@/components/ExercisePicker';
import { NextTargetCard } from '@/components/NextTargetCard';
import { RestTimer } from '@/components/RestTimer';
import { useAppData } from '@/hooks/AppData';
import {
  addSet,
  deleteSession,
  deleteSet,
  finishSession,
  getExercise,
  getPlanExercises,
  getSession,
  getSetting,
  getSets,
  setSetting,
  type Exercise,
  type WorkoutSession,
  type WorkoutSet,
} from '@/db/repo';
import { e1rm } from '@/services/training/progression';
import { loadNextTarget, type NextTarget } from '@/services/training/next';
import { colors, radius, spacing } from '@/theme/colors';
import { formatDateAr } from '@/utils/date';
import { formatClock, formatDuration, sessionDurationMs } from '@/utils/time';
import { fmt, parseNumber } from '@/utils/number';

interface ExerciseBlock {
  exercise: Exercise;
  planSets?: number;
  planReps?: string;
}

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const { bumpData } = useAppData();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(90);
  const [now, setNow] = useState(() => Date.now());

  // Remember the preferred rest length between sessions.
  useEffect(() => {
    getSetting<number>(db, 'restSeconds', 90).then(setRestTotal);
  }, [db]);

  // Live session clock while the workout is running.
  const running = !!session && !session.finished_at;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const startRest = useCallback(() => setRestEnd(Date.now() + restTotal * 1000), [restTotal]);
  const stopRest = useCallback(() => setRestEnd(null), []);
  const changeRest = useCallback(
    (d: number) => {
      const total = Math.min(600, Math.max(15, restTotal + d));
      setRestTotal(total);
      setRestEnd((e) => (e ? e + (total - restTotal) * 1000 : e));
      setSetting(db, 'restSeconds', total).catch(() => {});
    },
    [db, restTotal],
  );

  const load = useCallback(async () => {
    const s = await getSession(db, sessionId);
    setSession(s);
    if (!s) return;
    setNotes(s.notes ?? '');
    const [st, plan] = await Promise.all([
      getSets(db, sessionId),
      s.weekday != null ? getPlanExercises(db, s.weekday) : Promise.resolve([]),
    ]);
    setSets(st);
    // Plan exercises first (in plan order), then extra exercises that have sets.
    const ids: number[] = [];
    const meta = new Map<number, { planSets?: number; planReps?: string }>();
    plan.forEach((p) => {
      ids.push(p.exercise_id);
      meta.set(p.exercise_id, { planSets: p.target_sets, planReps: p.target_reps });
    });
    st.forEach((x) => !ids.includes(x.exercise_id) && ids.push(x.exercise_id));
    const exercises = await Promise.all(ids.map((eid) => getExercise(db, eid)));
    setBlocks((prev) => {
      const next: ExerciseBlock[] = exercises.filter((e): e is Exercise => !!e).map((e) => ({ exercise: e, ...meta.get(e.id) }));
      // keep exercises added in this screen that have no sets yet
      prev.forEach((b) => !next.some((n) => n.exercise.id === b.exercise.id) && next.push(b));
      return next;
    });
  }, [db, sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const volume = useMemo(() => sets.reduce((a, s) => a + s.weight_kg * s.reps, 0), [sets]);

  if (!session) {
    return (
      <Screen>
        <T muted>الجلسة غير موجودة.</T>
      </Screen>
    );
  }

  const doneExercises = blocks.filter((b) => sets.some((s) => s.exercise_id === b.exercise.id)).length;
  const finished = !!session.finished_at;
  const elapsedMs = sessionDurationMs(session.started_at, session.finished_at, new Date(now));

  async function finish() {
    if (!session) return;
    if (finished) {
      await finishSession(db, sessionId, notes.trim() || null);
      bumpData();
      goBack(router);
      return;
    }
    const doFinish = async () => {
      await finishSession(db, sessionId, notes.trim() || null);
      setRestEnd(null);
      // Personal records: sets that beat the best estimated 1RM from earlier sessions.
      let prs = 0;
      for (const exId of [...new Set(sets.map((x) => x.exercise_id))]) {
        const prev = await db.getFirstAsync<{ best: number | null }>(
          'SELECT MAX(weight_kg * (1 + reps / 30.0)) AS best FROM workout_sets WHERE exercise_id = ? AND session_id != ? AND reps > 0',
          exId,
          sessionId,
        );
        const best = prev?.best ?? 0;
        if (best > 0 && sets.some((x) => x.exercise_id === exId && e1rm(x.weight_kg, x.reps) > best + 0.01)) prs++;
      }
      bumpData();
      appAlert(
        'أحسنت! 💪 التمرين مكتمل',
        [
          `المدة: ${formatDuration(elapsedMs)}`,
          `التمارين: ${doneExercises}  ·  المجموعات: ${sets.length}`,
          `الحجم الكلي: ${fmt(volume)} كغ`,
          prs ? `🏆 أرقام جديدة في ${prs} ${prs === 1 ? 'تمرين' : 'تمارين'}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        [{ text: 'تم', onPress: () => goBack(router) }],
      );
    };
    if (sets.length === 0) {
      appAlert('لم تسجّل أي مجموعة', 'هل تريد إنهاء الجلسة بدون مجموعات؟', [
        { text: 'رجوع', style: 'cancel' },
        { text: 'إنهاء', onPress: doFinish },
      ]);
    } else {
      await doFinish();
    }
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen>
      <Stack.Screen options={{ title: session.title }} />
      <Card style={finished ? { borderColor: colors.primary + '66', backgroundColor: colors.primaryDim } : undefined}>
        <Row between>
          <T muted size={13}>{formatDateAr(session.date)}</T>
          {finished ? (
            <Chip text="✓ مكتمل" color={colors.primary} />
          ) : (
            <Row gap={6}>
              <Icon name="stopwatch" color={colors.warning} size={16} />
              <T weight="bold" color={colors.warning} style={{ fontVariant: ['tabular-nums'] }}>
                {formatClock(elapsedMs / 1000)}
              </T>
            </Row>
          )}
        </Row>
        {finished && (
          <T muted size={12}>
            المدة {formatDuration(elapsedMs)} · تقدر تعدّل المجموعات والملاحظات
          </T>
        )}
        <Row style={{ marginTop: spacing.sm }}>
          <Stat label="تمارين" value={`${doneExercises}/${blocks.length}`} />
          <Stat label="مجموعات" value={String(sets.length)} />
          <Stat label="الحجم" value={fmt(volume)} unit="كغ" />
        </Row>
      </Card>

      {blocks.map((b) => (
        <ExerciseCard
          key={b.exercise.id}
          block={b}
          sessionId={sessionId}
          sets={sets.filter((s) => s.exercise_id === b.exercise.id)}
          onSetAdded={finished ? undefined : startRest}
          onOpen={() => router.push({ pathname: '/exercise/[id]', params: { id: String(b.exercise.id) } })}
          onChanged={async () => {
            await load();
            bumpData();
          }}
        />
      ))}

      <Card title="إضافة تمرين للجلسة" icon="plus.circle.fill">
        {adding ? (
          <ExercisePicker
            excludeIds={blocks.map((b) => b.exercise.id)}
            onPick={async (e) => {
              const full = (await getExercise(db, e.id)) ?? e;
              setBlocks((bs) => [...bs, { exercise: full }]);
              setAdding(false);
            }}
          />
        ) : (
          <Button title="+ تمرين" variant="secondary" onPress={() => setAdding(true)} />
        )}
      </Card>

      <Card title="ملاحظات" icon="note.text" iconColor={colors.textMuted}>
        <Field value={notes} onChangeText={setNotes} placeholder="كيف كان التمرين؟" multiline />
      </Card>

      <Button title={finished ? 'حفظ الملاحظات' : 'إنهاء التمرين'} icon="checkmark.circle.fill" onPress={finish} />
      <Button
        title="حذف الجلسة"
        variant="ghost"
        onPress={() =>
          appAlert('حذف الجلسة', 'سيتم حذف الجلسة وجميع مجموعاتها نهائيًا.', [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'حذف',
              style: 'destructive',
              onPress: async () => {
                await deleteSession(db, sessionId);
                bumpData();
                goBack(router);
              },
            },
          ])
        }
      />
      {restEnd ? <View style={{ height: 90 }} /> : null}
    </Screen>
    <RestTimer endsAt={restEnd} total={restTotal} onChange={changeRest} onStop={stopRest} />
    </View>
  );
}

function ExerciseCard({
  block,
  sessionId,
  sets,
  onChanged,
  onOpen,
  onSetAdded,
}: {
  block: ExerciseBlock;
  sessionId: number;
  sets: WorkoutSet[];
  onChanged: () => Promise<void>;
  onOpen: () => void;
  onSetAdded?: () => void;
}) {
  const db = useSQLiteContext();
  const { profile } = useAppData();
  const ex = block.exercise;
  const [next, setNext] = useState<NextTarget | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadNextTarget(db, ex, profile, { excludeSessionId: sessionId, planSets: block.planSets, planReps: block.planReps }).then((n) => {
        if (!alive) return;
        setNext(n);
        // Prefill with the target so logging is one tap.
        setWeight((w) => w || (n.suggestion.weight > 0 ? String(n.suggestion.weight) : ''));
        setReps((r) => r || String(n.suggestion.reps));
      });
      return () => {
        alive = false;
      };
    }, [db, ex, profile, sessionId, block.planSets, block.planReps]),
  );

  // Best e1RM before today – used to flag new personal records.
  const prevBest = useMemo(
    () => Math.max(0, ...(next?.history ?? []).flatMap((h) => h.sets.map((s) => e1rm(s.weight, s.reps)))),
    [next],
  );
  const target = next?.suggestion;
  const targetSets = target?.sets ?? block.planSets ?? 3;

  async function add() {
    const w = parseNumber(weight) ?? 0;
    const r = parseNumber(reps);
    if (w < 0 || w > 1000) return appAlert('الوزن غير صحيح');
    if (r == null || r < 1 || r > 200 || !Number.isInteger(r)) return appAlert('التكرارات غير صحيحة');
    await addSet(db, sessionId, ex.id, w, r);
    await onChanged();
    onSetAdded?.();
  }

  return (
    <Card>
      <Pressable onPress={onOpen}>
        <Row gap={spacing.md} style={{ marginBottom: spacing.sm }}>
          <ExerciseAvatar muscle={ex.muscle} photo={ex.photo} size={48} />
          <View style={{ flex: 1 }}>
            <T bold size={16}>
              {ex.name}
            </T>
            <T muted size={12}>
              {block.planSets ? `الخطة ${block.planSets} × ${block.planReps}` : ex.muscle} · {sets.length}/{targetSets} مجموعات
            </T>
          </View>
          <Icon name="chevron.left" size={14} color={colors.textMuted} />
        </Row>
      </Pressable>

      {target && sets.length === 0 && (
        <NextTargetCard
          s={target}
          compact
          onUse={() => {
            setWeight(target.weight > 0 ? String(target.weight) : '');
            setReps(String(target.reps));
          }}
        />
      )}

      {sets.map((s) => {
        const isPR = prevBest > 0 && e1rm(s.weight_kg, s.reps) > prevBest + 0.01;
        const hit = target && s.weight_kg >= target.weight && s.reps >= target.reps;
        return (
          <Pressable
            key={s.id}
            onLongPress={() =>
              appAlert('حذف المجموعة؟', '', [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'حذف',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteSet(db, s.id);
                    await onChanged();
                  },
                },
              ])
            }
          >
            <Row
              style={{
                justifyContent: 'space-between',
                paddingVertical: 8,
                paddingHorizontal: spacing.sm,
                marginTop: 6,
                borderRadius: radius.sm,
                backgroundColor: colors.surface2,
              }}
            >
              <Row gap={6}>
                <Icon
                  name={hit ? 'checkmark.circle.fill' : 'plus.circle.fill'}
                  size={16}
                  color={hit ? colors.primary : colors.textMuted}
                />
                <T muted size={13}>مجموعة {s.set_index}</T>
              </Row>
              <Row gap={6}>
                {isPR && <Chip text="رقم جديد 🏆" color={colors.warning} />}
                <T bold>
                  {s.weight_kg > 0 ? `${fmt(s.weight_kg, 2)} كغ` : 'وزن الجسم'} × {s.reps}
                </T>
              </Row>
            </Row>
          </Pressable>
        );
      })}

      <Row style={{ marginTop: spacing.md }}>
        <Field label="الوزن" suffix="كغ" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Field label="تكرار" value={reps} onChangeText={setReps} keyboardType="number-pad" />
        <Button title="+ مجموعة" small onPress={add} style={{ alignSelf: 'flex-end', paddingVertical: 12 }} />
      </Row>
    </Card>
  );
}
