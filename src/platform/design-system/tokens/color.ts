export const colorPrimitives = {
  brand: {
    50: '254 252 232',
    100: '254 243 199',
    200: '253 230 138',
    300: '252 211 77',
    400: '251 191 36',
    500: '245 158 11',
    600: '217 119 6',
    700: '180 83 9',
    800: '146 64 14',
    900: '120 53 15',
    950: '69 26 3',
  },
  neutral: {
    white: '255 255 255',
  },
  accent: {
    current: '239 68 68',
  },
} as const;

export interface SemanticColors {
  surface: {
    canvas: string;
    default: string;
    soft: string;
    inverse: string;
  };
  brand: {
    primary: string;
    primaryHover: string;
    strong: string;
  };
  content: {
    brandStrong: string;
    brand: string;
    inverse: string;
  };
  action: {
    primary: string;
    primaryHover: string;
    secondary: string;
  };
}
