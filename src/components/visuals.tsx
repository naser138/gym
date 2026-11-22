/**
 * Visual building blocks: exercise avatars (SF Symbols or user photo), calorie ring, line chart.
 */
import { Image, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { sym, type SFSymbolName } from './symbols';
import Svg, { Circle, Line, Polyline, Circle as Dot } from 'react-native-svg';

import { photoUri } from '@/services/photos';
import { colors, rtl } from '@/theme/colors';
import { T } from './ui';

type SymbolName = SFSymbolName;

export const MUSCLE_STYLE: Record<string, { icon: SymbolName; color: string }> = {
  صدر: { icon: 'figure.strengthtraining.traditional', color: '#FF7A90' },
  ظهر: { icon: 'figure.rower', color: '#4EA8FF' },
  أرجل: { icon: 'figure.strengthtraining.functional', color: '#3DDC97' },
  أكتاف: { icon: 'figure.arms.open', color: '#FFB547' },
  باي: { icon: 'dumbbell.fill', color: '#B48CFF' },
  تراي: { icon: 'dumbbell.fill', color: '#5ED6E8' },
  بطن: { icon: 'figure.core.training', color: '#FFC857' },
  كارديو: { icon: 'figure.run', color: '#FF8A4C' },
};
const DEFAULT_STYLE = { icon: 'figure.cross.training' as SymbolName, color: colors.textMuted };

export function muscleStyle(muscle: string | null | undefined) {
  return (muscle && MUSCLE_STYLE[muscle]) || DEFAULT_STYLE;
}

export function Icon({ name, color = colors.text, size = 20 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={sym(name)} tintColor={color} size={size} style={{ width: size, height: size }} />;
}

/** User photo if set, otherwise a colored SF Symbol for the muscle group. */
export function ExerciseAvatar({ muscle, photo, size = 44 }: { muscle: string; photo?: string | null; size?: number }) {
  const uri = photoUri(photo);
  const st = muscleStyle(muscle);
  const r = size * 0.28;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, backgroundColor: colors.surface2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: st.color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={st.icon} color={st.color} size={size * 0.55} />
    </View>
  );
}

/** Circular progress ring with a centered label. */
export function Ring({
  value,
  max,
  size = 150,
  stroke = 12,
  color = colors.primary,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.danger : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * Minimal line chart. Points are drawn oldest → newest from left to right (time axis
 * stays left→right even in RTL, like Apple Health).
 */
export function LineChart({
  data,
  height = 140,
  width = 300,
  color = colors.primary,
  unit = '',
}: {
  data: { label: string; value: number }[];
  height?: number;
  width?: number;
  color?: string;
  unit?: string;
}) {
  if (data.length < 2) {
    return (
      <T muted size={12} style={{ textAlign: 'center', paddingVertical: 16 }}>
        يظهر الرسم بعد تسجيلين على الأقل.
      </T>
    );
  }
  const pad = 10;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (data.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const diff = last.value - first.value;

  return (
    <View style={{ direction: 'ltr' }}>
      <Svg width={width} height={height}>
        <Line x1={pad} x2={width - pad} y1={y(min)} y2={y(min)} stroke={colors.border} strokeWidth={1} />
        <Line x1={pad} x2={width - pad} y1={y(max)} y2={y(max)} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
        <Polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <Dot key={i} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 5 : 3} fill={color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <T muted size={11}>
          {first.label}: {Math.round(first.value * 10) / 10}
          {unit}
        </T>
        <T size={11} color={diff >= 0 ? colors.primary : colors.danger}>
          {diff >= 0 ? '+' : ''}
          {Math.round(diff * 10) / 10}
          {unit}
        </T>
        <T muted size={11}>
          {last.label}: {Math.round(last.value * 10) / 10}
          {unit}
        </T>
      </View>
    </View>
  );
}

export function Chip({ text, color = colors.primary }: { text: string; color?: string }) {
  return (
    <View style={{ backgroundColor: color + '26', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: rtl.alignStart }}>
      <T size={12} bold color={color}>
        {text}
      </T>
    </View>
  );
}
