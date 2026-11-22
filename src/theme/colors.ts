import { I18nManager } from 'react-native';

export const colors = {
  bg: '#090D12',
  surface: '#11171F',
  surface2: '#19212C',
  surface3: '#222C39',
  border: '#1F2935',
  text: '#F1F5F9',
  textMuted: '#8B98AB',
  primary: '#34D399',
  primaryDim: '#123A2C',
  onPrimary: '#04140D',
  accent: '#60A5FA',
  warning: '#FBBF24',
  danger: '#F87171',
  protein: '#FB7185',
  carbs: '#60A5FA',
  fat: '#FBBF24',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** IBM Plex Sans Arabic – loaded in the root layout. iOS needs one family per weight. */
export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

/**
 * Right-to-left without relying on the native RTL flag.
 * Production builds force RTL natively (expo-localization), but Expo Go ignores that
 * setting, so components lay themselves out right→left explicitly when the native
 * flag is off. Use these instead of hard-coded 'row' / 'left' / 'right'.
 */
export const nativeRTL = I18nManager.isRTL;
export const rtl = {
  row: (nativeRTL ? 'row' : 'row-reverse') as 'row' | 'row-reverse',
  /** Text alignment for Arabic: natural when native RTL is on, explicit right otherwise. */
  textAlign: (nativeRTL ? 'auto' : 'right') as 'auto' | 'right',
  /** Cross-axis alignment toward the reading start (right side). */
  alignStart: (nativeRTL ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
  alignEnd: (nativeRTL ? 'flex-end' : 'flex-start') as 'flex-start' | 'flex-end',
};
