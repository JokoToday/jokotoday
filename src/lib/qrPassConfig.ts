import { supabase } from './supabase';
import { getSetting } from './cmsService';
import type {
  BuilderChineseDisplayFont,
  BuilderDisplayFont,
  BuilderFontWeight,
  BuilderThaiDisplayFont,
} from '../platform/builder/contracts';

export const QR_PASS_CONFIG_KEY = 'qr_pass_config_v1';

export interface QrPassTextRoleStyle {
  weight: BuilderFontWeight;
  size: number;
}

export interface QrPassTypographyConfig {
  englishFont: BuilderDisplayFont;
  thaiFont: BuilderThaiDisplayFont;
  chineseFont: BuilderChineseDisplayFont;
  title: QrPassTextRoleStyle;
  customerName: QrPassTextRoleStyle;
  shortCode: QrPassTextRoleStyle;
  helper: QrPassTextRoleStyle;
}

export interface QrPassConfig {
  version: 1;
  logoUrl: string;
  logoScale: number;
  title: string;
  subtitle: string;
  footerText: string;
  showTitle: boolean;
  showSubtitle: boolean;
  showCustomerName: boolean;
  showShortCode: boolean;
  showFooterMark: boolean;
  showFooterText: boolean;
  cardBackground: string;
  cardSurface: string;
  borderColor: string;
  qrBorderColor: string;
  headingColor: string;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  typography: QrPassTypographyConfig;
}

export const DEFAULT_QR_PASS_CONFIG: QrPassConfig = {
  version: 1,
  logoUrl: '/JOKO.TODAY_logo.v0.4.webp',
  logoScale: 100,
  title: 'JOKO TODAY',
  subtitle: 'YOUR PERSONAL JOKO TODAY ID',
  footerText: 'joko.today',
  showTitle: true,
  showSubtitle: true,
  showCustomerName: true,
  showShortCode: true,
  showFooterMark: true,
  showFooterText: true,
  cardBackground: '#F7EAD7',
  cardSurface: '#F3EEE6',
  borderColor: '#C7C79A',
  qrBorderColor: '#E0CBAA',
  headingColor: '#52603B',
  accentColor: '#C45A00',
  textColor: '#24231F',
  mutedColor: '#8C8477',
  typography: {
    englishFont: 'noto-sans',
    thaiFont: 'noto-sans-thai',
    chineseFont: 'noto-sans-sc',
    title: { weight: 700, size: 22 },
    customerName: { weight: 600, size: 30 },
    shortCode: { weight: 700, size: 20 },
    helper: { weight: 500, size: 14 },
  },
};

const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const MEDIA_LOGO_URL = /^https:\/\/media\.joko\.today\/[A-Za-z0-9/_-]+\.(?:png|jpe?g|webp)(?:\?[^\s]*)?$/i;
const FONT_WEIGHTS: BuilderFontWeight[] = [300, 400, 500, 600, 700, 800, 900];

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || fallback;
}

function cleanLogoUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_QR_PASS_CONFIG.logoUrl;
  const normalized = value.trim().slice(0, 500);
  if (!normalized) return DEFAULT_QR_PASS_CONFIG.logoUrl;

  const isSameOriginAsset = normalized.startsWith('/')
    && !normalized.startsWith('//')
    && !normalized.includes('\\')
    && !normalized.endsWith('/');
  const isJokoMediaAsset = MEDIA_LOGO_URL.test(normalized);

  return isSameOriginAsset || isJokoMediaAsset ? normalized : DEFAULT_QR_PASS_CONFIG.logoUrl;
}

function cleanColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanScale(value: unknown): number {
  return cleanNumber(value, DEFAULT_QR_PASS_CONFIG.logoScale, 60, 140);
}

function cleanWeight(value: unknown, fallback: BuilderFontWeight): BuilderFontWeight {
  const numeric = Number(value) as BuilderFontWeight;
  return FONT_WEIGHTS.includes(numeric) ? numeric : fallback;
}

function cleanEnglishFont(value: unknown): BuilderDisplayFont {
  return value === 'noto-sans' || value === 'inter' || value === 'playfair-display'
    ? value
    : DEFAULT_QR_PASS_CONFIG.typography.englishFont;
}

function cleanThaiFont(value: unknown): BuilderThaiDisplayFont {
  return value === 'maitree'
    || value === 'noto-sans-thai-looped'
    || value === 'noto-sans-thai'
    || value === 'sarabun'
    || value === 'bai-jamjuree'
    ? value
    : DEFAULT_QR_PASS_CONFIG.typography.thaiFont;
}

function cleanChineseFont(value: unknown): BuilderChineseDisplayFont {
  return value === 'noto-sans-sc' || value === 'noto-serif-sc'
    ? value
    : DEFAULT_QR_PASS_CONFIG.typography.chineseFont;
}

function cleanRoleStyle(
  value: unknown,
  fallback: QrPassTextRoleStyle,
  minSize: number,
  maxSize: number,
): QrPassTextRoleStyle {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    weight: cleanWeight(input.weight, fallback.weight),
    size: cleanNumber(input.size, fallback.size, minSize, maxSize),
  };
}

function cleanTypography(value: unknown): QrPassTypographyConfig {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fallback = DEFAULT_QR_PASS_CONFIG.typography;

  return {
    englishFont: cleanEnglishFont(input.englishFont),
    thaiFont: cleanThaiFont(input.thaiFont),
    chineseFont: cleanChineseFont(input.chineseFont),
    title: cleanRoleStyle(input.title, fallback.title, 14, 34),
    customerName: cleanRoleStyle(input.customerName, fallback.customerName, 18, 42),
    shortCode: cleanRoleStyle(input.shortCode, fallback.shortCode, 12, 28),
    helper: cleanRoleStyle(input.helper, fallback.helper, 9, 20),
  };
}

export function parseQrPassConfig(value: string | null | undefined): QrPassConfig {
  if (!value) return structuredClone(DEFAULT_QR_PASS_CONFIG);

  try {
    const parsed = JSON.parse(value) as Partial<QrPassConfig>;
    return {
      version: 1,
      logoUrl: cleanLogoUrl(parsed.logoUrl),
      logoScale: cleanScale(parsed.logoScale),
      title: cleanText(parsed.title, DEFAULT_QR_PASS_CONFIG.title, 40),
      subtitle: cleanText(parsed.subtitle, DEFAULT_QR_PASS_CONFIG.subtitle, 80),
      footerText: cleanText(parsed.footerText, DEFAULT_QR_PASS_CONFIG.footerText, 60),
      showTitle: cleanBoolean(parsed.showTitle, DEFAULT_QR_PASS_CONFIG.showTitle),
      showSubtitle: cleanBoolean(parsed.showSubtitle, DEFAULT_QR_PASS_CONFIG.showSubtitle),
      showCustomerName: cleanBoolean(parsed.showCustomerName, DEFAULT_QR_PASS_CONFIG.showCustomerName),
      showShortCode: cleanBoolean(parsed.showShortCode, DEFAULT_QR_PASS_CONFIG.showShortCode),
      showFooterMark: cleanBoolean(parsed.showFooterMark, DEFAULT_QR_PASS_CONFIG.showFooterMark),
      showFooterText: cleanBoolean(parsed.showFooterText, DEFAULT_QR_PASS_CONFIG.showFooterText),
      cardBackground: cleanColor(parsed.cardBackground, DEFAULT_QR_PASS_CONFIG.cardBackground),
      cardSurface: cleanColor(parsed.cardSurface, DEFAULT_QR_PASS_CONFIG.cardSurface),
      borderColor: cleanColor(parsed.borderColor, DEFAULT_QR_PASS_CONFIG.borderColor),
      qrBorderColor: cleanColor(parsed.qrBorderColor, DEFAULT_QR_PASS_CONFIG.qrBorderColor),
      headingColor: cleanColor(parsed.headingColor, DEFAULT_QR_PASS_CONFIG.headingColor),
      accentColor: cleanColor(parsed.accentColor, DEFAULT_QR_PASS_CONFIG.accentColor),
      textColor: cleanColor(parsed.textColor, DEFAULT_QR_PASS_CONFIG.textColor),
      mutedColor: cleanColor(parsed.mutedColor, DEFAULT_QR_PASS_CONFIG.mutedColor),
      typography: cleanTypography(parsed.typography),
    };
  } catch {
    return structuredClone(DEFAULT_QR_PASS_CONFIG);
  }
}

export async function getQrPassConfig(): Promise<QrPassConfig> {
  try {
    const setting = await getSetting(QR_PASS_CONFIG_KEY);
    return parseQrPassConfig(setting?.value);
  } catch (error) {
    console.error('Could not load QR Pass configuration:', error);
    return structuredClone(DEFAULT_QR_PASS_CONFIG);
  }
}

export async function saveQrPassConfig(config: QrPassConfig): Promise<QrPassConfig> {
  const normalized = parseQrPassConfig(JSON.stringify(config));
  const { error } = await supabase
    .from('cms_settings')
    .upsert({
      setting_key: QR_PASS_CONFIG_KEY,
      value: JSON.stringify(normalized),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'setting_key' });

  if (error) throw error;
  return normalized;
}
