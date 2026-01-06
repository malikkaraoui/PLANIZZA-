import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants/menuConfig';
import { 
  generateCartItemId, 
  generateCartItemName, 
  findCartItem
} from '../utils/menuHelpers';
import { getItemPrice, calculateTotalCents } from '../utils/priceCalculations';

/**
 * Hook pour gérer le panier en mode "Live" (pizzaiolo)
 * Version simplifiée sans sync Firebase automatique (géré par useLiveOrder)
 */
export const useLiveCart = () => {
  const [cart, setCart] = useState(() => {
    // Initialiser depuis localStorage au premier render
    try {
      const savedCart = localStorage.getItem(STORAGE_KEYS.LIVE_CART);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('[useLiveCart] Erreur restauration cart:', err);
    }
    return [];
  });

  const [customerName, setCustomerName] = useState(() => {
    // Initialiser depuis localStorage au premier render
    try {
      const savedCustomer = localStorage.getItem(STORAGE_KEYS.LIVE_CUSTOMER);
      if (savedCustomer) {
        return savedCustomer;
      }
    } catch (err) {
      console.error('[useLiveCart] Erreur restauration customer:', err);
    }
    return '';
  });

  const [pickupTime, setPickupTime] = useState(() => {
    // Initialiser depuis localStorage au premier render
    try {
      const savedPickupTime = localStorage.getItem(STORAGE_KEYS.LIVE_PICKUP_TIME);
      if (savedPickupTime) {
        return savedPickupTime;
      }
    } catch (err) {
      console.error('[useLiveCart] Erreur restauration pickupTime:', err);
    }
    return '';
  });

  /**
   * Sauvegarde automatique dans localStorage
   */
  useEffect(() => {
    try {
      if (cart.length > 0 || customerName || pickupTime) {
        localStorage.setItem(STORAGE_KEYS.LIVE_CART, JSON.stringify(cart));
        localStorage.setItem(STORAGE_KEYS.LIVE_CUSTOMER, customerName);
        localStorage.setItem(STORAGE_KEYS.LIVE_PICKUP_TIME, pickupTime);
      }
    } catch (err) {
      console.error('[useLiveCart] Erreur sauvegarde localStorage:', err);
    }
  }, [cart, customerName, pickupTime]);

  /**
   * Ajoute un item au panier
   * @param {Object} item - Item du menu
   * @param {string} size - Taille (optionnelle)
   * @param {Object} customization - Personnalisation (optionnelle)
   */
  const addToCart = useCallback((item, size = null, customization = null) => {
    if (!item) return;

    const priceCents = getItemPrice(item, size);
    if (!priceCents) {
      console.error('[useLiveCart] Prix manquant pour', item);
      return;
    }

    const cartItemId = generateCartItemId(item, size);
    const cartItemName = generateCartItemName(item, size, customization);

    setCart(currentCart => {
      const found = findCartItem(currentCart, cartItemId);

      if (found) {
        // Item existe déjà, incrémenter la quantité
        const newCart = [...currentCart];
        newCart[found.index].qty += 1;
        return newCart;
      } else {
        // Nouvel item
        return [
          ...currentCart,
          {
            id: cartItemId,
            name: cartItemName,
            priceCents,
            qty: 1
          }
        ];
      }
    });
  }, []);

  /**
   * Retire 1 quantité d'un item (ou le supprime si qty = 1)
   * @param {string} itemId - ID de l'item dans le panier
   */
  const removeFromCart = useCallback((itemId) => {
    setCart(currentCart => {
      const found = findCartItem(currentCart, itemId);

      if (!found) return currentCart;

      const newCart = [...currentCart];

      if (newCart[found.index].qty > 1) {
        newCart[found.index].qty -= 1;
      } else {
        newCart.splice(found.index, 1);
      }

      return newCart;
    });
  }, []);

  /**
   * Supprime complètement un item du panier
   * @param {string} itemId - ID de l'item dans le panier
   */
  const deleteFromCart = useCallback((itemId) => {
    setCart(currentCart => currentCart.filter(item => item.id !== itemId));
  }, []);

  /**
   * Vide complètement le panier et le localStorage
   */
  const clearCart = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setPickupTime('');
    
    try {
      localStorage.removeItem(STORAGE_KEYS.LIVE_CART);
      localStorage.removeItem(STORAGE_KEYS.LIVE_CUSTOMER);
      localStorage.removeItem(STORAGE_KEYS.LIVE_PICKUP_TIME);
    } catch (err) {
      console.error('[useLiveCart] Erreur nettoyage localStorage:', err);
    }
  }, []);

  /**
   * Calcule le total du panier
   */
  const totalCents = calculateTotalCents(cart);

  /**
   * Compte le nombre total d'items
   */
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return {
    cart,
    customerName,
    setCustomerName,
    pickupTime,
    setPickupTime,
    addToCart,
    removeFromCart,
    deleteFromCart,
    clearCart,
    totalCents,
    itemCount
  };
};
