import { Link, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  View,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from './lib/firebase';

// Register pakai warna hijau (beda dari Login yang merah/coral Sisarasa)
const COLORS = {
  accent: '#10b981',
  accentPressed: '#059669',
  textMuted: '#636e72',
};

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) router.replace('/(tabs)');
    });
    return unsubscribe;
  }, [router]);

  const onCreateAccount = async () => {
    if (!normalizedEmail || !password) {
      Alert.alert('Validasi', 'Email dan password wajib diisi.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Validasi', 'Password minimal harus 6 karakter.');
      return;
    }

    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : '';

      if (code === 'auth/email-already-in-use') {
        Alert.alert('Register Gagal', 'Email sudah terdaftar. Silakan gunakan email lain atau login.');
      } else if (code === 'auth/invalid-email') {
        Alert.alert('Register Gagal', 'Format email tidak valid.');
      } else if (code === 'auth/weak-password') {
        Alert.alert('Register Gagal', 'Password terlalu lemah.');
      } else {
        Alert.alert('Register Gagal', e?.message ?? 'Terjadi kesalahan saat membuat akun.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cardStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    shadowColor: isDark ? '#000' : '#64748b',
  };

  const inputStyle = {
    backgroundColor: isDark ? '#0f172a' : '#f8f9fa',
    color: isDark ? '#f8fafc' : '#2d3436',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    opacity: isLoading ? 0.7 : 1,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.container}>
          <ThemedView style={[styles.card, cardStyle]}>

            {/* Brand panel - meniru .auth-image di versi web */}
            <View style={[styles.brandPanel, { backgroundColor: COLORS.accent }]}>
              <View style={styles.brandRow}>
                <FontAwesome5 name="leaf" size={20} color="#ffffff" />
                <ThemedText style={styles.brandName}>Sisarasa</ThemedText>
              </View>
              <ThemedText style={styles.brandTagline}>
                Bergabung sekarang dan nikmati promo spesial untuk pengguna baru.
              </ThemedText>
            </View>

            {/* Form panel - meniru .auth-form-container di versi web */}
            <ThemedView style={styles.formPanel}>
              <ThemedText type="title" style={styles.title}>Buat Akun</ThemedText>
              <ThemedText style={styles.subtitle}>Daftar untuk mulai menggunakan fitur lengkap.</ThemedText>

              <ThemedView style={styles.form}>

                <ThemedView style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Alamat Email</ThemedText>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="nama@email.com"
                    editable={!isLoading}
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    style={[styles.input, inputStyle]}
                  />
                </ThemedView>

                <ThemedView style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Password</ThemedText>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Minimal 6 karakter"
                    editable={!isLoading}
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    style={[styles.input, inputStyle]}
                  />
                </ThemedView>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      opacity: pressed || isLoading ? 0.85 : 1,
                      backgroundColor: isLoading ? '#94a3b8' : COLORS.accent,
                    },
                  ]}
                  onPress={onCreateAccount}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                      Daftar Sekarang
                    </ThemedText>
                  )}
                </Pressable>

                <ThemedView style={styles.footer}>
                  <ThemedText style={styles.footerText}>
                    Sudah punya akun?{' '}
                    <Link href="/login" asChild disabled={isLoading}>
                      <ThemedText type="link" style={styles.linkText}>Masuk di sini</ThemedText>
                    </Link>
                  </ThemedText>
                </ThemedView>

              </ThemedView>
            </ThemedView>

          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  brandPanel: {
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
  },
  formPanel: {
    padding: 24,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
    marginBottom: 20,
  },
  form: {
    gap: 16,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  footerText: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
});