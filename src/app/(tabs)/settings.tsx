import { useState } from 'react';
import { Platform, Switch, View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Field, H1, Row, Screen, T } from '@/components/ui';
import { ProfileForm } from '@/components/ProfileForm';
import { useAppData } from '@/hooks/AppData';
import { exportCsv, exportDatabaseFile, exportJsonBackup, importJsonBackup, type CsvKind } from '@/services/backup';
import { DEFAULT_FAT_PER_KG, DEFAULT_PROTEIN_PER_KG, macroCalories } from '@/services/nutrition/macros';
import type { Profile } from '@/services/nutrition/types';
import { colors, spacing } from '@/theme/colors';
import { fmt, parseNumber } from '@/utils/number';

export default function Settings() {
  const db = useSQLiteContext();
  const { profile, updateProfile, energy, targets, refresh, bumpData } = useAppData();
  const [busy, setBusy] = useState<string | null>(null);

  if (!profile) return null;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      appAlert('خطأ', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <H1 subtitle="الملف والحساب والنسخ الاحتياطي">الإعدادات</H1>

      <ProfileForm
        key={JSON.stringify([profile.weightKg, profile.goal, profile.heightCm, profile.birthYear, profile.sex])}
        initial={profile}
        submitLabel="حفظ الملف الشخصي"
        onSubmit={async (p) => {
          await updateProfile(p);
          appAlert('تم الحفظ');
        }}
      />

      <MacroSettings profile={profile} onSave={updateProfile} />

      <ManualOverrides profile={profile} onSave={updateProfile} suggested={targets?.calories ?? null} bmr={energy?.bmr ?? null} />

      <Card title="النسخ الاحتياطي والتصدير" icon="square.and.arrow.up" iconColor={colors.accent}>
        <View style={{ gap: spacing.sm }}>
          <Button title="نسخة احتياطية كاملة (JSON)" loading={busy === 'json'} onPress={() => run('json', () => exportJsonBackup(db))} />
          {Platform.OS !== 'web' && (
            <Button title="ملف قاعدة البيانات (.db)" variant="secondary" loading={busy === 'db'} onPress={() => run('db', () => exportDatabaseFile(db))} />
          )}
          <Row style={{ flexWrap: 'wrap' }}>
            {(
              [
                ['food', 'CSV التغذية'],
                ['weights', 'CSV الأوزان'],
                ['workouts', 'CSV التمارين'],
                ['daily', 'CSV السجل اليومي'],
              ] as [CsvKind, string][]
            ).map(([k, label]) => (
              <Button key={k} title={label} small variant="ghost" loading={busy === k} onPress={() => run(k, () => exportCsv(db, k))} />
            ))}
          </Row>
          <Button
            title="استعادة من نسخة احتياطية"
            variant="danger"
            loading={busy === 'import'}
            onPress={() =>
              appAlert('استعادة', 'سيتم استبدال جميع البيانات الحالية بمحتوى النسخة الاحتياطية. يُنصح بأخذ نسخة أولًا.', [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'متابعة',
                  style: 'destructive',
                  onPress: () =>
                    run('import', async () => {
                      const n = await importJsonBackup(db);
                      if (n == null) return;
                      await refresh();
                      bumpData();
                      appAlert('تمت الاستعادة', `تمت استعادة ${n} سجل.`);
                    }),
                },
              ])
            }
          />
          <T muted size={12}>
            الملفات تُنشأ على جهازك وتُفتح في قائمة المشاركة لتحفظها في تطبيق الملفات أو iCloud بنفسك. التطبيق لا يرفع أي بيانات صحية لأي خادم.
          </T>
        </View>
      </Card>
    </Screen>
  );
}

function MacroSettings({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => Promise<void> }) {
  const [protein, setProtein] = useState(profile.proteinPerKg != null ? String(profile.proteinPerKg) : '');
  const [fat, setFat] = useState(profile.fatPerKg != null ? String(profile.fatPerKg) : '');

  async function save() {
    const p = protein.trim() ? parseNumber(protein) : null;
    const f = fat.trim() ? parseNumber(fat) : null;
    if (p != null && (p < 1 || p > 3.5)) return appAlert('البروتين بين 1 و3.5 غ/كغ');
    if (f != null && (f < 0.4 || f > 2)) return appAlert('الدهون بين 0.4 و2 غ/كغ');
    await onSave({ ...profile, proteinPerKg: p, fatPerKg: f, calorieMode: 'projected', activeCalibration: 1 });
    appAlert('تم الحفظ');
  }

  return (
    <Card title="توزيع الماكروز" icon="chart.bar.fill" iconColor={colors.protein}>
      <Row gap={spacing.md}>
        <Field
          label={`بروتين غ/كغ (افتراضي ${DEFAULT_PROTEIN_PER_KG[profile.goal]})`}
          value={protein}
          onChangeText={setProtein}
          keyboardType="decimal-pad"
          placeholder="تلقائي"
        />
        <Field
          label={`دهون غ/كغ (افتراضي ${DEFAULT_FAT_PER_KG})`}
          value={fat}
          onChangeText={setFat}
          keyboardType="decimal-pad"
          placeholder="تلقائي"
        />
      </Row>
      <T muted size={12} style={{ marginTop: spacing.sm }}>
        الكربوهيدرات تأخذ باقي السعرات تلقائيًا. اترك الخانة فارغة للقيمة الافتراضية حسب هدفك.
      </T>
      <Button title="حفظ" variant="secondary" onPress={save} style={{ marginTop: spacing.sm }} />
    </Card>
  );
}

function ManualOverrides({
  profile,
  onSave,
  suggested,
  bmr,
}: {
  profile: Profile;
  onSave: (p: Profile) => Promise<void>;
  suggested: number | null;
  bmr: number | null;
}) {
  const [calOn, setCalOn] = useState(profile.manualCalories != null);
  const [cal, setCal] = useState(profile.manualCalories != null ? String(profile.manualCalories) : '');
  const [macroOn, setMacroOn] = useState(profile.manualMacros != null);
  const [p, setP] = useState(String(profile.manualMacros?.protein ?? ''));
  const [c, setC] = useState(String(profile.manualMacros?.carbs ?? ''));
  const [f, setF] = useState(String(profile.manualMacros?.fat ?? ''));

  function toggleCalories(on: boolean) {
    setCalOn(on);
    // Prefill with the current computed target as a starting point.
    if (on && !cal && suggested) setCal(String(suggested));
  }

  const macroKcal = macroCalories({ protein: parseNumber(p) ?? 0, carbs: parseNumber(c) ?? 0, fat: parseNumber(f) ?? 0 });

  async function save() {
    let manualCalories: number | null = null;
    let manualMacros: Profile['manualMacros'] = null;
    if (calOn) {
      const v = parseNumber(cal);
      if (v == null || v < 800 || v > 7000) return appAlert('السعرات بين 800 و7000');
      manualCalories = Math.round(v);
      if (bmr && v < bmr * 0.8) appAlert('تنبيه', 'السعرات أقل كثيرًا من معدل الأيض الأساسي.');
    }
    if (macroOn) {
      const pv = parseNumber(p);
      const cv = parseNumber(c);
      const fv = parseNumber(f);
      if ([pv, cv, fv].some((x) => x == null || x < 0 || x > 1000)) return appAlert('أدخل الماكروز بالغرام');
      manualMacros = { protein: Math.round(pv!), carbs: Math.round(cv!), fat: Math.round(fv!) };
    }
    await onSave({ ...profile, manualCalories, manualMacros });
    appAlert('تم الحفظ');
  }

  return (
    <Card title="تعديل يدوي" icon="pencil" iconColor={colors.accent}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T>سعرات يدوية</T>
        <Switch value={calOn} onValueChange={toggleCalories} trackColor={{ true: colors.primary }} />
      </Row>
      {calOn && <Field suffix="سعرة" value={cal} onChangeText={setCal} keyboardType="number-pad" style={{ marginTop: 6 }} />}
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
        <T>ماكروز يدوية</T>
        <Switch value={macroOn} onValueChange={setMacroOn} trackColor={{ true: colors.primary }} />
      </Row>
      {macroOn && (
        <>
          <Row style={{ marginTop: 6 }}>
            <Field label="بروتين" suffix="غ" value={p} onChangeText={setP} keyboardType="number-pad" />
            <Field label="كارب" suffix="غ" value={c} onChangeText={setC} keyboardType="number-pad" />
            <Field label="دهون" suffix="غ" value={f} onChangeText={setF} keyboardType="number-pad" />
          </Row>
          <T muted size={12} style={{ marginTop: 6 }}>
            = {fmt(macroKcal)} سعرة (الماكروز اليدوية تحدد السعرات)
          </T>
        </>
      )}
      <Button title="حفظ" variant="secondary" onPress={save} style={{ marginTop: spacing.md }} />
    </Card>
  );
}
