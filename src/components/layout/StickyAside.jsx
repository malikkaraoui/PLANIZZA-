import { cn } from '@/lib/utils';

/**
 * Wrapper sticky réutilisable (desktop) pour garder une carte visible pendant le scroll.
 *
 * Usage typique:
 * <StickyAside>
 *   <CartSidebar ... />
 * </StickyAside>
 */
export default function StickyAside({
  children,
  className = '',
  topClassName = 'lg:top-24',
}) {
  return (
    <aside
      className={cn(
        'self-start lg:sticky',
        topClassName,
        className,
      )}
    >
      {children}
    </aside>
  );
}
