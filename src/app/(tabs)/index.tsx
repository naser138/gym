import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';

import { Card, Divider, H1, KV, Row, Screen, T } from '@/components/ui';
import { Chip, Icon, Ring } from '@/components/visuals';
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard';
import { DateStrip } from '@/components/DateStrip';
import { useAppData } from '@/hooks/AppData';
import { getFoodTotals, type DayTotals } from '@/db/repo';
import { ACTIVITY_LABELS_AR, ACTIVITY_MULTIPLIERS } from '@/services/nutrition/calories';
import { GOAL_LABELS_AR, goalAdjustmentPercent } from '@/services/nutrition/macros';
import { colors, radius, spacing } from '@/theme/colors';
import { formatDateAr, relativeDayAr, toDateKey } from '@/utils/date';
import { fmt } from '@/utils/number';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مساء الخير';
  return 'مساء النور';
}

export default function Dashboard() {
  const db = useSQLiteContext();
  const { profile, energy, targets, refresh, refreshing, dataVersion, selectedDate } = useAppData();
  const [eaten, setEaten] = useState<DayTotals | null>(null);
  const dateKey = selectedDate;
  const isToday = dateKey === toDateKey();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getFoodTotals(db, dateKey).then((t) => alive && setEaten(t));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion reloads after edits on other screens
    }, [db, dateKey, dataVersion]),
  );

  if (!profile || !energy || !targets) {
    return (
      <Screen>
        <T muted>جارٍ التحميل…</T>
      </Screen>
    );
  }

  const consumed = eaten?.calories ?? 0;
  const remaining = targets.calories - consumed;
  const goalColor = profile.goal === 'cut' ? colors.accent : profile.goal === 'bulk' ? colors.warning : colors.primary;
  const adjPct = goalAdjustmentPercent(profile);

  const macros = [
    { label: 'بروتين', val: eaten?.protein ?? 0, max: targets.macros.protein, color: colors.protein },
    { label: 'كربوهيدرات', val: eaten?.carbs ?? 0, max: targets.macros.carbs, color: colors.carbs },
    { label: 'دهون', val: eaten?.fat ?? 0, max: targets.macros.fat, color: colors.fat },
  ];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <Row between>
        <H1 subtitle={formatDateAr(toDateKey())}>{greeting()}</H1>
        <Chip text={`الهدف: ${GOAL_LABELS_AR[profile.goal]}`} color={goalColor} />
      </Row>

      <DateStrip />

      {/* Hero: calories */}
      <LinearGradient
        colors={['#173B2E', '#11171F']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#1E4636' }}
      >
        <Row between style={{ marginBottom: spacing.md }}>
          <T weight="semibold" size={16}>
            {isToday ? 'سعرات اليوم' : `سعرات ${relativeDayAr(dateKey)}`}
          </T>
          <T muted size={12}>
            {!isToday ? 'مقارنة بهدفك الحالي' : targets.isManualCalories ? 'هدف يدوي' : 'محسوب من ملفك'}
          </T>
        </Row>
        <Row gap={spacing.lg}>
          <Ring value={consumed} max={targets.calories} size={148} stroke={14}>
            <T weight="bold" size={30} center color={remaining >= 0 ? colors.text : colors.danger} style={{ lineHeight: 38 }}>
              {fmt(Math.abs(remaining))}
            </T>
            <T muted size={12} center>
              {remaining >= 0 ? 'سعرة متبقية' : 'سعرة زيادة'}
            </T>
          </Ring>
          <View style={{ flex: 1, gap: spacing.md }}>
            {[
              { icon: 'target' as const, color: colors.primary, label: 'الهدف', value: fmt(targets.calories) },
              { icon: 'fork.knife' as const, color: colors.accent, label: 'المأكول', value: fmt(consumed) },
              { icon: 'flame.fill' as const, color: colors.warning, label: 'احتياج الثبات', value: fmt(targets.maintenance) },
            ].map((s) => (
              <Row key={s.label} gap={spacing.sm}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: s.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={s.icon} color={s.color} size={17} />
                </View>
                <View>
                  <T muted size={11}>
                    {s.label}
                  </T>
                  <T weight="bold" size={17} style={{ lineHeight: 22 }}>
                    {s.value}
                  </T>
                </View>
              </Row>
            ))}
          </View>
        </Row>
        {targets.warnings.map((w) => (
          <T key={w} size={12} color={colors.warning} style={{ marginTop: spacing.sm }}>
            {w}
          </T>
        ))}
      </LinearGradient>

      <TodayWorkoutCard date={dateKey} showTargets={false} showWeek={false} />

      {/* Macros */}
      <Card title="الماكروز" icon="chart.bar.fill" iconColor={colors.protein}>
        <Row between>
          {macros.map((m) => (
            <View key={m.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Ring value={m.val} max={m.max} size={82} stroke={8} color={m.color}>
                <T weight="bold" size={16} center style={{ lineHeight: 20 }}>
                  {fmt(m.val)}
                </T>
                <T muted size={10} center style={{ lineHeight: 14 }}>
                  من {fmt(m.max)}غ
                </T>
              </Ring>
              <T size={13} weight="medium" color={m.color} center>
                {m.label}
              </T>
            </View>
          ))}
        </Row>
      </Card>

      {/* How the target is built */}
      <Card title="كيف حُسب هدفك" icon="flame.fill" iconColor={colors.warning}>
        <KV label="معدل الأيض الأساسي (Mifflin–St Jeor)" value={`${fmt(energy.bmr)} سعرة`} />
        <KV label={`× معامل النشاط (${ACTIVITY_LABELS_AR[profile.activityLevel].split(' (')[0]})`} value={`× ${ACTIVITY_MULTIPLIERS[profile.activityLevel]}`} />
        <KV label="= احتياج الثبات" value={`${fmt(targets.maintenance)} سعرة`} />
        <Divider />
        <KV
          label={`تعديل الهدف (${GOAL_LABELS_AR[profile.goal]})`}
          value={targets.isManualCalories ? 'يدوي' : `${adjPct > 0 ? '+' : ''}${adjPct}%`}
          color={goalColor}
        />
        <KV label="= هدفك اليومي" value={`${fmt(targets.calories)} سعرة`} color={colors.primary} />
        <T muted size={12} style={{ marginTop: spacing.sm }}>
          معامل النشاط يشمل تمارينك، لذلك لا تُضاف سعرات التمرين مرة ثانية. عدّل مستوى النشاط من الإعدادات إذا تغيّر أسبوعك.
        </T>
      </Card>
    </Screen>
  );
}
