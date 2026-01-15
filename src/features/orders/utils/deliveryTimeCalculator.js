/**
 * Utilitaires pour les calculs de temps de livraison et tri des commandes
 */

import { coalesceMs } from '../../../lib/timestamps';

/**
 * Calcule l'heure de livraison prévue pour une commande
 * 
 * @param {Object} order - Données de la commande
 * @param {string} order.pickupTime - Heure de retrait prévue (format HH:MM) pour commandes manuelles
 * @param {Object} order.timeline - Timeline de la commande {acceptedAt, createdAt, ...}
 * @param {Array} order.items - Liste des items {qty, ...}
 * @param {number} pizzaPerHour - Cadence du pizzaiolo (pizzas/heure)
 * @returns {number} Timestamp de l'heure de livraison prévue (ms)
 */
export function getEstimatedDeliveryTime(order, pizzaPerHour = 30) {
  console.log('[getEstimatedDeliveryTime]', {
    orderId: order.id,
    pickupTime: order.pickupTime,
    pizzaPerHour,
    status: order.status
  });

  // Sécurité : valeurs par défaut
  if (!order) {
    console.warn('[getEstimatedDeliveryTime] Order manquant');
    return Date.now();
  }

  // 1. Si commande manuelle avec pickupTime défini -> convertir en timestamp
  if (order.pickupTime && typeof order.pickupTime === 'string') {
    try {
      const today = new Date();
      const [hours, minutes] = order.pickupTime.split(':');
      const pickupDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        parseInt(hours, 10),
        parseInt(minutes, 10)
      );
      
      const timestamp = pickupDate.getTime();
      console.log('[getEstimatedDeliveryTime] Manuel avec pickupTime:', {
        pickupTime: order.pickupTime,
        timestamp,
        formatted: pickupDate.toLocaleTimeString('fr-FR')
      });
      
      return timestamp;
    } catch (error) {
      console.error('[getEstimatedDeliveryTime] Erreur parsing pickupTime', error);
      // Fallback sur calcul automatique
    }
  }

  // 2. Sinon, calculer basé sur cadence + temps de préparation
  const totalPizzas = order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 1;
  const minutesPerPizza = 60 / pizzaPerHour;
  const estimatedMs = totalPizzas * minutesPerPizza * 60 * 1000;
  
  // Point de départ : acceptedAt si prise en charge, sinon createdAt
  const startTime =
    coalesceMs(order.timeline?.acceptedAt, order.createdAt, order.createdAtClient) || Date.now();
  const estimatedDeliveryTime = startTime + estimatedMs;
  
  console.log('[getEstimatedDeliveryTime] Calculé:', {
    totalPizzas,
    minutesPerPizza: minutesPerPizza.toFixed(2),
    estimatedMs: (estimatedMs / 1000 / 60).toFixed(2) + 'min',
    startTime: new Date(startTime).toLocaleTimeString('fr-FR'),
    estimatedDeliveryTime: new Date(estimatedDeliveryTime).toLocaleTimeString('fr-FR')
  });

  return estimatedDeliveryTime;
}

/**
 * Formate un timestamp en heure HH:MM
 * 
 * @param {number} timestamp - Timestamp en ms
 * @returns {string} Heure formatée (HH:MM)
 */
export function formatDeliveryTime(timestamp) {
  if (!timestamp || typeof timestamp !== 'number') {
    console.warn('[formatDeliveryTime] Timestamp invalide:', timestamp);
    return '--:--';
  }

  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('[formatDeliveryTime] Erreur formatage:', error);
    return '--:--';
  }
}

/**
 * Trie les commandes par ordre chronologique de livraison prévue
 * 
 * @param {Array} orders - Liste des commandes
 * @param {number} pizzaPerHour - Cadence du pizzaiolo
 * @returns {Array} Commandes triées par heure de livraison croissante
 */
export function sortOrdersByDeliveryTime(orders, pizzaPerHour = 30) {
  if (!Array.isArray(orders)) {
    console.warn('[sortOrdersByDeliveryTime] orders n\'est pas un array:', orders);
    return [];
  }

  console.log('[sortOrdersByDeliveryTime] Tri de', orders.length, 'commandes');

  const sorted = [...orders].sort((a, b) => {
    const timeA = getEstimatedDeliveryTime(a, pizzaPerHour);
    const timeB = getEstimatedDeliveryTime(b, pizzaPerHour);
    return timeA - timeB; // Ordre chronologique croissant
  });

  console.log('[sortOrdersByDeliveryTime] Résultat tri:', sorted.map(o => ({
    id: o.id,
    time: formatDeliveryTime(getEstimatedDeliveryTime(o, pizzaPerHour))
  })));

  return sorted;
}

/**
 * Sépare les commandes en groupes selon leur statut et paiement
 * 
 * @param {Array} orders - Liste des commandes actives
 * @returns {Object} Groupes de commandes {notAcceptedPaid, notAcceptedUnpaid, acceptedPaid, acceptedUnpaid}
 */
export function groupOrdersByStatus(orders) {
  if (!Array.isArray(orders)) {
    console.warn('[groupOrdersByStatus] orders n\'est pas un array:', orders);
    return {
      notAcceptedPaid: [],
      notAcceptedUnpaid: [],
      acceptedPaid: [],
      acceptedUnpaid: []
    };
  }

  const isPaid = (o) => o?.payment?.paymentStatus === 'paid' || o?.v2?.paymentStatus === 'PAID';

  const groups = {
    notAcceptedPaid: orders.filter((o) => o.status === 'received' && isPaid(o)),
    notAcceptedUnpaid: orders.filter((o) => o.status === 'received' && !isPaid(o)),
    acceptedPaid: orders.filter((o) => o.status === 'accepted' && isPaid(o)),
    acceptedUnpaid: orders.filter((o) => o.status === 'accepted' && !isPaid(o))
  };

  console.log('[groupOrdersByStatus] Groupes:', {
    notAcceptedPaid: groups.notAcceptedPaid.length,
    notAcceptedUnpaid: groups.notAcceptedUnpaid.length,
    acceptedPaid: groups.acceptedPaid.length,
    acceptedUnpaid: groups.acceptedUnpaid.length,
    total: orders.length
  });

  // Vérification d'intégrité
  const totalGrouped = groups.notAcceptedPaid.length + groups.notAcceptedUnpaid.length + groups.acceptedPaid.length + groups.acceptedUnpaid.length;
  if (totalGrouped !== orders.length) {
    console.error('[groupOrdersByStatus] ERREUR: Perte de commandes!', {
      original: orders.length,
      grouped: totalGrouped,
      diff: orders.length - totalGrouped
    });
  }

  return groups;
}
