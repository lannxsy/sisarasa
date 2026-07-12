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
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaveHeader } from '@/components/wave-header';
import { GRADIENTS } from '@/constants/theme';
import { auth } from './lib/firebase';

// Brand tokens - disamakan dengan assets/css/style.css di versi web
const COLORS = {
  primary: '#ff6b6b',
  primaryPressed: '#ff5252',
  secondary: '#4ecdc4',
  textMuted: '#636e72',
};

export default function LoginScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) router.replace('/intro-map');
    });
    return unsubscribe;
  }, [router]);

  const onLogin = async () => {
    if (!normalizedEmail || !password) {
      Alert.alert('Validasi', 'Email dan password wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      router.replace('/intro-map');
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : '';

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        Alert.alert('Gagal Login', 'Email atau password salah.');
      } else if (code === 'auth/too-many-requests') {
        Alert.alert('Gagal Login', 'Terlalu banyak percobaan. Coba lagi nanti.');
      } else {
        Alert.alert('Gagal login', e?.message ?? 'Terjadi kesalahan.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotPassword = async () => {
    if (isLoading) return;
    if (!normalizedEmail) {
      Alert.alert('Lupa Sandi', 'Masukkan email Anda terlebih dahulu, lalu ketuk "Lupa Sandi?" lagi.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      Alert.alert('Email Terkirim', `Link reset password telah dikirim ke ${normalizedEmail}.`);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Tidak dapat mengirim email reset password.');
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

            {/* Brand panel - versi gradient + wave, senada sama header di tab utama */}
            <WaveHeader height={168} colors={GRADIENTS.sunset} waveColor={cardStyle.backgroundColor} contentPaddingTop={28}>
              <View style={styles.brandRow}>
                <FontAwesome5 name="leaf" size={20} color="#ffffff" />
                <ThemedText style={styles.brandName}>Sisarasa</ThemedText>
              </View>
              <ThemedText style={styles.brandTagline}>
                Selamatkan makanan, hemat lebih banyak setiap hari.
              </ThemedText>
            </WaveHeader>

            {/* Form panel - meniru .auth-form-container di versi web */}
            <ThemedView style={styles.formPanel}>
              <ThemedText type="title" style={styles.title}>Selamat Datang! 👋</ThemedText>
              <ThemedText style={styles.subtitle}>Masuk untuk melanjutkan aplikasi.</ThemedText>

              <ThemedView style={styles.form}>

                <ThemedView style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Alamat Email</ThemedText>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="email@contoh.com"
                    editable={!isLoading}
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    style={[styles.input, inputStyle]}
                  />
                </ThemedView>

                <ThemedView style={styles.inputContainer}>
                  <View style={styles.labelRow}>
                    <ThemedText style={styles.label}>Password</ThemedText>
                    <Pressable onPress={onForgotPassword} disabled={isLoading} hitSlop={8}>
                      <ThemedText style={styles.forgotLink}>Lupa Sandi?</ThemedText>
                    </Pressable>
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    editable={!isLoading}
                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    style={[styles.input, inputStyle]}
                  />
                </ThemedView>

                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setRememberMe((v) => !v)}
                  disabled={isLoading}
                  hitSlop={8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: isDark ? '#475569' : '#cbd5e1' },
                      rememberMe && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                    ]}
                  >
                    {rememberMe && <FontAwesome5 name="check" size={10} color="#ffffff" />}
                  </View>
                  <ThemedText style={styles.checkboxLabel}>Ingat saya</ThemedText>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      opacity: pressed || isLoading ? 0.85 : 1,
                      backgroundColor: isLoading ? '#94a3b8' : COLORS.primary,
                    },
                  ]}
                  onPress={onLogin}
                  disabled={isLoading}
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 13,
    opacity: 0.7,
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
    color: COLORS.primary,
  },
});