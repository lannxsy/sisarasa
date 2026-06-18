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
export async function scheduleLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true,
    },
    trigger: null,
  });
}