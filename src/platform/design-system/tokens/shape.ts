export const radiusRoles = {
  control: 'lg',
  card: 'lg',
  feature: '2xl',
  pill: 'full',
  circle: 'full',
} as const;

export const elevationRoles = {
  subtle: 'sm',
  card: 'md',
  raised: 'xl',
  hero: '2xl',
} as const;

export type RadiusRole = keyof typeof radiusRoles;
export type ElevationRole = keyof typeof elevationRoles;
