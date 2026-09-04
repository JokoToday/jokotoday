import type { HTMLAttributes, ReactNode } from 'react';
import type { SectionSpacingRole } from '../../tokens';
import { joinClasses } from './classNames';

export type SectionSpacing = 'none' | SectionSpacingRole;

const sectionSpacingClasses: Record<SectionSpacing, string> = {
  none: '',
  compact: 'py-8',
  standard: 'py-12',
  spacious: 'py-16',
  extraSpacious: 'py-20',
};

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  spacing?: SectionSpacing;
  children: ReactNode;
}

export function Section({
  spacing = 'standard',
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      {...props}
      className={joinClasses(sectionSpacingClasses[spacing], className)}
    >
      {children}
    </section>
  );
}
