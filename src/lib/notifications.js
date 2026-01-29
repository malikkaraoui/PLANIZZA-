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
  pauseOnHover: false,
  draggable: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export const notify = {
  // --- Commandes ---
  orderStatusChanged: (status, truckName, orderId, navigate) => {
    const messages = {
      created: `Commande confirmée chez ${truckName}`,
      received: `📋 ${truckName} a reçu votre commande`,
      accepted: `👨‍🍳 ${truckName} prépare votre pizza...`,
      ready: `🍕 Votre commande est prête ! Venez la chercher`,
      delivered: `🤝 Commande remise ! N'hésitez pas à laisser un avis`,
      cancelled: `Commande annulée`,
    };
    const type = status === 'cancelled' ? 'error' : (status === 'ready' || status === 'delivered') ? 'success' : 'info';

    // Empêche les doublons (ex: double event / double listener) en réutilisant le même toastId.
    // Format stable: une notification par (commande, statut).
    const toastId = orderId ? `order-status:${orderId}:${status}` : undefined;

    let shownId;
    shownId = toast[type](messages[status] || `Statut: ${status}`, {
      ...defaultOptions,
      toastId,
      autoClose: 2000,
      onClick: () => {
        if (shownId) toast.dismiss(shownId);
        if (toastId) toast.dismiss(toastId);
        if (navigate && orderId) {
          navigate(`/order/${orderId}`);
        }
      },
    });
  },

  // --- Avis ---
  reviewReminder: (truckName) => {
    toast.info(`Vous avez aimé ${truckName} ? Laissez un avis !`, {
      ...defaultOptions,
      autoClose: 6000,
    });
  },

  reviewSubmitted: () => {
    toast.success('Merci pour votre avis !', defaultOptions);
  },

  // --- Favoris ---
  favoriteAdded: (truckName) => {
    toast.success(`❤️ ${truckName} ajouté à vos favoris`, {
      ...defaultOptions,
      autoClose: 2500,
    });
  },

  favoriteRemoved: (truckName) => {
    toast.info(`${truckName} retiré de vos favoris`, {
      ...defaultOptions,
      autoClose: 2500,
    });
  },

  // --- Camions ---
  truckNearbyOpening: (truckName) => {
    toast.info(`🍕 ${truckName} ouvre près de chez vous !`, {
      ...defaultOptions,
      autoClose: 8000,
    });
  },

  truckClosingSoon: (truckName, minutes = 30) => {
    toast.warning(`⏰ ${truckName} ferme dans ${minutes} min ! Vite, commandez !`, {
      ...defaultOptions,
      autoClose: 6000,
    });
  },

  truckPaused: (truckName) => {
    toast.warning(`☕ ${truckName} est en pause. Votre commande pourrait être retardée.`, {
      ...defaultOptions,
    });
  },

  truckHoursChanged: (truckName) => {
    toast.info(`🕐 ${truckName} a modifié ses horaires d'ouverture`, {
      ...defaultOptions,
    });
  },

  truckNewProduct: (truckName, productName) => {
    toast.info(`🆕 Nouveau chez ${truckName} : ${productName} !`, {
      ...defaultOptions,
      autoClose: 5000,
    });
  },

  // --- Panier ---
  cartModified: (reason) => {
    toast.warning(`🛒 ${reason || 'Votre panier a été modifié'}`, {
      ...defaultOptions,
      autoClose: 2000,
    });
  },

  itemAddedToCart: (itemName) => {
    toast.success(`${itemName} ajouté au panier`, {
      ...defaultOptions,
      autoClose: 2000,
      pauseOnHover: false,
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
    toast.success(`💰 Remboursement de ${amount}€ effectué`, {
      ...defaultOptions,
    });
  },

  // --- Profil ---
  profileIncomplete: (missingFields) => {
    const fields = Array.isArray(missingFields) ? missingFields.join(', ') : missingFields;
    toast.info(`👤 Complétez votre profil : ${fields}`, {
      ...defaultOptions,
      autoClose: 6000,
    });
  },

  addressMissing: () => {
    toast.info('📍 Renseignez votre adresse pour gagner du temps lors de vos commandes', {
      ...defaultOptions,
      autoClose: 6000,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PIZZAIOLO
// ═══════════════════════════════════════════════════════════════════════════

export const notifyPizzaiolo = {
  // --- Commandes ---
  newOrder: (customerName, total, orderId, navigate) => {
    toast.success(`🔔 Nouvelle commande de ${customerName} (${total}€)`, {
      ...defaultOptions,
      autoClose: 8000,
      onClick: () => {
        if (!navigate) return;
        // Route réelle côté app
        const target = orderId ? `/pro/commandes-v2?orderId=${encodeURIComponent(orderId)}` : '/pro/commandes-v2';
        navigate(target);
      },
    });
  },

  // --- Avis ---
  newReview: (score, hasComment, navigate) => {
    const stars = '⭐'.repeat(score);
    const message = hasComment
      ? `Nouvel avis ${stars} avec commentaire`
      : `Nouvel avis ${stars}`;
    let shownId;
    shownId = toast.info(message, {
      ...defaultOptions,
      autoClose: 5000,
      onClick: () => {
        if (shownId) toast.dismiss(shownId);
        if (navigate) navigate('/pro/avis');
      },
    });
  },

  // --- Favoris ---
  newFavorite: () => {
    toast.success('❤️ Un client a ajouté votre camion en favoris !', {
      ...defaultOptions,
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
