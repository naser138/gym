import { Redirect, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { sym, type SFSymbolName } from '@/components/symbols';
import { ActivityIndicator, Platform, View, type ColorValue } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppData } from '@/hooks/AppData';
import { colors, fonts, nativeRTL } from '@/theme/colors';

function icon(name: SFSymbolName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={sym(name)} tintColor={color} size={24} style={{ width: 26, height: 24 }} />;
  };
}

const TABS: { name: string; title: string; icon: SFSymbolName }[] = [
  { name: 'index', title: 'اليوم', icon: 'flame.fill' },
  { name: 'nutrition', title: 'التغذية', icon: 'fork.knife' },
  { name: 'workouts', title: 'التمارين', icon: 'dumbbell.fill' },
  { name: 'progress', title: 'التطور', icon: 'chart.line.uptrend.xyaxis' },
  { name: 'settings', title: 'الإعدادات', icon: 'gearshape.fill' },
];

// Open on "اليوم" even when the tab order is reversed for Arabic.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  const { ready, profile } = useAppData();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!profile) return <Redirect href="/onboarding" />;

  // Arabic order: "اليوم" on the right. Native RTL already flips the bar; otherwise reverse it.
  const ordered = nativeRTL ? TABS : [...TABS].reverse();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...(Platform.OS === 'web' ? { height: 62 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 } : { height: 88, paddingTop: 6 }) },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {ordered.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: icon(t.icon) }} />
      ))}
    </Tabs>
  );
}
