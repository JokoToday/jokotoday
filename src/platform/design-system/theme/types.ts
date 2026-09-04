export interface ThemeDocument {
  schemaVersion: 1;
  registryVersion: 1;
  colors: {
    brand: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
      950: string;
    };
    background: string;
    backgroundSecondary: string;
    accent: string;
  };
  typography: {
    displayFamily: string;
    bodyFamily: string;
    cjkFamily: string;
  };
}

export interface ThemeOverride {
  colors?: {
    brand?: Partial<ThemeDocument['colors']['brand']>;
    background?: string;
    backgroundSecondary?: string;
    accent?: string;
  };
  typography?: Partial<ThemeDocument['typography']>;
}

export type ResolvedTheme = ThemeDocument;
