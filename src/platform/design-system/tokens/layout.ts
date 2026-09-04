export const widthRoles = {
  narrow: 'md',
  compact: '3xl',
  reading: '4xl',
  standard: '5xl',
  wide: '7xl',
} as const;

export const sectionSpacing = {
  compact: '8',
  standard: '12',
  spacious: '16',
  extraSpacious: '20',
} as const;

export const pageGutters = {
  base: '4',
  sm: '6',
  lg: '8',
} as const;

export type WidthRole = keyof typeof widthRoles;
export type SectionSpacingRole = keyof typeof sectionSpacing;
