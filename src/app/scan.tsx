import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Banner, Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { Icon } from '@/components/visuals';
import { lookupBarcode, normalizeBarcode } from '@/services/food/barcode';
import { colors, radius, spacing } from '@/theme/colors';
import { toDateKey } from '@/utils/date';

type Phase = { kind: 'scan' } | { kind: 'loading' } | { kind: 'missing'; code: string; message: string };

/** Scan → found: open the amount screen. Not found: offer to enter the label once. */
export default function ScanScreen() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = params.date || toDateKey();
  const meal = params.meal || 'snack';
  const db = useSQLiteContext();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: 'scan' });
  const [torch, setTorch] = useState(false);
  const [typed, setTyped] = useState('');
  const busy = useRef(false);

  // Coming back to this screen re-arms the scanner.
  useFocusEffect(
    useCallback(() => {
      busy.current = false;
      setPhase({ kind: 'scan' });
    }, []),
  );

  async function lookup(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code) {
      setPhase({ kind: 'missing', code: raw.replace(/\D/g, ''), message: 'رقم الباركود غير صحيح. تأكد منه وحاول مرة أخرى.' });
      return;
    }
    setPhase({ kind: 'loading' });
    const r = await lookupBarcode(db, code);
    if (r.status === 'found') {
      router.push({ pathname: '/food/[id]', params: { id: String(r.food.id), date, meal } });
    } else if (r.status === 'not-found') {
      setPhase({ kind: 'missing', code, message: 'المنتج غير موجود في قاعدة البيانات. أدخل القيم من الملصق مرة واحدة وسيُحفظ لك.' });
    } else {
      setPhase({ kind: 'missing', code, message: `${r.message}. يمكنك إدخال القيم من الملصق.` });
    }
  }

  function onScanned(e: BarcodeScanningResult) {
    if (busy.current) return;
    busy.current = true;
    Vibration.vibrate();
    lookup(e.data);
  }

  if (!permission) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      {permission.granted ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={phase.kind === 'scan' ? onScanned : undefined}
          />
          <View pointerEvents="none" style={styles.overlay}>
            <View style={styles.frame} />
            <T size={13} center color="#fff" style={{ marginTop: spacing.md }}>
              {phase.kind === 'loading' ? 'جارٍ البحث…' : 'وجّه الكاميرا نحو الباركود'}
            </T>
          </View>
          {phase.kind === 'loading' && (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
          <Pressable onPress={() => setTorch((t) => !t)} style={styles.torch} hitSlop={8}>
            <Icon name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} color="#fff" size={20} />
          </Pressable>
        </View>
      ) : (
        <Card title="الكاميرا" icon="camera.fill">
          <T muted style={{ marginBottom: spacing.md }}>
            نحتاج إذن الكاميرا لمسح الباركود. الصور لا تُحفظ ولا تُرسل.
          </T>
          {permission.canAskAgain || Platform.OS === 'web' ? (
            <Button title="السماح بالكاميرا" icon="camera.fill" onPress={requestPermission} />
          ) : (
            <Button title="فتح الإعدادات" variant="secondary" onPress={() => Linking.openSettings()} />
          )}
        </Card>
      )}

      {phase.kind === 'missing' && (
        <>
          <Banner tone="warning" text={phase.message} />
          <Button
            title="إدخال القيم من الملصق"
            icon="pencil"
            onPress={() => router.push({ pathname: '/food/edit', params: { barcode: phase.code, date, meal } })}
          />
          <Button
            title="مسح مرة أخرى"
            icon="barcode.viewfinder"
            variant="secondary"
            onPress={() => {
              busy.current = false;
              setPhase({ kind: 'scan' });
            }}
          />
        </>
      )}

      <Card title="أو اكتب رقم الباركود" icon="barcode">
        <Row gap={spacing.sm}>
          <Field value={typed} onChangeText={setTyped} keyboardType="number-pad" placeholder="مثال: 6281007030258" />
          <Button
            title="بحث"
            disabled={typed.replace(/\D/g, '').length < 8 || phase.kind === 'loading'}
            onPress={() => {
              Keyboard.dismiss();
              busy.current = true;
              lookup(typed);
            }}
          />
        </Row>
      </Card>

      <T muted size={11} center>
        يُرسل رقم الباركود فقط إلى قاعدة Open Food Facts المفتوحة. لا تُرسل أي بيانات صحية أو شخصية.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraBox: { height: 340, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  frame: { width: '78%', height: 140, borderRadius: radius.md, borderWidth: 3, borderColor: colors.primary },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  torch: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
