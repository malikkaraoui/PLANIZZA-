import { TVA_RATE } from '../constants/menuConfig';

/**
 * Calcule le total HT d'un panier
 * @param {Array} cart - Tableau d'items avec priceCents et qty
 * @returns {number} Total en cents
 */
export const calculateTotalCents = (cart = []) => {
  return cart.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);
};

/**
 * Calcule la TVA
 * @param {number} totalCents - Total en cents
 * @param {number} tvaRate - Taux de TVA (défaut: TVA_RATE)
 * @returns {number} Montant TVA en cents
 */
export const calculateTVA = (totalCents, tvaRate = TVA_RATE) => {
  return totalCents * tvaRate;
};

/**
 * Calcule le total TTC
 * @param {number} totalCents - Total HT en cents
 * @param {number} tvaRate - Taux de TVA (défaut: TVA_RATE)
 * @returns {number} Total TTC en cents
 */
export const calculateTotalTTC = (totalCents, tvaRate = TVA_RATE) => {
  return totalCents * (1 + tvaRate);
};

/**
 * Formate un montant en cents vers une chaîne en euros
 * @param {number} cents - Montant en cents
 * @returns {string} Montant formaté (ex: "12.50€")
 */
export const formatPrice = (cents) => {
  return `${(cents / 100).toFixed(2)}€`;
};

/**
 * Calcule le prix d'un item en fonction de sa taille
 * @param {Object} item - Item du menu
 * @param {string} size - Taille sélectionnée (optionnelle)
 * @returns {number|null} Prix en cents ou null si non trouvé
 */
export const getItemPrice = (item, size = null) => {
  if (!item) return null;

  // Si une taille est spécifiée et existe
  if (size && item.sizes?.[size]?.priceCents) {
    return item.sizes[size].priceCents;
  }

  // Prix direct
  if (item.priceCents) {
    return item.priceCents;
  }

  // Fallback: si pas de taille spécifiée mais l'item a des sizes, prendre la première
  if (item.sizes && typeof item.sizes === 'object') {
    const firstSizeWithPrice = Object.values(item.sizes).find(s => s?.priceCents > 0);
    if (firstSizeWithPrice) return firstSizeWithPrice.priceCents;
  }

  return null;
};

/**
 * Obtient le prix d'affichage pour un item (pour l'aperçu)
 * Pour les pizzas, retourne le prix taille M par défaut, sinon la première taille disponible
 * @param {Object} item - Item du menu
 * @returns {number|null} Prix en cents ou null
 */
export const getDisplayPrice = (item) => {
  if (!item) return null;

  // Si l'item a des tailles
  if (item.sizes && typeof item.sizes === 'object') {
    // Pour les pizzas, préférer M > S > L
    if (item.type === 'pizza') {
      if (item.sizes.m?.priceCents) return item.sizes.m.priceCents;
      if (item.sizes.s?.priceCents) return item.sizes.s.priceCents;
      if (item.sizes.l?.priceCents) return item.sizes.l.priceCents;
    }

    // Pour les autres types, prendre la première taille avec un prix
    const firstSizeWithPrice = Object.values(item.sizes).find(size => size?.priceCents > 0);
    if (firstSizeWithPrice) return firstSizeWithPrice.priceCents;
  }

  // Sinon prix direct
  return item.priceCents || null;
};

/**
 * Vérifie si un item a un prix valide
 * @param {Object} item - Item du menu
 * @returns {boolean}
 */
export const hasValidPrice = (item) => {
  if (!item) return false;
  
  // Si l'item a des tailles
  if (item.sizes && typeof item.sizes === 'object') {
    return Object.values(item.sizes).some(size => size.priceCents > 0);
  }
  
  // Sinon vérifier le prix direct
  return item.priceCents > 0;
};
