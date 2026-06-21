import React from 'react';
import { View, StyleSheet, Pressable, useColorScheme, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '../lib/firebase';
import { COLORS } from '@/constants/theme';

export default function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const user = auth.currentUser;

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin mau keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const MenuItem = ({ icon, label, onPress, danger }: any) => (
    <Pressable
      style={[styles.menuItem, { backgroundColor: isDark ? COLORS.gray800 : COLORS.white }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? '#fee2e2' : COLORS.primaryLight }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <ThemedText style={[styles.menuLabel, danger && { color: COLORS.danger }]}>{label}</ThemedText>
      {!danger && <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
        <ThemedText style={styles.headerTitle}>Profil</ThemedText>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() ?? '?'}
          </ThemedText>
        </View>
        <ThemedText style={styles.email}>{user?.email}</ThemedText>
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
  container: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  email: { fontSize: 16, fontWeight: '700' },
  uid: { fontSize: 12, color: COLORS.gray400, marginTop: 4 },
  menuSection: { paddingHorizontal: 16, gap: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, elevation: 1 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});
