import type { ResolvedTheme } from './types';

export type CssVariableName =
  | '--joko-color-brand-50'
  | '--joko-color-brand-100'
  | '--joko-color-brand-200'
  | '--joko-color-brand-300'
  | '--joko-color-brand-400'
  | '--joko-color-brand-500'
  | '--joko-color-brand-600'
  | '--joko-color-brand-700'
  | '--joko-color-brand-800'
  | '--joko-color-brand-900'
  | '--joko-color-brand-950'
  | '--joko-surface-canvas'
  | '--joko-surface-soft'
  | '--joko-accent'
  | '--joko-font-display'
  | '--joko-font-body'
  | '--joko-font-cjk';

export type CssVariableMap = { [K in CssVariableName]: string };

export function themeToCssVariables(theme: ResolvedTheme): CssVariableMap {
  return {
    '--joko-color-brand-50': theme.colors.brand[50],
    '--joko-color-brand-100': theme.colors.brand[100],
    '--joko-color-brand-200': theme.colors.brand[200],
    '--joko-color-brand-300': theme.colors.brand[300],
    '--joko-color-brand-400': theme.colors.brand[400],
    '--joko-color-brand-500': theme.colors.brand[500],
    '--joko-color-brand-600': theme.colors.brand[600],
    '--joko-color-brand-700': theme.colors.brand[700],
    '--joko-color-brand-800': theme.colors.brand[800],
    '--joko-color-brand-900': theme.colors.brand[900],
    '--joko-color-brand-950': theme.colors.brand[950],
    '--joko-surface-canvas': theme.colors.background,
    '--joko-surface-soft': theme.colors.backgroundSecondary,
    '--joko-accent': theme.colors.accent,
    '--joko-font-display': theme.typography.displayFamily,
    '--joko-font-body': theme.typography.bodyFamily,
    '--joko-font-cjk': theme.typography.cjkFamily,
  };
}
