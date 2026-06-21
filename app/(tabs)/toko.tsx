import { useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View, useColorScheme, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '../lib/firebase';
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
}

export default function TokoScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [bags, setBags] = useState<MagicBag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
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

  // Ambil dokumen stores/{storeId} untuk tiap storeId baru yang belum ada
  // di cache. storeId di sini bisa berupa uid toko asli, atau (data lama)
  // tokoNama — kalau dokumennya tidak ditemukan, ditandai null supaya
  // grouping di bawah tahu harus fallback ke data menu.
  useEffect(() => {
    const ids = Array.from(new Set(bags.map((b) => b.storeId).filter((id): id is string => !!id)));
    const missing = ids.filter((id) => !(id in storeDocs));
    if (missing.length === 0) return;
    missing.forEach(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'stores', id));
        setStoreDocs((prev) => ({
          ...prev,
          [id]: snap.exists() ? (snap.data() as { imageUrl?: string; address?: string; isActive?: boolean }) : null,
        }));
      } catch {
        setStoreDocs((prev) => ({ ...prev, [id]: null }));
      }
    });
  }, [bags, storeDocs]);

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
        });
      }
    }
    return Array.from(map.values());
  }, [bags, storeDocs]);

  const filtered = tokoGroups.filter(
    (t) =>
      t.tokoNama.toLowerCase().includes(search.toLowerCase()) ||
      t.kategoriList.some((k) => k.toLowerCase().includes(search.toLowerCase()))
  );

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
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <ThemedText style={styles.headerTitle}>Toko</ThemedText>
      </View>

      <View style={[styles.searchBar, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100 }]}>
        <Ionicons name="search" size={18} color={COLORS.gray400} />
        <TextInput
          placeholder="Cari toko atau kategori..."
          placeholderTextColor={COLORS.gray400}
          style={[styles.searchInput, { color: isDark ? '#fff' : COLORS.dark }]}
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
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  searchBar: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 12, marginBottom: 10, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
  },
  cardHabis: { opacity: 0.55 },
  cardImageWrap: {
    width: 56, height: 56, borderRadius: 14,
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
  hargaMulai: { fontSize: 13, fontWeight: '800', color: COLORS.primary, marginTop: 4 },
  habisText: { fontSize: 13, fontWeight: '800', color: COLORS.danger, marginTop: 4 },
  menuBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  menuBadgeHabis: { backgroundColor: '#fee2e2' },
  menuBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primaryDark },
  menuBadgeTextHabis: { color: COLORS.danger },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: COLORS.gray400 },
});