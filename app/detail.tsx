import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, useColorScheme, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, runTransaction } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from './lib/firebase';
import { addFavorite, removeFavorite } from './lib/favorites';
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
}

function generateKode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [bag, setBag] = useState<MagicBag | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [jumlah, setJumlah] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'magic_bags', id)).then((d) => {
      if (d.exists()) setBag({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) });
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !userId) return;
    getDoc(doc(db, 'favorites', `${userId}_${id}`)).then((d) => setIsFav(d.exists()));
  }, [id, userId]);

  const toggleFavorite = async () => {
    if (!bag || !userId) return;
    setFavLoading(true);
    try {
      if (isFav) {
        await removeFavorite(userId, bag.id);
        setIsFav(false);
      } else {
        await addFavorite(userId, bag.id, {
          tokoNama: bag.tokoNama,
          kategori: bag.kategori,
          harga: bag.harga,
          hargaAsli: bag.hargaAsli,
          emoji: bag.emoji,
          jamPickup: bag.jamPickup,
          alamat: bag.alamat,
        });
        setIsFav(true);
      }
    } finally {
      setFavLoading(false);
    }
  };

  const handleOrder = async () => {
    if (!bag || !auth.currentUser) return;
    if (ordering) return; // cegah double-tap memicu dua transaksi sekaligus
    setOrdering(true);
    await new Promise((r) => setTimeout(r, 2000));

    const kode = generateKode();
    const bagRef = doc(db, 'magic_bags', bag.id);
    const orderRef = doc(collection(db, 'orders')); // generate id duluan, dipakai di dalam transaksi

    try {
      // addDoc (simpan order) dan updateDoc (kurangi stok) digabung jadi satu
      // operasi atomik. Kalau salah satu gagal (mis. stok udah habis duluan
      // direbut pembeli lain), KEDUANYA dibatalkan otomatis oleh Firestore —
      // jadi nggak akan ada lagi kasus "gagal" tapi order-nya kepalang tersimpan.
      await runTransaction(db, async (tx) => {
        const bagSnap = await tx.get(bagRef);
        if (!bagSnap.exists()) {
          throw new Error('Magic Bag tidak ditemukan.');
        }
        const stokSekarang = bagSnap.data().stok ?? 0;
        if (stokSekarang < jumlah) {
          throw new Error('Stok tidak mencukupi, sudah diambil pembeli lain.');
        }

        tx.set(orderRef, {
          userId: auth.currentUser!.uid,
          userEmail: auth.currentUser!.email,
          bagId: bag.id,
          tokoNama: bag.tokoNama,
          namaMenu: bag.namaMenu || bag.tokoNama,
          emoji: bag.emoji,
          imageUrl: bag.imageUrl || '',
          harga: bag.harga * jumlah,
          jumlah,
          status: 'pending',
          kodePickup: kode,
          createdAt: Date.now(),
        });
        tx.update(bagRef, { stok: stokSekarang - jumlah });
      });

      setOrdering(false);
      Alert.alert(
        '✅ Pembayaran Berhasil!',
        `Kode pickup kamu: ${kode}\n\nLihat di tab Pesanan untuk QR Code.`,
        [{ text: 'Lihat Pesanan', onPress: () => router.replace('/(tabs)/toko') }]
      );
    } catch (err) {
      setOrdering(false);
      const pesan = err instanceof Error ? err.message : 'Gagal membuat pesanan.';
      Alert.alert('Error', pesan);
    }
  };

  if (loading)
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ThemedView>
    );

  if (!bag)
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText>Magic Bag tidak ditemukan.</ThemedText>
      </ThemedView>
    );

  const diskon = Math.round((1 - bag.harga / bag.hargaAsli) * 100);
  const hasMap = !!(bag.lat && bag.lng);

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: COLORS.primary }]}>
          {bag.imageUrl ? (
            <Image source={{ uri: bag.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : null}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          {!bag.imageUrl && (
            <ThemedText style={styles.heroEmoji}>{bag.emoji || '🛍️'}</ThemedText>
          )}
          <Pressable style={styles.favBtn} onPress={toggleFavorite} disabled={favLoading} hitSlop={8}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#ef4444' : '#fff'} />
          </Pressable>
          <View style={styles.diskonBadge}>
            <ThemedText style={styles.diskonText}>-{diskon}%</ThemedText>
          </View>
        </View>

        <View style={styles.content}>
          {/* Judul + stok */}
          <View style={styles.titleRow}>
            <ThemedText style={[styles.tokoName, { color: isDark ? '#fff' : COLORS.dark }]}>
              {bag.namaMenu || bag.kategori}
            </ThemedText>
            <View style={[styles.stokBadge, { backgroundColor: bag.stok > 2 ? COLORS.primaryLight : '#fef3c7' }]}>
              <ThemedText style={[styles.stokText, { color: bag.stok > 2 ? COLORS.primaryDark : '#92400e' }]}>
                {bag.stok} sisa
              </ThemedText>
            </View>
          </View>
          <View style={styles.tokoSubRow}>
            <Ionicons name="storefront-outline" size={13} color={isDark ? '#86efac' : COLORS.primaryDark} />
            <ThemedText style={[styles.menuName, { color: isDark ? '#86efac' : COLORS.primaryDark }]}>
              {' '}{bag.tokoNama}
            </ThemedText>
          </View>
          <ThemedText style={[styles.kategori, { color: isDark ? '#cbd5e1' : COLORS.gray400 }]}>{bag.kategori}</ThemedText>

          {/* Info */}
          <View style={[styles.infoCard, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100 }]}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={15} color={isDark ? '#cbd5e1' : COLORS.gray600} />
              <ThemedText style={[styles.infoText, { color: isDark ? '#e2e8f0' : COLORS.gray600 }]}>Pickup: {bag.jamPickup}</ThemedText>
            </View>
            {bag.alamat && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={15} color={isDark ? '#cbd5e1' : COLORS.gray600} />
                <ThemedText style={[styles.infoText, { color: isDark ? '#e2e8f0' : COLORS.gray600 }]}>{bag.alamat}</ThemedText>
              </View>
            )}
          </View>

          {/* Mini Map */}
          {hasMap && (
            <>
              <ThemedText style={[styles.sectionLabel, { color: isDark ? '#fff' : COLORS.gray600 }]}>Lokasi Toko</ThemedText>
              <View style={styles.miniMapWrap}>
                <WebView
                  source={{ html: buatMiniMap(bag.lat!, bag.lng!, bag.tokoNama, bag.emoji || '🛍️') }}
                  style={styles.miniMap}
                  scrollEnabled={false}
                  javaScriptEnabled
                />
              </View>
            </>
          )}

          {/* Deskripsi */}
          <ThemedText style={[styles.sectionLabel, { color: isDark ? '#fff' : COLORS.gray600 }]}>Deskripsi</ThemedText>
          <ThemedText style={[styles.deskripsi, { color: isDark ? '#e2e8f0' : COLORS.gray600 }]}>
            {bag.deskripsi || 'Tidak ada deskripsi untuk Magic Bag ini.'}
          </ThemedText>

          {/* Jumlah */}
          <ThemedText style={[styles.sectionLabel, { color: isDark ? '#fff' : COLORS.gray600 }]}>Jumlah</ThemedText>
          <View style={styles.qtyRow}>
            <Pressable
              style={[styles.qtyBtn, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100 }]}
              onPress={() => setJumlah(Math.max(1, jumlah - 1))}
            >
              <Ionicons name="remove" size={20} color={COLORS.primary} />
            </Pressable>
            <ThemedText style={[styles.qtyText, { color: isDark ? '#fff' : COLORS.dark }]}>{jumlah}</ThemedText>
            <Pressable
              style={[styles.qtyBtn, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100 }]}
              onPress={() => setJumlah(Math.min(bag.stok, jumlah + 1))}
            >
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? COLORS.gray800 : COLORS.white }]}>
        <View>
          <ThemedText style={styles.totalLabel}>Total</ThemedText>
          <ThemedText style={styles.totalPrice}>Rp {(bag.harga * jumlah).toLocaleString('id-ID')}</ThemedText>
        </View>
        <Pressable
          style={[styles.orderBtn, { opacity: ordering ? 0.7 : 1 }]}
          onPress={handleOrder}
          disabled={ordering}
        >
          {ordering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.orderBtnText}>Pesan Sekarang</ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { height: 200, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 52, left: 16, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 8 },
  favBtn: { position: 'absolute', top: 52, right: 16, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 8 },
  heroEmoji: { fontSize: 72 },
  diskonBadge: { position: 'absolute', top: 98, right: 16, backgroundColor: COLORS.secondary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  diskonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  content: { padding: 18 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  tokoName: { fontSize: 20, fontWeight: '800', flex: 1 },
  stokBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  stokText: { fontSize: 11, fontWeight: '700' },
  menuName: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  tokoSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  kategori: { fontSize: 13, color: COLORS.gray400, marginBottom: 14 },
  infoCard: { borderRadius: 12, padding: 12, gap: 8, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: COLORS.gray600 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray600, marginBottom: 8 },
  miniMapWrap: { height: 160, borderRadius: 14, overflow: 'hidden', marginBottom: 16, borderWidth: 0.5, borderColor: COLORS.gray200 },
  miniMap: { flex: 1 },
  deskripsi: { fontSize: 13, lineHeight: 21, color: COLORS.gray600, marginBottom: 18 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 20, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 32, borderTopWidth: 0.5, borderTopColor: COLORS.gray200 },
  totalLabel: { fontSize: 12, color: COLORS.gray400 },
  totalPrice: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  orderBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, minWidth: 150, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});