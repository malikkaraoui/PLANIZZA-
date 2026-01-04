import { useCallback, useMemo, useState } from 'react';
import { push, ref, remove, set } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { devError } from '../../../lib/devLog';
import { useMenu } from './useMenu';
import { buildMenuItemData, validateMenuItemDraft } from '../utils';

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

  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => String(a?.type || '').localeCompare(String(b?.type || '')));
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
  };
}
