import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { addNotificationTapListener, getLastNotificationResponse } from './lib/notifications';

export const unstable_settings = {
  // Layar pertama yang dibuka tiap kali app dijalankan dari awal adalah
  // intro-map (full map tanpa tab bar), BUKAN langsung ke tab Toko.
  // Ini yang bikin flow-nya: buka app -> full map -> cari lokasi -> render
  // toko terdekat -> baru pindah ke tab bar (Toko/Pesanan/Favorit/Profil).
  anchor: 'intro-map',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

// Catatan: app sengaja SELALU pakai tema terang (lihat app.json ->
// userInterfaceStyle: "light"), jadi RootLayout tidak lagi cek dark mode.
export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

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

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="intro-map" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="detail" options={{ headerShown: false }} />
        <Stack.Screen name="toko-detail" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}