import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface AdminModalPortalProps {
  children: ReactNode;
}

export function AdminModalPortal({ children }: AdminModalPortalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="joko-admin-content contents">{children}</div>,
    document.body,
  );
}
