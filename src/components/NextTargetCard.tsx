import { View } from 'react-native';
import { Button, Row, T } from './ui';
import { Chip, Icon } from './visuals';
import { SUGGESTION_LABELS, type Suggestion } from '@/services/training/progression';
import { colors, radius, rtl, spacing } from '@/theme/colors';
import { fmt } from '@/utils/number';

const KIND_STYLE = {
  start: { color: colors.accent, icon: 'sparkles' },
  increase: { color: colors.primary, icon: 'arrow.up.circle.fill' },
  reps: { color: colors.accent, icon: 'plus.circle.fill' },
  repeat: { color: colors.warning, icon: 'equal.circle.fill' },
  deload: { color: colors.danger, icon: 'arrow.down.circle.fill' },
} as const;

/** "Next workout" target: weight × reps × sets, with the reason. */
export function NextTargetCard({ s, onUse, compact }: { s: Suggestion; onUse?: () => void; compact?: boolean }) {
  const st = KIND_STYLE[s.kind];
  const weightText = s.weight > 0 ? `${fmt(s.weight, 2)} كغ` : s.kind === 'start' ? 'اختر وزنًا' : 'وزن الجسم';
  return (
    <View
      style={{
        backgroundColor: st.color + '14',
        borderColor: st.color + '55',
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 6,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <Icon name={st.icon} color={st.color} size={18} />
          <T bold size={13} color={st.color}>
            الهدف القادم
          </T>
        </Row>
        <Chip text={SUGGESTION_LABELS[s.kind]} color={st.color} />
      </Row>
      <T bold size={compact ? 18 : 22}>
        {weightText} × {s.reps}
        <T muted size={13}> · {s.sets} مجموعات</T>
      </T>
      {s.last && (
        <T muted size={12}>
          آخر مرة: {s.last.weight > 0 ? `${fmt(s.last.weight, 2)} كغ` : 'وزن الجسم'} × {s.last.reps}
        </T>
      )}
      {!compact && <T muted size={12}>{s.reason}</T>}
      {onUse && <Button title="استخدم الهدف" small variant="secondary" onPress={onUse} style={{ alignSelf: rtl.alignStart }} />}
    </View>
  );
}
