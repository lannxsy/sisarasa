import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addNotificationTapListener, getLastNotificationResponse } from './lib/notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    // Kasus 1: app sudah jalan (foreground/background), user tap notif.
    const unsubscribe = addNotificationTapListener((data) => {
      if (data?.screen === 'orders') {
        router.push('/(tabs)/orders');
      }
    });

    // Kasus 2: app dibuka DARI TERTUTUP TOTAL lewat tap notif (cold start).
    // addNotificationTapListener di atas tidak menangkap ini karena
    // listener-nya baru terpasang setelah app sudah jalan — tap-nya
    // terjadi sebelum itu. getLastNotificationResponse mengambil tap
    // terakhir yang menyebabkan app dibuka, kalau ada.
    getLastNotificationResponse().then((data) => {
      if (data?.screen === 'orders') {
        router.push('/(tabs)/orders');
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="detail" options={{ headerShown: false }} />
        <Stack.Screen name="toko-detail" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}