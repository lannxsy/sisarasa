import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View, useColorScheme, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaveHeader } from '@/components/wave-header';
import { db } from '../lib/firebase';
import { COLORS } from '@/constants/theme';
import { hitungJarakKm, formatJarak } from '../lib/distance';

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

interface TokoGroup {
  storeId: string;
  tokoNama: string;
  imageUrl?: string;
  emoji: string;
  alamat?: string;
  kategoriList: string[];
  totalMenu: number;
  totalStok: number;
  hargaTermurah: number;
  adaStokTersedia: boolean;
  tokoBuka: boolean;
  jamPickup: string;
  lat?: number;
  lng?: number;
  storeExists?: boolean;
  jarakKm: number | null;
}

export default function TokoScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [bags, setBags] = useState<MagicBag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  // Lokasi user dipakai untuk menghitung & mengurutkan jarak tiap toko.
  // Diambil otomatis begitu tab ini terbuka (izin lokasi sudah diminta
  // sebelumnya di layar map intro, jadi biasanya langsung granted di sini).
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        // Pakai lastKnownPosition dulu (instan) supaya list langsung muncul
        const last = await Location.getLastKnownPositionAsync();
        if (last && isMounted) {
          setUserLat(last.coords.latitude);
          setUserLng(last.coords.longitude);
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isMounted) return;
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
      } catch {
        // Gagal ambil lokasi (GPS mati/izin ditolak) -> list tetap tampil,
        // cuma tanpa info jarak & urutan default (terbaru).
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cache dokumen stores/{storeId} → { imageUrl, address }. Dipakai untuk
  // menimpa foto & alamat hasil grouping dari magic_bags, supaya kartu
  // toko di list ini tampil foto TOKO (dari Pengaturan Toko), bukan foto
  // menu pertama milik toko itu.
  const [storeDocs, setStoreDocs] = useState<Record<string, { imageUrl?: string; address?: string; isActive?: boolean } | null>>({});

  useEffect(() => {
    const q = query(collection(db, 'magic_bags'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setBags(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Listener real-time ke SELURUH koleksi stores sekaligus (1 query) —
  // lebih efisien daripada pasang onSnapshot per storeId (N query).
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores'), (snap) => {
      const docs: Record<string, { imageUrl?: string; address?: string; isActive?: boolean } | null> = {};
      snap.forEach((d) => {
        docs[d.id] = d.data() as { imageUrl?: string; address?: string; isActive?: boolean };
      });
      setStoreDocs(docs);
    });
    return unsub;
  }, []);

  // Group magic_bags berdasarkan storeId (fallback: tokoNama kalau storeId kosong)
  const tokoGroups: TokoGroup[] = React.useMemo(() => {
    const map = new Map<string, TokoGroup>();
    for (const bag of bags) {
      // DULU: bag stok 0 di-skip total (continue) dari grouping. Itu bikin
      // toko yang cuma punya 1 menu langsung HILANG dari list pas stoknya
      // habis (bukan ditampilkan "Stok Habis"). Sekarang menu tetap masuk
      // grouping; status tersedia/habis-nya ditandai lewat adaStokTersedia,
      // dan ditampilkan di kartu toko (lihat renderItem) — bukan disembunyikan.
      const tersedia = bag.stok > 0;
      const key = bag.storeId || bag.tokoNama;
      const existing = map.get(key);
      if (existing) {
        existing.totalMenu += 1;
        if (tersedia) {
          existing.totalStok += bag.stok;
          existing.adaStokTersedia = true;
          if (bag.harga < existing.hargaTermurah) existing.hargaTermurah = bag.harga;
        }
        if (!existing.kategoriList.includes(bag.kategori)) existing.kategoriList.push(bag.kategori);
        // imageUrl/alamat dari menu HANYA dipakai sebagai fallback data lama
        // (storeExists === false). Kalau dokumen stores sudah ada, foto &
        // alamat toko murni dari sana — tidak boleh ketiban foto menu.
        if (!existing.storeExists && !existing.imageUrl && bag.imageUrl) existing.imageUrl = bag.imageUrl;
      } else {
        const storeDoc = bag.storeId ? storeDocs[bag.storeId] : undefined;
        const storeExists = !!storeDoc;
        map.set(key, {
          storeId: key,
          tokoNama: bag.tokoNama,
          imageUrl: storeExists ? storeDoc!.imageUrl : bag.imageUrl,
          emoji: bag.emoji || '🏪',
          alamat: storeExists ? (storeDoc!.address ?? bag.alamat) : bag.alamat,
          kategoriList: [bag.kategori],
          totalMenu: 1,
          totalStok: tersedia ? bag.stok : 0,
          hargaTermurah: tersedia ? bag.harga : Infinity,
          adaStokTersedia: tersedia,
          // Sama kayak settings.html: kalau field isActive belum pernah
          // di-set (toko lama/belum pernah disentuh togglenya), defaultnya
          // dianggap BUKA (true), bukan tutup.
          tokoBuka: storeDoc?.isActive !== false,
          jamPickup: bag.jamPickup,
          lat: bag.lat,
          lng: bag.lng,
          storeExists,
          jarakKm: null,
        });
      }
    }
    return Array.from(map.values());
  }, [bags, storeDocs]);

  // Hitung jarak tiap toko dari lokasi user (kalau lokasi & koordinat toko
  // ada), lalu urutkan list dari yang TERDEKAT. Toko tanpa koordinat atau
  // saat lokasi user belum tersedia diletakkan di paling bawah (bukan
  // dihilangkan), supaya tetap bisa ditemukan lewat pencarian.
  const tokoGroupsDenganJarak: TokoGroup[] = React.useMemo(() => {
    if (userLat == null || userLng == null) return tokoGroups;
    return tokoGroups.map((t) => ({
      ...t,
      jarakKm:
        t.lat != null && t.lng != null
          ? hitungJarakKm(userLat, userLng, t.lat, t.lng)
          : null,
    }));
  }, [tokoGroups, userLat, userLng]);

  const filtered = tokoGroupsDenganJarak
    .filter(
      (t) =>
        (t.tokoNama.toLowerCase().includes(search.toLowerCase()) ||
        t.kategoriList.some((k) => k.toLowerCase().includes(search.toLowerCase()))) &&
        (t.jarakKm == null || t.jarakKm <= 5) // FILTER: hanya toko dalam radius 5km
    )
    .sort((a, b) => {
      if (a.jarakKm == null && b.jarakKm == null) return 0;
      if (a.jarakKm == null) return 1;
      if (b.jarakKm == null) return -1;
      return a.jarakKm - b.jarakKm;
    });

  const renderItem = ({ item }: { item: TokoGroup }) => {
    // Toko tutup itu kondisi yang LEBIH dominan daripada stok habis — kalau
    // tokonya ditutup admin, gak peduli stoknya ada atau nggak, pembeli
    // tetap harus liat "Toko Tutup", bukan "Stok Habis".
    const redup = !item.tokoBuka || !item.adaStokTersedia;
    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: isDark ? COLORS.gray800 : COLORS.white },
          redup && styles.cardHabis,
        ]}
        onPress={() => router.push({ pathname: '/toko-detail', params: { storeId: item.storeId } })}
      >
        <View style={styles.cardImageWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <ThemedText style={styles.emoji}>{item.emoji}</ThemedText>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.tokoName}>{item.tokoNama}</ThemedText>
          <ThemedText style={styles.kategori} numberOfLines={1}>
            {item.kategoriList.join(', ')}
          </ThemedText>
          <View style={styles.pickupRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.gray400} />
            <ThemedText style={styles.pickupText}> {item.jamPickup}</ThemedText>
            {item.jarakKm != null && (
              <>
                <ThemedText style={styles.dotSep}> · </ThemedText>
                <Ionicons name="location-outline" size={12} color={COLORS.gray400} />
                <ThemedText style={styles.pickupText}> {formatJarak(item.jarakKm)}</ThemedText>
              </>
            )}
          </View>
          {!item.tokoBuka ? (
            <ThemedText style={styles.habisText}>Toko Tutup</ThemedText>
          ) : item.adaStokTersedia ? (
            <ThemedText style={styles.hargaMulai}>
              Mulai Rp {item.hargaTermurah.toLocaleString('id-ID')}
            </ThemedText>
          ) : (
            <ThemedText style={styles.habisText}>Stok Habis</ThemedText>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.menuBadge, redup && styles.menuBadgeHabis]}>
            <ThemedText style={[styles.menuBadgeText, redup && styles.menuBadgeTextHabis]}>
              {!item.tokoBuka ? 'Tutup' : `${item.totalMenu} menu`}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <WaveHeader height={170}>
        <ThemedText style={[styles.headerEyebrow, { color: 'rgba(255,255,255,0.85)' }]}>Selamat datang 👋</ThemedText>
        <ThemedText type="title" style={[styles.headerTitle, { color: '#fff' }]}>Satu Aksimu, Satu Makanan Terselamatkan</ThemedText>
      </WaveHeader>

      <View style={[styles.searchBar, { backgroundColor: COLORS.white }]}>
        <Ionicons name="search" size={18} color={COLORS.gray400} />
        <TextInput
          placeholder="Cari toko atau kategori..."
          placeholderTextColor={COLORS.gray400}
          style={[styles.searchInput, { color: COLORS.dark }]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={{ fontSize: 48, lineHeight: 58 }}>🔍</ThemedText>
          <ThemedText style={styles.emptyText}>Toko tidak ditemukan</ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.storeId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  headerEyebrow: { fontSize: 13, marginBottom: 2 },
  headerTitle: { fontSize: 24, lineHeight: 28 },
  searchBar: {
    marginHorizontal: 20, marginTop: -22, marginBottom: 6,
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    paddingHorizontal: 14, height: 50,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 18,
    padding: 12, marginBottom: 10, elevation: 2,
    shadowColor: COLORS.gray800, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 8,
    backgroundColor: COLORS.white,
  },
  cardHabis: { opacity: 0.55 },
  cardImageWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%' },
  emoji: { fontSize: 26 },
  tokoName: { fontSize: 15, fontWeight: '700' },
  kategori: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  pickupText: { fontSize: 11, color: COLORS.gray400 },
  dotSep: { fontSize: 11, color: COLORS.gray400 },
  hargaMulai: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark, marginTop: 4 },
  habisText: { fontSize: 13, fontWeight: '800', color: COLORS.danger, marginTop: 4 },
  menuBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  menuBadgeHabis: { backgroundColor: '#fee2e2' },
  menuBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.accentDark },
  menuBadgeTextHabis: { color: COLORS.danger },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: COLORS.gray400 },
});