import { useCallback, useMemo, useState } from 'react';

/**
 * Gestion partagée d'une seule tuile "ouverte" à la fois (accordéon léger).
 * Utilisable côté client (menu camion) et côté pro (liste produits).
 */
export function useSingleOpenItem(initialId = null) {
  const [openId, setOpenId] = useState(initialId);

  const isOpen = useCallback((id) => openId === id, [openId]);

  const open = useCallback((id) => setOpenId(id), []);

  const close = useCallback(() => setOpenId(null), []);

  const toggle = useCallback((id) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return useMemo(
    () => ({
      openId,
      isOpen,
      open,
      close,
      toggle,
      setOpenId,
    }),
    [openId, isOpen, open, close, toggle]
  );
}
