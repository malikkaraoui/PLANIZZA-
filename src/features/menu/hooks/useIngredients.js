import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { ALL_INGREDIENTS } from '../constants/ingredients';

const asStringList = (value) => {
  if (!value) return null;

  // RTDB peut renvoyer un tableau (stocké comme objet) ou un objet de {key: name}
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  }

  if (typeof value === 'object') {
    return Object.values(value)
      .filter((v) => typeof v === 'string' && v.trim())
      .map((v) => v.trim());
  }

  return null;
};

/**
 * Ingrédients pour la personnalisation pizza.
 *
 * Si `menus/{truckId}/ingredients` existe dans RTDB, on l'utilise.
 * Sinon on fallback sur la liste locale `ALL_INGREDIENTS`.
 */
export function useIngredients(truckId) {
  const enabled = Boolean(truckId && isFirebaseConfigured && db);

  const [ingredients, setIngredients] = useState(ALL_INGREDIENTS);

  useEffect(() => {
    if (!enabled) return;

    const ingredientsRef = ref(db, rtdbPaths.truckIngredients(truckId));

    const unsub = onValue(
      ingredientsRef,
      (snap) => {
        if (!snap.exists()) {
          setIngredients(ALL_INGREDIENTS);
          return;
        }

        const parsed = asStringList(snap.val());
        if (parsed && parsed.length > 0) {
          // dédoublonner + trier
          const uniq = Array.from(new Set(parsed));
          uniq.sort((a, b) => a.localeCompare(b, 'fr'));
          setIngredients(uniq);
        } else {
          setIngredients(ALL_INGREDIENTS);
        }
      },
      (err) => {
        console.error('[useIngredients] RTDB error:', err);
        setIngredients(ALL_INGREDIENTS);
      },
    );

    return () => unsub();
  }, [enabled, truckId]);

  return {
    ingredients,
  };
}
