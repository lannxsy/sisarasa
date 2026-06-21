import { useRouter } from 'expo-router';
import { onSnapshot, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '../lib/firebase';
import { favoritesCollection, removeFavorite } from '../lib/favorites';
import { COLORS } from '@/constants/theme';

interface FavoriteItem {
  id: string;
  bagId: string;
  tokoNama: string;
  kategori: string;
  harga: number;
  hargaAsli: number;
  emoji: string;
  imageUrl?: string;
  jamPickup?: string;
  alamat?: string;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  // userId TIDAK dibaca langsung dari auth.currentUser?.uid di render pertama
  // — itu yang bikin layar ini sempat nunjukin "Masuk dulu..." padahal user
  // udah login (auth.currentUser masih null sesaat pas app baru dibuka,
  // sebelum sesinya selesai di-restore). Tunggu onAuthStateChanged dulu.
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setAuthReady(true);
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!authReady) return; // tunggu status login dipastikan dulu
    if (!userId) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    const q = query(
      favoritesCollection(),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setFavorites(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FavoriteItem, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, [authReady, userId]);

  const handleRemove = async (bagId: string) => {
    if (!userId) return;
    await removeFavorite(userId, bagId);
  };

  // Fallback gambar: dokumen favorites itu snapshot data pas di-fav, jadi
  // kalau toko baru UPLOAD/UPDATE foto SETELAH user nge-fav, favorit lama
  // tetap kesimpen dengan imageUrl kosong. Daripada nulis ulang ke
  // favorites (yang bisa nimpa data lain), kita fetch imageUrl terbaru
  // dari magic_bags cuma buat item yang kosong, sekali per bagId, dan
  // simpan di cache lokal terpisah supaya gak fetch berulang tiap render.
  const [fallbackImages, setFallbackImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const missing = favorites.filter((f) => !f.imageUrl && !(f.bagId in fallbackImages));
    if (missing.length === 0) return;

    missing.forEach(async (item) => {
      try {
        const snap = await getDoc(doc(db, 'magic_bags', item.bagId));
        if (snap.exists()) {
          const url = (snap.data() as { imageUrl?: string }).imageUrl;
          if (url) {
            setFallbackImages((prev) => ({ ...prev, [item.bagId]: url }));
          }
        }
      } catch {
        // Toko/menu mungkin udah dihapus — biarin fallback ke emoji aja, gapapa.
      }
    });
  }, [favorites, fallbackImages]);

  const renderItem = ({ item }: { item: FavoriteItem }) => {
    const imageUrl = item.imageUrl || fallbackImages[item.bagId];
    return (
    <Pressable
      style={[styles.card, { backgroundColor: isDark ? COLORS.gray800 : COLORS.white }]}
      onPress={() => router.push({ pathname: '/detail', params: { id: item.bagId } })}
    >
      <View style={styles.cardEmoji}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <ThemedText style={styles.emoji}>{item.emoji || '🛍️'}</ThemedText>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.tokoName}>{item.tokoNama}</ThemedText>
        <ThemedText style={styles.kategori}>{item.kategori}</ThemedText>
        <View style={styles.priceRow}>
          <ThemedText style={styles.harga}>Rp {item.harga.toLocaleString('id-ID')}</ThemedText>
          <ThemedText style={styles.hargaAsli}>Rp {item.hargaAsli.toLocaleString('id-ID')}</ThemedText>
        </View>
      </View>
      <Pressable
        style={styles.heartBtn}
        onPress={(e) => {
          e.stopPropagation();
          handleRemove(item.bagId);
        }}
        hitSlop={8}
      >
        <Ionicons name="heart" size={22} color={COLORS.danger} />
      </Pressable>
    </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <ThemedText style={styles.headerTitle}>Favorit</ThemedText>
      </View>

      {!authReady ? null : !userId ? (
        <View style={styles.empty}>
          <ThemedText style={{ fontSize: 48 }}>🔒</ThemedText>
          <ThemedText style={styles.emptyText}>Masuk dulu untuk lihat favorit kamu</ThemedText>
        </View>
      ) : loading ? null : favorites.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={{ fontSize: 48 }}>🤍</ThemedText>
          <ThemedText style={styles.emptyText}>Belum ada toko favorit</ThemedText>
          <ThemedText style={styles.emptySub}>Tap ikon hati di Magic Bag yang kamu suka</ThemedText>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, marginBottom: 12, elevation: 2 },
  cardEmoji: { width: 50, height: 50, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  emoji: { fontSize: 24 },
  tokoName: { fontSize: 15, fontWeight: '700' },
  kategori: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  harga: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  hargaAsli: { fontSize: 11, color: COLORS.gray400, textDecorationLine: 'line-through' },
  heartBtn: { padding: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: COLORS.gray400, fontWeight: '600' },
  emptySub: { fontSize: 12, color: COLORS.gray400 },
});