/**
 * "تمرين اليوم" – shared by the dashboard and the workouts tab.
 * States: not started → in progress → completed ✓ (or rest day), plus this week's progress.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Row, T } from './ui';
import { Chip, ExerciseAvatar, Icon } from './visuals';
import { useAppData } from '@/hooks/AppData';
import {
  createSession,
  getExercise,
  getPlanDays,
  getPlanExercises,
  getSessionExerciseIds,
  getSessionsForDate,
  getTrainedDates,
  type Exercise,
  type SessionSummary,
} from '@/db/repo';
import { loadNextTarget } from '@/services/training/next';
import { SUGGESTION_LABELS, type Suggestion } from '@/services/training/progression';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { addDays, fromDateKey, relativeDayAr, toDateKey, weekdayNameAr } from '@/utils/date';
import { fmt } from '@/utils/number';
import { formatDuration, sessionDurationMs } from '@/utils/time';

interface Item {
  exercise: Exercise;
  sets: number;
  reps: string;
  target: Suggestion;
  done: boolean;
}

interface State {
  title: string;
  items: Item[];
  session: SessionSummary | null;
  week: { key: string; weekday: number; planned: boolean; trained: boolean; isToday: boolean }[];
}

const SHORT_DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

export function TodayWorkoutCard({
  date: dateProp,
  showTargets = true,
  showWeek = true,
}: {
  /** Day to show (defaults to today). Past days show what was done and allow logging late. */
  date?: string;
  showTargets?: boolean;
  showWeek?: boolean;
}) {
  const db = useSQLiteContext();
  const router = useRouter();
  const { profile, dataVersion, bumpData } = useAppData();
  const [state, setState] = useState<State | null>(null);
  const todayKey = toDateKey();
  const date = dateProp ?? todayKey;
  const isToday = date === todayKey;
  const wd = fromDateKey(date).getDay();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [days, plan, sessions] = await Promise.all([getPlanDays(db), getPlanExercises(db, wd), getSessionsForDate(db, date)]);
        // Prefer today's planned session, otherwise the latest one of today.
        const session = sessions.find((s) => s.weekday === wd) ?? sessions[0] ?? null;
        const doneIds = session ? await getSessionExerciseIds(db, session.id) : [];

        const items: Item[] = [];
        for (const p of plan) {
          const ex = await getExercise(db, p.exercise_id);
          if (!ex) continue;
          const n = await loadNextTarget(db, ex, profile, {
            planSets: p.target_sets,
            planReps: p.target_reps,
            excludeSessionId: session?.id,
          });
          items.push({ exercise: ex, sets: p.target_sets, reps: p.target_reps, target: n.suggestion, done: doneIds.includes(ex.id) });
        }

        // This week: Sunday → Saturday.
        const sunday = addDays(fromDateKey(date), -wd);
        const keys = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(sunday, i)));
        const [trained, counts] = await Promise.all([
          getTrainedDates(db, keys[0], keys[6]),
          db.getAllAsync<{ weekday: number; n: number }>('SELECT weekday, COUNT(*) AS n FROM plan_exercises GROUP BY weekday'),
        ]);
        const week = keys.map((key, i) => ({
          key,
          weekday: i,
          planned: counts.some((c) => c.weekday === i && c.n > 0),
          trained: trained.includes(key),
          isToday: key === todayKey,
        }));

        if (!alive) return;
        setState({ title: days.find((d) => d.weekday === wd)?.title ?? '', items, session, week });
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion reloads after edits on other screens
    }, [db, profile, date, todayKey, wd, dataVersion]),
  );

  if (!state) return <View style={[styles.card, { height: 120 }]} />;

  const { items, session, week, title } = state;
  const finished = !!session?.finished_at;
  const inProgress = !!session && !finished;
  const isRest = items.length === 0;
  const plannedCount = week.filter((d) => d.planned).length;
  const trainedCount = week.filter((d) => d.trained).length;

  async function start() {
    const id = await createSession(db, date, title || (isRest ? 'تمرين حر' : `تمرين ${weekdayNameAr(wd)}`), isRest ? null : wd);
    bumpData();
    router.push({ pathname: '/workout/[id]', params: { id: String(id) } });
  }
  const openSession = () => session && router.push({ pathname: '/workout/[id]', params: { id: String(session.id) } });

  const body = (
    <>
      {/* Header */}
      <Row between style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T muted size={12}>
            {isToday ? `${weekdayNameAr(wd)} · تمرين اليوم` : `${relativeDayAr(date)} · التمرين`}
          </T>
          <T weight="bold" size={20}>
            {finished
              ? isToday
                ? 'أحسنت! التمرين مكتمل'
                : 'تمرين مكتمل'
              : isRest && !session
                ? 'يوم راحة'
                : !isToday && !session
                  ? 'لم يُسجَّل تمرين'
                  : title || session?.title || 'تمرين'}
          </T>
        </View>
        {finished ? (
          <View style={styles.doneBadge}>
            <Icon name="checkmark.circle.fill" color={colors.onPrimary} size={18} />
            <T weight="bold" size={13} color={colors.onPrimary}>
              مكتمل
            </T>
          </View>
        ) : inProgress ? (
          <Chip text={isToday ? 'قيد التنفيذ' : 'غير مكتمل'} color={colors.warning} />
        ) : (
          <Icon name={isRest ? 'moon.zzz.fill' : 'figure.strengthtraining.traditional'} size={30} color={isRest ? colors.textMuted : colors.primary} />
        )}
      </Row>

      {/* Stats when a session exists */}
      {session && (
        <Row style={styles.stats}>
          {[
            ['المدة', formatDuration(sessionDurationMs(session.started_at, session.finished_at))],
            ['التمارين', items.length ? `${items.filter((i) => i.done).length}/${items.length}` : String(session.exercise_count)],
            ['المجموعات', String(session.set_count)],
            ['الحجم', `${fmt(session.volume)} كغ`],
          ].map(([l, v]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <T weight="bold" size={15} center>
                {v}
              </T>
              <T muted size={11} center>
                {l}
              </T>
            </View>
          ))}
        </Row>
      )}

      {/* Exercises */}
      {items.map((it) => (
        <Pressable
          key={it.exercise.id}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(it.exercise.id) } })}
          style={({ pressed }) => [styles.exRow, pressed && { opacity: 0.6 }]}
        >
          <View>
            <ExerciseAvatar muscle={it.exercise.muscle} photo={it.exercise.photo} size={38} />
            {it.done && (
              <View style={styles.tick}>
                <Icon name="checkmark.circle.fill" color={colors.primary} size={16} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <T weight="medium" size={14} color={it.done ? colors.textMuted : colors.text} style={it.done ? { textDecorationLine: 'line-through' } : undefined}>
              {it.exercise.name}
            </T>
            <T muted size={12}>
              {showTargets && isToday && !finished
                ? `الهدف: ${it.target.weight > 0 ? `${fmt(it.target.weight, 2)} كغ` : it.target.kind === 'start' ? 'اختر وزنًا' : 'وزن الجسم'} × ${it.target.reps} · ${it.sets} مجموعات`
                : `${it.sets} × ${it.reps}`}
            </T>
          </View>
          {!finished && it.target.kind === 'increase' ? <Chip text={SUGGESTION_LABELS.increase} color={colors.primary} /> : null}
          {!finished && it.target.kind === 'deload' ? <Chip text={SUGGESTION_LABELS.deload} color={colors.danger} /> : null}
        </Pressable>
      ))}

      {isRest && !session && (
        <T muted size={13} style={{ marginTop: spacing.sm }}>
          {isToday ? 'لا يوجد تمرين في جدول اليوم. استرح، أو ابدأ تمرينًا حرًا.' : 'لا يوجد تمرين في جدول هذا اليوم.'}
        </T>
      )}

      {/* Action */}
      <View style={{ marginTop: spacing.md }}>
        {finished ? (
          <Button title="عرض الجلسة" icon="list.bullet" variant="secondary" onPress={openSession} />
        ) : inProgress ? (
          <Button title={isToday ? 'متابعة التمرين' : 'فتح الجلسة'} icon="play.fill" onPress={openSession} />
        ) : (
          <Button
            title={isToday ? (isRest ? 'تمرين حر' : 'ابدأ التمرين') : 'تسجيل تمرين لهذا اليوم'}
            icon={isToday ? 'play.fill' : 'plus'}
            variant={isToday && !isRest ? 'primary' : 'secondary'}
            onPress={start}
          />
        )}
      </View>

      {/* Week strip */}
      {showWeek && (
      <View style={styles.weekBox}>
        <Row between style={{ marginBottom: spacing.sm }}>
          <T muted size={12} weight="medium">
            هذا الأسبوع
          </T>
          <T size={12} weight="semibold" color={trainedCount >= plannedCount && plannedCount > 0 ? colors.primary : colors.text}>
            {trainedCount}/{plannedCount || '—'} تمارين
          </T>
        </Row>
        <View style={styles.weekRow}>
          {week.map((d) => (
            <View key={d.key} style={{ alignItems: 'center', gap: 4 }}>
              <View
                style={[
                  styles.dot,
                  d.trained && { backgroundColor: colors.primary, borderColor: colors.primary },
                  !d.trained && d.planned && { borderColor: colors.primary + '88' },
                  d.isToday && !d.trained && { borderColor: colors.text },
                ]}
              >
                {d.trained ? <Icon name="checkmark" color={colors.onPrimary} size={12} /> : null}
              </View>
              <T size={11} color={d.isToday ? colors.text : colors.textMuted} weight={d.isToday ? 'bold' : 'regular'} center>
                {SHORT_DAYS[d.weekday]}
              </T>
            </View>
          ))}
        </View>
      </View>
      )}
    </>
  );

  return finished ? (
    <LinearGradient colors={['#14402F', '#11171F']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.card, { borderColor: colors.primary + '66' }]}>
      {body}
    </LinearGradient>
  ) : (
    <View style={[styles.card, inProgress && { borderColor: colors.warning + '66' }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  doneBadge: { flexDirection: rtl.row, alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  stats: { backgroundColor: colors.surface2 + 'CC', borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  exRow: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  tick: { position: 'absolute', bottom: -4, right: -4, backgroundColor: colors.surface, borderRadius: 10 },
  weekBox: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  weekRow: { flexDirection: rtl.row, justifyContent: 'space-between' },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});
