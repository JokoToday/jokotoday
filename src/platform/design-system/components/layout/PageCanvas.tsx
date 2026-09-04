import type { HTMLAttributes, ReactNode } from 'react';
import { joinClasses } from './classNames';

export type PageCanvasSurface = 'canvas' | 'soft' | 'transparent';

const pageCanvasSurfaceClasses: Record<PageCanvasSurface, string> = {
  canvas: 'bg-background',
  soft: 'bg-primary-50',
  transparent: '',
};

export interface PageCanvasProps extends HTMLAttributes<HTMLDivElement> {
  surface?: PageCanvasSurface;
  children: ReactNode;
}

export function PageCanvas({
  surface = 'canvas',
  className,
  children,
  ...props
}: PageCanvasProps) {
  return (
    <div
      {...props}
      className={joinClasses(
        'min-h-screen',
        pageCanvasSurfaceClasses[surface],
        className,
      )}
    >
      {children}
    </div>
  );
}
