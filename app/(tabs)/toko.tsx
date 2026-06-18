import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View, useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '../lib/firebase';
import { addFavorite, favoritesCollection, removeFavorite } from '../lib/favorites';
import { COLORS } from '@/constants/theme';

interface MagicBag {
  id: string;
  tokoNama: string;
  kategori: string;
  harga: number;
  hargaAsli: number;
  stok: number;
  jamPickup: string;
  deskripsi: string;
  emoji: string;
  alamat?: string;
}

export default function TokoScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [bags, setBags] = useState<MagicBag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    const q = query(collection(db, 'magic_bags'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setBags(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MagicBag, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setFavoriteIds(new Set());
      return;
    }
    const q = query(favoritesCollection(), where('userId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
      setFavoriteIds(new Set(snap.docs.map((d) => d.data().bagId as string)));
    });
    return unsub;
  }, [userId]);

  const toggleFavorite = async (item: MagicBag) => {
    if (!userId) return;
    if (favoriteIds.has(item.id)) {
      await removeFavorite(userId, item.id);
    } else {
      await addFavorite(userId, item.id, {
        tokoNama: item.tokoNama,
        kategori: item.kategori,
        harga: item.harga,
        hargaAsli: item.hargaAsli,
        emoji: item.emoji,
        jamPickup: item.jamPickup,
        alamat: item.alamat,
      });
    }
  };

  const filtered = bags.filter(
    (b) =>
      b.tokoNama.toLowerCase().includes(search.toLowerCase()) ||
      b.kategori.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: MagicBag }) => {
    const isFav = favoriteIds.has(item.id);
    const habis = item.stok <= 0;
    return (
      <Pressable
        style={[styles.card, { backgroundColor: isDark ? COLORS.gray800 : COLORS.white, opacity: habis ? 0.6 : 1 }]}
        onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
        disabled={habis}
      >
        <View style={styles.cardEmoji}>
          <ThemedText style={styles.emoji}>{item.emoji || '🛍️'}</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.tokoName}>{item.tokoNama}</ThemedText>
          <ThemedText style={styles.kategori}>{item.kategori}</ThemedText>
          <View style={styles.pickupRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.gray400} />
            <ThemedText style={styles.pickupText}> {item.jamPickup}</ThemedText>
          </View>
          <View style={styles.priceRow}>
            <ThemedText style={styles.harga}>Rp {item.harga.toLocaleString('id-ID')}</ThemedText>
            <ThemedText style={styles.hargaAsli}>Rp {item.hargaAsli.toLocaleString('id-ID')}</ThemedText>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Pressable
            style={styles.heartBtn}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item);
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? COLORS.danger : COLORS.gray400}
            />
          </Pressable>
          <View style={[styles.stokBadge, habis && { backgroundColor: '#fee2e2' }]}>
            <ThemedText style={[styles.stokText, habis && { color: COLORS.danger }]}>
              {habis ? 'Habis' : `${item.stok} sisa`}
            </ThemedText>
          </View>
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
        <View style={styles.emptyWrap}>
          <ThemedText style={{ fontSize: 48 }}>🔍</ThemedText>
          <ThemedText style={styles.emptyText}>Toko tidak ditemukan</ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
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
  searchBar: { marginHorizontal: 16, marginTop: 14, marginBottom: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
  cardEmoji: { width: 50, height: 50, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  emoji: { fontSize: 26 },
  tokoName: { fontSize: 14, fontWeight: '700' },
  kategori: { fontSize: 11, color: COLORS.gray400, marginTop: 1 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  pickupText: { fontSize: 11, color: COLORS.gray400 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  harga: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  hargaAsli: { fontSize: 11, color: COLORS.gray400, textDecorationLine: 'line-through' },
  stokBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  stokText: { fontSize: 11, fontWeight: '700', color: COLORS.primaryDark },
  heartBtn: { padding: 4 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.gray400 },
});
