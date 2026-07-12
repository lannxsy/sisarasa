import React, { useEffect, useRef, useState } from 'react';
import {
  View, FlatList, StyleSheet, useColorScheme,
  Pressable, Modal, ActivityIndicator, Linking, Image, Alert,
  ScrollView, Dimensions, TextInput,
} from 'react-native';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaveHeader } from '@/components/wave-header';
import { auth, db } from '../lib/firebase';
import { registerForPushNotifications, scheduleLocalNotification } from '../lib/notifications';
import { submitReview } from '../lib/reviews';
import { COLORS, GRADIENTS } from '@/constants/theme';

interface Order {
  id: string;
  tokoNama: string;
  namaMenu?: string;
  imageUrl?: string;
  harga: number;
  storeId?: string;
  // Termasuk 'selesai'/'batal' (skema lama, Bahasa Indonesia) karena order
  // yang dibuat SEBELUM standar disatukan ke 'completed'/'cancelled' masih
  // bisa ada di Firestore. UI sengaja cek dua-duanya (lihat badge di bawah).
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'selesai' | 'batal';
  // Order baru: Firestore Timestamp (dari serverTimestamp()).
  // Order lama (sebelum diperbaiki): number biasa (dari Date.now()).
  // Keduanya bisa muncul, makanya helper toDate() di bawah cek dua-duanya.
  createdAt: Timestamp | number;
  kodePickup: string;
  emoji: string;
  jumlah: number;
  bagId?: string;
}

// serverTimestamp() menulis Firestore Timestamp object (punya .toDate()),
// sedangkan order lama nulis Date.now() (number biasa). new Date(timestamp)
// langsung gagal jadi "Invalid Date" kalau dikasih Timestamp object — jadi
// semua pembacaan createdAt WAJIB lewat helper ini, jangan new Date() langsung.
function toDate(value: Timestamp | number | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value);
  if (typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  return null;
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
  completed: { label: 'Selesai',      color: '#6366f1' },
  batal:     { label: 'Dibatalkan',   color: COLORS.danger },
  cancelled: { label: 'Dibatalkan',   color: COLORS.danger },
};

export default function OrdersScreen() {
  const isDark = useColorScheme() === 'dark';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<Order | null>(null);
  const [storeLocation, setStoreLocation] = useState<StoreLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const userId = auth.currentUser?.uid;

  // Set berisi orderId yang SUDAH direview, dipakai buat mutusin tampilan
  // tombol di tiap card: "Beri Rating" (belum pernah) vs "Rating Terkirim"
  // (sudah). Karena docId review = orderId (lihat lib/reviews.ts), cukup
  // dengar koleksi reviews milik user ini dan simpan id-nya doang.
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());
  const [ratingModal, setRatingModal] = useState<Order | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Lacak status TERAKHIR yang udah pernah keliatan per order id, biar bisa
  // bedain "status beneran baru berubah barusan" vs "ini emang dari awal
  // udah confirmed/completed pas listener pertama kali nyala" (misal pas
  // app baru dibuka). Tanpa ini, buka app sekali bisa langsung nge-notif
  // SEMUA pesanan lama yang udah confirmed dari kemarin-kemarin.
  const prevStatusRef = useRef<Record<string, Order['status']>>({});
  const isFirstSnapshotRef = useRef(true);

  // Minta izin notifikasi sekali pas tab Pesanan pertama dibuka. Local
  // notification (scheduleLocalNotification) tetap butuh izin ini biar
  // beneran muncul, walau kita gak pernah pakai expo push token-nya di sini.
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
      setOrders(list);
      setLoading(false);

      // Notif lokal cuma muncul SELAMA APP KEBUKA (listener ini jalan).
      // Ini bukan push notification beneran dari server — kalau mau notif
      // tetep masuk pas app fully closed, butuh Cloud Function terpisah
      // yang ngirim lewat Expo Push API pas admin update status di web.
      for (const o of list) {
        const prev = prevStatusRef.current[o.id];
        const changed = !isFirstSnapshotRef.current && !!prev && prev !== o.status;
        if (changed) {
          if (o.status === 'confirmed') {
            scheduleLocalNotification(
              'Pesanan Dikonfirmasi! 🎉',
              `${o.namaMenu || o.tokoNama} di ${o.tokoNama} sudah dikonfirmasi toko. Tunjukkan kode pickup-nya ya saat ambil!`,
              { screen: 'orders', orderId: o.id }
            );
          } else if (o.status === 'completed' || o.status === 'selesai') {
            scheduleLocalNotification(
              'Pesanan Selesai ✅',
              `Terima kasih sudah belanja di ${o.tokoNama}! Sampai jumpa lagi.`,
              { screen: 'orders', orderId: o.id }
            );
          } else if (o.status === 'cancelled' || o.status === 'batal') {
            scheduleLocalNotification(
              'Pesanan Dibatalkan',
              `Pesanan kamu di ${o.tokoNama} dibatalkan oleh toko.`,
              { screen: 'orders', orderId: o.id }
            );
          }
        }
        prevStatusRef.current[o.id] = o.status;
      }
      isFirstSnapshotRef.current = false;
    });
    return unsub;
  }, [userId]);

  // Dengar koleksi reviews milik user ini secara real-time, biar begitu
  // submit rating berhasil, tombol di card langsung berubah jadi "Rating
  // Terkirim" tanpa perlu refresh manual.
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'reviews'), where('userId', '==', userId));
    const unsub = onSnapshot(q, (snap) => {
      setReviewedOrderIds(new Set(snap.docs.map((d) => d.id)));
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

  const openRatingModal = (item: Order) => {
    setRatingValue(0);
    setRatingComment('');
    setRatingModal(item);
  };

  const submitRating = async () => {
    if (!ratingModal || !userId) return;
    if (!ratingModal.storeId) {
      Alert.alert('Gagal', 'Data toko untuk pesanan ini tidak lengkap, tidak bisa diberi rating.');
      return;
    }
    if (ratingValue < 1) {
      Alert.alert('Validasi', 'Pilih dulu jumlah bintangnya ya.');
      return;
    }
    setSubmittingReview(true);
    try {
      const namaUser =
        auth.currentUser?.displayName ||
        auth.currentUser?.email?.split('@')[0] ||
        'Pembeli';
      await submitReview(ratingModal.id, {
        storeId: ratingModal.storeId,
        userId,
        userName: namaUser,
        rating: ratingValue,
        comment: ratingComment.trim(),
      });
      setRatingModal(null);
    } catch (e: any) {
      Alert.alert('Gagal Mengirim Rating', e?.message ?? 'Terjadi kesalahan, coba lagi.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCardPress = (item: Order) => {
    // Selagi masih 'pending' (Menunggu), toko belum acc pesanan ini —
    // kode pickup-nya jangan ditunjukkan dulu. Modal/QR baru boleh dibuka
    // setelah status berubah jadi 'confirmed' (atau status lanjutannya).
    if (item.status === 'pending') {
      Alert.alert(
        'Menunggu Konfirmasi',
        'Pesanan kamu masih menunggu konfirmasi dari toko. Kode pickup akan muncul setelah pesanan dikonfirmasi.'
      );
      return;
    }
    setQrModal(item);
  };

  const renderItem = ({ item }: { item: Order }) => {
    const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending;
    const isPending = item.status === 'pending';
    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: isDark ? COLORS.gray800 : COLORS.white },
          isPending && styles.cardDisabled,
        ]}
        onPress={() => handleCardPress(item)}
      >
        <View style={styles.cardEmoji}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <ThemedText style={styles.emoji}>{item.emoji || '🛍️'}</ThemedText>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.tokoName}>{item.tokoNama}</ThemedText>
          {item.namaMenu ? (
            <ThemedText style={styles.menuName}>{item.namaMenu}</ThemedText>
          ) : null}
          <ThemedText style={styles.sub}>
            {item.jumlah}x Magic Bag • Rp {item.harga.toLocaleString('id-ID')}
          </ThemedText>
          <ThemedText style={styles.sub}>
            {toDate(item.createdAt)?.toLocaleString('id-ID') ?? '-'}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.badge, { backgroundColor: st.color + '22' }]}>
            <ThemedText style={[styles.badgeText, { color: st.color }]}>{st.label}</ThemedText>
          </View>

          {/* Tombol rating cuma muncul buat order yang udah 'completed'/
              'selesai'. Dipisah dari onPress card (yang buka modal QR)
              pakai Pressable sendiri, biar RN touch responder nangkep
              tap di tombol ini duluan, bukan ikut trigger buka modal QR. */}
          {(item.status === 'completed' || item.status === 'selesai') && (
            reviewedOrderIds.has(item.id) ? (
              <View style={styles.ratedBadge}>
                <Ionicons name="star" size={11} color={COLORS.gray400} />
                <ThemedText style={styles.ratedBadgeText}>Sudah dinilai</ThemedText>
              </View>
            ) : (
              <Pressable
                style={styles.rateBtn}
                onPress={() => openRatingModal(item)}
              >
                <Ionicons name="star-outline" size={12} color={COLORS.primary} />
                <ThemedText style={styles.rateBtnText}>Beri Rating</ThemedText>
              </Pressable>
            )
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <WaveHeader height={130} colors={GRADIENTS.ocean}>
        <ThemedText type="title" style={{ color: '#fff', fontSize: 24 }}>Pesanan Saya</ThemedText>
      </WaveHeader>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={{ fontSize: 48, lineHeight: 58 }}>🛒</ThemedText>
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
          <View style={[
            styles.modal,
            { backgroundColor: isDark ? '#1e293b' : COLORS.white },
          ]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <ThemedText style={styles.modalTitle}>Kode Pickup</ThemedText>
              <ThemedText style={styles.modalToko}>{qrModal?.tokoNama}</ThemedText>
              {qrModal?.namaMenu ? (
                <ThemedText style={styles.modalMenuName}>{qrModal.namaMenu}</ThemedText>
              ) : null}

              {/* QR asli — link ke halaman pickup, di-scan pakai kamera HP
                  BIASA (bukan dari app), langsung tandai pesanan selesai */}
              <View style={styles.qrWrap}>
                {qrModal?.kodePickup ? (
                  <QRCode
                    value={`https://sisarasa-3f969.web.app/pickup.html?oid=${qrModal.id}&kode=${qrModal.kodePickup}`}
                    size={140}
                    color={isDark ? '#fff' : '#0f172a'}
                    backgroundColor="transparent"
                  />
                ) : null}
              </View>

              {/* Kode */}
              <View style={styles.kodeWrap}>
                <ThemedText style={styles.kodeLabel}>Kode</ThemedText>
                <ThemedText style={styles.kodeText}>{qrModal?.kodePickup}</ThemedText>
              </View>

              {/* Status pembayaran — pembeli bayar CASH di toko pas ambil
                  pesanan, jadi badge "Pembayaran Berhasil" baru muncul
                  SETELAH status jadi completed (abis di-scan mitra), bukan
                  dari awal checkout. */}
              <View style={styles.successRow}>
                {(qrModal?.status === 'completed' || qrModal?.status === 'selesai') ? (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    <ThemedText style={styles.successText}>Pembayaran Berhasil</ThemedText>
                  </>
                ) : (qrModal?.status === 'cancelled' || qrModal?.status === 'batal') ? (
                  <>
                    <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                    <ThemedText style={[styles.successText, { color: COLORS.danger }]}>Pesanan Dibatalkan</ThemedText>
                  </>
                ) : (
                  <>
                    <Ionicons name="time-outline" size={20} color="#f59e0b" />
                    <ThemedText style={[styles.successText, { color: '#f59e0b' }]}>Menunggu Diambil</ThemedText>
                  </>
                )}
              </View>

              <ThemedText style={styles.modalHint}>
                {(qrModal?.status === 'completed' || qrModal?.status === 'selesai')
                  ? 'Pesanan ini sudah diambil dan dibayar di toko.'
                  : 'Tunjukkan kode ini ke toko & bayar di tempat saat mengambil pesanan'}
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
                    {qrModal ? (toDate(qrModal.createdAt)?.toLocaleDateString('id-ID') ?? '-') : ''}
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
            </ScrollView>

            <Pressable style={styles.closeBtn} onPress={() => setQrModal(null)}>
              <ThemedText style={styles.closeBtnText}>Tutup</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Rating Modal — muncul pas pembeli pencet "Beri Rating" di order
          yang statusnya sudah completed/selesai. */}
      <Modal
        visible={!!ratingModal}
        transparent
        animationType="slide"
        onRequestClose={() => (!submittingReview ? setRatingModal(null) : null)}
      >
        <View style={styles.overlay}>
          <View style={[
            styles.modal,
            { backgroundColor: isDark ? '#1e293b' : COLORS.white },
          ]}>
            <View style={styles.handleBar} />

            <ThemedText style={styles.modalTitle}>Beri Rating</ThemedText>
            <ThemedText style={styles.modalToko}>{ratingModal?.tokoNama}</ThemedText>
            {ratingModal?.namaMenu ? (
              <ThemedText style={styles.modalMenuName}>{ratingModal.namaMenu}</ThemedText>
            ) : null}

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRatingValue(n)} hitSlop={6}>
                  <Ionicons
                    name={n <= ratingValue ? 'star' : 'star-outline'}
                    size={34}
                    color="#f59e0b"
                    style={{ marginHorizontal: 3 }}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="Ceritain pengalaman kamu di toko ini (opsional)"
              placeholderTextColor={COLORS.gray400}
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!submittingReview}
              style={[
                styles.commentInput,
                {
                  backgroundColor: isDark ? COLORS.gray800 : COLORS.gray100,
                  color: isDark ? '#fff' : COLORS.dark,
                },
              ]}
            />

            <Pressable
              style={[styles.closeBtn, { opacity: submittingReview ? 0.7 : 1 }]}
              onPress={submitRating}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.closeBtnText}>Kirim Rating</ThemedText>
              )}
            </Pressable>
            <Pressable
              style={styles.cancelRatingBtn}
              onPress={() => setRatingModal(null)}
              disabled={submittingReview}
            >
              <ThemedText style={styles.cancelRatingBtnText}>Batal</ThemedText>
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
  cardDisabled: { opacity: 0.6 },
  cardEmoji: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%' },
  emoji: { fontSize: 24 },
  tokoName: { fontSize: 14, fontWeight: '700' },
  menuName: { fontSize: 12, fontWeight: '600', color: COLORS.primaryDark, marginTop: 1 },
  sub: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  rateBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  ratedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratedBadgeText: { fontSize: 10, color: COLORS.gray400, fontWeight: '600' },
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
    paddingTop: 14, paddingHorizontal: 24, paddingBottom: 24,
    alignItems: 'center',
    width: '100%',
    maxHeight: Dimensions.get('window').height * 0.88,
  },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.gray200, marginBottom: 12,
  },
  modalScroll: { width: '100%' },
  modalScrollContent: { alignItems: 'center', paddingBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalToko: { fontSize: 13, color: COLORS.gray400, marginBottom: 2 },
  modalMenuName: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 16 },

  // QR
  qrWrap: {
    borderWidth: 2, borderColor: COLORS.gray200,
    borderRadius: 16, padding: 12, marginBottom: 14,
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
    marginTop: 16,
  },
  closeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  starRow: { flexDirection: 'row', marginVertical: 16 },
  commentInput: {
    width: '100%', borderRadius: 14, padding: 14,
    fontSize: 13, minHeight: 80, textAlignVertical: 'top',
  },
  cancelRatingBtn: { paddingVertical: 14, alignItems: 'center', width: '100%' },
  cancelRatingBtnText: { color: COLORS.gray400, fontWeight: '700', fontSize: 13 },
});