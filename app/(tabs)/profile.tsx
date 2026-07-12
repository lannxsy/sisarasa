import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaveHeader } from '@/components/wave-header';
import { auth } from '../lib/firebase';
import { COLORS, GRADIENTS } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin mau keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const MenuItem = ({ icon, label, onPress, danger }: any) => (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? COLORS.dangerLight : COLORS.primaryLight }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <ThemedText style={[styles.menuLabel, danger && { color: COLORS.danger }]}>{label}</ThemedText>
      {!danger && <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <WaveHeader height={128} colors={GRADIENTS.sunset} />

      {/* Avatar ngambang, overlap ke wave-nya header */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() ?? '?'}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="defaultSemiBold" style={styles.email}>{user?.email}</ThemedText>
        <ThemedText style={styles.uid}>UID: {user?.uid?.slice(0, 10)}...</ThemedText>
      </View>

      {/* Menu */}
      <View style={styles.menuSection}>
        <MenuItem icon="information-circle-outline" label="Tentang SisaRasa" onPress={() => Alert.alert('SisaRasa', 'Aplikasi penyelamat makanan berlebih. Versi 1.0.0')} />
        <MenuItem icon="log-out-outline" label="Keluar" onPress={handleLogout} danger />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  avatarSection: { alignItems: 'center', marginTop: -46, paddingBottom: 20 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.bg,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 6,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  email: { fontSize: 16, marginTop: 12 },
  uid: { fontSize: 12, color: COLORS.gray400, marginTop: 4 },
  menuSection: { paddingHorizontal: 16, gap: 10, marginTop: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.gray800, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  menuIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});