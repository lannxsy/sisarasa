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
  ActivityIndicator, // Tambahkan ini
  View
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from './lib/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // State Loading

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) router.replace('/(tabs)');
    });
    return unsubscribe;
  }, [router]);

  const onLogin = async () => {
    if (!normalizedEmail || !password) {
      Alert.alert('Validasi', 'Email dan password wajib diisi.');
      return;
    }

    setIsLoading(true); // Aktifkan loading
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : '';

      // Error handling lebih spesifik biar UX mantap
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        Alert.alert('Gagal Login', 'Email atau password salah.');
      } else if (code === 'auth/too-many-requests') {
        Alert.alert('Gagal Login', 'Terlalu banyak percobaan. Coba lagi nanti.');
      } else {
        Alert.alert('Gagal login', e?.message ?? 'Terjadi kesalahan.');
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
            <ThemedText type="title" style={styles.title}>Selamat Datang</ThemedText>
            <ThemedText style={styles.subtitle}>Masuk untuk melanjutkan aplikasi</ThemedText>
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
                  placeholder="email@contoh.com"
                  editable={!isLoading} // Disable input pas loading
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
                  placeholder="••••••••"
                  editable={!isLoading} // Disable input pas loading
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
                    backgroundColor: isLoading ? '#64748b' : '#2563eb'
                  }
                ]}
                onPress={onLogin}
                disabled={isLoading} // Cegah spam klik
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                    Login
                  </ThemedText>
                )}
              </Pressable>

              <ThemedView style={styles.footer}>
                <ThemedText style={styles.footerText}>
                  Belum punya akun?{' '}
                  <Link href="/register" asChild disabled={isLoading}>
                    <ThemedText type="link" style={styles.linkText}>Register</ThemedText>
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
    color: '#2563eb',
  }
});