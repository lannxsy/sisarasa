import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, GRADIENTS } from '@/constants/theme';

type WaveHeaderProps = {
  children?: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  height?: number;
  waveColor?: string;
  contentPaddingTop?: number;
  style?: ViewStyle;
};

// Elemen "tanda tangan" visual SisaRasa: header gradient dengan tepi bawah
// bergelombang (bukan potongan kotak rata) + bulatan translucent buat
// tekstur. Dipakai di semua layar utama (Toko, Pesanan, Favorit, Profil,
// Login, Register) supaya identitas app konsisten & langsung dikenali.
export function WaveHeader({
  children,
  colors = GRADIENTS.sunset,
  height = 168,
  waveColor = COLORS.bg,
  contentPaddingTop = 54,
  style,
}: WaveHeaderProps) {
  return (
    <View style={[{ height, overflow: 'visible' }, style]}>
      <LinearGradient
        colors={colors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
          <Circle cx="368" cy="18" r="64" fill="#ffffff" opacity={0.09} />
          <Circle cx="36" cy="140" r="42" fill="#ffffff" opacity={0.08} />
          <Circle cx="320" cy="130" r="16" fill="#ffffff" opacity={0.14} />
        </Svg>
      </View>

      <View style={[styles.content, { paddingTop: contentPaddingTop }]}>{children}</View>

      <View style={styles.waveWrap} pointerEvents="none">
        <Svg width="100%" height="26" viewBox="0 0 400 26" preserveAspectRatio="none">
          <Path
            d="M0,12 C60,26 100,0 160,9 C220,18 260,0 320,5 C360,9 380,16 400,9 L400,26 L0,26 Z"
            fill={waveColor}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'flex-start' },
  waveWrap: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 26 },
});
