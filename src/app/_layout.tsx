import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';

import { KeyboardDoneButton } from '@/components/ui';
import { AlertHost } from '@/components/AlertHost';
import { DB_NAME, migrateDbIfNeeded } from '@/db/schema';
import { AppDataProvider } from '@/hooks/AppData';
import { colors, fonts } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const ready = fontsLoaded || !!fontError; // never block the app on a font failure

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SQLiteProvider databaseName={DB_NAME} onInit={migrateDbIfNeeded} useSuspense={false}>
          <AppDataProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerShadowVisible: false,
                headerTintColor: colors.primary,
                headerTitleStyle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
                headerBackTitleStyle: { fontFamily: fonts.medium },
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ title: 'مرحبًا بك', gestureEnabled: false, headerBackVisible: false }} />
              <Stack.Screen name="workout/[id]" options={{ title: 'جلسة تمرين' }} />
              <Stack.Screen name="plan/[weekday]" options={{ title: 'تمارين اليوم' }} />
              <Stack.Screen name="exercise/[id]" options={{ title: 'التمرين' }} />
              <Stack.Screen name="library" options={{ title: 'مكتبة التمارين' }} />
              <Stack.Screen name="scan" options={{ title: 'مسح الباركود' }} />
              <Stack.Screen name="food/add" options={{ title: 'إضافة طعام' }} />
              <Stack.Screen name="food/[id]" options={{ title: 'الكمية' }} />
              <Stack.Screen name="food/edit" options={{ title: 'طعام' }} />
              <Stack.Screen name="food/quick" options={{ title: 'سعرات سريعة' }} />
            </Stack>
          </AppDataProvider>
        </SQLiteProvider>
        <KeyboardDoneButton />
        <AlertHost />
      </View>
    </SafeAreaProvider>
  );
}
