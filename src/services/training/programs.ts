import type { ProgramDay } from '@/db/repo';

/** Ready-made weekly programs. Weekday: 0 = Sunday … 6 = Saturday. */
export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  days: ProgramDay[];
}

export const PROGRAMS: ProgramTemplate[] = [
  {
    id: 'ppl',
    name: 'دفع / سحب / أرجل',
    description: '5 أيام: الأحد إلى الخميس، والجمعة والسبت راحة.',
    days: [
      {
        weekday: 0,
        title: 'دفع (صدر، أكتاف، تراي)',
        exercises: [
          { name: 'بنش برس', sets: 4, reps: '6-10' },
          { name: 'بنش مائل بالدمبل', sets: 3, reps: '8-12' },
          { name: 'ضغط أكتاف', sets: 3, reps: '8-12' },
          { name: 'رفرفة جانبية', sets: 3, reps: '12-20' },
          { name: 'تراي بالكيبل', sets: 3, reps: '10-15' },
        ],
      },
      {
        weekday: 1,
        title: 'سحب (ظهر، باي)',
        exercises: [
          { name: 'سحب أمامي', sets: 4, reps: '8-12' },
          { name: 'تجديف بالبار', sets: 3, reps: '8-10' },
          { name: 'تجديف بالكيبل جالس', sets: 3, reps: '10-12' },
          { name: 'فيس بول', sets: 3, reps: '12-15' },
          { name: 'باي بالبار', sets: 3, reps: '8-12' },
        ],
      },
      {
        weekday: 2,
        title: 'أرجل',
        exercises: [
          { name: 'سكوات', sets: 4, reps: '5-8' },
          { name: 'رومانيان ديدلفت', sets: 3, reps: '8-10' },
          { name: 'ليج برس', sets: 3, reps: '10-15' },
          { name: 'ليج كيرل', sets: 3, reps: '10-15' },
          { name: 'سمانة واقف', sets: 4, reps: '12-20' },
        ],
      },
      {
        weekday: 3,
        title: 'علوي',
        exercises: [
          { name: 'بنش برس بالدمبل', sets: 3, reps: '8-12' },
          { name: 'تجديف بالدمبل', sets: 3, reps: '8-12' },
          { name: 'ضغط أكتاف', sets: 3, reps: '8-12' },
          { name: 'هامر', sets: 3, reps: '10-12' },
          { name: 'تراي فوق الرأس', sets: 3, reps: '10-15' },
        ],
      },
      {
        weekday: 4,
        title: 'سفلي + بطن',
        exercises: [
          { name: 'ديدلفت', sets: 3, reps: '4-6' },
          { name: 'لانجز بالدمبل', sets: 3, reps: '10-12' },
          { name: 'ليج اكستنشن', sets: 3, reps: '12-15' },
          { name: 'رفع الأرجل معلق', sets: 3, reps: '10-20' },
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'علوي / سفلي',
    description: '4 أيام: الأحد، الاثنين، الأربعاء، الخميس.',
    days: [
      {
        weekday: 0,
        title: 'علوي (قوة)',
        exercises: [
          { name: 'بنش برس', sets: 4, reps: '6-10' },
          { name: 'تجديف بالبار', sets: 4, reps: '8-10' },
          { name: 'ضغط أكتاف', sets: 3, reps: '8-12' },
          { name: 'باي بالبار', sets: 2, reps: '8-12' },
          { name: 'تراي بالكيبل', sets: 2, reps: '10-15' },
        ],
      },
      {
        weekday: 1,
        title: 'سفلي (قوة)',
        exercises: [
          { name: 'سكوات', sets: 4, reps: '5-8' },
          { name: 'رومانيان ديدلفت', sets: 3, reps: '8-10' },
          { name: 'ليج كيرل', sets: 3, reps: '10-15' },
          { name: 'سمانة واقف', sets: 3, reps: '12-20' },
        ],
      },
      {
        weekday: 3,
        title: 'علوي (حجم)',
        exercises: [
          { name: 'بنش مائل بالدمبل', sets: 3, reps: '8-12' },
          { name: 'سحب أمامي', sets: 3, reps: '8-12' },
          { name: 'تفتيح صدر بالكيبل', sets: 3, reps: '12-15' },
          { name: 'رفرفة جانبية', sets: 3, reps: '12-20' },
          { name: 'هامر', sets: 3, reps: '10-12' },
        ],
      },
      {
        weekday: 4,
        title: 'سفلي (حجم)',
        exercises: [
          { name: 'ليج برس', sets: 4, reps: '10-15' },
          { name: 'لانجز بالدمبل', sets: 3, reps: '10-12' },
          { name: 'ليج اكستنشن', sets: 3, reps: '12-15' },
          { name: 'بطن كرنش', sets: 3, reps: '15-25' },
        ],
      },
    ],
  },
];
