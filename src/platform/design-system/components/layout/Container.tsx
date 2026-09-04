import type { HTMLAttributes, ReactNode } from 'react';
import type { WidthRole } from '../../tokens';
import { joinClasses } from './classNames';

const containerWidthClasses: Record<WidthRole, string> = {
  narrow: 'max-w-md',
  compact: 'max-w-3xl',
  reading: 'max-w-4xl',
  standard: 'max-w-5xl',
  wide: 'max-w-7xl',
};

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: WidthRole;
  gutters?: boolean;
  children: ReactNode;
}

export function Container({
  width = 'wide',
  gutters = true,
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <div
      {...props}
      className={joinClasses(
        containerWidthClasses[width],
        'mx-auto',
        gutters && 'px-4 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
