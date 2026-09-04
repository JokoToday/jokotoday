export const typographyPrimitives = {
  families: {
    display: "'Playfair Display', serif",
    body: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', sans-serif",
    cjk: "'Noto Sans SC', 'PingFang SC', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export type TypographyFamilyRole = keyof typeof typographyPrimitives.families;
export type TypographyWeightRole = keyof typeof typographyPrimitives.weights;
