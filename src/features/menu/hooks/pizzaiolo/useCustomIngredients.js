import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../../../../lib/firebase';

const MAX_CUSTOM_INGREDIENTS = 50;

/**
 * Hook pour gérer les ingrédients personnalisés du pizzaiolo
 * Sauvegarde dans Firebase : pizzaiolos/{uid}/customIngredients
 */
export function useCustomIngredients(pizzaioloUid) {
  const [customBases, setCustomBases] = useState([]);
  const [customGarnitures, setCustomGarnitures] = useState([]);
  const [customFromages, setCustomFromages] = useState([]);
  const [loading, setLoading] = useState(!pizzaioloUid ? false : true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pizzaioloUid) {
      console.log('[useCustomIngredients] Pas de pizzaioloUid fourni');
      return;
    }

    console.log('[useCustomIngredients] Chargement pour uid:', pizzaioloUid);
    const customIngredientsRef = ref(db, `pizzaiolos/${pizzaioloUid}/customIngredients`);

    const unsubscribe = onValue(
      customIngredientsRef,
      (snapshot) => {
        const data = snapshot.val();
        setCustomBases(data?.bases || []);
        setCustomGarnitures(data?.garnitures || []);
        setCustomFromages(data?.fromages || []);
        setLoading(false);
      },
      (err) => {
        console.error('Erreur chargement ingrédients personnalisés:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [pizzaioloUid]);

  const getTotalCount = () => {
    return customBases.length + customGarnitures.length + customFromages.length;
  };

  const canAddMore = () => {
    return getTotalCount() < MAX_CUSTOM_INGREDIENTS;
  };

  const addCustomIngredient = async (ingredient) => {
    console.log('[addCustomIngredient] Appelé avec:', ingredient);
    
    if (!pizzaioloUid) {
      const error = 'Utilisateur non authentifié';
      console.error('[addCustomIngredient]', error);
      throw new Error(error);
    }

    if (!canAddMore()) {
      const error = `Maximum ${MAX_CUSTOM_INGREDIENTS} ingrédients personnalisés atteint`;
      console.error('[addCustomIngredient]', error);
      throw new Error(error);
    }

    const { type, name, emoji } = ingredient;
    const newIngredient = { name, emoji, id: Date.now().toString() };

    console.log('[addCustomIngredient] Nouvel ingrédient:', newIngredient);

    let updatedList;
    let pathKey;

    switch (type) {
      case 'base':
        updatedList = [...customBases, newIngredient];
        pathKey = 'bases';
        break;
      case 'garniture':
        updatedList = [...customGarnitures, newIngredient];
        pathKey = 'garnitures';
        break;
      case 'fromage':
        updatedList = [...customFromages, newIngredient];
        pathKey = 'fromages';
        break;
      default:
        throw new Error('Type ingrédient invalide');
    }

    console.log('[addCustomIngredient] Sauvegarde dans:', `pizzaiolos/${pizzaioloUid}/customIngredients/${pathKey}`);
    console.log('[addCustomIngredient] Liste mise à jour:', updatedList);

    const ingredientRef = ref(db, `pizzaiolos/${pizzaioloUid}/customIngredients/${pathKey}`);
    await set(ingredientRef, updatedList);
    
    console.log('[addCustomIngredient] Sauvegarde réussie !');
  };

  return {
    customBases,
    customGarnitures,
    customFromages,
    loading,
    error,
    getTotalCount,
    canAddMore,
    addCustomIngredient,
  };
}
