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
  ActivityIndicator // Tambahkan ActivityIndicator
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from './lib/firebase';

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // State Loading untuk UX

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

    setIsLoading(true); // Mulai loading
    try {
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : '';

      // Error handling lengkap sesuai kriteria
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
      setIsLoading(false); // Matikan loading
    }
  };

  const cardStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    shadowColor: isDark ? '#000' : '#64748b',
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

          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>Buat Akun</ThemedText>
            <ThemedText style={styles.subtitle}>Daftar untuk mulai menggunakan fitur lengkap</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.card, cardStyle]}>
            <ThemedView style={styles.form}>

              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="nama@email.com"
                  editable={!isLoading} // Kunci input saat loading
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      opacity: isLoading ? 0.7 : 1
                    }
                  ]}
                />
              </ThemedView>

              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Password</ThemedText>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Minimal 6 karakter"
                  editable={!isLoading} // Kunci input saat loading
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      opacity: isLoading ? 0.7 : 1
                    }
                  ]}
                />
              </ThemedView>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    opacity: (pressed || isLoading) ? 0.8 : 1,
                    backgroundColor: isLoading ? '#64748b' : '#10b981'
                  }
                ]}
                onPress={onCreateAccount}
                disabled={isLoading} // Cegah double tap
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
  header: {
    marginBottom: 32,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  form: {
    gap: 18,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  }
});