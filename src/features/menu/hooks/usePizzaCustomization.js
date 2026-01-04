import { useState } from 'react';
import { extractIngredientsFromDescription } from '../utils/menuHelpers';

/**
 * Hook pour gérer la personnalisation d'une pizza
 * Gère l'ajout/retrait d'ingrédients
 */
export const usePizzaCustomization = () => {
  const [customizingPizza, setCustomizingPizza] = useState(null);

  /**
   * Démarre la personnalisation d'une pizza
   * @param {Object} item - Item pizza
   * @param {string} size - Taille choisie
   */
  const startCustomization = (item, size) => {
    if (!item || !size) return;

    const currentIngredients = extractIngredientsFromDescription(item.description);

    setCustomizingPizza({
      item,
      size,
      currentIngredients,
      removedIngredients: [],
      addedIngredients: []
    });
  };

  /**
   * Annule la personnalisation en cours
   */
  const cancelCustomization = () => {
    setCustomizingPizza(null);
  };

  /**
   * Toggle un ingrédient existant (le retirer ou le remettre)
   * @param {string} ingredient - Nom de l'ingrédient
   */
  const toggleRemoveIngredient = (ingredient) => {
    if (!customizingPizza) return;

    const isRemoved = customizingPizza.removedIngredients.includes(ingredient);

    setCustomizingPizza({
      ...customizingPizza,
      removedIngredients: isRemoved
        ? customizingPizza.removedIngredients.filter(i => i !== ingredient)
        : [...customizingPizza.removedIngredients, ingredient]
    });
  };

  /**
   * Toggle un ingrédient supplémentaire
   * @param {string} ingredient - Nom de l'ingrédient
   */
  const toggleAddIngredient = (ingredient) => {
    if (!customizingPizza) return;

    const isAdded = customizingPizza.addedIngredients.includes(ingredient);

    setCustomizingPizza({
      ...customizingPizza,
      addedIngredients: isAdded
        ? customizingPizza.addedIngredients.filter(i => i !== ingredient)
        : [...customizingPizza.addedIngredients, ingredient]
    });
  };

  /**
   * Retourne la personnalisation actuelle formatée
   * @returns {Object|null} {removedIngredients, addedIngredients}
   */
  const getCustomization = () => {
    if (!customizingPizza) return null;

    return {
      removedIngredients: customizingPizza.removedIngredients,
      addedIngredients: customizingPizza.addedIngredients
    };
  };

  return {
    customizingPizza,
    startCustomization,
    cancelCustomization,
    toggleRemoveIngredient,
    toggleAddIngredient,
    getCustomization
  };
};
