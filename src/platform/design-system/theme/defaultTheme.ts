import { colorPrimitives, typographyPrimitives } from '../tokens';
import type { ThemeDocument } from './types';

export const jokoTodayDefaultTheme: ThemeDocument = {
  schemaVersion: 1,
  registryVersion: 1,
  colors: {
    brand: {
      50: colorPrimitives.brand[50],
      100: colorPrimitives.brand[100],
      200: colorPrimitives.brand[200],
      300: colorPrimitives.brand[300],
      400: colorPrimitives.brand[400],
      500: colorPrimitives.brand[500],
      600: colorPrimitives.brand[600],
      700: colorPrimitives.brand[700],
      800: colorPrimitives.brand[800],
      900: colorPrimitives.brand[900],
      950: colorPrimitives.brand[950],
    },
    background: colorPrimitives.neutral.white,
    backgroundSecondary: colorPrimitives.brand[50],
    accent: colorPrimitives.accent.current,
  },
  typography: {
    displayFamily: typographyPrimitives.families.display,
    bodyFamily: typographyPrimitives.families.body,
    cjkFamily: typographyPrimitives.families.cjk,
  },
};
