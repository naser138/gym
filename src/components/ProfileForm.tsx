import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { appAlert } from '@/utils/alert';

import { Button, Card, Field, Row, Segmented, T } from './ui';
import { Icon } from './visuals';
import { ACTIVITY_LABELS_AR } from '@/services/nutrition/calories';
import { GOAL_LABELS_AR } from '@/services/nutrition/macros';
import type { ActivityLevel, Goal, Profile, Sex } from '@/services/nutrition/types';
import { colors, radius, spacing } from '@/theme/colors';
import { parseNumber } from '@/utils/number';

const ACTIVITY_ORDER: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

/** Body + goal fields. Manual calorie/macro overrides live in the settings screen. */
export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: Profile;
  submitLabel: string;
  onSubmit: (p: Profile) => Promise<void> | void;
}) {
  const [sex, setSex] = useState<Sex>(initial.sex);
  const [birthYear, setBirthYear] = useState(String(initial.birthYear));
  const [height, setHeight] = useState(String(initial.heightCm));
  const [weight, setWeight] = useState(String(initial.weightKg));
  const [activity, setActivity] = useState<ActivityLevel>(initial.activityLevel);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [cutPct, setCutPct] = useState(String(initial.cutPercent));
  const [bulkPct, setBulkPct] = useState(String(initial.bulkPercent));
  const [saving, setSaving] = useState(false);

  async function submit() {
    const by = parseNumber(birthYear);
    const h = parseNumber(height);
    const w = parseNumber(weight);
    const cp = parseNumber(cutPct);
    const bp = parseNumber(bulkPct);
    const year = new Date().getFullYear();
    const errors: string[] = [];
    if (by == null || by < year - 100 || by > year - 12) errors.push('سنة الميلاد غير صحيحة');
    if (h == null || h < 120 || h > 230) errors.push('الطول يجب أن يكون بين 120 و230 سم');
    if (w == null || w < 30 || w > 300) errors.push('الوزن يجب أن يكون بين 30 و300 كغ');
    if (cp == null || cp < 5 || cp > 30) errors.push('نسبة العجز بين 5% و30%');
    if (bp == null || bp < 3 || bp > 25) errors.push('نسبة الفائض بين 3% و25%');
    if (errors.length) {
      appAlert('تحقق من البيانات', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...initial,
        sex,
        birthYear: Math.round(by!),
        heightCm: h!,
        weightKg: w!,
        activityLevel: activity,
        goal,
        cutPercent: cp!,
        bulkPercent: bp!,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card title="بياناتك" icon="person.fill" iconColor={colors.accent}>
        <Segmented
          value={sex}
          onChange={setSex}
          options={[
            { value: 'male', label: 'ذكر' },
            { value: 'female', label: 'أنثى' },
          ]}
        />
        <Row style={{ marginTop: spacing.md }}>
          <Field label="سنة الميلاد" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" />
          <Field label="الطول" suffix="سم" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          <Field label="الوزن" suffix="كغ" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        </Row>
      </Card>

      <Card title="مستوى النشاط" icon="figure.walk" iconColor={colors.warning}>
        <T muted size={12} style={{ marginBottom: spacing.sm }}>
          يحدد احتياجك اليومي مع الوزن والطول والعمر. اختر الأقرب لأسبوعك المعتاد شاملًا التمارين.
        </T>
        {ACTIVITY_ORDER.map((a) => (
          <Pressable
            key={a}
            onPress={() => setActivity(a)}
            style={{
              padding: spacing.md,
              borderRadius: radius.sm,
              marginBottom: 6,
              backgroundColor: activity === a ? colors.primaryDim : colors.surface2,
              borderWidth: 1.5,
              borderColor: activity === a ? colors.primary : 'transparent',
            }}
          >
            <Row between>
              <T weight={activity === a ? 'semibold' : 'regular'}>{ACTIVITY_LABELS_AR[a]}</T>
              {activity === a ? <Icon name="checkmark.circle.fill" color={colors.primary} size={18} /> : null}
            </Row>
          </Pressable>
        ))}
      </Card>

      <Card title="الهدف" icon="target">
        <Segmented
          value={goal}
          onChange={setGoal}
          options={(['cut', 'maintain', 'bulk'] as Goal[]).map((g) => ({ value: g, label: GOAL_LABELS_AR[g] }))}
        />
        <Row style={{ marginTop: spacing.md }}>
          <Field label="عجز التنشيف" suffix="%" value={cutPct} onChangeText={setCutPct} keyboardType="decimal-pad" />
          <Field label="فائض التضخيم" suffix="%" value={bulkPct} onChangeText={setBulkPct} keyboardType="decimal-pad" />
        </Row>
        <T muted size={12} style={{ marginTop: 6 }}>
          التنشيف: بروتين 2.2 غ/كغ · التثبيت والتضخيم: 1.8 غ/كغ (قابل للتعديل من الإعدادات).
        </T>
      </Card>

      <Button title={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}
