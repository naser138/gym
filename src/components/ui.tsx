/**
 * Design system. Everything is laid out right→left explicitly (see theme `rtl`), uses
 * IBM Plex Sans Arabic, and keeps one visual language: dark surfaces, 20px cards,
 * emerald primary.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { sym, type SFSymbolName } from './symbols';
import { colors, fonts, radius, rtl, spacing } from '@/theme/colors';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

// ---------------------------------------------------------------- Text
export function T({
  children,
  style,
  muted,
  size = 15,
  bold,
  weight,
  color,
  numberOfLines,
  center,
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  muted?: boolean;
  size?: number;
  bold?: boolean;
  weight?: Weight;
  color?: string;
  numberOfLines?: number;
  center?: boolean;
}) {
  const w: Weight = weight ?? (bold ? 'bold' : 'regular');
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: color ?? (muted ? colors.textMuted : colors.text),
          fontSize: size,
          fontFamily: fonts[w],
          // Arabic glyphs need extra line height or they get clipped.
          lineHeight: Math.round(size * 1.5),
          textAlign: center ? 'center' : rtl.textAlign,
        },
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

export function H1({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.xs }}>
      {subtitle ? (
        <T muted size={13} weight="medium">
          {subtitle}
        </T>
      ) : null}
      <T size={30} weight="bold" style={{ lineHeight: 42 }}>
        {children}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- Layout
export function Screen({
  children,
  refreshControl,
}: {
  children: React.ReactNode;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Row({
  children,
  style,
  gap = spacing.sm,
  between,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  gap?: number;
  between?: boolean;
}) {
  return <View style={[styles.row, { gap }, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  title,
  icon,
  iconColor = colors.primary,
  right,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  title?: string;
  icon?: SFSymbolName;
  iconColor?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <Row between style={{ marginBottom: spacing.md }}>
          <Row gap={spacing.sm} style={{ flexShrink: 1 }}>
            {icon ? (
              <View style={[styles.cardIcon, { backgroundColor: iconColor + '1F' }]}>
                <SymbolView name={sym(icon)} tintColor={iconColor} size={16} style={{ width: 16, height: 16 }} />
              </View>
            ) : null}
            {title ? (
              <T weight="semibold" size={16} style={{ flexShrink: 1 }}>
                {title}
              </T>
            ) : null}
          </Row>
          {right}
        </Row>
      )}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Controls
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
  icon?: SFSymbolName;
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger + '22' : variant === 'secondary' ? colors.surface3 : 'transparent';
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.surface3 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={6}>
          {icon ? <SymbolView name={sym(icon)} tintColor={fg} size={small ? 13 : 16} style={{ width: small ? 13 : 16, height: small ? 13 : 16 }} /> : null}
          <T weight="semibold" color={fg} size={small ? 13 : 15} center>
            {title}
          </T>
        </Row>
      )}
    </Pressable>
  );
}

/**
 * Text field. Deliberately NO inputAccessoryViewID and NO writingDirection: on iOS
 * (Fabric) both made typed digits invisible until the keyboard closed.
 */
export function Field({
  label,
  suffix,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string; suffix?: string; style?: ViewStyle }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ flex: 1, minWidth: 64 }, style]}>
      {label ? (
        <T muted size={12} weight="medium" numberOfLines={1} style={{ marginBottom: 4 }}>
          {label}
        </T>
      ) : null}
      <View style={[styles.row, styles.input, focused && { borderColor: colors.primary, backgroundColor: colors.surface3 }]}>
        <TextInput
          placeholderTextColor={colors.textMuted + 'AA'}
          selectionColor={colors.primary}
          keyboardAppearance="dark"
          returnKeyType={props.multiline ? 'default' : 'done'}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.inputText,
            props.multiline && { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
          ]}
        />
        {suffix ? (
          <T muted size={12}>
            {suffix}
          </T>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Floating "تم" button shown just above the iOS keyboard (number pads have no return key).
 * Uses keyboard events instead of InputAccessoryView, which breaks text rendering with a tab bar.
 */
export function KeyboardDoneButton() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (!height) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <View style={{ flexDirection: rtl.row, paddingHorizontal: spacing.md, marginBottom: height + 8 }}>
        <Pressable onPress={Keyboard.dismiss} hitSlop={10} style={styles.donePill} accessibilityRole="button">
          <SymbolView name={sym('keyboard.chevron.compact.down')} tintColor={colors.onPrimary} size={14} style={{ width: 18, height: 14 }} />
          <T weight="bold" size={14} color={colors.onPrimary}>
            تم
          </T>
        </Pressable>
      </View>
    </View>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <View style={[styles.row, styles.segment]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, active && styles.segmentActive]}>
            <T size={13} weight={active ? 'bold' : 'medium'} color={active ? colors.onPrimary : colors.textMuted} center numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Data display
export function ProgressBar({ value, max, color = colors.primary, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <View style={[styles.barTrack, { height, alignItems: rtl.alignStart }]}>
      <View style={{ height: '100%', borderRadius: height / 2, width: `${pct * 100}%`, backgroundColor: over ? colors.danger : color }} />
    </View>
  );
}

export function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T size={22} weight="bold" color={color} center>
        {value}
      </T>
      <T muted size={12} center>
        {unit ? `${label} (${unit})` : label}
      </T>
    </View>
  );
}

export function Banner({
  text,
  tone = 'info',
  action,
}: {
  text: string;
  tone?: 'info' | 'warning' | 'danger';
  action?: React.ReactNode;
}) {
  const c = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.accent;
  const icon: SFSymbolName = tone === 'info' ? 'info.circle.fill' : 'exclamationmark.triangle.fill';
  return (
    <View style={[styles.banner, { backgroundColor: c + '14', borderColor: c + '40' }]}>
      <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
        <SymbolView name={sym(icon)} tintColor={c} size={18} style={{ width: 18, height: 18, marginTop: 2 }} />
        <T size={13} color={colors.text} style={{ flex: 1 }}>
          {text}
        </T>
      </Row>
      {action ? <View style={{ marginTop: spacing.sm, alignItems: rtl.alignStart }}>{action}</View> : null}
    </View>
  );
}

export function Empty({ text, icon = 'tray' }: { text: string; icon?: SFSymbolName }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
      <SymbolView name={sym(icon)} tintColor={colors.textMuted} size={28} style={{ width: 28, height: 28 }} />
      <T muted center>
        {text}
      </T>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

/** Label / value line used in detail lists. */
export function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Row between style={{ paddingVertical: 4 }}>
      <T muted size={13}>
        {label}
      </T>
      <T size={13} weight="semibold" color={color}>
        {value}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // On wide (desktop) browsers keep a phone-like column centered.
  scrollContent: { padding: spacing.lg, paddingBottom: 64, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { flexDirection: rtl.row, alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.sm },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  inputText: {
    flex: 1,
    // Browsers give <input> an intrinsic width; without this it overflows narrow fields.
    minWidth: 0,
    width: '100%',
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.medium,
    paddingVertical: 10,
    textAlign: rtl.textAlign === 'right' ? 'right' : undefined,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  segment: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.primary },
  barTrack: { backgroundColor: colors.surface3, borderRadius: 999, overflow: 'hidden' },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
