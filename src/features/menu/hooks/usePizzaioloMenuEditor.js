import { useCallback, useMemo, useState } from 'react';
import { push, ref, remove, set, update } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { devError } from '../../../lib/devLog';
import { useMenu } from './useMenu';
import { buildMenuItemData, validateMenuItemDraft } from '../utils';
import { useAutoDismissMessage } from '../../../hooks/useAutoDismissMessage';

/**
 * Hook “safe” d’édition de menu pizzaiolo.
 * - Source de vérité: RTDB public/trucks/{truckId}/menu/items
 * - Lecture live via useMenu()
 * - Ecriture centralisée (add/delete)
 */
export function usePizzaioloMenuEditor(truckId) {
  const enabled = Boolean(truckId && isFirebaseConfigured && db);
  const { items, loading, error } = useMenu(truckId);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Les messages d'info/succès (✅ / ⏸️) doivent disparaître après 5s.
  useAutoDismissMessage(message, setMessage, { delayMs: 5000, dismissErrors: false });

  const canWrite = enabled;

  const addItem = useCallback(
    async (draft) => {
      if (!canWrite) {
        setMessage('❌ Firebase non configuré ou camion manquant');
        return { ok: false };
      }

      const validation = validateMenuItemDraft(draft);
      if (!validation.ok) {
        const first = validation.errors?.[0] || '❌ Données invalides';
        setMessage(first);
        return { ok: false };
      }

      const built = buildMenuItemData({
        type: draft.type,
        name: draft.name,
        description: draft.description,
        priceS: draft.priceS,
        priceM: draft.priceM,
        priceL: draft.priceL,
        diameterS: draft.diameterS,
        diameterM: draft.diameterM,
        diameterL: draft.diameterL,
        drinkSizes: draft.drinkSizes,
        selectedDrinkSize: draft.selectedDrinkSize,
      });

      if (!built.ok) {
        setMessage(`❌ ${built.error || 'Données invalides'}`);
        return { ok: false };
      }

      setSaving(true);
      setMessage('');

      try {
        const menuRef = ref(db, rtdbPaths.truckMenuItems(truckId));
        const newItemRef = push(menuRef);
        await set(newItemRef, built.itemData);
        setMessage('✅ Article ajouté avec succès !');
        return { ok: true, id: newItemRef.key };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        devError('[usePizzaioloMenuEditor] addItem error:', err);
        setMessage('❌ Erreur lors de la sauvegarde. Réessayez.');
        return { ok: false };
      } finally {
        setSaving(false);
      }
    },
    [canWrite, truckId]
  );

  const deleteItem = useCallback(
    async (itemId) => {
      if (!canWrite) {
        setMessage('❌ Firebase non configuré ou camion manquant');
        return { ok: false };
      }
      if (!itemId) return { ok: false };

      try {
        await remove(ref(db, `${rtdbPaths.truckMenuItems(truckId)}/${itemId}`));
        setMessage('✅ Article supprimé');
        return { ok: true };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        devError('[usePizzaioloMenuEditor] deleteItem error:', err);
        setMessage('❌ Erreur suppression');
        return { ok: false };
      }
    },
    [canWrite, truckId]
  );

  const setItemAvailability = useCallback(
    async (itemId, available) => {
      if (!canWrite) {
        setMessage('❌ Firebase non configuré ou camion manquant');
        return { ok: false };
      }
      if (!itemId) return { ok: false };

      const nextAvailable = available === true;

      try {
        await update(ref(db, `${rtdbPaths.truckMenuItems(truckId)}/${itemId}`), {
          available: nextAvailable,
        });
        setMessage(nextAvailable ? '✅ Article remis en vente' : '⏸️ Article mis en pause');
        return { ok: true };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        devError('[usePizzaioloMenuEditor] setItemAvailability error:', err);
        setMessage('❌ Erreur lors de la mise à jour');
        return { ok: false };
      }
    },
    [canWrite, truckId]
  );

  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const typeWeight = (t) => {
      switch (String(t || '').toLowerCase()) {
        case 'pizza':
          return 10;
        case 'calzone':
          return 20;
        case 'eau':
          return 30;
        case 'soda':
          return 40;
        case 'biere':
          return 50;
        case 'vin':
          return 60;
        case 'dessert':
          return 70;
        default:
          return 999;
      }
    };

    const isAvailable = (it) => it?.available !== false;

    return [...items].sort((a, b) => {
      // Actifs avant pausés
      const avA = isAvailable(a);
      const avB = isAvailable(b);
      if (avA !== avB) return avA ? -1 : 1;

      // Regroupement/ordre métier
      const wa = typeWeight(a?.type);
      const wb = typeWeight(b?.type);
      if (wa !== wb) return wa - wb;

      // Nom
      const na = String(a?.name || '');
      const nb = String(b?.name || '');
      const byName = na.localeCompare(nb, 'fr', { sensitivity: 'base' });
      if (byName !== 0) return byName;

      // Fallback stable
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  }, [items]);

  return {
    items: sortedItems,
    loading,
    error,
    saving,
    message,
    setMessage,
    addItem,
    deleteItem,
    setItemAvailability,
  };
}
