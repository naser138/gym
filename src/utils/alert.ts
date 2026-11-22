/**
 * Drop-in replacement for Alert.alert.
 * Native: the system alert. Web: React Native Web's Alert is a no-op, so we show
 * our own dialog (rendered by <AlertHost/> in the root layout).
 */
import { Alert, Platform, type AlertButton } from 'react-native';

export interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type Listener = (req: AlertRequest) => void;
let listener: Listener | null = null;
let nextId = 1;

export function setAlertListener(l: Listener | null) {
  listener = l;
}

export function appAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const req: AlertRequest = { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'حسنًا' }] };
  if (listener) listener(req);
  else if (typeof window !== 'undefined') {
    // Fallback before the host mounts.
    window.alert([title, message].filter(Boolean).join('\n\n'));
    req.buttons.find((b) => b.style !== 'cancel')?.onPress?.();
  }
}
