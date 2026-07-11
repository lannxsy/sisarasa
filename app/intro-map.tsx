import { Redirect, useRouter } from 'expo-router';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable, StyleSheet, View, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from './lib/firebase';
import { COLORS } from '@/constants/theme';

interface MagicBag {
  id: string;
  storeId?: string;
  tokoNama: string;
  kategori: string;
  harga: number;
  hargaAsli: number;
  stok: number;
  jamPickup: string;
  deskripsi: string;
  emoji: string;
  imageUrl?: string;
  alamat?: string;
  lat?: number;
  lng?: number;
}

// Default center: Bandung, Jawa Barat
const BANDUNG_LAT = -6.9175;
const BANDUNG_LNG = 107.6191;

function buatHTMLPeta(bags: MagicBag[], userLat: number, userLng: number) {
  const markers = bags
    .filter((b) => b.lat && b.lng)
    .map(
      (b) => `
      L.marker([${b.lat}, ${b.lng}], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#0f3d2e;width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
      }).addTo(map);
      // Markers hanya untuk dilihat, tidak bisa di-klik
    `
    )
    .join('\n');

  const userMarker =
    userLat !== 0
      ? `L.circleMarker([${userLat}, ${userLng}], {
          radius: 8, fillColor: '#2563eb', color: '#fff',
          weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(map);`
      : '';

  const centerLat = userLat !== 0 ? userLat : BANDUNG_LAT;
  const centerLng = userLng !== 0 ? userLng : BANDUNG_LNG;

  return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  ${markers}
  ${userMarker}

  window.recenterMap = function(lat, lng) {
    map.setView([lat, lng], 14);
  };
</script>
</body>
</html>
  `;
}

// Layar pertama yang dilihat user tiap kali app dibuka (sebelum masuk ke
// tab Toko/Pesanan/Favorit/Profil). Tampilannya FULL MAP tanpa tab bar,
// mirip flow Too Good To Go: user pencet "Di mana kamu?" -> lokasi dicari
// -> toko terdekat di-render di map -> baru lanjut ke tab bar.
//
// Layar ini TIDAK ada di tab bar dan tidak bisa diakses lagi setelah lanjut
// ke tabs, kecuali user tutup-buka app dari awal (sesuai permintaan: untuk
// liat map lagi, app harus di-restart).
export default function IntroMapScreen() {
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [bags, setBags] = useState<MagicBag[]>([]);
  const [loadingToko, setLoadingToko] = useState(true);
  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [locating, setLocating] = useState(false);
  // Tahap 1 selesai begitu lokasi user ketemu -> tombol berubah jadi
  // tombol tahap 2 ("Cari toko terdekat").
  const [lokasiKetemu, setLokasiKetemu] = useState(false);
  // Tahap 2: render ulang map fokus ke toko-toko terdekat. Loading KE-2
  // yang muncul setelah tombol "Cari toko terdekat" dipencet.
  const [renderingToko, setRenderingToko] = useState(false);

  // Auth gate: layar ini jadi entry point app, jadi dia yang nentuin
  // apakah user lanjut liat map atau diarahkan ke /login dulu.
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(Boolean(user));
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'magic_bags'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) }));
      setBags(data);
      setLoadingToko(false);
    });
    return unsub;
  }, []);

  const cariLokasiku = async () => {
    if (!lokasiKetemu) {
      // TAHAP 1: Ambil lokasi user
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
        webviewRef.current?.injectJavaScript(
          `window.recenterMap && window.recenterMap(${loc.coords.latitude}, ${loc.coords.longitude}); true;`
        );
        setLokasiKetemu(true);
      } finally {
        setLocating(false);
      }
    } else {
      // TAHAP 2: Cari toko terdekat dan lanjut ke tab. Data toko (bags) sudah
      // di-fetch dari awal screen ini dibuka (lihat useEffect magic_bags di
      // atas), jadi tidak perlu nunggu apa-apa lagi di sini — dulu ada delay
      // buatan 1200ms yang cuma bikin app kerasa lambat tanpa alasan.
      router.replace('/(tabs)/toko');
    }
  };

  const bagsTersedia = bags.filter((b) => b.stok > 0 && b.lat && b.lng);
  const mapHtml = buatHTMLPeta(bagsTersedia, userLat, userLng);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type === 'PIN') {
        if (payload.storeId) {
          router.push({ pathname: '/toko-detail', params: { storeId: payload.storeId } });
        } else if (payload.bagId) {
          router.push({ pathname: '/detail', params: { id: payload.bagId } });
        }
      }
    } catch {
      // Pesan dari WebView gak valid JSON — abaikan saja.
    }
  };

  // Tunggu status auth siap dulu sebelum render apa pun, supaya gak ada
  // "kedip" map sebelum ke-redirect ke /login.
  if (!authReady) return null;
  if (!isLoggedIn) return <Redirect href="/login" />;

  return (
    <ThemedView style={styles.container}>
      {loadingToko ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          onMessage={handleMessage}
        />
      )}

      {/* Overlay loading ke-2: muncul setelah lokasi ketemu, sebelum pindah ke tab bar */}
      {renderingToko && (
        <View style={styles.renderOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <ThemedText style={styles.renderOverlayText}>Mencari toko terdekat...</ThemedText>
        </View>
      )}

      {!renderingToko && (
        <View style={styles.bottomWrap}>
          {!lokasiKetemu ? (
            <Pressable style={styles.locateBtn} onPress={cariLokasiku} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="navigate" size={16} color="#fff" />
              )}
              <ThemedText style={styles.locateBtnText}>Lokasi Saya</ThemedText>
            </Pressable>
          ) : (
            <Pressable style={styles.locateBtn} onPress={cariLokasiku} disabled={renderingToko}>
              {renderingToko ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="location" size={16} color="#fff" />
              )}
              <ThemedText style={styles.locateBtnText}>Cari Toko Terdekat</ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  bottomWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    height: 52,
    borderRadius: 26,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  locateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  renderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  renderOverlayText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});