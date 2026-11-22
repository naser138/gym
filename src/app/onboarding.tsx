import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ProfileForm } from '@/components/ProfileForm';
import { Screen, T } from '@/components/ui';
import { useAppData } from '@/hooks/AppData';
import { upsertWeight } from '@/db/repo';
import { DEFAULT_PROFILE } from '@/services/nutrition/types';
import { toDateKey } from '@/utils/date';

export default function Onboarding() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { updateProfile, refresh } = useAppData();

  return (
    <Screen>
      <T muted>
        أدخل بياناتك مرة واحدة لحساب احتياجك من السعرات والماكروز. تُحفظ على جهازك فقط، وتقدر تعدّلها لاحقًا من الإعدادات.
      </T>
      <ProfileForm
        initial={DEFAULT_PROFILE}
        submitLabel="ابدأ"
        onSubmit={async (p) => {
          await updateProfile(p);
          await upsertWeight(db, toDateKey(), p.weightKg, 'manual');
          await refresh();
          router.replace('/');
        }}
      />
    </Screen>
  );
}
