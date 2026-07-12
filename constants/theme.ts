import { Platform } from 'react-native';

// Palette baru SisaRasa — disamakan sama warna di web (coral + teal),
// jadi tampilan app & web sekarang senada, nggak ijo polos kayak dulu.
export const COLORS = {
  primary: '#FF6B6B',        // coral — warna utama, sama kayak web
  primaryDark: '#EE5253',    // buat teks/ikon di atas background terang & efek pressed
  primaryLight: '#FFE3E0',   // tint lembut buat background badge/ikon

  secondary: '#4ECDC4',      // teal — aksen kedua, sama kayak web
  secondaryDark: '#22A6A0',
  secondaryLight: '#DFF9F7',

  accent: '#FFC145',         // kuning keemasan — buat rating/bintang/highlight biar "pop"
  accentDark: '#F5A623',
  accentLight: '#FFF3D6',

  danger: '#EF4444',
  dangerLight: '#FEE2E2',

  bg: '#FFF8F4',             // background utama: krem hangat, bukan putih/item polos
  white: '#ffffff',

  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray400: '#94a3b8',
  gray600: '#475569',
  gray800: '#1e293b',
  dark: '#241f1c',
};

const tintColorLight = COLORS.primary;

// Catatan: app dipaksa selalu pakai skema "light" lewat app.json
// (userInterfaceStyle: "light"), makanya varian "dark" di bawah ini
// sengaja dibikin senada sama light (bukan hitam pekat) — jaga-jaga
// kalau suatu saat mode gelap diaktifkan lagi, tampilan tetap berwarna,
// bukan balik jadi item.
export const Colors = {
  light: {
    text: COLORS.dark,
    background: COLORS.bg,
    tint: tintColorLight,
    icon: COLORS.gray600,
    tabIconDefault: COLORS.gray400,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: COLORS.dark,
    background: COLORS.bg,
    tint: tintColorLight,
    icon: COLORS.gray600,
    tabIconDefault: COLORS.gray400,
    tabIconSelected: tintColorLight,
  },
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Font "Outfit" — sama kayak yang dipakai di web (lihat style.css), dimuat
// lewat @expo-google-fonts/outfit di app/_layout.tsx. Dipakai di ThemedText
// supaya identitas tipografi app & web akhirnya senada.
export const FONT = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semiBold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
};

// Preset gradient buat header/hero — dipakai lewat <WaveHeader> supaya
// setiap layar utama punya "wajah" yang sama: coral meleleh ke kuning,
// bukan blok warna solid rata kayak sebelumnya.
export const GRADIENTS = {
  sunset: [COLORS.primary, COLORS.accentDark] as const,
  ocean: [COLORS.secondaryDark, COLORS.secondary] as const,
  candy: [COLORS.primary, COLORS.secondary] as const,
  leaf: ['#10b981', COLORS.secondary] as const,
};