/**
 * Cross-platform icon names. iOS uses SF Symbols; web/Android use Material Symbols
 * (bundled font, works offline). Every icon used in the app must be listed here.
 */
import type { SymbolViewProps } from 'expo-symbols';

type SF = Extract<SymbolViewProps['name'], string>;

const MATERIAL: Record<string, string> = {
  'arrow.down.circle.fill': 'arrow_circle_down',
  'arrow.up.circle.fill': 'arrow_circle_up',
  'arrow.uturn.backward': 'undo',
  barcode: 'barcode',
  'barcode.viewfinder': 'barcode_scanner',
  'bolt.fill': 'bolt',
  calendar: 'calendar_month',
  'camera.fill': 'photo_camera',
  'chart.bar.fill': 'bar_chart',
  'chart.line.uptrend.xyaxis': 'trending_up',
  checkmark: 'check',
  'checkmark.circle.fill': 'check_circle',
  'chevron.down': 'keyboard_arrow_down',
  'chevron.left': 'chevron_left',
  'chevron.right': 'chevron_right',
  'clock.arrow.circlepath': 'history',
  'doc.on.doc': 'content_copy',
  'dumbbell.fill': 'fitness_center',
  'equal.circle.fill': 'drag_handle',
  'exclamationmark.triangle.fill': 'warning',
  'figure.arms.open': 'accessibility_new',
  'figure.cooldown': 'self_improvement',
  'figure.core.training': 'sports_gymnastics',
  'figure.cross.training': 'sports_martial_arts',
  'figure.rower': 'rowing',
  'figure.run': 'directions_run',
  'figure.strengthtraining.functional': 'sports_kabaddi',
  'figure.strengthtraining.traditional': 'exercise',
  'figure.walk': 'directions_walk',
  'flame.fill': 'local_fire_department',
  'flashlight.off.fill': 'flashlight_off',
  'flashlight.on.fill': 'flashlight_on',
  'fork.knife': 'restaurant',
  'gearshape.fill': 'settings',
  'info.circle.fill': 'info',
  'keyboard.chevron.compact.down': 'keyboard_hide',
  'leaf.fill': 'eco',
  'list.bullet': 'format_list_bulleted',
  magnifyingglass: 'search',
  'moon.stars.fill': 'nightlight',
  'moon.zzz.fill': 'bedtime',
  'note.text': 'sticky_note_2',
  pencil: 'edit',
  'person.fill': 'person',
  'play.fill': 'play_arrow',
  plus: 'add',
  'plus.circle.fill': 'add_circle',
  scalemass: 'scale',
  'scalemass.fill': 'monitor_weight',
  sparkles: 'auto_awesome',
  'square.and.arrow.up': 'ios_share',
  stopwatch: 'timer',
  'sun.max.fill': 'wb_sunny',
  'sunrise.fill': 'wb_twilight',
  target: 'target',
  timer: 'timer',
  trash: 'delete',
  tray: 'inbox',
  'trophy.fill': 'emoji_events',
};

/** SF Symbol name → per-platform name object understood by <SymbolView>. */
export function sym(name: SF): SymbolViewProps['name'] {
  const md = MATERIAL[name] ?? 'circle';
  return { ios: name, android: md, web: md } as unknown as SymbolViewProps['name'];
}

export type { SF as SFSymbolName };
export const MATERIAL_MAP = MATERIAL;
