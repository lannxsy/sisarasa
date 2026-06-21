import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushTokenResult = {
  token: string | null;
  provider: 'expo';
  debug: {
    platform: string;
    isDevice: boolean;
    appOwnership: string | null;
    projectIdToUse: string | null;
    permissionStatus: string | null;
  };
  error: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<PushTokenResult> {
  const debugBase: PushTokenResult['debug'] = {
    platform: Platform.OS,
    isDevice: Device.isDevice,
    appOwnership: Constants.appOwnership ?? null,
    projectIdToUse: null,
    permissionStatus: null,
  };

  if (Platform.OS !== 'web' && !Device.isDevice) {
    return { token: null, provider: 'expo', debug: debugBase, error: 'Harus pakai device fisik!' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  debugBase.permissionStatus = String(finalStatus);

  if (finalStatus !== 'granted') {
    return { token: null, provider: 'expo', debug: debugBase, error: 'Izin ditolak!' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  try {
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId ?? 
      Constants.easConfig?.projectId;
    
    debugBase.projectIdToUse = projectId ?? null;

    if (!projectId) {
      throw new Error('Project ID tidak ditemukan di app.json.');
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return {
      token: token.data,
      provider: 'expo',
      debug: debugBase,
      error: null,
    };
  } catch (e: any) {
    return {
      token: null,
      provider: 'expo',
      debug: debugBase,
      error: e.message || 'Gagal ambil token Expo',
    };
  }
}

// FUNGSI BARU BIAR TIDAK ERROR LAGI
// data: payload tambahan yang ikut terbawa ke notification response saat
// notif di-tap. Tanpa ini, tap notif cuma buka app ke state terakhir
// (gak ada cara tau notif ini soal apa, jadi gak bisa diarahkan ke layar
// yang relevan).
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true,
      data: data ?? {},
    },
    trigger: null,
  });
}

// Dipanggil sekali di root layout. Menangkap event "user TAP notifikasi"
// (baik saat app di foreground/background, maupun saat notif itu yang
// membuka app dari kondisi tertutup) dan memanggil onTap dengan data
// payload yang disertakan saat notif dibuat di scheduleLocalNotification.
export function addNotificationTapListener(
  onTap: (data: Record<string, unknown>) => void
) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    onTap(data ?? {});
  });
  return () => subscription.remove();
}

// Dipanggil sekali di root layout untuk menangani kasus app dibuka DARI
// KONDISI TERTUTUP TOTAL lewat tap notifikasi (cold start). Listener biasa
// (addNotificationResponseReceivedListener) tidak menangkap tap yang
// terjadi sebelum listener itu sempat terpasang.
export async function getLastNotificationResponse(): Promise<Record<string, unknown> | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  return (response.notification.request.content.data as Record<string, unknown>) ?? null;
}