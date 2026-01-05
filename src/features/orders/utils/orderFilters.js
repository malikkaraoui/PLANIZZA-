/**
 * Logique commune de filtrage des commandes
 * Partagée entre Orders.jsx et Stats.jsx
 */

// Durée max avant de considérer une commande comme perdue (120 min après prise en charge)
export const MAX_ORDER_DURATION = 120 * 60 * 1000;

/**
 * Vérifie si une commande est expirée (perdue)
 */
export const isExpired = (order) => {
  if (!order.timeline?.acceptedAt) return false;
  if (['delivered', 'cancelled'].includes(order.status)) return false;
  return Date.now() - order.timeline.acceptedAt > MAX_ORDER_DURATION;
};

/**
 * Filtre les commandes selon les critères (statut, paiement, période)
 * @param {Array} ordersList - Liste des commandes à filtrer
 * @param {Object} filters - Objet de filtres { status, payment, period }
 * @returns {Array} - Liste filtrée
 */
export const getFilteredOrders = (ordersList, filters) => {
  if (!ordersList || !Array.isArray(ordersList)) return [];
  
  return ordersList.filter((order) => {
    // Filtre statut
    if (filters.status === 'lost' && !isExpired(order)) return false;
    if (filters.status === 'delivered_pickup' && !(order.status === 'delivered' && order.deliveryMethod === 'pickup')) return false;
    if (filters.status === 'delivered_delivery' && !(order.status === 'delivered' && order.deliveryMethod === 'delivery')) return false;
    
    // Filtre paiement
    if (filters.payment === 'online' && order.payment?.provider !== 'stripe') return false;
    if (filters.payment === 'cash' && order.payment?.provider !== 'manual') return false;
    
    // Filtre période (si présent)
    if (filters.period) {
      const orderDate = new Date(order.createdAt);
      
      switch (filters.period) {
        case 'today': {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (orderDate < today) return false;
          break;
        }
        case 'week': {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (orderDate < weekAgo) return false;
          break;
        }
        case 'month': {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          if (orderDate < monthAgo) return false;
          break;
        }
        case 'year': {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          if (orderDate < yearAgo) return false;
          break;
        }
        default:
          break;
      }
    }
    
    return true;
  });
};
