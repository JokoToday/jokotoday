import { jokoTodayDefaultTheme } from './defaultTheme';
import type { ResolvedTheme, ThemeOverride } from './types';

function validString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function resolveTheme(override?: ThemeOverride): ResolvedTheme {
  const defaults = jokoTodayDefaultTheme;
  const brand = override?.colors?.brand;

  return {
    schemaVersion: 1,
    registryVersion: 1,
    colors: {
      brand: {
        50: validString(brand?.[50], defaults.colors.brand[50]),
        100: validString(brand?.[100], defaults.colors.brand[100]),
        200: validString(brand?.[200], defaults.colors.brand[200]),
        300: validString(brand?.[300], defaults.colors.brand[300]),
        400: validString(brand?.[400], defaults.colors.brand[400]),
        500: validString(brand?.[500], defaults.colors.brand[500]),
        600: validString(brand?.[600], defaults.colors.brand[600]),
        700: validString(brand?.[700], defaults.colors.brand[700]),
        800: validString(brand?.[800], defaults.colors.brand[800]),
        900: validString(brand?.[900], defaults.colors.brand[900]),
        950: validString(brand?.[950], defaults.colors.brand[950]),
      },
      background: validString(override?.colors?.background, defaults.colors.background),
      backgroundSecondary: validString(
        override?.colors?.backgroundSecondary,
        defaults.colors.backgroundSecondary,
      ),
      accent: validString(override?.colors?.accent, defaults.colors.accent),
    },
    typography: {
      displayFamily: validString(
        override?.typography?.displayFamily,
        defaults.typography.displayFamily,
      ),
      bodyFamily: validString(override?.typography?.bodyFamily, defaults.typography.bodyFamily),
      cjkFamily: validString(override?.typography?.cjkFamily, defaults.typography.cjkFamily),
    },
  };
}
