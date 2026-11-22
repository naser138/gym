import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Card, Empty, H1, Row, Screen, T } from '@/components/ui';
import { Icon, muscleStyle } from '@/components/visuals';
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard';
import { useAppData } from '@/hooks/AppData';
import {
  applyProgram,
  getPersonalRecords,
  getPlanDays,
  getSessions,
  type PlanDay,
  type WorkoutSession,
} from '@/db/repo';
import { PROGRAMS } from '@/services/training/programs';
import { colors, radius, spacing } from '@/theme/colors';
import { formatDateAr, weekdayNameAr } from '@/utils/date';
import { fmt } from '@/utils/number';

type SessionRow = WorkoutSession & { set_count: number; volume: number };
type DayRow = PlanDay & { count: number; muscles: string[] };

export default function Workouts() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { dataVersion, bumpData } = useAppData();
  const [days, setDays] = useState<DayRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [prs, setPrs] = useState<{ name: string; best_1rm: number; best_weight: number }[]>([]);
  const todayWd = new Date().getDay();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [d, rows, s, r] = await Promise.all([
          getPlanDays(db),
          db.getAllAsync<{ weekday: number; muscle: string }>(
            'SELECT pe.weekday, e.muscle FROM plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id ORDER BY pe.position',
          ),
          getSessions(db, 20),
          getPersonalRecords(db),
        ]);
        if (!alive) return;
        setDays(
          d.map((x) => {
            const ms = rows.filter((row) => row.weekday === x.weekday).map((row) => row.muscle);
            return { ...x, count: ms.length, muscles: [...new Set(ms)] };
          }),
        );
        setSessions(s);
        setPrs(r);
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion reloads after edits on other screens
    }, [db, dataVersion]),
  );

  function chooseProgram() {
    appAlert(
      'برنامج جاهز',
      'اختر برنامجًا ليملأ جدولك الأسبوعي. سيستبدل الجدول الحالي (سجل تمارينك لا يتأثر).',
      [
        ...PROGRAMS.map((p) => ({
          text: `${p.name} — ${p.description}`,
          onPress: async () => {
            await applyProgram(db, p.days);
            bumpData();
          },
        })),
        { text: 'إلغاء', style: 'cancel' as const },
      ],
    );
  }

  const planEmpty = days.every((d) => d.count === 0);

  return (
    <Screen>
      <H1 subtitle="الجدول والتطور">التمارين</H1>

      <TodayWorkoutCard />

      <Row>
        <Pressable onPress={() => router.push('/library')} style={tileStyle}>
          <Icon name="dumbbell.fill" color={colors.accent} size={26} />
          <T bold>مكتبة التمارين</T>
          <T muted size={11}>الصور والتطور لكل تمرين</T>
        </Pressable>
        <Pressable onPress={chooseProgram} style={tileStyle}>
          <Icon name="sparkles" color={colors.warning} size={26} />
          <T bold>برنامج جاهز</T>
          <T muted size={11}>{planEmpty ? 'ابدأ بسرعة' : 'استبدل الجدول'}</T>
        </Pressable>
      </Row>

      <Card title="الجدول الأسبوعي" icon="calendar" iconColor={colors.accent}>
        {days.map((d) => (
          <Pressable
            key={d.weekday}
            onPress={() => router.push({ pathname: '/plan/[weekday]', params: { weekday: String(d.weekday) } })}
            style={{
              padding: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: d.weekday === todayWd ? colors.primaryDim : colors.surface2,
              marginBottom: 6,
            }}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T bold>{weekdayNameAr(d.weekday)}</T>
                <T muted size={12}>
                  {d.count ? `${d.title || 'تمرين'} · ${d.count} تمارين` : 'راحة'}
                </T>
              </View>
              <Row gap={4}>
                {d.muscles.slice(0, 4).map((m) => (
                  <Icon key={m} name={muscleStyle(m).icon} color={muscleStyle(m).color} size={18} />
                ))}
                <Icon name="chevron.left" size={12} color={colors.textMuted} />
              </Row>
            </Row>
          </Pressable>
        ))}
      </Card>

      <Card title="السجل" icon="clock.arrow.circlepath" iconColor={colors.textMuted}>
        {sessions.length ? (
          sessions.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(s.id) } })}
              style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <T>{s.title}</T>
                <T muted size={12}>
                  {formatDateAr(s.date)}
                </T>
              </Row>
              <T muted size={12}>
                {s.set_count} مجموعة · الحجم {fmt(s.volume)} كغ{s.finished_at ? '' : ' · غير مكتمل'}
              </T>
            </Pressable>
          ))
        ) : (
          <Empty text="لا توجد جلسات بعد." />
        )}
      </Card>

      {prs.length > 0 && (
        <Card title="أفضل الأرقام" icon="trophy.fill" iconColor={colors.warning} right={<T muted size={11}>أقصى وزن لتكرار واحد (تقديري)</T>}>
          {prs.map((p) => (
            <Row key={p.name} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <T>{p.name}</T>
              <T muted size={13}>
                {fmt(p.best_1rm, 1)} كغ · أعلى وزن {fmt(p.best_weight, 1)}
              </T>
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const tileStyle = {
  flex: 1,
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
  gap: 4,
} as const;
