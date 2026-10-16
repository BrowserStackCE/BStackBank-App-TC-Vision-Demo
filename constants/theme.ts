import { Platform } from 'react-native';

// Design system — Urbanist / modern banking palette
export const BSColors = {
  // Primary navy-blue (--color-primary)
  primary: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryDark: '#1E3A8A',
  primaryBg: '#EFF6FF',      // light blue tint
  primaryBorder: '#BFDBFE',  // blue-200

  // Accent indigo (--color-accent)
  accent: '#6366F1',
  accentLight: '#A5B4FC',

  // Neutrals
  navy: '#0F172A',
  navyLight: '#1E293B',
  white: '#FFFFFF',
  bgPage: '#FCFBFC',         // --color-bg
  bgCard: '#FFFFFF',         // --color-surface
  lightGray: '#F1F5F9',
  mediumGray: '#E2E8F0',     // --color-border
  darkGray: '#64748B',       // --color-muted
  textPrimary: '#0F172A',    // --color-text
  textSecondary: '#475569',

  // Semantic
  error: '#EF4444',          // --color-danger
  errorDark: '#DC2626',      // darker red (used for debit amounts, error states)
  errorBg: '#FEF2F2',        // red-50
  errorBgLight: '#FFF5F5',   // very light red
  errorBorder: '#FECACA',    // red-200
  errorBorderDark: '#FEE2E2',// red-100
  success: '#10B981',        // --color-success
  successDark: '#059669',    // darker green (green mode primary, success states)
  successBg: '#F0FDF4',      // green-50
  successBgLight: '#D1FAE5', // green-100
  successBorder: '#BBF7D0',  // green-200
  warning: '#F59E0B',        // --color-warning
  warningDark: '#D97706',    // amber-600
  warningBg: '#FFFBEB',      // amber-50
  warningBorder: '#FEF3C7',  // amber-100
  info: '#3B82F6',
  infoDark: '#0891B2',       // cyan-600
  infoBg: '#E0F2FE',         // sky-100
  infoDeep: '#0369A1',       // sky-700
  infoDeepAlt: '#0284C7',    // sky-600

  // Additional neutrals
  grayNeutral: '#E0E0E0',    // neutral gray border
  grayDark: '#374151',       // gray-700 (dark overlays)
  greenLight: '#6EE7B7',     // emerald-300 (switch track)
  greenBright: '#4ADE80',    // green-400 (QR success)
  amberText: '#92400E',      // amber-800 (warning text)
  amberHighlight: '#FDE68A', // amber-200
  indigoLight: '#E0E7FF',    // indigo-100
  neutralFaint: '#FAFAFA',   // near-white neutral
  errorDeep: '#E11D48',      // rose-600
  errorDeeper: '#D32F2F',    // material red-700
  tealDeep: '#0a7ea4',       // teal (web color scheme)

  // Extended neutrals
  slate300: '#94A3B8',       // placeholder text, inactive icons
  slate400: '#64748B',       // same as darkGray — alias for clarity
  slate700: '#334155',       // dark text variant
  bgPageAlt: '#F8FAFF',      // slightly blue-tinted page bg (auth screens)
  bgPageLight: '#F5F6FA',    // neutral light bg
  bgPageNeutral: '#F5F5F5',  // pure neutral bg
  borderLight: '#F0F0F0',    // very light border

  // Indigo / accent extended
  indigoBg: '#EEF2FF',       // indigo-50 (step badges, highlights)
  indigoBorder: '#C7D2FE',   // indigo-200
  purple: '#7C3AED',         // violet-700 (chat, agents)

  // Legacy aliases (keep so existing references don't break)
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  blueDark: '#1D4ED8',
  orange: '#1E3A8A',
  orangeLight: '#3B82F6',
  orangeDark: '#1E3A8A',
  inputBorder: '#BFDBFE',
  inputBg: '#EFF6FF',
};

const tintColorLight = BSColors.primary;
const tintColorDark = BSColors.primaryLight;

export const Colors = {
  light: {
    text: BSColors.textPrimary,
    background: BSColors.bgPage,
    tint: tintColorLight,
    icon: BSColors.darkGray,
    tabIconDefault: BSColors.darkGray,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Card themes — dark gradient-style shades used for all bank cards.
// `slate` is the reference design; other shades follow the same dark, muted treatment.
export const CARD_THEMES = {
  slate:  { bg: '#1B2230', circle: 'rgba(255,255,255,0.12)', label: 'rgba(255,255,255,0.65)', text: '#FFFFFF' },
  navy:   { bg: '#172554', circle: 'rgba(255,255,255,0.12)', label: 'rgba(255,255,255,0.65)', text: '#FFFFFF' },
  forest: { bg: '#14291F', circle: 'rgba(255,255,255,0.12)', label: 'rgba(255,255,255,0.65)', text: '#FFFFFF' },
  wine:   { bg: '#2B1520', circle: 'rgba(255,255,255,0.12)', label: 'rgba(255,255,255,0.65)', text: '#FFFFFF' },
  plum:   { bg: '#241B3A', circle: 'rgba(255,255,255,0.12)', label: 'rgba(255,255,255,0.65)', text: '#FFFFFF' },
  teal:   { bg: '#12292E', circle: 'rgba(255,255,255,0.12)', label: 'rgba(255,255,255,0.65)', text: '#FFFFFF' },
} as const;
export type CardThemeKey = keyof typeof CARD_THEMES;

// Urbanist font family constants — loaded in app/_layout.tsx via expo-font
export const BSFonts = {
  regular:    'Urbanist-Regular',
  medium:     'Urbanist-Medium',
  semiBold:   'Urbanist-SemiBold',
  bold:       'Urbanist-Bold',
  extraBold:  'Urbanist-ExtraBold',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  },
});