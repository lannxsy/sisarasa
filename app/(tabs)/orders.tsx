import React, { useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet, useColorScheme,
  Pressable, Modal, ActivityIndicator, Linking,
} from 'react-native';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '../lib/firebase';
import { COLORS } from '@/constants/theme';

interface Order {
  id: string;
  tokoNama: string;
  harga: number;
  status: 'pending' | 'confirmed' | 'selesai' | 'batal';
  createdAt: number;
  kodePickup: string;
  emoji: string;
  jumlah: number;
  bagId?: string;
}

interface StoreLocation {
  alamat?: string;
  lat?: number;
  lng?: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Menunggu',     color: '#f59e0b' },
  confirmed: { label: 'Dikonfirmasi', color: COLORS.primary },
  selesai:   { label: 'Selesai',      color: '#6366f1' },
  batal:     { label: 'Dibatalkan',   color: COLORS.danger },
};

export default function OrdersScreen() {
  const isDark = useColorScheme() === 'dark';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<Order | null>(null);
  const [storeLocation, setStoreLocation] = useState<StoreLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  // Ambil lokasi toko (alamat, lat, lng) dari magic_bags begitu modal
  // dibuka, jadi pembeli langsung tahu dimana harus pickup tanpa perlu
  // balik ke tab Toko.
  useEffect(() => {
    if (!qrModal) {
      setStoreLocation(null);
      return;
    }
    if (!qrModal.bagId) return;
    setLocationLoading(true);
    getDoc(doc(db, 'magic_bags', qrModal.bagId))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setStoreLocation({ alamat: d.alamat, lat: d.lat, lng: d.lng });
        } else {
          setStoreLocation(null);
        }
      })
      .catch(() => setStoreLocation(null))
      .finally(() => setLocationLoading(false));
  }, [qrModal]);

  const openMaps = () => {
    if (!storeLocation?.lat || !storeLocation?.lng) return;
    const label = encodeURIComponent(qrModal?.tokoNama || 'Toko');
    const url = `https://www.google.com/maps/search/?api=1&query=${storeLocation.lat},${storeLocation.lng}&query_place_id=${label}`;
    Linking.openURL(url).catch(() => {});
  };

  const renderItem = ({ item }: { item: Order }) => {
    const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending;
    return (
      <Pressable
        style={[styles.card, { backgroundColor: isDark ? COLORS.gray800 : COLORS.white }]}
        onPress={() => setQrModal(item)}
      >
        <View style={styles.cardEmoji}>
          <ThemedText style={styles.emoji}>{item.emoji || '🛍️'}</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.tokoName}>{item.tokoNama}</ThemedText>
          <ThemedText style={styles.sub}>
            {item.jumlah}x Magic Bag • Rp {item.harga.toLocaleString('id-ID')}
          </ThemedText>
          <ThemedText style={styles.sub}>
            {new Date(item.createdAt).toLocaleString('id-ID')}
          </ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: st.color + '22' }]}>
          <ThemedText style={[styles.badgeText, { color: st.color }]}>{st.label}</ThemedText>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <ThemedText style={styles.headerTitle}>Pesanan Saya</ThemedText>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={{ fontSize: 48 }}>🛒</ThemedText>
          <ThemedText style={styles.emptyText}>Belum ada pesanan</ThemedText>
          <ThemedText style={styles.emptySubText}>Pesan Magic Bag di tab Toko!</ThemedText>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* QR Modal */}
      <Modal
        visible={!!qrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setQrModal(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: isDark ? '#1e293b' : COLORS.white }]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            <ThemedText style={styles.modalTitle}>Kode Pickup</ThemedText>
            <ThemedText style={styles.modalToko}>{qrModal?.tokoNama}</ThemedText>

            {/* QR dummy */}
            <View style={styles.qrWrap}>
              <View style={styles.qrGrid}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.qrCell,
                      {
                        backgroundColor:
                          [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,7,17,12].includes(i)
                            ? (isDark ? '#fff' : '#0f172a')
                            : 'transparent',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Kode */}
            <View style={styles.kodeWrap}>
              <ThemedText style={styles.kodeLabel}>Kode</ThemedText>
              <ThemedText style={styles.kodeText}>{qrModal?.kodePickup}</ThemedText>
            </View>

            {/* Status pembayaran */}
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <ThemedText style={styles.successText}>Pembayaran Berhasil</ThemedText>
            </View>

            <ThemedText style={styles.modalHint}>
              Tunjukkan kode ini ke toko saat mengambil pesanan
            </ThemedText>

            {/* Info pesanan */}
            <View style={[styles.infoBox, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100 }]}>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Total Bayar</ThemedText>
                <ThemedText style={styles.infoValue}>
                  Rp {qrModal?.harga.toLocaleString('id-ID')}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Status</ThemedText>
                <ThemedText style={[styles.infoValue, {
                  color: STATUS_LABEL[qrModal?.status ?? 'pending']?.color
                }]}>
                  {STATUS_LABEL[qrModal?.status ?? 'pending']?.label}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Tanggal</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {qrModal ? new Date(qrModal.createdAt).toLocaleDateString('id-ID') : ''}
                </ThemedText>
              </View>
            </View>

            {/* Lokasi pickup */}
            <View style={[styles.infoBox, { backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100, width: '100%' }]}>
              <View style={styles.locationHeader}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                <ThemedText style={styles.locationTitle}>Lokasi Pickup</ThemedText>
              </View>
              {locationLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
              ) : storeLocation?.alamat || storeLocation?.lat ? (
                <>
                  {storeLocation.alamat && (
                    <ThemedText style={styles.locationAddress}>{storeLocation.alamat}</ThemedText>
                  )}
                  {storeLocation.lat && storeLocation.lng && (
                    <Pressable style={styles.mapsBtn} onPress={openMaps}>
                      <Ionicons name="navigate-outline" size={15} color={COLORS.primary} />
                      <ThemedText style={styles.mapsBtnText}>Buka di Google Maps</ThemedText>
                    </Pressable>
                  )}
                </>
              ) : (
                <ThemedText style={styles.locationAddress}>Lokasi toko belum tersedia.</ThemedText>
              )}
            </View>

            <Pressable style={styles.closeBtn} onPress={() => setQrModal(null)}>
              <ThemedText style={styles.closeBtnText}>Tutup</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 14, marginBottom: 10, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
  },
  cardEmoji: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  emoji: { fontSize: 24 },
  tokoName: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySubText: { fontSize: 13, color: COLORS.gray400 },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, alignItems: 'center',
  },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.gray200, marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalToko: { fontSize: 13, color: COLORS.gray400, marginBottom: 20 },

  // QR
  qrWrap: {
    borderWidth: 2, borderColor: COLORS.gray200,
    borderRadius: 16, padding: 14, marginBottom: 16,
  },
  qrGrid: {
    width: 150, height: 150,
    flexDirection: 'row', flexWrap: 'wrap', gap: 2,
  },
  qrCell: { width: 26, height: 26, borderRadius: 3 },

  kodeWrap: { alignItems: 'center', marginBottom: 14 },
  kodeLabel: { fontSize: 11, color: COLORS.gray400, marginBottom: 4 },
  kodeText: {
    fontSize: 32, fontWeight: '900',
    letterSpacing: 6, color: COLORS.primary,
  },

  successRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginBottom: 12,
  },
  successText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  modalHint: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', marginBottom: 16 },

  infoBox: { width: '100%', borderRadius: 14, padding: 14, gap: 8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: COLORS.gray400 },
  infoValue: { fontSize: 13, fontWeight: '700' },

  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  locationTitle: { fontSize: 13, fontWeight: '700' },
  locationAddress: { fontSize: 12, color: COLORS.gray400, lineHeight: 18 },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, backgroundColor: COLORS.primaryLight,
  },
  mapsBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  closeBtn: {
    backgroundColor: COLORS.primary, width: '100%',
    paddingVertical: 16, borderRadius: 16, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});