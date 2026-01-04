import { useState, useCallback } from 'react';

/**
 * Hook pour gérer l'état et les interactions d'un item du menu
 * Gère l'expansion, la sélection de taille, et le feedback visuel
 */
export const useMenuItem = () => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [flashingItemId, setFlashingItemId] = useState(null);

  /**
   * Toggle la sélection d'un item (pour afficher les tailles)
   * @param {Object} item - Item à toggle
   */
  const toggleItemSelection = useCallback((item) => {
    setSelectedItem(current => 
      current?.id === item?.id ? null : item
    );
  }, []);

  /**
   * Désélectionne l'item courant
   */
  const clearSelection = useCallback(() => {
    setSelectedItem(null);
  }, []);

  /**
   * Déclenche un flash visuel sur un item (feedback ajout au panier)
   * @param {string} itemId - ID de l'item
   * @param {number} duration - Durée du flash en ms (défaut: 500)
   */
  const flashItem = useCallback((itemId, duration = 500) => {
    setFlashingItemId(itemId);
    setTimeout(() => setFlashingItemId(null), duration);
  }, []);

  /**
   * Vérifie si un item est sélectionné
   * @param {string} itemId - ID de l'item
   * @returns {boolean}
   */
  const isItemSelected = useCallback((itemId) => {
    return selectedItem?.id === itemId;
  }, [selectedItem]);

  /**
   * Vérifie si un item est en train de flasher
   * @param {string} itemId - ID de l'item
   * @returns {boolean}
   */
  const isItemFlashing = useCallback((itemId) => {
    return flashingItemId === itemId;
  }, [flashingItemId]);

  return {
    selectedItem,
    flashingItemId,
    toggleItemSelection,
    clearSelection,
    flashItem,
    isItemSelected,
    isItemFlashing
  };
};
