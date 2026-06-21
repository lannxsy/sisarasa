import { useRouter } from 'expo-router';
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
import { db } from '../lib/firebase';
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
      }).addTo(map).on('click', function() {
        // Tap pin di peta -> ke halaman TOKO (semua menu toko itu),
        // bukan langsung ke 1 Magic Bag spesifik. Kirim storeId (dan
        // bagId sebagai fallback kalau storeId kosong di data lama).
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PIN',
          bagId: ${JSON.stringify(b.id)},
          storeId: ${JSON.stringify(b.storeId || '')}
        }));
      });
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

export default function HomeScreen() {
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [bags, setBags] = useState<MagicBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'magic_bags'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) }));
      setBags(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const cariLokasiku = async () => {
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
    } finally {
      setLocating(false);
    }
  };

  const bagsTersedia = bags.filter((b) => b.stok > 0 && b.lat && b.lng);
  const mapHtml = buatHTMLPeta(bagsTersedia, userLat, userLng);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type === 'PIN') {
        if (payload.storeId) {
          // Pencet titik di peta -> ke halaman TOKO (semua menu toko itu),
          // bukan langsung ke 1 Magic Bag spesifik.
          router.push({ pathname: '/toko-detail', params: { storeId: payload.storeId } });
        } else if (payload.bagId) {
          // Fallback untuk data lama yang belum punya storeId di magic_bags.
          router.push({ pathname: '/detail', params: { id: payload.bagId } });
        }
      }
    } catch {
      // Pesan dari WebView gak valid JSON — abaikan saja.
    }
  };

  return (
    <ThemedView style={styles.container}>
      {loading ? (
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

      <View style={styles.bottomWrap}>
        <Pressable style={styles.locateBtn} onPress={cariLokasiku} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="navigate" size={16} color="#fff" />
          )}
          <ThemedText style={styles.locateBtnText}>Di mana kamu?</ThemedText>
        </Pressable>
      </View>
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
});