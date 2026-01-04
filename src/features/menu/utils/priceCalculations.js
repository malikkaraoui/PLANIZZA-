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
  
  // Sinon, prix direct
  return item.priceCents || null;
};

/**
 * Obtient le prix d'affichage pour un item (pour l'aperçu)
 * Pour les pizzas, retourne le prix taille M par défaut
 * @param {Object} item - Item du menu
 * @returns {number|null} Prix en cents ou null
 */
export const getDisplayPrice = (item) => {
  if (!item) return null;
  
  // Pour les pizzas avec tailles, afficher le prix M
  if (item.type === 'pizza' && item.sizes?.m?.priceCents) {
    return item.sizes.m.priceCents;
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
