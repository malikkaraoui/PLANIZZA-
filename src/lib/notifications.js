import { toast } from 'react-toastify';

/**
 * Service de notifications centralisé pour Planizza
 * Toutes les notifications sont éphémères et disparaissent automatiquement
 */

const defaultOptions = {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export const notify = {
  // --- Commandes ---
  orderStatusChanged: (status, truckName) => {
    const messages = {
      pending: `Commande envoyée à ${truckName}`,
      confirmed: `${truckName} a confirmé votre commande !`,
      preparing: `${truckName} prépare votre pizza...`,
      ready: `Votre commande est prête ! Rendez-vous chez ${truckName}`,
      completed: `Bon appétit ! Merci d'avoir commandé chez ${truckName}`,
      cancelled: `Commande annulée`,
    };
    const type = status === 'cancelled' ? 'error' : status === 'ready' ? 'success' : 'info';
    toast[type](messages[status] || `Statut: ${status}`, defaultOptions);
  },

  // --- Avis ---
  reviewReminder: (truckName) => {
    toast.info(`Vous avez aimé ${truckName} ? Laissez un avis !`, {
      ...defaultOptions,
      autoClose: 6000,
      icon: '⭐',
    });
  },

  reviewSubmitted: () => {
    toast.success('Merci pour votre avis !', defaultOptions);
  },

  // --- Favoris ---
  favoriteAdded: (truckName) => {
    toast.success(`${truckName} ajouté aux favoris`, {
      ...defaultOptions,
      autoClose: 2500,
      icon: '❤️',
    });
  },

  favoriteRemoved: (truckName) => {
    toast.info(`${truckName} retiré des favoris`, {
      ...defaultOptions,
      autoClose: 2500,
    });
  },

  // --- Camions ---
  truckNearbyOpening: (truckName) => {
    toast.info(`${truckName} ouvre près de chez vous !`, {
      ...defaultOptions,
      autoClose: 8000,
      icon: '🍕',
    });
  },

  truckClosingSoon: (truckName, minutes = 30) => {
    toast.warning(`${truckName} ferme dans ${minutes} min ! Vite, commandez !`, {
      ...defaultOptions,
      autoClose: 6000,
      icon: '⏰',
    });
  },

  truckPaused: (truckName) => {
    toast.warning(`${truckName} est en pause. Votre commande pourrait être retardée.`, {
      ...defaultOptions,
      icon: '☕',
    });
  },

  truckHoursChanged: (truckName) => {
    toast.info(`${truckName} a modifié ses horaires d'ouverture`, {
      ...defaultOptions,
      icon: '🕐',
    });
  },

  truckNewProduct: (truckName, productName) => {
    toast.info(`Nouveau chez ${truckName} : ${productName} !`, {
      ...defaultOptions,
      autoClose: 5000,
      icon: '🆕',
    });
  },

  // --- Panier ---
  cartModified: (reason) => {
    toast.warning(reason || 'Votre panier a été modifié', {
      ...defaultOptions,
      icon: '🛒',
    });
  },

  itemAddedToCart: (itemName) => {
    toast.success(`${itemName} ajouté au panier`, {
      ...defaultOptions,
      autoClose: 2000,
    });
  },

  // --- Paiement ---
  paymentFailed: (reason) => {
    toast.error(reason || 'Paiement refusé. Veuillez réessayer.', {
      ...defaultOptions,
      autoClose: 6000,
    });
  },

  refundProcessed: (amount) => {
    toast.success(`Remboursement de ${amount}€ effectué`, {
      ...defaultOptions,
      icon: '💰',
    });
  },

  // --- Profil ---
  profileIncomplete: (missingFields) => {
    const fields = Array.isArray(missingFields) ? missingFields.join(', ') : missingFields;
    toast.info(`Complétez votre profil : ${fields}`, {
      ...defaultOptions,
      autoClose: 6000,
      icon: '👤',
    });
  },

  addressMissing: () => {
    toast.info('Renseignez votre adresse pour gagner du temps lors de vos commandes', {
      ...defaultOptions,
      autoClose: 6000,
      icon: '📍',
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PIZZAIOLO
// ═══════════════════════════════════════════════════════════════════════════

export const notifyPizzaiolo = {
  // --- Commandes ---
  newOrder: (customerName, total) => {
    toast.success(`Nouvelle commande de ${customerName} (${total}€)`, {
      ...defaultOptions,
      autoClose: 8000,
      icon: '🔔',
    });
  },

  // --- Avis ---
  newReview: (score, hasComment) => {
    const stars = '⭐'.repeat(score);
    const message = hasComment
      ? `Nouvel avis ${stars} avec commentaire`
      : `Nouvel avis ${stars}`;
    toast.info(message, {
      ...defaultOptions,
      autoClose: 5000,
    });
  },

  // --- Favoris ---
  newFavorite: () => {
    toast.success('Un client a ajouté votre camion en favoris !', {
      ...defaultOptions,
      icon: '❤️',
    });
  },

  // --- Stripe ---
  stripeStatusChanged: (status) => {
    const messages = {
      pending: 'Votre compte Stripe est en cours de vérification',
      active: 'Votre compte Stripe est maintenant actif !',
      restricted: 'Votre compte Stripe nécessite des informations supplémentaires',
      disabled: 'Votre compte Stripe a été désactivé',
    };
    const type = status === 'active' ? 'success' : status === 'disabled' ? 'error' : 'warning';
    toast[type](messages[status] || `Statut Stripe: ${status}`, defaultOptions);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS GÉNÉRIQUES
// ═══════════════════════════════════════════════════════════════════════════

export const toasts = {
  success: (message) => toast.success(message, defaultOptions),
  error: (message) => toast.error(message, defaultOptions),
  warning: (message) => toast.warning(message, defaultOptions),
  info: (message) => toast.info(message, defaultOptions),
};

export default notify;
