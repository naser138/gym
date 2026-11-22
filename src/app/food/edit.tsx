import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { appAlert } from '@/utils/alert';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { goBack, closeFlow } from '@/utils/nav';
import { useSQLiteContext } from 'expo-sqlite';

import { Banner, Button, Card, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { useAppData } from '@/hooks/AppData';
import { normalizeBarcode } from '@/services/food/barcode';
import {
  createFood,
  getFood,
  per100FromServing,
  removeFood,
  updateFood,
  validatePer100,
  type Food,
  type PerUnit,
} from '@/services/food/foods';
import { colors, spacing } from '@/theme/colors';
import { parseNumber } from '@/utils/number';

type Basis = '100' | 'serving';

/**
 * Create or edit a food. Values can be typed exactly as printed on the label,
 * either "per 100 g/ml" or "per serving" – serving values are converted to per 100.
 */
export default function EditFood() {
  const params = useLocalSearchParams<{ id?: string; barcode?: string; date?: string; meal?: string; reason?: string }>();
  const id = params.id ? Number(params.id) : null;
  const db = useSQLiteContext();
  const router = useRouter();
  const { bumpData } = useAppData();

  const [orig, setOrig] = useState<Food | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [unit, setUnit] = useState<PerUnit>('g');
  const [basis, setBasis] = useState<Basis>('100');
  const [servingSize, setServingSize] = useState('');
  const [servingName, setServingName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getFood(db, id).then((x) => {
      if (!alive || !x) return;
      setOrig(x);
      setName(x.name);
      setBrand(x.brand);
      setBarcode(x.barcode ?? '');
      setUnit(x.per_unit);
      setServingSize(x.serving_size ? String(x.serving_size) : '');
      setServingName(x.serving_name ?? '');
      setKcal(String(x.kcal_100));
      setP(String(x.protein_100));
      setC(String(x.carbs_100));
      setF(String(x.fat_100));
    });
    return () => {
      alive = false;
    };
  }, [db, id]);

  const u = unit === 'ml' ? 'مل' : 'غ';

  async function save() {
    setError('');
    const ss = parseNumber(servingSize);
    const pv = parseNumber(p) ?? 0;
    const cv = parseNumber(c) ?? 0;
    const fv = parseNumber(f) ?? 0;
    const kv = parseNumber(kcal) ?? Math.round(pv * 4 + cv * 4 + fv * 9);
    if (!name.trim()) return setError('أدخل اسم الطعام.');
    if (basis === 'serving' && !(ss && ss > 0)) return setError(`أدخل حجم الحصة بال${unit === 'ml' ? 'مليلتر' : 'غرام'}.`);
    if (ss != null && (ss <= 0 || ss > 3000)) return setError('حجم الحصة غير منطقي.');
    const per100 = basis === 'serving' ? per100FromServing({ calories: kv, protein: pv, carbs: cv, fat: fv }, ss!) : { calories: kv, protein: pv, carbs: cv, fat: fv };
    const invalid = validatePer100(per100);
    if (invalid) return setError(invalid + (basis === 'serving' ? ' (بعد التحويل إلى لكل 100)' : ''));
    let bc: string | null = null;
    if (barcode.trim()) {
      bc = normalizeBarcode(barcode);
      if (!bc) return setError('رقم الباركود غير صحيح. اتركه فارغًا إن لم يكن لديك.');
    }

    const input = {
      name: name.trim(),
      brand: brand.trim(),
      barcode: bc,
      kcal_100: per100.calories,
      protein_100: per100.protein,
      carbs_100: per100.carbs,
      fat_100: per100.fat,
      per_unit: unit,
      serving_size: ss && ss > 0 ? ss : null,
      serving_name: ss && ss > 0 ? servingName.trim() || 'حصة' : null,
      source: 'user' as const,
    };
    try {
      let foodId = id;
      if (id) await updateFood(db, id, input);
      else foodId = await createFood(db, input);
      bumpData();
      if (!id && params.date) {
        // Came from the add-food flow: continue to choose the amount.
        router.replace({ pathname: '/food/[id]', params: { id: String(foodId), date: params.date, meal: params.meal ?? 'snack' } });
      } else {
        goBack(router);
      }
    } catch (e) {
      const msg = e instanceof Error && /UNIQUE/i.test(e.message) ? 'هذا الباركود مستخدم لطعام آخر.' : 'تعذّر الحفظ.';
      setError(msg);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'تعديل الطعام' : 'طعام جديد' }} />
      {params.reason ? <Banner tone="warning" text={params.reason} /> : null}

      <Card title="المعلومات" icon="fork.knife">
        <View style={{ gap: spacing.md }}>
          <Field label="اسم الطعام" value={name} onChangeText={setName} placeholder="مثال: لبن المراعي قليل الدسم" />
          <Row gap={spacing.md}>
            <Field label="الماركة (اختياري)" value={brand} onChangeText={setBrand} />
            <Field label="الباركود (اختياري)" value={barcode} onChangeText={setBarcode} keyboardType="number-pad" />
          </Row>
          <Segmented
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'g', label: 'صلب (غرام)' },
              { value: 'ml', label: 'سائل (مليلتر)' },
            ]}
          />
        </View>
      </Card>

      <Card title="الحصة (اختياري)" icon="scalemass.fill" iconColor={colors.accent}>
        <Row gap={spacing.md}>
          <Field label={`حجم الحصة (${u})`} value={servingSize} onChangeText={setServingSize} keyboardType="decimal-pad" suffix={u} />
          <Field label="اسم الحصة" value={servingName} onChangeText={setServingName} placeholder="حبة، كوب، سكوب…" />
        </Row>
        <T muted size={12} style={{ marginTop: spacing.sm }}>
          مثال: بيضة = 50 غ، سكوب بروتين = 30 غ، كوب حليب = 250 مل. يسمح لك بالتسجيل بعدد الحصص.
        </T>
      </Card>

      <Card title="القيم الغذائية" icon="chart.bar.fill" iconColor={colors.protein}>
        <Segmented
          value={basis}
          onChange={setBasis}
          options={[
            { value: '100', label: `لكل 100 ${u}` },
            { value: 'serving', label: 'لكل حصة' },
          ]}
        />
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <Row gap={spacing.md}>
            <Field label="السعرات" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" placeholder="تلقائي" />
            <Field label="بروتين" suffix="غ" value={p} onChangeText={setP} keyboardType="decimal-pad" />
          </Row>
          <Row gap={spacing.md}>
            <Field label="كربوهيدرات" suffix="غ" value={c} onChangeText={setC} keyboardType="decimal-pad" />
            <Field label="دهون" suffix="غ" value={f} onChangeText={setF} keyboardType="decimal-pad" />
          </Row>
          <T muted size={12}>
            انسخ الأرقام من جدول «القيم الغذائية» على العبوة. اترك السعرات فارغة لتُحسب من الماكروز.
          </T>
        </View>
      </Card>

      {error ? <Banner tone="danger" text={error} /> : null}
      <Button title={id ? 'حفظ' : 'حفظ ومتابعة'} icon="checkmark.circle.fill" onPress={save} />

      {orig ? (
        <Button
          title="حذف من قائمة الأطعمة"
          icon="trash"
          variant="danger"
          onPress={() =>
            appAlert('حذف الطعام', 'سيُحذف من قائمتك. السجلات السابقة تبقى كما هي.', [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'حذف',
                style: 'destructive',
                onPress: async () => {
                  await removeFood(db, orig.id);
                  bumpData();
                  closeFlow(router);
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
