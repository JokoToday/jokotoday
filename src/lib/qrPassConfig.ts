import { supabase } from './supabase';
import { getSetting } from './cmsService';

export const QR_PASS_CONFIG_KEY = 'qr_pass_config_v1';

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
}

export const DEFAULT_QR_PASS_CONFIG: QrPassConfig = {
  version: 1,
  logoUrl: '/JOKO.TODAY_logo.v0.4.webp',
  logoScale: 100,
  title: 'JOKO PASS',
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
};

const HEX_COLOR = /^#[0-9A-F]{6}$/i;

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || fallback;
}

function cleanLogoUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_QR_PASS_CONFIG.logoUrl;
  const normalized = value.trim().slice(0, 500);
  if (!normalized) return DEFAULT_QR_PASS_CONFIG.logoUrl;
  if (normalized.startsWith('/') || /^https?:\/\//i.test(normalized)) return normalized;
  return DEFAULT_QR_PASS_CONFIG.logoUrl;
}

function cleanColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanScale(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_QR_PASS_CONFIG.logoScale;
  return Math.min(140, Math.max(60, Math.round(parsed)));
}

export function parseQrPassConfig(value: string | null | undefined): QrPassConfig {
  if (!value) return { ...DEFAULT_QR_PASS_CONFIG };

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
    };
  } catch {
    return { ...DEFAULT_QR_PASS_CONFIG };
  }
}

export async function getQrPassConfig(): Promise<QrPassConfig> {
  try {
    const setting = await getSetting(QR_PASS_CONFIG_KEY);
    return parseQrPassConfig(setting?.value);
  } catch (error) {
    console.error('Could not load QR Pass configuration:', error);
    return { ...DEFAULT_QR_PASS_CONFIG };
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
