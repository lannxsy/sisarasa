import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PushTokenResult } from './notifications';

export type StoredExpoPushToken = {
  token: string;
  savedAt: number;
  debug?: PushTokenResult['debug'];
};

const STORAGE_KEY = 'expoPushToken:last';

export async function saveExpoPushToken(result: PushTokenResult): Promise<void> {
  if (!result.token) return;

  const payload: StoredExpoPushToken = {
    token: result.token,
    savedAt: Date.now(),
    debug: result.debug,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function loadExpoPushToken(): Promise<StoredExpoPushToken | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredExpoPushToken;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearExpoPushToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
