import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Empty, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { Chip, Icon } from '@/components/visuals';
import { MEAL_LABELS_AR, type Meal } from '@/db/repo';
import { searchFoods, unitLabel, type Food } from '@/services/food/foods';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { toDateKey } from '@/utils/date';
import { fmt } from '@/utils/number';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function AddFood() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = params.date || toDateKey();
  const db = useSQLiteContext();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal>(MEALS.includes(params.meal as Meal) ? (params.meal as Meal) : 'snack');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Food[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      searchFoods(db, q).then((r) => alive && setResults(r));
      return () => {
        alive = false;
      };
    }, [db, q]),
  );

  const go = (pathname: '/scan' | '/food/edit' | '/food/quick') => router.push({ pathname, params: { date, meal } });

  return (
    <Screen>
      <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABELS_AR[m] }))} />

      <Field value={q} onChangeText={setQ} placeholder="ابحث عن طعام: دجاج، رز، بيض…" returnKeyType="search" autoCorrect={false} />

      <Row gap={spacing.sm}>
        {[
          { icon: 'barcode.viewfinder' as const, label: 'مسح الباركود', color: colors.primary, to: '/scan' as const },
          { icon: 'plus.circle.fill' as const, label: 'طعام جديد', color: colors.accent, to: '/food/edit' as const },
          { icon: 'bolt.fill' as const, label: 'سعرات سريعة', color: colors.warning, to: '/food/quick' as const },
        ].map((a) => (
          <Pressable key={a.label} onPress={() => go(a.to)} style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}>
            <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
              <Icon name={a.icon} color={a.color} size={20} />
            </View>
            <T size={12} weight="semibold" center>
              {a.label}
            </T>
          </Pressable>
        ))}
      </Row>

      <T muted size={12} weight="medium">
        {q.trim() ? 'النتائج' : 'الأخيرة والشائعة'}
      </T>

      <View style={styles.list}>
        {results.map((f, i) => (
          <Pressable
            key={f.id}
            onPress={() => router.push({ pathname: '/food/[id]', params: { id: String(f.id), date, meal } })}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.surface2 }]}
          >
            <View style={{ flex: 1 }}>
              <T weight="medium" numberOfLines={1}>
                {f.name}
              </T>
              <T muted size={12} numberOfLines={1}>
                {fmt(f.kcal_100)} سعرة / 100 {unitLabel(f.per_unit)}
                {f.serving_size ? ` · ${f.serving_name || 'حصة'} ${fmt(f.serving_size)} ${unitLabel(f.per_unit)}` : ''}
                {f.brand ? ` · ${f.brand}` : ''}
              </T>
            </View>
            {f.source === 'off' ? <Chip text="باركود" color={colors.primary} /> : f.source === 'user' ? <Chip text="طعامي" color={colors.accent} /> : null}
            <Icon name="chevron.left" size={12} color={colors.textMuted} />
          </Pressable>
        ))}
        {!results.length && <Empty icon="magnifyingglass" text="لا توجد نتائج. أضفه كطعام جديد أو امسح الباركود." />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: rtl.row, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
