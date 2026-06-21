import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, View, useColorScheme, Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from './lib/firebase';
import { COLORS } from '@/constants/theme';

interface MagicBag {
  id: string;
  tokoNama: string;
  namaMenu?: string;
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
  storeId?: string;
}

interface StoreDoc {
  name?: string;
  imageUrl?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

function buatMiniMap(lat: number, lng: number, namaToKo: string, emoji: string) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>* { margin:0;padding:0;box-sizing:border-box; } html,body,#map{width:100%;height:100%;}</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, dragging: false, scrollWheelZoom: false })
    .setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.marker([${lat}, ${lng}], {
    icon: L.divIcon({
      className: '',
      html: '<div style="background:#16a34a;color:#fff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${emoji}</div>',
      iconSize: [40, 40], iconAnchor: [20, 20],
    })
  }).addTo(map).bindPopup('<b>${namaToKo}</b>').openPopup();
</script>
</body>
</html>
  `;
}

export default function TokoDetailScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [bags, setBags] = useState<MagicBag[]>([]);
  const [storeDoc, setStoreDoc] = useState<StoreDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    // Data resmi toko (nama, foto, alamat, lokasi) — sumber kebenaran dari
    // halaman Pengaturan Toko di web admin. Kalau dokumennya nggak ada
    // (kasus lama: storeId param sebenarnya tokoNama), storeDoc tetap null
    // dan kita fallback ke data menu pertama di bawah.
    const unsubStore = onSnapshot(doc(db, 'stores', storeId), (snap) => {
      setStoreDoc(snap.exists() ? (snap.data() as StoreDoc) : null);
    });
    return unsubStore;
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    // Coba filter by storeId dulu; kalau tidak ada hasil, fallback ke tokoNama (data lama)
    const q = query(collection(db, 'magic_bags'), where('storeId', '==', storeId));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setBags(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) })));
      } else {
        // fallback: storeId sebenarnya adalah tokoNama (data lama tanpa storeId)
        const qFallback = query(collection(db, 'magic_bags'), where('tokoNama', '==', storeId));
        onSnapshot(qFallback, (snap2) => {
          setBags(snap2.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) })));
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [storeId]);

  if (loading) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ThemedView>
    );
  }

  if (bags.length === 0) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText>Toko tidak ditemukan.</ThemedText>
      </ThemedView>
    );
  }

  // Data toko buat header: utamakan dokumen stores/{storeId} (resmi, dari
  // Pengaturan Toko). Fallback ke menu pertama HANYA untuk data lama yang
  // belum punya dokumen stores/{storeId} sama sekali (storeDoc === null,
  // kasus storeId param = tokoNama lama). Kalau dokumen stores SUDAH ada
  // tapi field imageUrl/address/lat/lng-nya memang belum diisi admin,
  // jangan jatuh ke foto/alamat menu — tampilkan kosong/placeholder saja,
  // supaya foto toko tidak ketuker dengan foto menu.
  const storeExists = storeDoc !== null;
  const toko = {
    tokoNama: storeExists ? (storeDoc!.name || bags[0].tokoNama) : bags[0].tokoNama,
    imageUrl: storeExists ? storeDoc!.imageUrl : bags[0].imageUrl,
    alamat: storeExists ? storeDoc!.address : bags[0].alamat,
    lat: storeExists ? storeDoc!.latitude : bags[0].lat,
    lng: storeExists ? storeDoc!.longitude : bags[0].lng,
    jamPickup: bags[0].jamPickup,
    emoji: bags[0].emoji,
    // Default BUKA (true) kalau dokumen stores belum ada atau field
    // isActive belum pernah di-set — konsisten sama default checkbox di
    // settings.html ("checked" + `data.isActive !== false`).
    tokoBuka: storeExists ? storeDoc!.isActive !== false : true,
  };

  const renderMenuItem = ({ item }: { item: MagicBag }) => {
    const habis = item.stok <= 0;
    // Toko tutup itu lebih dominan dari stok habis — kalau admin matiin
    // toko, pembeli gak boleh checkout sama sekali walau stoknya masih ada.
    const tidakBisaPesan = habis || !toko.tokoBuka;
    const diskon = Math.round((1 - item.harga / item.hargaAsli) * 100);
    return (
      <Pressable
        style={[styles.menuCard, { backgroundColor: isDark ? COLORS.gray800 : COLORS.white, opacity: tidakBisaPesan ? 0.55 : 1 }]}
        onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
        disabled={tidakBisaPesan}
      >
        <View style={styles.menuImageWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.menuImage} resizeMode="cover" />
          ) : (
            <ThemedText style={styles.menuEmoji}>{item.emoji || '🛍️'}</ThemedText>
          )}
          {diskon > 0 && (
            <View style={styles.diskonBadge}>
              <ThemedText style={styles.diskonText}>-{diskon}%</ThemedText>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.menuName}>{item.namaMenu || item.kategori}</ThemedText>
          <ThemedText style={styles.menuKategori}>{item.kategori}</ThemedText>
          <View style={styles.priceRow}>
            <ThemedText style={styles.harga}>Rp {item.harga.toLocaleString('id-ID')}</ThemedText>
            <ThemedText style={styles.hargaAsli}>Rp {item.hargaAsli.toLocaleString('id-ID')}</ThemedText>
          </View>
        </View>
        <View style={[styles.stokBadge, { backgroundColor: tidakBisaPesan ? '#fee2e2' : COLORS.primaryLight }]}>
          <ThemedText style={[styles.stokText, { color: tidakBisaPesan ? COLORS.danger : COLORS.primaryDark }]}>
            {!toko.tokoBuka ? 'Tutup' : habis ? 'Habis' : `${item.stok} sisa`}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={bags}
        keyExtractor={(i) => i.id}
        renderItem={renderMenuItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Hero toko */}
            <View style={[styles.hero, { backgroundColor: COLORS.primary }]}>
              {toko.imageUrl ? (
                <Image source={{ uri: toko.imageUrl }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <ThemedText style={styles.heroEmoji}>{toko.emoji || '🏪'}</ThemedText>
              )}
              <Pressable style={styles.backBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.tokoInfo}>
              <ThemedText style={[styles.tokoName, { color: isDark ? '#fff' : COLORS.dark }]}>
                {toko.tokoNama}
              </ThemedText>

              {!toko.tokoBuka && (
                <View style={styles.closedBanner}>
                  <Ionicons name="moon-outline" size={16} color={COLORS.danger} />
                  <ThemedText style={styles.closedBannerText}>
                    Toko sedang tutup — belum bisa pesan dulu sekarang
                  </ThemedText>
                </View>
              )}

              <View style={[styles.infoCard, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100 }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={15} color={isDark ? '#cbd5e1' : COLORS.gray600} />
                  <ThemedText style={[styles.infoText, { color: isDark ? '#e2e8f0' : COLORS.gray600 }]}>
                    Pickup: {toko.jamPickup}
                  </ThemedText>
                </View>
                {toko.alamat && (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={15} color={isDark ? '#cbd5e1' : COLORS.gray600} />
                    <ThemedText style={[styles.infoText, { color: isDark ? '#e2e8f0' : COLORS.gray600 }]}>
                      {toko.alamat}
                    </ThemedText>
                  </View>
                )}
              </View>

              {toko.lat && toko.lng && (
                <View style={styles.miniMapWrap}>
                  <WebView
                    source={{ html: buatMiniMap(toko.lat, toko.lng, toko.tokoNama, toko.emoji || '🏪') }}
                    style={styles.miniMap}
                    scrollEnabled={false}
                    javaScriptEnabled
                  />
                </View>
              )}

              <ThemedText style={[styles.sectionLabel, { color: isDark ? '#fff' : COLORS.gray600 }]}>
                Menu Tersedia ({bags.length})
              </ThemedText>
            </View>
          </>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { height: 180, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroEmoji: { fontSize: 64, lineHeight: 76 },
  backBtn: {
    position: 'absolute', top: 52, left: 16,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 8,
  },
  tokoInfo: { paddingHorizontal: 18, paddingTop: 16 },
  tokoName: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  closedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fee2e2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  closedBannerText: { fontSize: 12.5, fontWeight: '700', color: COLORS.danger, flex: 1 },
  infoCard: { borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13 },
  miniMapWrap: {
    height: 140, borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    borderWidth: 0.5, borderColor: COLORS.gray200,
  },
  miniMap: { flex: 1 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 10 },

  menuCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 12, marginHorizontal: 16, marginBottom: 10, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
  },
  menuImageWrap: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    overflow: 'hidden',
  },
  menuImage: { width: '100%', height: '100%' },
  menuEmoji: { fontSize: 26 },
  diskonBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: COLORS.secondary, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1,
  },
  diskonText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  menuName: { fontSize: 14, fontWeight: '700' },
  menuKategori: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  harga: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  hargaAsli: { fontSize: 11, color: COLORS.gray400, textDecorationLine: 'line-through' },
  stokBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stokText: { fontSize: 11, fontWeight: '700' },
});